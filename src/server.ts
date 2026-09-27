import {applySecurityHeaders} from './lib/security-headers.server';
import {renderErrorPage} from './lib/error-page';
export default {
 async fetch(request:Request,env:unknown,ctx:unknown){
  if(!['GET','HEAD'].includes(request.method))return applySecurityHeaders(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','Content-Type':'text/plain; charset=utf-8'}}));
  if(request.url.length>8192)return applySecurityHeaders(new Response('Request URL too long',{status:414}));
  try{
   const entry=await import('@tanstack/react-start/server-entry');
   const response=await entry.default.fetch(request);
   if(response.status>=500)return applySecurityHeaders(new Response(renderErrorPage(),{status:500,headers:{'Content-Type':'text/html; charset=utf-8'}}));
   return applySecurityHeaders(response);
  }catch{console.error('Ethereum Town request failed');return applySecurityHeaders(new Response(renderErrorPage(),{status:500,headers:{'Content-Type':'text/html; charset=utf-8'}}))}
 }
};
