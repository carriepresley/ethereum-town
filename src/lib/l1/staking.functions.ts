import {createServerFn} from '@tanstack/react-start'
import {getRequest,setResponseHeader} from '@tanstack/react-start/server'
import {STAKING_SNAPSHOT,type StakingSnapshot} from './staking'
import {loadStaking} from './staking-loader.server'
import {publicFeedCache} from './public-feed-cache.server'

export const getStaking=createServerFn({method:'GET'}).handler(async():Promise<StakingSnapshot>=>{
  setResponseHeader('Cache-Control','no-store, max-age=0')
  try{
    return await publicFeedCache<StakingSnapshot>({
      requestUrl:getRequest().url,key:'reported-staking',ttlSeconds:900,load:()=>loadStaking(),
      timestamp:value=>value.capturedAt,
      cacheable:value=>!value.warning&&Number.isSafeInteger(value.reportedStakedEth)&&value.reportedStakedEth>0,
    })
  }catch{return {...STAKING_SNAPSHOT,warning:'Staking source unavailable. Showing the last captured source figure.'}}
})
