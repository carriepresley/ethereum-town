/**
 * Defense-in-depth headers for the read-only town.
 * Public read-only visualization; no cross-origin embedding is needed.
 * TanStack hydration currently needs inline bootstrap scripts; all data shown
 * by the town is React-escaped text or locally generated canvas content.
 */
export function applySecurityHeaders(response:Response):Response{
 const headers=new Headers(response.headers);
 headers.set('Content-Security-Policy',[
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
 ].join('; ')+';');
 headers.set('Strict-Transport-Security','max-age=63072000; includeSubDomains; preload');
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 headers.set('X-XSS-Protection','0');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
