import {expect,test} from 'bun:test';
import {applySecurityHeaders} from '../src/lib/security-headers.server';
test('restricts active content and preserves status, body and existing headers',async()=>{
 const response=applySecurityHeaders(new Response('ok',{status:201,headers:{'Cache-Control':'no-store'}}));
 expect(response.status).toBe(201);expect(await response.text()).toBe('ok');expect(response.headers.get('Cache-Control')).toBe('no-store');
 const csp=response.headers.get('content-security-policy')!;
 for(const rule of ["connect-src 'self'","object-src 'none'","frame-src 'none'","frame-ancestors 'self'","base-uri 'none'","form-action 'none'"])expect(csp).toContain(rule);
 expect(csp).not.toContain('unsafe-eval');expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
});
