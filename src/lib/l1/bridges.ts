/** Selected canonical bridge events observed on Ethereum L1, not all cross-chain traffic. */
export type BridgeDirection = 'ethereum-to-l2' | 'l2-to-ethereum'
export type BridgeStage = 'deposit-initiated' | 'withdrawal-finalized' | 'batch-data-posted' | 'batch-committed' | 'batch-executed' | 'state-updated'
export type BridgeKind = 'bridge' | 'settlement'
export type BridgeEventSpec = {
  name: string
  signature: string
  topic: string
  direction: BridgeDirection
  stage: BridgeStage
  topicCount: number
  minimumDataBytes: number
}
export type BridgeRegistryEntry = {
  chainId: string
  chainName: string
  kind?: BridgeKind
  addresses: string[]
  sources: { label: string; url: string }[]
  events: BridgeEventSpec[]
  note: string
  verifiedAt: string | null
}
export const STANDARD_BRIDGE_SOURCE = 'https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/universal/StandardBridge.sol'
// Keccak-256 of the exact Solidity signatures; no legacy events (those double-count).
export const STANDARD_BRIDGE_EVENTS: BridgeEventSpec[] = [
  { name: 'ETHBridgeInitiated', signature: 'ETHBridgeInitiated(address,address,uint256,bytes)', topic: '0x2849b43074093a05396b6f2a937dee8565b15a48a7b3d4bffb732a5017380af5', direction: 'ethereum-to-l2', stage: 'deposit-initiated', topicCount: 3, minimumDataBytes: 96 },
  { name: 'ETHBridgeFinalized', signature: 'ETHBridgeFinalized(address,address,uint256,bytes)', topic: '0x31b2166ff604fc5672ea5df08a78081d2bc6d746cadce880747f3643d819e83d', direction: 'l2-to-ethereum', stage: 'withdrawal-finalized', topicCount: 3, minimumDataBytes: 96 },
  { name: 'ERC20BridgeInitiated', signature: 'ERC20BridgeInitiated(address,address,address,address,uint256,bytes)', topic: '0x7ff126db8024424bbfd9826e8ab82ff59136289ea440b04b39a0df1b03b9cabf', direction: 'ethereum-to-l2', stage: 'deposit-initiated', topicCount: 4, minimumDataBytes: 128 },
  { name: 'ERC20BridgeFinalized', signature: 'ERC20BridgeFinalized(address,address,address,address,uint256,bytes)', topic: '0xd59c65b35445225835c83f50b6ede06a7be047d22e357073e250d9af537518cd', direction: 'l2-to-ethereum', stage: 'withdrawal-finalized', topicCount: 4, minimumDataBytes: 128 },
]
const unsupported = (chainId: string, chainName: string): BridgeRegistryEntry => ({
  chainId, chainName, addresses: [], sources: [], events: [], verifiedAt: null,
  note: 'This network’s bridge events are not monitored in this feed. Its connection in the town is architectural, not measured traffic.',
})
export const BRIDGE_REGISTRY: BridgeRegistryEntry[] = [
  { chainId: 'base', chainName: 'Base', addresses: ['0x3154Cf16ccdb4C6d922629664174b904d80F2C35'], events: STANDARD_BRIDGE_EVENTS,
    sources: [{ label: 'Base L1 contract addresses', url: 'https://docs.base.org/specifications/reference/base-contracts' }, { label: 'StandardBridge event definitions', url: STANDARD_BRIDGE_SOURCE }],
    note: 'Selected ETH/ERC-20 events from Base’s canonical L1 StandardBridge only. Excludes third-party bridges, direct Portal deposits and rollup data batches.', verifiedAt: '2026-09-27' },
  { chainId: 'arbitrum', chainName: 'Arbitrum One', addresses: ['0xa3A7B6F88361F48403514059F1F16C8E78d60EeC'],
    events: [
      {name: 'DepositInitiated', signature:'DepositInitiated(address,address,address,uint256,uint256)',topic:'0xb8910b9960c443aac3240b98585384e3a6f109fbf6969e264c3f183d69aba7e1',direction:'ethereum-to-l2',stage:'deposit-initiated',topicCount:4,minimumDataBytes:64},
      {name: 'WithdrawalFinalized', signature:'WithdrawalFinalized(address,address,address,uint256,uint256)',topic:'0x891afe029c75c4f8c5855fc3480598bc5a53739344f6ae575bdb7ea2a79f56b3',direction:'l2-to-ethereum',stage:'withdrawal-finalized',topicCount:4,minimumDataBytes:64},
    ], sources:[{label:'Arbitrum contract addresses',url:'https://docs.arbitrum.io/arbitrum-essentials/reference/contract-addresses'},{label:'Canonical gateway events',url:'https://github.com/OffchainLabs/token-bridge-contracts/blob/main/contracts/tokenbridge/ethereum/gateway/L1ArbitrumGateway.sol'}],
    note:'Standard ERC-20 gateway only. Excludes ETH deposits, WETH/custom gateways and third-party bridges.', verifiedAt:'2026-09-27'},
  { chainId: 'optimism', chainName: 'OP Mainnet', addresses: ['0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1'], events: STANDARD_BRIDGE_EVENTS,
    sources: [{ label: 'Official OP Mainnet registry', url: 'https://github.com/ethereum-optimism/superchain-registry/blob/main/superchain/configs/mainnet/op.toml' }, { label: 'StandardBridge event definitions', url: STANDARD_BRIDGE_SOURCE }],
    note: 'Selected ETH/ERC-20 events from OP Mainnet’s canonical L1 StandardBridge only. Excludes third-party bridges, direct Portal deposits and rollup data batches.', verifiedAt: '2026-09-27' },
  unsupported('starknet', 'Starknet'), unsupported('zksync-era', 'ZKsync Era'), unsupported('linea', 'Linea'),
  unsupported('mantle', 'Mantle'), unsupported('ink', 'Ink'), unsupported('unichain', 'Unichain'),
]
export type BridgeEvent = {
  kind: BridgeKind
  sourceUrl: string
  id: string
  chainId: string
  chainName: string
  direction: BridgeDirection
  stage: BridgeStage
  eventName: string
  contractAddress: string
  txHash: string
  logIndex: number
  blockNumber: number
  blockHash: string
  timestamp: string
  finality: 'included'
  explorerUrl: string
}
export type BridgeCoverage = Omit<BridgeRegistryEntry, 'events'> & {
  status: 'monitored' | 'unsupported' | 'unavailable'
  bridgeStatus: 'monitored' | 'unsupported' | 'unavailable'
  settlementStatus: 'monitored' | 'unsupported' | 'unavailable'
}
export type BridgeSnapshot = {
  status: 'live' | 'partial' | 'unavailable'
  fetchedAt: string
  fromBlock: number | null
  toBlock: number | null
  periodStart: string | null
  observedThrough: string | null
  rpcLabel: string | null
  rpcUrl: string | null
  coverage: BridgeCoverage[]
  events: BridgeEvent[]
  note: string
}
export const BRIDGE_FEED_NOTE = 'Selected bridge and rollup infrastructure activity. Batch data, commitments and state updates are not asset transfers. Base/OP batch calls are a sample (up to 6 newest each), discovered with Blockscout and verified using Ethereum RPC. Canonical bridge events on Ethereum only. Deposits are initiated, not confirmed received on L2. Withdrawal-finalized is a bridge stage, not Ethereum consensus finality. Recent blocks may reorganize. This feed does not measure all bridging, L2 transactions, settlement batches or token value.'
export const SETTLEMENT_REGISTRY: BridgeRegistryEntry[] = [
  {chainId:'starknet',chainName:'Starknet',kind:'settlement',addresses:['0xc662c410C0ECf747543f5bA90660f6ABeBD9C8c4'],verifiedAt:'2026-09-27',note:'Proof-backed state updates emitted by the Starknet core contract. Ethereum inclusion is not consensus finality.',
    sources:[{label:'Starknet mainnet registry',url:'https://github.com/starknet-io/starknet-docs/blob/main/learn/cheatsheets/chain-info.mdx'},{label:'Starknet core state update',url:'https://github.com/starkware-libs/cairo-lang/blob/master/src/starkware/starknet/solidity/Starknet.sol'}],
    events:[{name:'LogStateUpdate',signature:'LogStateUpdate(uint256,int256,uint256)',topic:'0xd342ddf7a308dec111745b00315c14b7efb2bdae570a6856e088ed0c65a3576c',direction:'l2-to-ethereum',stage:'state-updated',topicCount:1,minimumDataBytes:96}]},
  {chainId:'linea',chainName:'Linea',kind:'settlement',addresses:['0xd19d4B5d358258f05D7B411E21A1460D11B0876F'],verifiedAt:'2026-09-27',note:'Current V3 data submission/finalization events only. Rollup-stage finalization differs from Ethereum consensus finality.',
    sources:[{label:'Linea deployment registry',url:'https://docs.linea.build/network/build/contracts'},{label:'Current Linea event definitions',url:'https://docs.linea.build/api/linea-smart-contracts/interfaces/l1/ilinearollup'}],
    events:[{name:'DataSubmittedV3',signature:'DataSubmittedV3(bytes32,bytes32,bytes32)',topic:'0x55f4c645c36aa5cd3f443d6be44d7a7a5df9d2100d7139dfc69d4289ee072319',direction:'l2-to-ethereum',stage:'batch-data-posted',topicCount:2,minimumDataBytes:64},{name:'DataFinalizedV3',signature:'DataFinalizedV3(uint256,uint256,bytes32,bytes32,bytes32)',topic:'0xa0262dc79e4ccb71ceac8574ae906311ae338aa4a2044fd4ec4b99fad5ab60cb',direction:'l2-to-ethereum',stage:'batch-executed',topicCount:4,minimumDataBytes:64}]},

  {chainId:'arbitrum',chainName:'Arbitrum One',kind:'settlement',addresses:['0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6'],verifiedAt:'2026-09-27',note:'Sequencer inbox batch-delivery events; data publication does not by itself prove finalized L2 state.',
    sources:[{label:'Arbitrum contract addresses',url:'https://docs.arbitrum.io/arbitrum-essentials/reference/contract-addresses'},{label:'Sequencer inbox interface',url:'https://github.com/OffchainLabs/nitro-contracts/blob/main/src/bridge/ISequencerInbox.sol'}],
    events:[{name:'SequencerBatchDelivered',signature:'SequencerBatchDelivered(uint256,bytes32,bytes32,bytes32,uint256,(uint64,uint64,uint64,uint64),uint8)',topic:'0x7394f4a19a13c7b92b5bb71033245305946ef78452f7b4986ac1390b5df4ebd7',direction:'l2-to-ethereum',stage:'batch-data-posted',topicCount:4,minimumDataBytes:224}]},
  {chainId:'zksync-era',chainName:'ZKsync Era',kind:'settlement',addresses:['0x32400084c286cf3e17e7b677ea9583e60a000324'],verifiedAt:'2026-09-27',note:'Era batch commitment/execution events on Ethereum. A commitment is not batch execution.',
    sources:[{label:'ZKsync L1 addresses',url:'https://docs.zksync.io/zksync-network/environment/l1-contracts'},{label:'Executor events',url:'https://github.com/matter-labs/era-contracts/blob/main/l1-contracts/contracts/state-transition/chain-interfaces/IExecutor.sol'}],
    events:[{name:'BlockCommit',signature:'BlockCommit(uint256,bytes32,bytes32)',topic:'0x8f2916b2f2d78cc5890ead36c06c0f6d5d112c7e103589947e8e2f0d6eddb763',direction:'l2-to-ethereum',stage:'batch-committed',topicCount:4,minimumDataBytes:0},{name:'BlockExecution',signature:'BlockExecution(uint256,bytes32,bytes32)',topic:'0x2402307311a4d6604e4e7b4c8a15a7e1213edb39c16a31efa70afb06030d3165',direction:'l2-to-ethereum',stage:'batch-executed',topicCount:4,minimumDataBytes:0}]},
]
export const BATCH_INBOXES = [
  {chainId:'base',chainName:'Base',address:'0xff00000000000000000000000000000000008453',sender:'0x5050f69a9786f081509234f1a7f4684b5e5b76c9',sourceUrl:'https://docs.base.org/specifications/reference/base-contracts'},
  {chainId:'optimism',chainName:'OP Mainnet',address:'0xff00000000000000000000000000000000000010',sender:'0x6887246668a3b87f54deb3b94ba47a6f63f32985',sourceUrl:'https://github.com/ethereum-optimism/superchain-registry/blob/main/superchain/configs/mainnet/op.toml'},
]
export function bridgeCoverage(available: boolean, batchAvailable: string[] = []): BridgeCoverage[] {
  return BRIDGE_REGISTRY.map(({events,...entry}) => {
    const settlement=SETTLEMENT_REGISTRY.filter(e=>e.chainId===entry.chainId)
    const inbox=BATCH_INBOXES.find(e=>e.chainId===entry.chainId)
    const bridgeStatus=events.length ? (available?'monitored':'unavailable') : 'unsupported'
    const settlementStatus=settlement.length ? (available?'monitored':'unavailable') : inbox ? (batchAvailable.includes(entry.chainId)?'monitored':'unavailable') : 'unsupported'
    const status=bridgeStatus==='monitored'||settlementStatus==='monitored'?'monitored':bridgeStatus==='unavailable'||settlementStatus==='unavailable'?'unavailable':'unsupported'
    return {...entry,addresses:[...entry.addresses,...settlement.flatMap(e=>e.addresses),...(inbox?[inbox.address]:[])],sources:[...entry.sources,...settlement.flatMap(e=>e.sources),...(inbox?[{label:'Batch inbox source',url:inbox.sourceUrl}]:[])],note: [events.length?entry.note:'Asset bridge events are not monitored.',...settlement.map(e=>e.note),...(inbox?['Sampled blob batch calls from the documented batch sender to inbox; no claim of L2 finality or asset movement.']:[])].join(' '),status,bridgeStatus,settlementStatus}
  })
}
export function unavailableBridgeSnapshot(message = 'The Ethereum log source could not be verified. No observed packets are shown.'): BridgeSnapshot {
  return { status: 'unavailable', fetchedAt: new Date().toISOString(), fromBlock: null, toBlock: null, periodStart: null, observedThrough: null, rpcLabel: null, rpcUrl: null, coverage: bridgeCoverage(false), events: [], note: message + ' ' + BRIDGE_FEED_NOTE }
}
