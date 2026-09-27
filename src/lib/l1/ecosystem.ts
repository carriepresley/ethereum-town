/** Conceptual categories, not measured buildings, balances or packet routes. */
export type EcosystemPlace = {
  id: 'stablecoins' | 'defi' | 'tokenized-assets' | 'liquid-staking' | 'data-availability' | 'app-rollups'
  name: string
  description: string
  examples: string
  sourceUrl: string
  sourceLabel: string
  scopeNote: string
}
export const ECOSYSTEM_PLACES: EcosystemPlace[] = [
  {id:'stablecoins',name:'Stablecoins',description:'Tokens designed to track a currency or another reference asset move through payments, exchanges and lending. Their backing, redemption rights and risks depend on the issuer or protocol.',examples:'Examples: USDC, USDT and USDS.',sourceUrl:'https://ethereum.org/stablecoins/',sourceLabel:'Ethereum stablecoin guide',scopeNote:'A conceptual category across networks. No supply, reserves or payment flows are measured here.'},
  {id:'defi',name:'DeFi markets',description:'Smart contracts support token trading, lending and borrowing on Ethereum and its L2s. Different applications have their own rules, collateral requirements and risks.',examples:'Examples: decentralized exchanges and lending markets.',sourceUrl:'https://ethereum.org/defi/',sourceLabel:'Ethereum DeFi guide',scopeNote:'Applications can operate on several networks. This landmark does not imply a deployment on every neighborhood.'},
  {id:'tokenized-assets',name:'Tokenized assets',description:'Fund shares, bonds and other claims can be represented by tokens. Issuers, custodians, eligibility rules and legal rights still matter alongside the blockchain record.',examples:'Selected documented products in the outer district: BUIDL and BENJI.',sourceUrl:'https://institutions.ethereum.org/rwa',sourceLabel:'Ethereum institutional asset guide',scopeNote:'Tokenization does not move every underlying asset or legal obligation onchain. Product paths are documented relationships, not measured money flows.'},
  {id:'liquid-staking',name:'Liquid staking',description:'Some staking services issue tokens that represent a position in staked ETH. Those tokens can be used in other applications while the underlying validators participate in Ethereum consensus.',examples:'Examples include stETH and rETH.',sourceUrl:'https://ethereum.org/staking/pools/',sourceLabel:'Ethereum pooled staking guide',scopeNote:'Separate from native consensus staking. Receipt tokens add service and smart-contract risks; they are not an additional amount of ETH securing Ethereum.'},
  {id:'data-availability',name:'Data availability',description:'Rollups publish data that lets others reconstruct their state. Ethereum blobs provide temporary data space for rollup batches; execution and proof verification are separate jobs.',examples:'Ethereum blobs and calldata.',sourceUrl:'https://ethereum.org/roadmap/danksharding/',sourceLabel:'Ethereum blob and scaling guide',scopeNote:'A shared infrastructure role, not an asset bridge. Only the separately labeled feed represents observed submissions.'},
  {id:'app-rollups',name:'Application rollups',description:'Some rollups specialize in one application instead of hosting a general-purpose neighborhood. Lighter is an example focused on trading, with proofs and data connected to Ethereum.',examples:'Lighter is one selected example; its activity is not included in the live neighborhood totals.',sourceUrl:'https://assets.lighter.xyz/whitepaper.pdf',sourceLabel:'Lighter protocol whitepaper',scopeNote:'Illustrates a category missing from a general-purpose L2 map. This landmark has no live transaction metric or measured packet route.'},
]
export const ECOSYSTEM_SCOPE = 'A selected map of Ethereum networks, financial products and application categories. It is not a complete inventory of Ethereum, the onchain economy or the global financial system.'
export const ECOSYSTEM_REVIEWED_AT = '2026-09-27'
