"""How data.js (the embedded snapshot) was generated on Sep 28, 2026.

Needs the raw snapshot files it reads below (L2BEAT summary and activity, Blobscan blob transactions,
validatorqueue.com history, sampled mainnet blocks). They are not included in this repository; put them
in a folder and point SNAPSHOT_DIR at it. The live site does not need this script: /api/town and
/api/pulse fetch fresh numbers at runtime.
"""
import json, os, datetime, statistics
S=os.environ.get("SNAPSHOT_DIR","snapshot/").rstrip("/")+"/"
L=lambda f: json.load(open(S+f))
summary=L("l2beat_summary.json")["projects"]
acts=L("l2beat_activity_projects.json")
sender_map=L("sender_map.json")
replay=L("replay_blocks.json")
vq=L("vq_history.json")
agg=L("l2beat_activity_max.json")["data"]["chart"]["data"]

SHOPS=[("lighter","Lighter","#343A46"),("rise","RISE","#F28C28"),("base","Base","#1A5CFF"),("robinhood","Robinhood Chain","#A8D81B"),
("fuel","Fuel","#19C37D"),("polygon-pos","Polygon PoS","#8247E5"),("megaeth","MegaETH","#E0457B"),("optimism","OP Mainnet","#FF2A3A"),
("arbitrum","Arbitrum One","#2BB3F3"),("xlayer","X Layer","#8A93A6"),("celo","Celo","#E9DF3A"),("worldchain","World Chain","#E8E8E8"),
("unichain","Unichain","#F50DB4"),("ink","Ink","#7132F5")]
# blobscan rollup name -> key
BS={"base":"base","arbitrum":"arbitrum","world":"worldchain","optimism":"optimism","unichain":"unichain"}
for addr,keys in sender_map.items():
    if keys and len(keys)==1:
        k=keys[0]; BS["addr:"+addr]={"zksync2":"zksync"}.get(k,k)
NICE={"soneium":"Soneium","katana":"Katana","metal":"Metal L2","hemi":"Hemi","blast":"Blast","mantle":"Mantle","starknet":"Starknet","taiko":"Taiko",
"shape":"Shape","codex":"Codex","morph":"Morph","pegglecoin":"Pegglecoin","mode":"Mode","metis":"Metis","boba":"Boba","zora":"Zora","superseed":"Superseed",
"bob":"BOB","phala":"Phala","linea":"Linea","scroll":"Scroll","settlus":"Settlus","debankchain":"DeBank Chain","r0ar":"r0ar","abstract":"Abstract",
"hashkey":"HashKey Chain","zksync":"ZKsync Era","zircuit":"Zircuit","forknet":"Forknet","lighter":"Lighter","robinhood":"Robinhood Chain","xlayer":"X Layer","ink":"Ink"}
shopkeys={k for k,_,_ in SHOPS}
def key_of(ro, frm):
    if ro: 
        k=BS.get(ro, ro)
        return k
    k=BS.get("addr:"+frm.lower())
    return k if k else "other"

# ---- blob shares: prefer 7d
bfile="blob_txs_7d.json" if os.path.exists(S+"blob_txs_7d.json") else "blob_txs_1d.json"
brows=L(bfile); days=7 if "7d" in bfile else 1
from collections import defaultdict
per=defaultdict(int)
for bn,ts,ro,cat,nb,fr in brows: per[key_of(ro,fr)]+=nb
tot=sum(per.values())
blobShares=[{"key":k,"name":dict((a,b) for a,b,_ in SHOPS).get(k, NICE.get(k,k.title() if k!="other" else "Unlabeled")),"perDay":round(v/days),"share":round(v/tot,4)} for k,v in sorted(per.items(), key=lambda x:-x[1])]
print("blob source", bfile, "total/day", round(tot/days)); print(blobShares[:14])

# ---- replay posters from 1d data (covers replay window)
b1=L("blob_txs_1d.json")
byblock=defaultdict(lambda: defaultdict(int))
for bn,ts,ro,cat,nb,fr in b1: byblock[bn][key_of(ro,fr)]+=nb
blocks=[]; mism=0
genesis=1606824023
for b in replay:
    posters=byblock.get(b["n"],{})
    s=sum(posters.values())
    posters=dict(posters)
    if s<b["blobs"]: posters["other"]=posters.get("other",0)+b["blobs"]-s; mism+=1
    if s>b["blobs"]: mism+=1
    pl=sorted(([k,v] for k,v in posters.items() if v>0), key=lambda x:-x[1])
    slot=(b["ts"]-genesis)//12
    blocks.append([b["n"], b["ts"], b["tx"], round(b["gu"]/b["gl"]*1000), round(b["bf"]/1e9*1e4), b["blobs"], pl, slot])
print("replay blocks", len(blocks), "poster mismatches", mism)

# ---- L2 shops
def rows(k):
    r=acts.get(k) or []
    return [[x[0], x[1] or 0, x[2] or 0] for x in r]
shops=[]
for k,name,color in SHOPS:
    r=rows(k); p=summary[k]
    u7=sum(x[2] for x in r[-7:])/7/86400; up=sum(x[2] for x in r[-14:-7])/7/86400
    da=[b["id"] for b in p["badges"] if b["type"]=="DA"]
    risks={x["name"]:x["value"] for x in p["risks"]}
    damode="blobs" if "EthereumBlobs" in da else ("eigenda" if any("EigenDA" in d for d in da) else "own")
    spark=[round(x[2]/86400,2) for x in r[-30:]]
    d0=datetime.datetime.utcfromtimestamp(r[-30][0]).strftime("%b %-d"); d1=datetime.datetime.utcfromtimestamp(r[-1][0]).strftime("%b %-d")
    shops.append({"key":k,"slug":p["slug"],"name":name,"color":color,"uops":round(u7,1),"wow":round(u7/up-1,4) if up else 0,
      "tvs":round(p["tvs"]["breakdown"]["total"]), "tvs7d":round(p["tvs"].get("change7d") or 0,4),
      "stage":p["stage"],"category":p["category"],"stack":", ".join(p.get("providers") or []) or "Independent",
      "da":damode,"daLabel":risks.get("Data Availability",""),"blobsPerDay":round(per.get(dict(worldchain="worldchain").get(k,k),0)/days),
      "blobShare":round(per.get(k,0)/tot,4),"txPerDay":round(sum(x[1] for x in r[-7:])/7),"spark":spark,"sparkRange":[d0,d1]})
shops.sort(key=lambda s:-s["uops"])
for i,s in enumerate(shops): s["rank"]=i+1
print([(s["rank"],s["name"],s["uops"],s["blobsPerDay"],s["da"],s["stage"]) for s in shops])

# ---- staking history (90d)
hist=[[r["date"][5:], r["entry_queue"], r["exit_queue"]] for r in vq[-90:]]
last=vq[-1]
# ---- L2 aggregate
def avg7(i): return sum((x[2] or 0) for x in agg[i-6:i+1])/7/86400
n=len(agg)
l2agg={"uops":round(avg7(n-1)),"uopsYearAgo":round(avg7(n-366)),"lighterShare":round(shops[0]["uops"]/avg7(n-1),3),
       "lighterSince":"Oct 2, 2025"}  # L2BEAT only counts Lighter from this date, so the year-ago figure has no Lighter in it
# ---- replay tx sparkline (5-min buckets)
bucket=25; txs=[b[2] for b in blocks]
rspark=[round(statistics.mean(txs[i:i+bucket]),1) for i in range(0,len(txs),bucket)]

DATA={
 "asOf":"2026-09-28T11:45:00Z","asOfLabel":"Mon Sep 28, 2026 · 11:45 UTC","price":2666.59,
 "l1":{"txPerDay":1870288,"txPerDayYearAgo":1552983,"gasLimit":60000000,"gasLimitYearAgo":45000000,"fullness":0.506,"baseFee7d":0.495,
       # blob week (Sep 21-27, Blobscan daily totals): 251,419 blobs = ~35.9K/day = ~5.0 per block; fees 0.99 ETH
       "blobsPerBlock":5.0,"blobTarget":14,"blobMax":21,"blobFees7dEth":0.99,"blobsPerDay":35917,"blobSourceDays":days,"window":"7d"},
 "replay":{"blocks":blocks,"spark":rspark,"bucket":bucket,
           "from":datetime.datetime.utcfromtimestamp(replay[0]["ts"]).strftime("%H:%M"),"to":datetime.datetime.utcfromtimestamp(replay[-1]["ts"]).strftime("%H:%M")},
 "names":{**NICE, **{k:n for k,n,_ in SHOPS}, "other":"Unlabeled rollups"},
 "blobShares":blobShares[:16],
 # ultrasound.money supply-parts at block 26,076,211 (Sep 28) and 7-day gauge rates
 "supply":{"supply":122082026,"issuedPerDay":2941.3,"burnedPerDay":108.3,"growthPct":0.847,"burnedSince1559":4639464,"burn24h":188.5},
 "staking":{"staked":last["staked_amount"],"pct":last["staked_percent"],"validators":last["validators"],"apr":last["apr"],
            "entryQ":last["entry_queue"],"entryWait":last["entry_wait"],"exitQ":last["exit_queue"],"exitWait":last["exit_wait"],"churn":256,"sweepDays":7.7,"hist":hist,
            # fact-check on Sep 28: ~99% of the exit line was EIP-7251 consolidations (ETH stays staked); ~1.9K ETH was really leaving
            "exitNote":{"date":"Sep 28, 2026","consolidationShare":0.99,"unstakingEth":1900}},
 # Bitmine weekly press release of Sep 28, 2026 (holdings as of Sep 27, 3pm ET) and Sep 21, 2026 (as of Sep 20)
 "bitmine":{"holdings":6001302,"holdingsDate":"Sep 27, 2026","staked":5067309,"prevHoldings":5983940,"prevDate":"Sep 20, 2026",
            "statedAnnualStakingUsd":358000000,"releaseDate":"Sep 28, 2026",
            "releaseUrl":"https://www.prnewswire.com/news-releases/bitmine-immersion-technologies-bmnr-announces-eth-holdings-reach-over-6-million-tokens-with-total-crypto-cash--marketable-securities-holdings-of-17-2-billion-302891056.html",
            "prevReleaseUrl":"https://www.prnewswire.com/news-releases/bitmine-immersion-technologies-bmnr-announces-eth-holdings-reach-5-98-million-tokens-and-total-crypto-and-total-cash-holdings-of-17-1-billion-302884434.html",
            "supplyShare":round(6001302/122082026,4),"stakeShare":round(5067309/last["staked_amount"],4)},
 "l2":shops,"l2agg":l2agg,
 "stables":{"eth":148.4e9,"all":313.1e9,"share":0.474,"ethYoY":-0.063,"allYoY":0.057},
}
open("data.js","w").write("window.ETH_TOWN_DATA="+json.dumps(DATA,separators=(",",":"))+";\n")
print("data.js bytes", os.path.getsize("data.js"), "l2agg", l2agg)
