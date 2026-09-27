import {createServerFn} from '@tanstack/react-start'
import {getRequest,setResponseHeader} from '@tanstack/react-start/server'
import {loadTelemetry,TELEMETRY_NETWORKS} from './telemetry-loader.server'
import {isTelemetryFresh,type TelemetrySnapshot} from './telemetry'
import {publicFeedCache} from './public-feed-cache.server'

export const getTelemetry=createServerFn({method:'GET'}).handler(async():Promise<TelemetrySnapshot>=>{
  setResponseHeader('Cache-Control','no-store, max-age=0')
  return publicFeedCache({
    requestUrl:getRequest().url,key:'telemetry-10-networks',ttlSeconds:12,load:()=>loadTelemetry(),
    timestamp:value=>value.polledAt,
    cacheable:value=>value.chains.length===TELEMETRY_NETWORKS.length&&value.chains.every(row=>isTelemetryFresh(row)),
  })
})
