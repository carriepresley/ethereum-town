import {createServerFn} from '@tanstack/react-start'
import {getRequest,setResponseHeader} from '@tanstack/react-start/server'
import {loadBridgeSnapshot} from './bridges-loader.server'
import {publicFeedCache} from './public-feed-cache.server'

export const getBridges=createServerFn({method:'GET'}).handler(async()=>{
  setResponseHeader('Cache-Control','no-store, max-age=0')
  return publicFeedCache({
    requestUrl:getRequest().url,key:'selected-bridges',ttlSeconds:12,load:()=>loadBridgeSnapshot(),
    timestamp:value=>value.fetchedAt,
    cacheable:value=>value.status!=='unavailable'&&value.toBlock!==null&&value.observedThrough!==null
      &&Date.now()-Date.parse(value.observedThrough)>=0&&Date.now()-Date.parse(value.observedThrough)<180_000,
  })
})
