import { describe, expect, test } from 'bun:test'
import { readFile, readdir } from 'node:fs/promises'
import { TELEMETRY_NETWORKS } from '../src/lib/l1/telemetry-loader.server'
import { BATCH_INBOXES, BRIDGE_REGISTRY, SETTLEMENT_REGISTRY } from '../src/lib/l1/bridges'

const source = (path: string) => readFile(new URL('../' + path, import.meta.url), 'utf8')
const origin = 'https://ethereum-town.example'

describe('public app security boundaries', () => {
  test('telemetry fetch destinations are fixed HTTPS endpoints without credentials or arbitrary ports', () => {
    const allowed = new Set(['ethereum-rpc.publicnode.com','mainnet.base.org','arb1.arbitrum.io','mainnet.optimism.io','api.cartridge.gg','mainnet.era.zksync.io','rpc.linea.build','rpc.mantle.xyz','rpc-gel.inkonchain.com','mainnet.unichain.org'])
    for (const network of TELEMETRY_NETWORKS) {
      const url = new URL(network.rpc)
      expect(url.protocol).toBe('https:')
      expect(url.username + url.password + url.port).toBe('')
      expect(allowed.has(url.hostname)).toBe(true)
    }
  })
  test('bridge discovery uses fixed Ethereum addresses, not user-supplied paths', () => {
    for (const address of [...BRIDGE_REGISTRY,...SETTLEMENT_REGISTRY].flatMap(e => e.addresses).concat(BATCH_INBOXES.flatMap(e => [e.address,e.sender]))) {
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })
  test('public feed handlers expose reads and do not accept a URL or query as input', async () => {
    for (const file of ['telemetry','bridges','activity','staking','finance-metrics']) {
      const code = await source('src/lib/l1/' + file + '.functions.ts')
      expect(code).toMatch(/method:\s*['"]GET['"]/)
      expect(code).not.toMatch(/inputValidator|\.validator\(|\{\s*data\s*\}|request\.url|searchParams/)
    }
  })
  test('unused generation UI is no longer a public route and observed values use escaped rendering', async () => {
    const app = await source('src/routes/app.tsx').catch(error => { if(error.code==='ENOENT') return ''; throw error })
    expect(app).not.toContain('CustomTemplate')
    if(app) expect(app).toContain('redirect')
    for (const file of ['src/routes/index.tsx','src/lib/l1/town-panels.tsx']) {
      const code = await source(file)
      expect(code).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=/)
    }
  })
  test('no environment files, private keys or source maps are intentionally published', async () => {
    const scan = async (path: URL): Promise<void> => {
      for (const item of await readdir(path, { withFileTypes: true })) {
        if (item.isDirectory()) await scan(new URL(item.name + '/', path))
        else expect(item.name).not.toMatch(/^(?:\.env|\.git)|\.(?:pem|key|map)$/i)
      }
    }
    await scan(new URL('../public/', import.meta.url))
  })
})

// Run against the freshly built Nitro SSR application with:
// TEST_BUILT_SECURITY=1 bun test tests/public-security.test.ts
// No HTTP request leaves this process; public-provider fetches are blocked.
const builtTest = process.env.TEST_BUILT_SECURITY === '1' ? test : test.skip
builtTest('built server rejects hostile methods and paths without disclosure or external redirects', async () => {
  const outputFiles = await readdir(new URL('../.output/server/', import.meta.url))
  const manifestFile = outputFiles.find(file => file.startsWith('__23tanstack-start-server-fn-resolver-') && file.endsWith('.mjs'))
  expect(manifestFile).toBeTruthy()
  const code = await source('.output/server/' + manifestFile)
  const manifest = [...code.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)_createServerFn_handler"/g)]
  expect(manifest.map(m => m[2]).sort()).toEqual(['getActivity','getBridges','getStaking','getTelemetry','getFinanceMetrics'].sort())
  const id = manifest.find(m => m[2] === 'getTelemetry')?.[1]
  expect(id).toBeTruthy()
  const bundleUrl = new URL('../.output/server/_ssr/ssr.mjs', import.meta.url).href
  const { default: worker } = await import(bundleUrl)
  const originalFetch = globalThis.fetch
  const originalError = console.error, originalWarn = console.warn
  const outbound: string[] = []
  globalThis.fetch = async (input) => { outbound.push(String(input)); throw new Error('Security test blocks outbound network') }
  console.error = () => {}; console.warn = () => {}
  try {
    const cases: Array<{path:string;method?:string;headers?:Record<string,string>;body?:string;status?:number}> = [
      {path:'/.env',status:404}, {path:'/.git/config',status:404},
      {path:'/%2e%2e/%2e%2e/etc/passwd',status:404}, {path:'/%2e%2e%2f.env',status:404},
      {path:'//attacker.invalid/'}, {path:'/app?redirect=https://attacker.invalid'},
      {path:'/_serverFn/no-such-function',headers:{'sec-fetch-site':'same-origin',origin}},
      {path:'/_serverFn/'+id+'?payload=%7B',headers:{'sec-fetch-site':'same-origin',origin}},
      {path:'/_serverFn/'+id,method:'POST',headers:{origin:'https://attacker.invalid','sec-fetch-site':'cross-site','content-type':'application/json'},body:'{}',status:405},
      {path:'/_serverFn/'+id,method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}',status:405},
      {path:'/?q='+ 'x'.repeat(8300),status:414},
    ]
    for (const entry of cases) {
      const response: Response = await worker.fetch(new Request(origin+entry.path,{method:entry.method??'GET',headers:entry.headers,body:entry.body}),{}, {})
      if (entry.status) expect(response.status).toBe(entry.status)
      if (entry.path.includes('no-such-function') || entry.path.includes('payload=%7B')) expect(response.status).toBeGreaterThanOrEqual(400)
      const location=response.headers.get('location')
      if(location) expect(new URL(location,origin).origin).toBe(origin)
      if(entry.path.startsWith('/app')) { if(location) expect(new URL(location,origin).pathname).toBe('/'); else expect(response.status).toBe(404) }
      const body=await response.text()
      expect(body).not.toMatch(/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|root:x:0:0|file:\/\/\/home\/|at [\w.$]+ \(\/home\//)
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('content-security-policy')).toContain("object-src 'none'")
    }
    expect(outbound).toEqual([])
  } finally {
    globalThis.fetch=originalFetch
    console.error=originalError; console.warn=originalWarn
  }
})
