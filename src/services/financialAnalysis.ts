import axios from 'axios';
import { fredService, MacroEconomicData } from './fredService';

// Configuration Polygon.io
const POLYGON_API_KEY = '_VMkPLij43RaTzRGa8CoCBwsaJPpRiFX';
const POLYGON_BASE_URL = 'https://api.polygon.io/v2';

// Configuration Axios
const axiosInstance = axios.create({
  baseURL: POLYGON_BASE_URL,
  headers: {
    'Authorization': `Bearer ${POLYGON_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

interface PolygonQuote {
  status: string;
  from: string;
  symbol: string;
  last: {
    price: number;
    size: number;
    exchange: number;
    conditions: number[];
    timestamp: number;
  };
}

interface PolygonAggregates {
  ticker: string;
  status: string;
  adjusted: boolean;
  queryCount: number;
  resultsCount: number;
  results: Array<{
    c: number; // close
    h: number; // high
    l: number; // low
    n: number; // number of transactions
    o: number; // open
    t: number; // timestamp
    v: number; // volume
    vw: number; // volume weighted average price
  }>;
}

interface PolygonTickerDetails {
  status: string;
  request_id: string;
  results: {
    ticker: string;
    name: string;
    market: string;
    locale: string;
    primary_exchange: string;
    type: string;
    active: boolean;
    currency_name: string;
    cik: string;
    composite_figi: string;
    share_class_figi: string;
    market_cap: number;
    phone_number: string;
    address: {
      address1: string;
      city: string;
      state: string;
      postal_code: string;
    };
    description: string;
    sic_code: string;
    sic_description: string;
    ticker_root: string;
    homepage_url: string;
    total_employees: number;
    list_date: string;
    branding: {
      logo_url: string;
      icon_url: string;
    };
    share_class_shares_outstanding: number;
    weighted_shares_outstanding: number;
  };
}

interface AlphaVantageOverview {
  Symbol: string;
  AssetType: string;
  Name: string;
  Description: string;
  Exchange: string;
  Currency: string;
  Country: string;
  Sector: string;
  Industry: string;
  MarketCapitalization: string;
  EBITDA: string;
  PERatio: string;
  PEGRatio: string;
  BookValue: string;
  DividendPerShare: string;
  DividendYield: string;
  EPS: string;
  ProfitMargin: string;
  OperatingMarginTTM: string;
  ReturnOnAssetsTTM: string;
  ReturnOnEquityTTM: string;
  RevenueTTM: string;
  GrossProfitTTM: string;
  Beta: string;
  SharesOutstanding: string;
  SharesFloat: string;
  SharesShort: string;
  ShortRatio: string;
  '52WeekHigh': string;
  '52WeekLow': string;
  '50DayMovingAverage': string;
  '200DayMovingAverage': string;
}

interface AlphaVantageQuote {
  '01. symbol': string;
  '02. open': string;
  '03. high': string;
  '04. low': string;
  '05. price': string;
  '06. volume': string;
  '07. latest trading day': string;
  '08. previous close': string;
  '09. change': string;
  '10. change percent': string;
}

interface AlphaVantageTimeSeries {
  'Time Series (Daily)': {
    [key: string]: {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. volume': string;
    };
  };
  'Meta Data': {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Output Size': string;
    '5. Time Zone': string;
  };
}

interface AlphaVantageRSI {
  'Technical Analysis: RSI': {
    [key: string]: {
      RSI: string;
    };
  };
  'Meta Data': {
    '1: Symbol': string;
    '2: Indicator': string;
    '3: Last Refreshed': string;
    '4: Interval': string;
    '5: Time Period': number;
    '6: Series Type': string;
    '7: Time Zone': string;
  };
}

interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  percent_change: string;
  average_volume: string;
  fifty_two_week: {
    low: string;
    high: string;
  };
}

interface TwelveDataTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
}

interface StockQuote {
  c: number;  // Prix actuel
  h: number;  // Prix le plus haut
  l: number;  // Prix le plus bas
  o: number;  // Prix d'ouverture
  pc: number; // Prix de clôture précédent
  t: number;  // Timestamp
  v: number;  // Volume
}

interface AlphaVantageSearchResult {
  bestMatches: Array<{
    '1. symbol': string;
    '2. name': string;
    '3. type': string;
    '4. region': string;
    '5. marketOpen': string;
    '6. marketClose': string;
    '7. timezone': string;
    '8. currency': string;
    '9. matchScore': string;
  }>;
}

interface AlphaVantageErrorResponse {
  Note?: string;
  Information?: string;
  Error?: string;
}

interface FundamentalMetrics {
  marketCap: number;
  sharesOutstanding: number;
  sharesFloat: number;
  sharesShort: number;
  shortRatio: number;
  beta: number;
  peRatio: number;
  pegRatio: number;
  bookValue: number;
}

export interface DetailedStockData {
  marketData: {
    marketCap: number;
    volume: number;
    avgVolume: number;
    relVolume: number;
    sharesOutstanding: number;
    sharesFloat: number;
    shortFloat: number;
    shortRatio: number;
    beta: number;
  };
  
  valuationMetrics: {
    peRatio: number;
    forwardPE: number;
    peg: number;
    priceToSales: number;
    priceToBook: number;
    priceToFcf: number;
    currentRatio: number;
    quickRatio: number;
    debtToEquity: number;
    ltDebtToEquity: number;
  };
  
  performanceMetrics: {
    perfDay: number;
    perfWeek: number;
    perfMonth: number;
    perfQuarter: number;
    perfHalfYear: number;
    perfYear: number;
    perfYTD: number;
  };
  
  earningsData: {
    eps: number;
    epsTTM: number;
    epsNextQ: number;
    epsThisY: number;
    epsNextY: number;
    eps5Y: number;
    epsPast5Y: number;
    epsGrowthNextQ: number;
    epsGrowthThisY: number;
    epsGrowthNextY: number;
    epsGrowth5Y: number;
  };
  
  salesData: {
    salesGrowthPast5Y: number;
    salesGrowthQuarter: number;
    salesQoQ: number;
  };
  
  profitabilityMetrics: {
    grossMargin: number;
    operatingMargin: number;
    profitMargin: number;
    roe: number;
    roi: number;
    roa: number;
  };
  
  ownershipData: {
    insiderOwn: number;
    insiderTrans: number;
    instOwn: number;
    instTrans: number;
  };
  
  technicalIndicators: {
    rsi14: number;
    sma20: number;
    sma50: number;
    sma200: number;
    volatility: number;
    atr: number;
    range52W: {
      low: number;
      high: number;
    };
    targetPrice: number;
  };
}

export interface StockAnalysis {
  symbol: string;
  detailedData: DetailedStockData;
  technicalIndicators: {
    rsi: number;
    macd: {
      histogram: number;
      signal: number;
      value: number;
    };
    movingAverages: {
      sma20: number;
      sma50: number;
      sma200: number;
    };
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
    };
    volume: {
      current: number;
      average: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
  };
  fundamentalData: {
    peRatio: number;
    roe: number;
    revenueGrowth: number;
    profitMargin: number;
  };
  riskAnalysis: {
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    var95: number;
  };
  marketSentiment: {
    sentimentScore: number;
    shortInterest: number;
    institutionalOwnership: number;
    newsSentiment: 'positive' | 'negative' | 'neutral';
    analystRating: string;
  };
  macroEnvironment: MacroEconomicData;
  consensus: ConsensusAnalysis;
}

interface ConsensusAnalysis {
  technicalConsensus: {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
    strength: number;
    reliability: number;
    signals: Array<{
      indicator: string;
      signal: string;
      weight: number;
    }>;
  };
  fundamentalConsensus: {
    valueMetrics: {
      status: string;
      score: number;
      metrics: Array<{
        name: string;
        value: number;
        benchmark: number;
        evaluation: string;
      }>;
    };
    growthMetrics: {
      status: string;
      score: number;
      metrics: Array<{
        name: string;
        value: number;
        industryAvg: number;
        evaluation: string;
      }>;
    };
    qualityMetrics: {
      status: string;
      score: number;
      metrics: Array<{
        name: string;
        value: number;
        threshold: number;
        evaluation: string;
      }>;
    };
  };
  marketConsensus: {
    overall: string;
    institutionalSentiment: number;
    retailSentiment: number;
    newsImpact: number;
    analystConsensus: {
      targetPrice: number;
      numberOfAnalysts: number;
      distribution: {
        strongBuy: number;
        buy: number;
        hold: number;
        sell: number;
        strongSell: number;
      };
    };
  };
}

function isAlphaVantageSearchResult(data: AlphaVantageSearchResult | AlphaVantageErrorResponse): data is AlphaVantageSearchResult {
  return 'bestMatches' in data;
}

function isAlphaVantageOverview(data: AlphaVantageOverview | AlphaVantageErrorResponse): data is AlphaVantageOverview {
  return 'MarketCapitalization' in data;
}

interface YFinanceData {
  info: {
    marketCap: number;
    sharesOutstanding: number;
    sharesFloat: number;
    shortRatio: number;
    beta: number;
    peRatio: number;
    pegRatio: number;
    bookValue: number;
    eps: number;
    epsTTM: number;
    grossMargins: number;
    operatingMargins: number;
    profitMargins: number;
    returnOnEquity: number;
    returnOnAssets: number;
    revenueGrowth: number;
  };
  history: {
    Date: string[];
    Close: number[];
    Volume: number[];
    High: number[];
    Low: number[];
  };
}

class FinancialAnalysisService {
  private async getPolygonData(symbol: string) {
    try {
      console.log('Récupération des données Polygon pour:', symbol);
      
      // Récupérer les détails du ticker
      const detailsUrl = `/reference/tickers/${symbol}`;
      console.log('URL Details:', detailsUrl);
      
      const detailsResponse = await axiosInstance.get<PolygonTickerDetails>(detailsUrl);
      console.log('Réponse brute Details:', detailsResponse.data);

      // Récupérer le dernier prix
      const quoteUrl = `/last/trade/${symbol}`;
      console.log('URL Quote:', quoteUrl);
      
      const quoteResponse = await axiosInstance.get<PolygonQuote>(quoteUrl);
      console.log('Réponse brute Quote:', quoteResponse.data);

      // Récupérer l'historique des prix (aggrégats journaliers)
      const today = new Date();
      const yearAgo = new Date();
      yearAgo.setFullYear(today.getFullYear() - 1);
      
      const aggregatesUrl = `/aggs/ticker/${symbol}/range/1/day/${yearAgo.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}`;
      console.log('URL Aggregates:', aggregatesUrl);
      
      const aggregatesResponse = await axiosInstance.get<PolygonAggregates>(aggregatesUrl);
      console.log('Réponse brute Aggregates:', aggregatesResponse.data);

      // Si tout est ok, retourner les données
      const result = {
        details: detailsResponse.data.results,
        quote: quoteResponse.data.last,
        aggregates: aggregatesResponse.data.results
      };

      console.log('Données formatées:', JSON.stringify(result, null, 2));
      return result;

    } catch (error) {
      if (error instanceof Error) {
        console.error('Erreur lors de la récupération des données Polygon:', error.message);
        if (axios.isAxiosError(error)) {
          console.error('Détails de l\'erreur Axios:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url
          });
        }
        throw new Error(`Impossible de récupérer les données de marché: ${error.message}`);
      }
      throw error;
    }
  }

  private async getYFinanceData(symbol: string): Promise<YFinanceData> {
    try {
      console.log('Récupération des données YFinance pour:', symbol);
      
      // Configuration des headers
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };
      
      // URL pour les données du ticker
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      
      // Paramètres pour l'historique des prix (1 an)
      const end = Math.floor(Date.now() / 1000);
      const start = end - 365 * 24 * 60 * 60;
      
      const params = {
        period1: start,
        period2: end,
        interval: '1d',
        events: 'history'
      };
      
      // Récupérer les données historiques
      const response = await axios.get(url, { headers, params });
      if (response.status !== 200) {
        throw new Error(`Erreur lors de la récupération des données: ${response.status}`);
      }
      
      const data = response.data;
      if (!data.chart?.result?.[0]) {
        throw new Error(`Données invalides pour ${symbol}`);
      }
      
      const result = data.chart.result[0];
      
      // URL pour les informations du ticker
      const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`;
      const quoteParams = {
        modules: 'summaryDetail,defaultKeyStatistics,financialData'
      };
      
      // Récupérer les informations détaillées
      const quoteResponse = await axios.get(quoteUrl, { headers, params: quoteParams });
      let info: YFinanceData['info'] = {
        marketCap: 0,
        sharesOutstanding: 0,
        sharesFloat: 0,
        shortRatio: 0,
        beta: 0,
        peRatio: 0,
        pegRatio: 0,
        bookValue: 0,
        eps: 0,
        epsTTM: 0,
        grossMargins: 0,
        operatingMargins: 0,
        profitMargins: 0,
        returnOnEquity: 0,
        returnOnAssets: 0,
        revenueGrowth: 0
      };
      
      if (quoteResponse.status === 200) {
        const quoteData = quoteResponse.data;
        if (quoteData.quoteSummary?.result?.[0]) {
          const quoteInfo = quoteData.quoteSummary.result[0];
          
          // Extraire les données des différents modules
          const summary = quoteInfo.summaryDetail || {};
          const stats = quoteInfo.defaultKeyStatistics || {};
          const financials = quoteInfo.financialData || {};
          
          info = {
            marketCap: summary.marketCap?.raw || 0,
            sharesOutstanding: stats.sharesOutstanding?.raw || 0,
            sharesFloat: stats.floatShares?.raw || 0,
            shortRatio: stats.shortRatio?.raw || 0,
            beta: summary.beta?.raw || 0,
            peRatio: summary.trailingPE?.raw || 0,
            pegRatio: stats.pegRatio?.raw || 0,
            bookValue: stats.bookValue?.raw || 0,
            eps: financials.trailingEps?.raw || 0,
            epsTTM: financials.trailingEps?.raw || 0,
            grossMargins: financials.grossMargins?.raw || 0,
            operatingMargins: financials.operatingMargins?.raw || 0,
            profitMargins: financials.profitMargins?.raw || 0,
            returnOnEquity: financials.returnOnEquity?.raw || 0,
            returnOnAssets: financials.returnOnAssets?.raw || 0,
            revenueGrowth: financials.revenueGrowth?.raw || 0
          };
        }
      }
      
      // Préparer les données historiques
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      return {
        info,
        history: {
          Date: timestamps.map((ts: number) => new Date(ts * 1000).toISOString().split('T')[0]),
          Close: quotes.close || [],
          Volume: quotes.volume || [],
          High: quotes.high || [],
          Low: quotes.low || []
        }
      };
      
    } catch (error) {
      if (error instanceof Error) {
        console.error('Erreur lors de la récupération des données YFinance:', error.message);
        throw new Error(`Impossible de récupérer les données YFinance: ${error.message}`);
      }
      throw error;
    }
  }

  async getStockAnalysis(symbol: string): Promise<StockAnalysis> {
    try {
      console.log('Début de l\'analyse pour:', symbol);
      
      // Essayer d'abord YFinance
      let yfinanceData;
      try {
        yfinanceData = await this.getYFinanceData(symbol);
      } catch (yfinanceError) {
        console.warn('Erreur YFinance, utilisation de Polygon comme fallback:', yfinanceError);
        yfinanceData = null;
      }
      
      // Si YFinance a échoué, utiliser Polygon
      if (!yfinanceData) {
        const polygonData = await this.getPolygonData(symbol);
        
        // Conversion des données en format utilisable
        const timeSeriesData = polygonData.aggregates.map(agg => ({
          close: agg.c,
          volume: agg.v,
          high: agg.h,
          low: agg.l
        }));

        const prices = timeSeriesData.map(d => d.close);
        const volumes = timeSeriesData.map(d => d.volume);
        const details = polygonData.details;

        // Calculer le changement quotidien en pourcentage
        const currentPrice = polygonData.quote.price;
        const previousClose = timeSeriesData[timeSeriesData.length - 2]?.close || currentPrice;
        const dailyChangePercent = ((currentPrice - previousClose) / previousClose) * 100;

        const detailedData = {
          marketData: {
            marketCap: details.market_cap || 0,
            volume: polygonData.quote.size,
            avgVolume: this.calculateSMA(volumes, 30),
            relVolume: polygonData.quote.size / this.calculateSMA(volumes, 30),
            sharesOutstanding: details.weighted_shares_outstanding || 0,
            sharesFloat: details.share_class_shares_outstanding || 0,
            shortFloat: 0, // Non disponible dans l'API Polygon
            shortRatio: 0, // Non disponible dans l'API Polygon
            beta: this.calculateBeta(prices) // Calculé à partir des données historiques
          },
          valuationMetrics: {
            peRatio: 0, // Non disponible dans l'API Polygon
            forwardPE: 0, // Non disponible dans l'API Polygon
            peg: 0, // Non disponible dans l'API Polygon
            priceToSales: 0, // Non disponible dans l'API Polygon
            priceToBook: 0, // Non disponible dans l'API Polygon
            priceToFcf: 0,
            currentRatio: 0,
            quickRatio: 0,
            debtToEquity: 0,
            ltDebtToEquity: 0
          },
          performanceMetrics: {
            perfDay: dailyChangePercent,
            perfWeek: this.calculatePerformance(prices, 5),
            perfMonth: this.calculatePerformance(prices, 21),
            perfQuarter: this.calculatePerformance(prices, 63),
            perfHalfYear: this.calculatePerformance(prices, 126),
            perfYear: this.calculatePerformance(prices, 252),
            perfYTD: this.calculateYTDPerformance(prices)
          },
          earningsData: {
            eps: 0, // Non disponible dans l'API Polygon
            epsTTM: 0, // Non disponible dans l'API Polygon
            epsNextQ: 0,
            epsThisY: 0,
            epsNextY: 0,
            eps5Y: 0,
            epsPast5Y: 0,
            epsGrowthNextQ: 0,
            epsGrowthThisY: 0,
            epsGrowthNextY: 0,
            epsGrowth5Y: 0
          },
          salesData: {
            salesGrowthPast5Y: 0,
            salesGrowthQuarter: 0,
            salesQoQ: 0
          },
          profitabilityMetrics: {
            grossMargin: 0, // Non disponible dans l'API Polygon
            operatingMargin: 0, // Non disponible dans l'API Polygon
            profitMargin: 0, // Non disponible dans l'API Polygon
            roe: 0, // Non disponible dans l'API Polygon
            roi: 0,
            roa: 0 // Non disponible dans l'API Polygon
          },
          ownershipData: {
            insiderOwn: 0,
            insiderTrans: 0,
            instOwn: 0,
            instTrans: 0
          },
          technicalIndicators: {
            rsi14: this.calculateRSI(prices),
            sma20: this.calculateSMA(prices, 20),
            sma50: this.calculateSMA(prices, 50),
            sma200: this.calculateSMA(prices, 200),
            volatility: this.calculateVolatility(prices),
            atr: this.calculateATR(
              timeSeriesData.map(d => d.high),
              timeSeriesData.map(d => d.low),
              timeSeriesData.map(d => d.close)
            ),
            range52W: {
              low: Math.min(...prices),
              high: Math.max(...prices)
            },
            targetPrice: 0
          }
        };

        return {
          symbol,
          detailedData,
          technicalIndicators: {
            rsi: this.calculateRSI(prices),
            macd: this.calculateMACD(prices),
            movingAverages: {
              sma20: this.calculateSMA(prices, 20),
              sma50: this.calculateSMA(prices, 50),
              sma200: this.calculateSMA(prices, 200)
            },
            bollingerBands: this.calculateBollingerBands(prices),
            volume: {
              current: volumes[volumes.length - 1],
              average: this.calculateSMA(volumes, 20),
              trend: this.determineVolumeTrend(volumes)
            }
          },
          fundamentalData: {
            peRatio: 0, // Non disponible dans l'API Polygon
            roe: 0, // Non disponible dans l'API Polygon
            revenueGrowth: 0,
            profitMargin: 0 // Non disponible dans l'API Polygon
          },
          riskAnalysis: {
            volatility: this.calculateVolatility(prices),
            sharpeRatio: this.calculateSharpeRatio(prices),
            maxDrawdown: this.calculateMaxDrawdown(prices),
            var95: this.calculateVaR(prices, 0.95)
          },
          marketSentiment: {
            sentimentScore: 0,
            shortInterest: 0,
            institutionalOwnership: 0,
            newsSentiment: 'neutral',
            analystRating: 'N/A'
          },
          macroEnvironment: await this.getMacroEnvironment(),
          consensus: this.getDefaultConsensus()
        };
      } else {
        // Utiliser les données YFinance
        const prices = yfinanceData.history.Close;
        const volumes = yfinanceData.history.Volume;
        const info = yfinanceData.info;

        const detailedData: DetailedStockData = {
          marketData: {
            marketCap: info.marketCap || 0,
            volume: volumes[volumes.length - 1] || 0,
            avgVolume: this.calculateSMA(volumes, 30),
            relVolume: volumes[volumes.length - 1] / this.calculateSMA(volumes, 30),
            sharesOutstanding: info.sharesOutstanding || 0,
            sharesFloat: info.sharesFloat || 0,
            shortFloat: info.shortRatio || 0,
            shortRatio: info.shortRatio || 0,
            beta: info.beta || 0
          },
          valuationMetrics: {
            peRatio: info.peRatio || 0,
            forwardPE: 0,
            peg: info.pegRatio || 0,
            priceToSales: 0,
            priceToBook: info.bookValue || 0,
            priceToFcf: 0,
            currentRatio: 0,
            quickRatio: 0,
            debtToEquity: 0,
            ltDebtToEquity: 0
          },
          performanceMetrics: {
            perfDay: this.calculatePerformance(prices, 1),
            perfWeek: this.calculatePerformance(prices, 5),
            perfMonth: this.calculatePerformance(prices, 21),
            perfQuarter: this.calculatePerformance(prices, 63),
            perfHalfYear: this.calculatePerformance(prices, 126),
            perfYear: this.calculatePerformance(prices, 252),
            perfYTD: this.calculateYTDPerformance(prices)
          },
          earningsData: {
            eps: info.eps || 0,
            epsTTM: info.epsTTM || 0,
            epsNextQ: 0,
            epsThisY: 0,
            epsNextY: 0,
            eps5Y: 0,
            epsPast5Y: 0,
            epsGrowthNextQ: 0,
            epsGrowthThisY: 0,
            epsGrowthNextY: 0,
            epsGrowth5Y: 0
          },
          salesData: {
            salesGrowthPast5Y: info.revenueGrowth || 0,
            salesGrowthQuarter: 0,
            salesQoQ: 0
          },
          profitabilityMetrics: {
            grossMargin: (info.grossMargins || 0) * 100,
            operatingMargin: (info.operatingMargins || 0) * 100,
            profitMargin: (info.profitMargins || 0) * 100,
            roe: info.returnOnEquity || 0,
            roi: 0,
            roa: info.returnOnAssets || 0
          },
          ownershipData: {
            insiderOwn: 0,
            insiderTrans: 0,
            instOwn: 0,
            instTrans: 0
          },
          technicalIndicators: {
            rsi14: this.calculateRSI(prices),
            sma20: this.calculateSMA(prices, 20),
            sma50: this.calculateSMA(prices, 50),
            sma200: this.calculateSMA(prices, 200),
            volatility: this.calculateVolatility(prices),
            atr: this.calculateATR(
              prices.slice(1).map((price, i) => price - prices[i]),
              prices.slice(1).map((price, i) => price - prices[i]),
              prices.slice(1).map((price, i) => price - prices[i])
            ),
            range52W: {
              low: Math.min(...prices),
              high: Math.max(...prices)
            },
            targetPrice: 0
          }
        };

        return {
          symbol,
          detailedData,
          technicalIndicators: {
            rsi: this.calculateRSI(prices),
            macd: this.calculateMACD(prices),
            movingAverages: {
              sma20: this.calculateSMA(prices, 20),
              sma50: this.calculateSMA(prices, 50),
              sma200: this.calculateSMA(prices, 200)
            },
            bollingerBands: this.calculateBollingerBands(prices),
            volume: {
              current: volumes[volumes.length - 1],
              average: this.calculateSMA(volumes, 20),
              trend: this.determineVolumeTrend(volumes)
            }
          },
          fundamentalData: {
            peRatio: info.peRatio || 0,
            roe: info.returnOnEquity || 0,
            revenueGrowth: info.revenueGrowth || 0,
            profitMargin: (info.profitMargins || 0) * 100
          },
          riskAnalysis: {
            volatility: this.calculateVolatility(prices),
            sharpeRatio: this.calculateSharpeRatio(prices),
            maxDrawdown: this.calculateMaxDrawdown(prices),
            var95: this.calculateVaR(prices, 0.95)
          },
          marketSentiment: {
            sentimentScore: 0,
            shortInterest: 0,
            institutionalOwnership: 0,
            newsSentiment: 'neutral',
            analystRating: 'N/A'
          },
          macroEnvironment: await this.getMacroEnvironment(),
          consensus: this.getDefaultConsensus()
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Erreur lors de l\'analyse:', error.message);
        throw new Error(`Impossible d'analyser ${symbol}: ${error.message}`);
      }
      throw error;
    }
  }

  private calculatePerformanceMetrics(prices: number[]) {
    const current = prices[prices.length - 1];
    const previous = prices[prices.length - 2];
    
    return {
      perfDay: ((current - previous) / previous) * 100,
      perfWeek: this.calculatePerformance(prices, 5),
      perfMonth: this.calculatePerformance(prices, 21),
      perfQuarter: this.calculatePerformance(prices, 63),
      perfHalfYear: this.calculatePerformance(prices, 126),
      perfYear: this.calculatePerformance(prices, 252),
      perfYTD: this.calculateYTDPerformance(prices)
    };
  }

  private calculateMACD(prices: number[]): { histogram: number; signal: number; value: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    const signalLine = this.calculateEMA([macdLine], 9);
    
    return {
      value: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  private calculateEMA(prices: number[], period: number): number {
    const k = 2 / (period + 1);
    return prices.reduce((ema, price) => (price - ema) * k + ema);
  }

  private calculateBollingerBands(prices: number[]) {
    const sma = this.calculateSMA(prices, 20);
    const stdDev = this.calculateStandardDeviation(prices, 20);
    
    return {
      upper: sma + (2 * stdDev),
      middle: sma,
      lower: sma - (2 * stdDev)
    };
  }

  private calculateStandardDeviation(prices: number[], period: number): number {
    const mean = this.calculateSMA(prices.slice(-period), period);
    const squaredDiffs = prices.slice(-period).map(price => Math.pow(price - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / period);
  }

  private calculateMaxDrawdown(prices: number[]): number {
    let maxDrawdown = 0;
    let peak = prices[0];
    
    for (const price of prices) {
      if (price > peak) {
        peak = price;
      }
      const drawdown = (peak - price) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown * 100;
  }

  private calculateSharpeRatio(prices: number[], riskFreeRate: number = 0.02): number {
    const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
    
    return (avgReturn - riskFreeRate) / stdDev;
  }

  private calculateVaR(prices: number[], confidence: number): number {
    const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
    returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * returns.length);
    return -returns[index] * 100;
  }

  private determineVolumeTrend(volumes: number[]): 'increasing' | 'decreasing' | 'stable' {
    const recentAvg = this.calculateSMA(volumes.slice(-5), 5);
    const oldAvg = this.calculateSMA(volumes.slice(-10, -5), 5);
    
    if (recentAvg > oldAvg * 1.1) return 'increasing';
    if (recentAvg < oldAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  private async getMacroEnvironment(): Promise<MacroEconomicData> {
    try {
      // Utiliser le service FRED pour obtenir les données macroéconomiques réelles
      return await fredService.getMacroEconomicData();
    } catch (error) {
      console.error('Erreur lors de la récupération des données macroéconomiques:', error);
      
      // Utilisation de valeurs par défaut en cas d'erreur
    return {
      gdpGrowth: 0,
      inflation: 0,
      unemploymentRate: 0,
      interestRates: {
        federal: 0,
        treasury10Y: 0,
        treasury2Y: 0
      },
      economicIndicators: {
        pmi: 0,
        consumerConfidence: 0,
        retailSales: 0,
        industrialProduction: 0
      },
      globalMarkets: {
        usDollarIndex: 0,
        vix: 0,
        goldPrice: 0,
        oilPrice: 0
      }
    };
    }
  }

  private getDefaultConsensus(): ConsensusAnalysis {
    return {
      technicalConsensus: {
        shortTerm: 'Neutre',
        mediumTerm: 'Neutre',
        longTerm: 'Neutre',
        strength: 50,
        reliability: 50,
        signals: []
      },
      fundamentalConsensus: {
        valueMetrics: {
          status: 'Neutre',
          score: 50,
          metrics: []
        },
        growthMetrics: {
          status: 'Neutre',
          score: 50,
          metrics: []
        },
        qualityMetrics: {
          status: 'Neutre',
          score: 50,
          metrics: []
        }
      },
      marketConsensus: {
        overall: 'Neutre',
        institutionalSentiment: 0,
        retailSentiment: 0,
        newsImpact: 0,
        analystConsensus: {
          targetPrice: 0,
          numberOfAnalysts: 0,
          distribution: {
            strongBuy: 0,
            buy: 0,
            hold: 0,
            sell: 0,
            strongSell: 0
          }
        }
      }
    };
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (!prices || prices.length < period + 1) return 50;
    
    const changes = prices.slice(1).map((price, index) => price - prices[index]);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateSMA(prices: number[], period: number): number {
    if (!prices || prices.length < period) return 0;
    return prices.slice(-period).reduce((a, b) => a + b) / period;
  }

  private calculateVolatility(prices: number[], period: number = 20): number {
    if (!prices || prices.length < period + 1) return 0;
    
    const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance * 252) * 100; // Annualisé
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (!highs || !lows || !closes || highs.length < 2) return 0;
    
    const tr = highs.map((high, i) => {
      if (i === 0) return high - lows[i];
      const yesterdayClose = closes[i - 1];
      return Math.max(
        high - lows[i],
        Math.abs(high - yesterdayClose),
        Math.abs(lows[i] - yesterdayClose)
      );
    });

    return tr.slice(-period).reduce((a, b) => a + b) / period;
  }

  private calculatePerformance(prices: number[], period: number): number {
    if (!prices || prices.length < period) return 0;
    const start = prices[prices.length - period] || prices[0];
    const end = prices[prices.length - 1];
    return ((end - start) / start) * 100;
  }

  private calculateYTDPerformance(prices: number[]): number {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const daysInYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const daysInYTD = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const performance = ((endPrice - startPrice) / startPrice) * 100;
    return (performance / 100) * (daysInYTD / daysInYear);
  }

  private calculateFundamentalMetrics(overview: AlphaVantageOverview): FundamentalMetrics {
    return {
      marketCap: parseFloat(overview.MarketCapitalization) || 0,
      sharesOutstanding: parseFloat(overview.SharesOutstanding) || 0,
      sharesFloat: parseFloat(overview.SharesFloat) || 0,
      sharesShort: parseFloat(overview.SharesShort) || 0,
      shortRatio: parseFloat(overview.ShortRatio) || 0,
      beta: parseFloat(overview.Beta) || 0,
      peRatio: parseFloat(overview.PERatio) || 0,
      pegRatio: parseFloat(overview.PEGRatio) || 0,
      bookValue: parseFloat(overview.BookValue) || 0,
    };
  }

  private calculateBeta(prices: number[], marketPrices?: number[]): number {
    if (!marketPrices) {
      return 1; // Valeur par défaut si les données du marché ne sont pas disponibles
    }
    
    const stockReturns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
    const marketReturns = marketPrices.slice(1).map((price, i) => (price - marketPrices[i]) / marketPrices[i]);
    
    const stockVariance = this.calculateVariance(stockReturns);
    const marketVariance = this.calculateVariance(marketReturns);
    const covariance = this.calculateCovariance(stockReturns, marketReturns);
    
    return covariance / marketVariance;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  }

  private calculateCovariance(values1: number[], values2: number[]): number {
    const mean1 = values1.reduce((a, b) => a + b) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b) / values2.length;
    
    return values1.reduce((sum, _, i) => sum + (values1[i] - mean1) * (values2[i] - mean2), 0) / values1.length;
  }
}

export const financialAnalysisService = new FinancialAnalysisService();
export type { MacroEconomicData, ConsensusAnalysis }; 