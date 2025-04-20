declare module 'coinmarketcap-api' {
  export interface CoinMarketCapResponse<T> {
    data: T;
    status: {
      timestamp: string;
      error_code: number;
      error_message: string | null;
      elapsed: number;
      credit_count: number;
    };
  }

  export interface GlobalMetrics {
    data: {
      active_cryptocurrencies: number;
      total_market_cap: number;
      total_volume_24h: number;
      market_cap_change_percentage_24h: number;
      volume_change_percentage_24h: number;
      btc_dominance: number;
      quote: {
        USD: {
          total_market_cap: number;
          total_volume_24h: number;
          market_cap_change_percentage_24h: number;
          volume_change_percentage_24h: number;
        };
      };
    };
  }

  export interface CryptoQuote {
    data: {
      [key: string]: {
        id: number;
        name: string;
        symbol: string;
        slug: string;
        quote: {
          USD: {
            price: number;
            volume_24h: number;
            market_cap: number;
            percent_change_24h: number;
          };
        };
      };
    };
  }

  export class CoinMarketCap {
    constructor(apiKey: string);
    getGlobalMetrics(): Promise<CoinMarketCapResponse<GlobalMetrics>>;
    getQuotes(params: { symbol: string }): Promise<CoinMarketCapResponse<CryptoQuote>>;
  }
} 