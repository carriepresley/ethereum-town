export type CityPlace = {
  id: string;
  name: string;
  product: string;
  category: string;
  status: "live" | "pilot" | "context";
  networkId: string | null;
  description: string;
  scopeNote: string;
  sourceUrl: string | null;
  sourceLabel: string;
  reviewedAt: string;
  color: string;
};

// Reviewed product connections, not a live measure of company activity or assets.
// A selected network is a display destination, not an exhaustive deployment list.
const reviewedAt = "2026-09-26";

export const CITY_SCOPE_NOTE =
  "A selected map of documented products and protocols using Ethereum or its L2s. The surrounding financial districts provide context: integrations vary, and their size does not measure assets or predict migration to Ethereum.";

export const CONNECTED_PLACES: CityPlace[] = [
  {
    id: "usdc",
    name: "Circle",
    product: "USDC",
    category: "Stablecoins",
    status: "live",
    networkId: "ethereum",
    color: "#55a7e8",
    description:
      "USDC is a dollar stablecoin issued by Circle. Its native Ethereum deployment connects digital dollars to applications and payments.",
    scopeNote:
      "This street shows Ethereum. Circle also issues native USDC on Base, Arbitrum and many other networks; bridged copies are distinct. No Circle payment volume is measured here.",
    sourceUrl: "https://www.circle.com/multi-chain-usdc",
    sourceLabel: "Circle: native USDC networks",
    reviewedAt,
  },
  {
    id: "usdt",
    name: "Tether",
    product: "USD₮ / USDT",
    category: "Stablecoins",
    status: "live",
    networkId: "ethereum",
    color: "#58baa3",
    description:
      "Tether documents a supported USD₮ token contract on Ethereum, providing another dollar token used throughout the onchain economy.",
    scopeNote:
      "Only the Ethereum USD₮ deployment is shown. Tether also supports other blockchains. This building does not represent Tether’s total issuance, reserves or transaction volume.",
    sourceUrl: "https://tether.to/en/supported-protocols/",
    sourceLabel: "Tether: supported protocols and official contracts",
    reviewedAt,
  },
  {
    id: "uniswap",
    name: "Uniswap",
    product: "Token exchange",
    category: "Trading",
    status: "live",
    networkId: "base",
    color: "#ed79ad",
    description:
      "Uniswap enables token swaps through onchain liquidity pools. This storefront highlights its documented Base deployment.",
    scopeNote:
      "The official v3 contract directory also includes Ethereum, Arbitrum and other networks. A road means a deployed protocol connection; it does not show measured swaps or the location of every Uniswap market.",
    sourceUrl: "https://developers.uniswap.org/docs/protocols/v3/deployments",
    sourceLabel: "Uniswap: official v3 deployment directory",
    reviewedAt,
  },
  {
    id: "aave",
    name: "Aave",
    product: "Lending markets",
    category: "Credit",
    status: "live",
    networkId: "ethereum",
    color: "#a58ae4",
    description:
      "Aave’s Ethereum markets let users supply assets and borrow through onchain lending contracts.",
    scopeNote:
      "This street selects Ethereum. Aave also documents governance-approved deployments on Base, Arbitrum and other networks. Building size and pedestrians do not measure supplied assets, debt or users.",
    sourceUrl: "https://aave.com/help/aave-101/accessing-aave",
    sourceLabel: "Aave: official protocol deployments",
    reviewedAt,
  },
  {
    id: "buidl",
    name: "BlackRock",
    product: "BUIDL fund",
    category: "Tokenized funds",
    status: "live",
    networkId: "ethereum",
    color: "#b9aa83",
    description:
      "BUIDL is BlackRock’s tokenized institutional liquidity fund, launched on Ethereum through Securitize for eligible investors.",
    scopeNote:
      "The fund’s Ethereum connection is shown. BUIDL has expanded to other networks; this is neither all BlackRock assets nor all BUIDL deployments. No fund balance or flow is measured here.",
    sourceUrl:
      "https://investors.securitize.io/news/news-details/2024/BlackRock-Launches-Its-First-Tokenized-Fund-BUIDL-on-the-Ethereum-Network-03-20-2024/default.aspx",
    sourceLabel: "BlackRock / Securitize launch release · March 20, 2024",
    reviewedAt,
  },
  {
    id: "benji",
    name: "Franklin Templeton",
    product: "BENJI / FOBXX",
    category: "Tokenized funds",
    status: "live",
    networkId: "arbitrum",
    color: "#dc9c65",
    description:
      "BENJI represents shares of the Franklin OnChain U.S. Government Money Fund. Its official directory includes contracts on Arbitrum, Ethereum and Base.",
    scopeNote:
      "Arbitrum is the selected connection in this view. The wider BENJI platform uses additional networks and products. This building does not represent Franklin Templeton’s entire portfolio or measured fund flows.",
    sourceUrl:
      "https://digitalassets.franklintempleton.com/benji/benji-contracts/",
    sourceLabel: "Franklin Templeton: official BENJI contract directory",
    reviewedAt,
  },
  {
    id: "jpmcoin",
    name: "J.P. Morgan",
    product: "JPM Coin / JPMD",
    category: "Bank deposits",
    status: "live",
    networkId: "base",
    color: "#5f98bd",
    description:
      "JPM Coin, ticker JPMD, is J.P. Morgan’s USD bank deposit token available to its institutional clients on Base.",
    scopeNote:
      "This is a specific institutional deposit-token product. The connection does not put all J.P. Morgan deposits or its separate private Kinexys network on Ethereum. Product flows are not measured here.",
    sourceUrl:
      "https://www.jpmorgan.com/payments/newsroom/jpm-coin-usd-deposit-token-institutional-clients",
    sourceLabel: "J.P. Morgan availability announcement · November 12, 2025",
    reviewedAt,
  },
  {
    id: "visa",
    name: "Visa",
    product: "Stablecoin settlement pilot",
    category: "Payments",
    status: "pilot",
    networkId: "ethereum",
    color: "#d7ae54",
    description:
      "Visa’s live stablecoin settlement pilot lets participating issuers and acquirers settle with the network. Supported blockchains include Ethereum and Base.",
    scopeNote:
      "A selected pilot connection, not all Visa card payments. Visa’s announced pilot is multichain; its aggregate settlement figures must not be presented as Ethereum-only activity.",
    sourceUrl:
      "https://investor.visa.com/news/news-details/2026/Visa-Accelerates-Stablecoin-Momentum-Adding-Five-Blockchains-for-Settlement/",
    sourceLabel: "Visa settlement pilot update · April 29, 2026",
    reviewedAt,
  },
  {
    id: "lido",
    name: "Lido",
    product: "ETH staking / stETH",
    category: "Staking",
    status: "live",
    networkId: "ethereum",
    color: "#7caedf",
    description:
      "Lido’s Ethereum contracts let users stake ETH and receive stETH, which represents their staked ETH and reflects rewards or penalties.",
    scopeNote:
      "Lido is one staking protocol, not the whole validator network. stETH is a claim on underlying staked ETH and must not be added to that ETH as extra network security.",
    sourceUrl: "https://lido.fi/how-lido-works/lido-staking-protocol",
    sourceLabel: "Lido: staking protocol documentation",
    reviewedAt,
  },
];

const contextScope =
  "Sector context, not a named institution or a confirmed Ethereum connection. Some participants already use public or private blockchains; integrations vary. No migration commitment or asset scale is implied.";

export const CONTEXT_PLACES: CityPlace[] = [
  {
    id: "sector-bank-deposits",
    name: "Bank deposits",
    product: "The wider banking system",
    category: "Wider finance",
    status: "context",
    networkId: null,
    color: "#82909b",
    description:
      "Commercial banks hold deposits and provide payments and credit. A tokenized deposit product is one connection within this much broader sector.",
    scopeNote: contextScope,
    sourceUrl: null,
    sourceLabel: "Illustrative sector context",
    reviewedAt,
  },
  {
    id: "sector-exchanges",
    name: "Securities exchanges",
    product: "Equities and market infrastructure",
    category: "Wider finance",
    status: "context",
    networkId: null,
    color: "#85929c",
    description:
      "Exchanges, brokers, clearing houses and depositories support securities trading. A tokenized product does not move an entire exchange onto Ethereum.",
    scopeNote: contextScope,
    sourceUrl: null,
    sourceLabel: "Illustrative sector context",
    reviewedAt,
  },
  {
    id: "sector-bonds-credit",
    name: "Bonds and credit",
    product: "Debt markets and lending",
    category: "Wider finance",
    status: "context",
    networkId: null,
    color: "#8a929b",
    description:
      "Government and corporate debt, private credit and loans form a broad financial district beyond the selected onchain lending and fund products shown here.",
    scopeNote: contextScope,
    sourceUrl: null,
    sourceLabel: "Illustrative sector context",
    reviewedAt,
  },
  {
    id: "sector-insurance",
    name: "Insurance",
    product: "Risk protection and underwriting",
    category: "Wider finance",
    status: "context",
    networkId: null,
    color: "#85969c",
    description:
      "Insurers price and pool risk, underwrite policies and pay claims. This district gives that economic activity a place in the wider financial city.",
    scopeNote: contextScope,
    sourceUrl: null,
    sourceLabel: "Illustrative sector context",
    reviewedAt,
  },
  {
    id: "sector-pensions",
    name: "Pensions",
    product: "Retirement savings and investment",
    category: "Wider finance",
    status: "context",
    networkId: null,
    color: "#92929a",
    description:
      "Pension systems collect, invest and distribute retirement savings. Their role spans many asset classes and institutions beyond the products in this map.",
    scopeNote: contextScope,
    sourceUrl: null,
    sourceLabel: "Illustrative sector context",
    reviewedAt,
  },
  {
    id: "sector-real-estate",
    name: "Real estate",
    product: "Property finance and ownership",
    category: "Wider finance",
    status: "context",
    networkId: null,
    color: "#96918a",
    description:
      "Property ownership, mortgages and real estate investment are part of the broader financial landscape. Tokenization is only one possible tool within it.",
    scopeNote: contextScope,
    sourceUrl: null,
    sourceLabel: "Illustrative sector context",
    reviewedAt,
  },
];

export const CITY_PLACES: CityPlace[] = [
  ...CONNECTED_PLACES,
  ...CONTEXT_PLACES,
];

export function cityStatusLabel(status: CityPlace["status"]): string {
  return status === "live"
    ? "Documented live product"
    : status === "pilot"
      ? "Documented live pilot"
      : "Wider financial sector";
}
