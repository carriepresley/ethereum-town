import {createServerFn} from '@tanstack/react-start';
import {SNAPSHOT,type Snapshot} from './data';
import {loadEthereumActivity} from './loader.server';
export const getActivity=createServerFn({method:'GET'}).handler(async():Promise<Snapshot>=>{
try{
const bounded:typeof fetch=(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(12000),cf:{cacheTtl:900,cacheEverything:true}} as RequestInit);
const live=await loadEthereumActivity(bounded);
if(!live.periodVerified||!live.dateUtc)throw new Error('Provider period could not be verified.');
return {provider:live.provider,sourceUrl:live.sourceUrl,capturedAt:live.capturedAt,dateUtc:live.dateUtc,periodVerified:true,chains:SNAPSHOT.chains.map(c=>{const row=live.chains.find((r:{slug:string})=>r.slug===c.id);if(!row)throw new Error('Incomplete source');return {...c,transactions:row.transactionCount,notes:row.notes||c.notes}})};
}catch{return {...SNAPSHOT,warning:'Live source could not be verified. Showing the dated, verified snapshot.'};}
});
