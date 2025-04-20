export interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryDate: Date;
  exitDate: Date;
  profitLoss: number;
  strategy: string;
  notes?: string;
  timeframe: string;
  risk: number;
  fees?: number;        // Frais divers
  spread?: number;      // Coût du spread
  commission?: number;  // Commissions du broker
}

export interface PortfolioStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  totalProfitLoss: number;
  maxDrawdown: number;
}

export interface EquityPoint {
  date: Date;
  balance: number;
  invested?: number;
}

export interface CryptoPosition {
  id: string;
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  profitLoss: number;
  entryDate: Date;
  color?: string;
}

export interface LongTermInvestment {
  id: string;
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  purchaseDate: Date;
  strategy: string;
  portfolioType: string;
  profitLoss: number;
}

export interface LongTermMetrics {
  totalValue: number;
  totalProfitLoss: number;
  profitLossPercentage: number;
  averageHoldingPeriod: number;
  averageReturn: number;
  dividendYield: number;
  portfolioBeta: number;
  beta: number;
  sectorAllocation: {
    technology: number;
    finance: number;
    healthcare: number;
    consumer: number;
    energy: number;
    other: number;
  };
} 