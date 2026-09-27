import type {Network} from './networks';
export type TownActivityRecord={id:string;blockNumber:number|string;blockHash:string;transactions:number;timestamp:string;visitorCount?:number};
export type TownBridgeEvent={id:string;chainId:string;direction:'to-l1'|'to-l2';kind:string};
export type TownController={
  select:(id:string|null)=>void;
  setPaused:(value:boolean)=>void;
  setSpeed:(value:number)=>void;
  setNight:(value:boolean)=>void;
  setScale:(mode:unknown)=>void;
  getCanvas:()=>HTMLCanvasElement;
  setLiveActivity:(records:TownActivityRecord[])=>void;
  showBridgeEvents:(events:TownBridgeEvent[])=>void;
  setFinanceVisible:(visible:boolean)=>void;
  dispose:()=>void;
};
export function mountTown(container:HTMLElement,chains:(Network&{visitorCount:number})[],onSelect:(id:string|null)=>void):TownController;
