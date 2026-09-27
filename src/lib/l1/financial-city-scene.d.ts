export type FinancialCityPlace = {
  id: string;
  name: string;
  product: string;
  category: string;
  status: "live" | "pilot" | "context";
  networkId: string | null;
  color: string;
};
export type FinancialCityEvent = {
  id: string;
  networkId: string;
  kind: string;
  direction: string;
};
export type FinancialCityActivity = {
  id: string;
  transactionCount: number;
  blockHash: string;
};
export type FinancialCityController = {
  select(id: string | null): void;
  setPaused(paused: boolean): void;
  setNight(night: boolean): void;
  setSpeed(speed: number): void;
  setLayers(layer: "all" | "connected" | "context"): void;
  setObservedEvents(events: FinancialCityEvent[]): void;
  setNetworkActivity(records: FinancialCityActivity[]): void;
  resetView(): void;
  getCanvas(): HTMLCanvasElement;
  dispose(): void;
};
export function mountFinancialCity(
  container: HTMLElement,
  places: FinancialCityPlace[],
  onSelect?: (id: string | null) => void,
): FinancialCityController;
