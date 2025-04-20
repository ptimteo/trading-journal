import { defineStore } from 'pinia';
import type { Trade, PortfolioStats, CryptoPosition, LongTermInvestment, EquityPoint } from '../types/trading';
import { apiService } from '../services/api';

interface TradingMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRateGlobal: number;
  winRatePure: number;
  winRateBreakeven: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  maxDrawdown: number;
  sharpeRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageTradeDuration: number;
  advancedWinRate?: number;
  valueAtRisk95?: number;
  valueAtRisk99?: number;
  conditionalVaR95?: number;
  conditionalVaR99?: number;
}

interface CryptoMetrics {
  btcFearGreedIndex: number;
  btcDominance: number;
  altcoinSeasonIndex: number;
  totalValue: number;
  totalProfitLoss: number;
  profitLossPercentage: number;
  marketCap: number;
  volume24h: number;
  dominance: {
    btc: number;
    eth: number;
    others: number;
  };
}

interface LongTermMetrics {
  totalValue: number;
  totalProfitLoss: number;
  profitLossPercentage: number;
  averageHoldingPeriod: number;
  averageReturn: number;
  dividendYield: number;
  portfolioBeta: number;
  sectorAllocation: {
    technology: number;
    finance: number;
    healthcare: number;
    consumer: number;
    energy: number;
    other: number;
  };
  beta: number;
  trend: {
    direction: string;
    value: number;
  };
}

// Clé de stockage local
const STORAGE_KEY = 'trading-journal';

export const useTradingStore = defineStore('trading', {
  state: () => ({
    trading: {
      initialCapital: 10000,
      currentCapital: 10000,
      trades: [] as Trade[],
      equityCurve: [] as EquityPoint[],
      metrics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRateGlobal: 0,
        winRatePure: 0,
        winRateBreakeven: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        expectancy: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        averageTradeDuration: 0
      } as TradingMetrics
    },
    crypto: {
      positions: [] as CryptoPosition[],
      equityCurve: [] as EquityPoint[],
      metrics: {
        btcFearGreedIndex: 0,
        btcDominance: 0,
        altcoinSeasonIndex: 0,
        totalValue: 0,
        totalProfitLoss: 0,
        profitLossPercentage: 0,
        marketCap: 0,
        volume24h: 0,
        dominance: {
          btc: 0,
          eth: 0,
          others: 0
        }
      } as CryptoMetrics
    },
    longTerm: {
      investments: [] as LongTermInvestment[],
      equityCurve: [] as EquityPoint[],
      metrics: {
        totalValue: 0,
        totalProfitLoss: 0,
        profitLossPercentage: 0,
        averageHoldingPeriod: 0,
        averageReturn: 0,
        dividendYield: 0,
        portfolioBeta: 0,
        sectorAllocation: {
          technology: 0,
          finance: 0,
          healthcare: 0,
          consumer: 0,
          energy: 0,
          other: 0
        },
        beta: 0,
        trend: {
          direction: 'stable',
          value: 0
        }
      } as LongTermMetrics
    },
    initialCapital: 10000 // Capital initial par défaut
  }),

  getters: {
    tradingMetrics: (state): TradingMetrics => state.trading.metrics,
    cryptoMetrics: (state): CryptoMetrics => state.crypto.metrics,
    longTermMetrics: (state): LongTermMetrics => state.longTerm.metrics,
  },

  actions: {
    saveToLocalStorage() {
      // Sauvegarder les trades avec conversion des dates en ISO string
      localStorage.setItem('trades', JSON.stringify(this.trading.trades.map(trade => ({
        ...trade,
        entryDate: trade.entryDate instanceof Date ? trade.entryDate.toISOString() : trade.entryDate,
        exitDate: trade.exitDate instanceof Date ? trade.exitDate.toISOString() : trade.exitDate
      }))));
      
      // Sauvegarder la courbe d'équité
      localStorage.setItem('equityCurve', JSON.stringify(this.trading.equityCurve.map(point => ({
        ...point,
        date: point.date instanceof Date ? point.date.toISOString() : point.date
      }))));
      
      // Sauvegarder les positions crypto
      localStorage.setItem('cryptoPositions', JSON.stringify(this.crypto.positions));
      
      // Sauvegarder les métriques crypto importantes
      localStorage.setItem('cryptoMetrics', JSON.stringify({
        btcFearGreedIndex: this.crypto.metrics.btcFearGreedIndex,
        btcDominance: this.crypto.metrics.btcDominance,
        altcoinSeasonIndex: this.crypto.metrics.altcoinSeasonIndex
      }));
      
      // Sauvegarder les investissements long terme
      localStorage.setItem('longTermInvestments', JSON.stringify(this.longTerm.investments.map(inv => ({
        ...inv,
        purchaseDate: inv.purchaseDate instanceof Date ? inv.purchaseDate.toISOString() : inv.purchaseDate
      }))));
    },

    loadFromLocalStorage() {
      console.log('Début du chargement des données depuis le localStorage');
      
      // Vérifier les clés présentes dans le localStorage
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      console.log('Clés disponibles dans localStorage:', keys);
      
      // Essayer de charger les investissements long terme directement
      const savedLongTermInvestments = localStorage.getItem('longTermInvestments');
      if (savedLongTermInvestments) {
        try {
          const parsedInvestments = JSON.parse(savedLongTermInvestments);
          console.log('Investissements long terme chargés directement:', parsedInvestments);
          
          // Convertir les dates
          this.longTerm.investments = parsedInvestments.map((inv: any) => ({
            ...inv,
            purchaseDate: new Date(inv.purchaseDate)
          }));
          
          console.log('Investissements long terme après conversion des dates:', this.longTerm.investments);
        } catch (e) {
          console.error('Erreur lors du parsing des investissements long terme:', e);
        }
      } else {
        console.log('Aucun investissement long terme trouvé dans localStorage');
      }
      
      const savedData = localStorage.getItem(STORAGE_KEY);
      
      // Charger les métriques crypto séparément pour assurer leur persistance
      const savedCryptoMetrics = localStorage.getItem('cryptoMetrics');
      if (savedCryptoMetrics) {
        try {
          const parsedMetrics = JSON.parse(savedCryptoMetrics);
          this.crypto.metrics.btcFearGreedIndex = parsedMetrics.btcFearGreedIndex || 0;
          this.crypto.metrics.btcDominance = parsedMetrics.btcDominance || 0;
          this.crypto.metrics.altcoinSeasonIndex = parsedMetrics.altcoinSeasonIndex || 0;
          console.log('Métriques crypto chargées:', this.crypto.metrics);
        } catch (e) {
          console.error('Erreur lors du chargement des métriques crypto:', e);
        }
      }
      
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          console.log('Données globales chargées:', parsedData);
          
          // Restaurer les données du trading
          this.trading = {
            ...parsedData.trading,
            trades: parsedData.trading.trades.map((trade: any) => ({
              ...trade,
              entryDate: new Date(trade.entryDate),
              exitDate: new Date(trade.exitDate)
            })),
            equityCurve: parsedData.trading.equityCurve.map((point: any) => ({
              ...point,
              date: new Date(point.date)
            }))
          };

          // Restaurer les données crypto
          this.crypto = {
            ...parsedData.crypto,
            equityCurve: parsedData.crypto.equityCurve.map((point: any) => ({
              ...point,
              date: new Date(point.date)
            }))
          };

          // Si les investissements n'ont pas été chargés directement, les charger depuis les données globales
          if (!savedLongTermInvestments && parsedData.longTerm && parsedData.longTerm.investments) {
            console.log('Chargement des investissements depuis les données globales:', parsedData.longTerm.investments);
            this.longTerm = {
              ...parsedData.longTerm,
              investments: parsedData.longTerm.investments.map((inv: any) => ({
                ...inv,
                purchaseDate: new Date(inv.purchaseDate)
              })),
              equityCurve: parsedData.longTerm.equityCurve.map((point: any) => ({
                ...point,
                date: new Date(point.date)
              }))
            };
          }

          // Charger le capital initial global
          const initialCapitalData = localStorage.getItem('initialCapital');
          if (initialCapitalData) {
            try {
              const parsedCapital = JSON.parse(initialCapitalData);
              this.initialCapital = parsedCapital;
              // S'assurer que le capital initial de trading est synchronisé
              this.trading.initialCapital = parsedCapital;
              console.log('Capital initial chargé:', this.initialCapital);
            } catch (e) {
              console.error('Erreur lors du parsing du capital initial:', e);
            }
          }
        } catch (e) {
          console.error('Erreur lors du parsing des données globales:', e);
        }
      } else {
        // Initialiser pour première utilisation
        console.log('Aucune donnée globale trouvée, initialisation des données');
        this.initializeData();
      }
      
      // Mettre à jour les métriques après chargement
      this.updateLongTermMetrics();
      
      console.log('Fin du chargement des données - État actuel de longTerm.investments:', this.longTerm.investments);
    },

    // Mise à jour du capital initial global
    updateInitialCapital(amount: number) {
      this.initialCapital = amount;
      // Synchroniser avec le capital initial de trading
      this.trading.initialCapital = amount;
      // Sauvegarder le capital initial dans localStorage
      localStorage.setItem('initialCapital', JSON.stringify(amount));
      console.log('Capital initial mis à jour et sauvegardé:', amount);
      // Mettre à jour la courbe d'équité avec le nouveau capital
      this.updateEquityCurve();
    },

    // Mise à jour spécifique du capital initial de trading
    updateTradingInitialCapital(amount: number) {
      this.initialCapital = amount;
      this.trading.initialCapital = amount;
      localStorage.setItem('initialCapital', JSON.stringify(amount));
      console.log('Capital initial de trading mis à jour:', amount);
      this.updateEquityCurve();
      this.saveToLocalStorage();
    },

    // Réinitialiser complètement toutes les données
    resetAllData() {
      // Sauvegarder le capital initial actuel avant de réinitialiser
      const currentInitialCapital = this.initialCapital;
      
      // Effacer les données du store
      this.trading.trades = [];
      this.trading.equityCurve = [];
      this.crypto.positions = [];
      this.longTerm.investments = [];
      
      // Effacer TOUTES les données du localStorage liées à l'application
      localStorage.removeItem('trades');
      localStorage.removeItem('equityCurve');
      localStorage.removeItem('cryptoPositions');
      localStorage.removeItem('longTermInvestments');
      localStorage.removeItem(STORAGE_KEY);
      
      // Restaurer le capital initial sauvegardé
      this.initialCapital = currentInitialCapital;
      // S'assurer que le capital initial est sauvegardé en localStorage
      localStorage.setItem('initialCapital', JSON.stringify(currentInitialCapital));
      
      // Mettre à jour les métriques
      this.updateTradingMetrics();
      this.updateEquityCurve();
      
      // Forcer la sauvegarde de l'état vide
      this.saveToLocalStorage();
      
      // Pour débug - vérifier que les trades sont bien vides et le capital préservé
      console.log('Réinitialisation effectuée - trades:', this.trading.trades);
      console.log('Capital initial préservé:', this.initialCapital);
    },

    // Initialisation des données
    initializeData() {
      // D'abord charger le capital initial depuis localStorage
      const initialCapitalData = localStorage.getItem('initialCapital');
      if (initialCapitalData) {
        try {
          const parsedCapital = JSON.parse(initialCapitalData);
          this.initialCapital = parsedCapital;
          // S'assurer que le capital initial de trading est synchronisé
          this.trading.initialCapital = parsedCapital;
          console.log('Capital initial chargé:', this.initialCapital);
        } catch (e) {
          console.error('Erreur lors du parsing du capital initial:', e);
        }
      }
      
      // Charger les trades depuis localStorage
      const tradesData = localStorage.getItem('trades');
      if (tradesData) {
        try {
          this.trading.trades = JSON.parse(tradesData).map((trade: any) => ({
            ...trade,
            entryDate: new Date(trade.entryDate),
            exitDate: new Date(trade.exitDate)
          }));
          console.log('Trades chargés depuis localStorage:', this.trading.trades.length);
        } catch (e) {
          console.error('Erreur lors du chargement des trades:', e);
          this.trading.trades = [];
        }
      } else {
        console.log('Aucun trade trouvé dans localStorage');
        this.trading.trades = [];
      }
      
      // Charger la courbe d'équité depuis localStorage
      const equityCurveData = localStorage.getItem('equityCurve');
      if (equityCurveData) {
        try {
          // Convertir les chaînes de date en objets Date
          this.trading.equityCurve = JSON.parse(equityCurveData).map((point: any) => ({
            ...point,
            date: new Date(point.date)
          }));
          console.log('Courbe d\'équité chargée:', this.trading.equityCurve.length, 'points');
        } catch (e) {
          console.error('Erreur lors du chargement de la courbe d\'équité:', e);
          this.updateEquityCurve();
        }
      } else {
        console.log('Aucune courbe d\'équité trouvée, recalcul...');
        this.updateEquityCurve();
      }
      
      // Charger le capital courant depuis localStorage
      const currentCapitalData = localStorage.getItem('currentCapital');
      if (currentCapitalData) {
        try {
          this.trading.currentCapital = JSON.parse(currentCapitalData);
          console.log('Capital courant chargé:', this.trading.currentCapital);
        } catch (e) {
          console.error('Erreur lors du chargement du capital courant:', e);
          this.trading.currentCapital = this.initialCapital;
        }
      } else {
        this.trading.currentCapital = this.initialCapital;
      }
      
      // Mettre à jour les métriques
      this.updateTradingMetrics();
    },

    async updateRealTimeData() {
      try {
        // Mettre à jour les prix des cryptos
        for (const position of this.crypto.positions) {
          const quote = await apiService.getCryptoQuote(position.symbol);
          if (quote) {
            position.currentPrice = quote.price;
            position.profitLoss = (quote.price - position.averageEntryPrice) * position.quantity;
          }
        }

        // Mettre à jour les prix des investissements long terme
        for (const investment of this.longTerm.investments) {
          const quote = await apiService.getStockQuote(investment.symbol);
          if (quote) {
            investment.currentPrice = quote.price;
            investment.profitLoss = (quote.price - investment.averageEntryPrice) * investment.quantity;
          }
        }

        // Sauvegarder les modifications
        this.saveToLocalStorage();
      } catch (error) {
        console.error('Erreur lors de la mise à jour des données en temps réel:', error);
      }
    },

    addTrade(trade: Omit<Trade, 'id'>) {
      const newTrade: Trade = {
        ...trade,
        id: `trade-${Date.now()}`
      };
      this.trading.trades.push(newTrade);
      this.updateTradingMetrics();
      this.updateEquityCurve();
      this.saveToLocalStorage();
    },

    addCryptoPosition(position: Omit<CryptoPosition, 'id'>) {
      const newPosition: CryptoPosition = {
        ...position,
        id: `crypto-${Date.now()}`
      };
      this.crypto.positions.push(newPosition);
      this.updateCryptoMetrics();
      this.saveToLocalStorage();
    },

    addLongTermInvestment(investment: Omit<LongTermInvestment, 'id'>) {
      try {
        console.log('Store: Ajout d\'un investissement long terme:', investment);
        
        // Vérifier que les propriétés nécessaires sont présentes et valides
        if (!investment.symbol) {
          console.error('Symbole manquant');
          return;
        }
        
        if (typeof investment.quantity !== 'number' || isNaN(investment.quantity) || investment.quantity <= 0) {
          console.error('Quantité invalide:', investment.quantity);
          return;
        }
        
        if (typeof investment.averageEntryPrice !== 'number' || isNaN(investment.averageEntryPrice) || investment.averageEntryPrice < 0) {
          console.error('Prix d\'entrée invalide:', investment.averageEntryPrice);
          return;
        }
        
        if (typeof investment.currentPrice !== 'number' || isNaN(investment.currentPrice) || investment.currentPrice < 0) {
          console.error('Prix actuel invalide:', investment.currentPrice);
          return;
        }
        
        // S'assurer que purchaseDate est une date valide
        let purchaseDate: Date;
        if (investment.purchaseDate instanceof Date) {
          purchaseDate = investment.purchaseDate;
        } else {
          try {
            purchaseDate = new Date(investment.purchaseDate);
            if (isNaN(purchaseDate.getTime())) {
              console.error('Date d\'achat invalide:', investment.purchaseDate);
              return;
            }
          } catch (e) {
            console.error('Erreur lors de la conversion de la date d\'achat:', e);
            return;
          }
        }
        
        const newInvestment: LongTermInvestment = {
          ...investment,
          purchaseDate, // Utiliser la date convertie
          id: `lt-${Date.now()}`
        };
        
        console.log('Nouvel investissement créé:', newInvestment);
        
        this.longTerm.investments.push(newInvestment);
        this.updateLongTermMetrics();
        this.saveToLocalStorage();
        
        console.log('Investissement ajouté avec succès, nouvelle liste:', this.longTerm.investments);
        
      } catch (error) {
        console.error('Erreur lors de l\'ajout d\'un investissement long terme:', error);
      }
    },

    updateTradingMetrics() {
      const trades = this.trading.trades;
      const winningTrades = trades.filter(t => t.profitLoss > 0);
      const losingTrades = trades.filter(t => t.profitLoss < 0);
      
      // Calculer la somme des profits
      const totalProfits = winningTrades.reduce((sum, t) => sum + t.profitLoss, 0);
      // Calculer la valeur absolue de la somme des pertes
      const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profitLoss, 0));
      
      // Calculer le profit factor (totalProfits / totalLosses)
      const profitFactor = totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? 999 : 0;
      
      // Calculer les trades en break-even (P/L = 0)
      const breakEvenTrades = trades.filter(t => t.profitLoss === 0);
      const breakEvenRate = trades.length ? (breakEvenTrades.length / trades.length) * 100 : 0;
      
      this.trading.metrics = {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRateGlobal: trades.length ? (winningTrades.length / trades.length) * 100 + breakEvenRate : 0,
        winRatePure: trades.length ? (winningTrades.length / trades.length) * 100 : 0,
        winRateBreakeven: trades.length ? ((winningTrades.length + breakEvenTrades.length) / trades.length) * 100 : 0,
        profitFactor: profitFactor,
        averageWin: winningTrades.length ? winningTrades.reduce((sum, t) => sum + t.profitLoss, 0) / winningTrades.length : 0,
        averageLoss: losingTrades.length ? losingTrades.reduce((sum, t) => sum + t.profitLoss, 0) / losingTrades.length : 0,
        expectancy: trades.length ? trades.reduce((sum, t) => sum + t.profitLoss, 0) / trades.length : 0,
        maxDrawdown: this.calculateMaxDrawdown(),
        sharpeRatio: this.calculateSharpeRatio(),
        maxConsecutiveWins: this.calculateMaxConsecutiveWins(),
        maxConsecutiveLosses: this.calculateMaxConsecutiveLosses(),
        averageTradeDuration: this.calculateAverageTradeDuration()
      };
      
      console.log('Métriques trading mises à jour:', {
        totalTrades: trades.length,
        winRate: this.trading.metrics.winRateGlobal.toFixed(1) + '%',
        profitFactor: profitFactor.toFixed(2),
        totalProfits: totalProfits.toFixed(2),
        totalLosses: totalLosses.toFixed(2)
      });
    },

    updateCryptoMetrics() {
      try {
        // Calculer les métriques basées sur les positions
        const positions = this.crypto.positions;
        const totalValue = positions.reduce((sum, p) => sum + (p.currentPrice * p.quantity), 0);
        const totalProfitLoss = positions.reduce((sum, p) => sum + p.profitLoss, 0);
        
        // Conserver les métriques existantes qui ne sont pas calculées ici
        // comme btcFearGreedIndex et btcDominance
        const currentFearGreedIndex = this.crypto.metrics.btcFearGreedIndex || 45;
        const currentBtcDominance = this.crypto.metrics.btcDominance || 51.2;
        const currentAltcoinSeasonIndex = this.crypto.metrics.altcoinSeasonIndex || 35;
        
        // Mettre à jour les métriques
        this.crypto.metrics = {
          ...this.crypto.metrics,
          totalValue,
          totalProfitLoss,
          profitLossPercentage: totalValue ? (totalProfitLoss / totalValue) * 100 : 0,
          // Conserver ces valeurs importantes même après mise à jour
          btcFearGreedIndex: currentFearGreedIndex,
          btcDominance: currentBtcDominance,
          altcoinSeasonIndex: currentAltcoinSeasonIndex
        };
        
        // Sauvegarder les métriques importantes dans localStorage
        localStorage.setItem('cryptoMetrics', JSON.stringify({
          btcFearGreedIndex: this.crypto.metrics.btcFearGreedIndex,
          btcDominance: this.crypto.metrics.btcDominance,
          altcoinSeasonIndex: this.crypto.metrics.altcoinSeasonIndex
        }));
        
        console.log('Métriques crypto mises à jour et sauvegardées:', this.crypto.metrics);
        
        return {
          btcFearGreedIndex: this.crypto.metrics.btcFearGreedIndex,
          btcDominance: this.crypto.metrics.btcDominance
        };
      } catch (error) {
        console.error('Erreur lors de la mise à jour des métriques crypto:', error);
        return {
          btcFearGreedIndex: 50,
          btcDominance: 50
        };
      }
    },

    updateLongTermMetrics() {
      const investments = this.longTerm.investments;
      const totalValue = investments.reduce((sum, inv) => sum + (inv.currentPrice * inv.quantity), 0);
      const totalInitialValue = investments.reduce((sum, inv) => sum + (inv.averageEntryPrice * inv.quantity), 0);
      const totalProfitLoss = totalValue - totalInitialValue;
      const profitLossPercentage = totalInitialValue > 0 ? (totalProfitLoss / totalInitialValue) * 100 : 0;
      
      // Calcul du bêta du portefeuille
      // Les bêtas moyens par type d'actif (simplifiés pour l'exemple)
      const betaValues = {
        'SP500': 1.0,
        'NS100': 1.2,
        'CAC40': 1.1,
        'MSCI W': 1.0,
        'WLD SWP PEA': 0.95,
        'PANIER DYNAMIQUE': 1.15,
        // Valeurs par défaut pour les autres actifs
        'default': 1.0
      };
      
      let weightedBeta = 0;
      if (totalValue > 0) {
        for (const inv of investments) {
          const investmentValue = inv.currentPrice * inv.quantity;
          const weight = investmentValue / totalValue;
          const beta = betaValues[inv.symbol as keyof typeof betaValues] || betaValues.default;
          weightedBeta += beta * weight;
        }
      }
      
      // Calcul de la tendance récente (des 7 derniers jours)
      let trendDirection = 'stable';
      let trendValue = 0;
      
      if (this.longTerm.equityCurve.length >= 2) {
        // Obtenir les 7 derniers points de la courbe d'équité (ou moins s'il y en a moins)
        const recentPoints = this.longTerm.equityCurve.slice(-Math.min(7, this.longTerm.equityCurve.length));
        
        // Calculer les variations entre points consécutifs
        const variations = [];
        for (let i = 1; i < recentPoints.length; i++) {
          const prevValue = recentPoints[i-1].balance;
          const currentValue = recentPoints[i].balance;
          const variation = prevValue > 0 ? (currentValue - prevValue) / prevValue * 100 : 0;
          variations.push(variation);
        }
        
        // Calculer la moyenne des variations
        trendValue = variations.length > 0 
          ? variations.reduce((sum, var_) => sum + var_, 0) / variations.length 
          : 0;
        
        // Déterminer la direction de la tendance
        if (trendValue > 1) trendDirection = 'en forte hausse';
        else if (trendValue > 0.2) trendDirection = 'en hausse';
        else if (trendValue < -1) trendDirection = 'en forte baisse';
        else if (trendValue < -0.2) trendDirection = 'en baisse';
        else trendDirection = 'stable';
      }
      
      this.longTerm.metrics = {
        ...this.longTerm.metrics,
        totalValue,
        totalProfitLoss,
        profitLossPercentage,
        beta: parseFloat(weightedBeta.toFixed(2)),
        trend: {
          direction: trendDirection,
          value: parseFloat(trendValue.toFixed(2))
        }
      };
    },

    calculateMaxDrawdown() {
      const equityCurve = this.trading.equityCurve;
      let maxDrawdown = 0;
      let peak = equityCurve[0]?.balance || 0;

      for (const point of equityCurve) {
        if (point.balance > peak) {
          peak = point.balance;
        }
        const drawdown = ((peak - point.balance) / peak) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      return maxDrawdown;
    },

    calculateSharpeRatio() {
      const equityCurve = this.trading.equityCurve;
      if (equityCurve.length < 2) return 0;

      const returns = [];
      for (let i = 1; i < equityCurve.length; i++) {
        const dailyReturn = (equityCurve[i].balance - equityCurve[i - 1].balance) / equityCurve[i - 1].balance;
        returns.push(dailyReturn);
      }

      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);

      return stdDev ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    },

    calculateMaxConsecutiveWins() {
      const trades = this.trading.trades;
      let maxWins = 0;
      let currentWins = 0;

      for (const trade of trades) {
        if (trade.profitLoss > 0) {
          currentWins++;
          maxWins = Math.max(maxWins, currentWins);
        } else {
          currentWins = 0;
        }
      }

      return maxWins;
    },

    calculateMaxConsecutiveLosses() {
      const trades = this.trading.trades;
      let maxLosses = 0;
      let currentLosses = 0;

      for (const trade of trades) {
        if (trade.profitLoss < 0) {
          currentLosses++;
          maxLosses = Math.max(maxLosses, currentLosses);
        } else {
          currentLosses = 0;
        }
      }

      return maxLosses;
    },

    calculateAverageTradeDuration() {
      const trades = this.trading.trades;
      if (!trades.length) return 0;

      const totalDuration = trades.reduce((sum, trade) => {
        const duration = trade.exitDate.getTime() - trade.entryDate.getTime();
        return sum + duration;
      }, 0);

      return totalDuration / (trades.length * 24 * 60 * 60 * 1000); // Convertir en jours
    },

    deleteAllTrades() {
      this.trading.trades = [];
      this.updateTradingMetrics();
      this.updateEquityCurve();
      this.saveToLocalStorage();
    },

    deleteTrade(id: string) {
      this.trading.trades = this.trading.trades.filter(trade => trade.id !== id);
      this.updateTradingMetrics();
      this.updateEquityCurve();
      this.saveToLocalStorage();
    },

    deleteCryptoPosition(id: string) {
      this.crypto.positions = this.crypto.positions.filter(position => position.id !== id)
      this.updateCryptoMetrics()
      this.saveToLocalStorage()
    },

    deleteLongTermInvestment(id: string) {
      this.longTerm.investments = this.longTerm.investments.filter(investment => investment.id !== id)
      this.updateLongTermMetrics()
      this.saveToLocalStorage()
    },

    // Mise à jour de la courbe d'équité
    updateEquityCurve() {
      // Si aucun trade, la courbe commence avec le capital initial uniquement
      if (!this.trading.trades.length) {
        this.trading.equityCurve = [{ date: new Date(), balance: this.initialCapital }];
        // Sauvegarder la courbe d'équité
        localStorage.setItem('equityCurve', JSON.stringify(this.trading.equityCurve));
        console.log('Courbe d\'équité initialisée avec capital initial:', this.initialCapital);
        return;
      }
      
      // Trier les trades par date de sortie chronologique
      const sortedTrades = [...this.trading.trades].sort((a, b) => {
        return new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime();
      });
      
      // Initialiser la courbe d'équité avec le point de départ (capital initial)
      const equityCurve: { date: Date; balance: number }[] = [];
      
      // Ajouter le point initial (avant tout trade)
      const firstTradeDate = new Date(sortedTrades[0].entryDate);
      // Si le premier trade a une date d'entrée antérieure à aujourd'hui,
      // utiliser la date d'entrée du premier trade moins un jour comme point de départ
      const startDate = new Date(firstTradeDate);
      startDate.setDate(startDate.getDate() - 1);
      
      equityCurve.push({ date: startDate, balance: this.initialCapital });
      
      // Calculer l'évolution du capital pour chaque trade successif
      let currentBalance = this.initialCapital;
      
      for (const trade of sortedTrades) {
        const exitDate = new Date(trade.exitDate);
        
        // Calculer le montant absolu du P/L basé sur le pourcentage du risque
        const riskAmount = (trade.risk / 100) * this.initialCapital; // Montant risqué basé sur le capital initial
        
        // Calculer le P/L en montant absolu basé sur le pourcentage saisi
        // Le pourcentage est appliqué au capital initial pour être cohérent
        const profitLossAmount = (trade.profitLoss / 100) * this.initialCapital;
        
        // Mettre à jour le capital courant
        currentBalance += profitLossAmount;
        
        // Ajouter un point à la courbe d'équité
        equityCurve.push({ 
          date: exitDate, 
          balance: currentBalance 
        });
        
        console.log(`Trade ${trade.id} - Date: ${exitDate.toLocaleDateString()} - P/L: ${trade.profitLoss}% (${profitLossAmount.toFixed(2)}€) - Nouveau solde: ${currentBalance.toFixed(2)}€`);
      }
      
      this.trading.equityCurve = equityCurve;
      
      // Mettre à jour le capital courant dans le store
      this.trading.currentCapital = currentBalance;
      
      // Sauvegarder la courbe d'équité et le capital courant
      localStorage.setItem('equityCurve', JSON.stringify(this.trading.equityCurve.map(point => ({
        ...point,
        date: point.date instanceof Date ? point.date.toISOString() : point.date
      }))));
      localStorage.setItem('currentCapital', JSON.stringify(currentBalance));
      
      console.log('Courbe d\'équité mise à jour avec', equityCurve.length, 'points. Capital final:', currentBalance.toFixed(2), '€');
    },

    // Mise à jour de la courbe d'équité pour les cryptos
    updateCryptoEquityCurve() {
      // Si aucune position, la courbe commence avec un point initial à 0
      if (!this.crypto.positions.length) {
        this.crypto.equityCurve = [{ date: new Date(), balance: 0 }];
        return;
      }
      
      // Calculer la valeur totale actuelle du portefeuille crypto
      const totalValue = this.crypto.positions.reduce(
        (sum, position) => sum + (position.currentPrice * position.quantity), 
        0
      );
      
      // Ajouter un nouveau point à la courbe d'équité
      this.crypto.equityCurve.push({ 
        date: new Date(), 
        balance: totalValue 
      });
      
      // Limiter la taille de la courbe d'équité (garder les 100 derniers points par exemple)
      if (this.crypto.equityCurve.length > 100) {
        this.crypto.equityCurve = this.crypto.equityCurve.slice(-100);
      }
      
      // Sauvegarder la courbe d'équité
      this.saveToLocalStorage();
      
      console.log('Courbe d\'équité crypto mise à jour. Valeur actuelle du portefeuille:', totalValue.toFixed(2), '€');
    },

    // Mise à jour de la courbe d'équité pour les investissements long terme
    updateLongTermEquityCurve() {
      console.log('Début de la mise à jour de la courbe d\'équité long terme');
      
      // Si aucun investissement, initialiser avec une courbe vide
      if (this.longTerm.investments.length === 0) {
        this.longTerm.equityCurve = [];
        return;
      }
      
      // Créer un historique des transactions (dates d'achat et montants)
      interface CapitalFlow {
        date: Date;
        amount: number; // montant cumulé investi à cette date
        value: number;  // valeur réelle du portefeuille à cette date
      }
      
      // Récupérer les dates d'achat et les montants
      const flows: CapitalFlow[] = this.longTerm.investments.map(inv => ({
        date: new Date(inv.purchaseDate),
        amount: inv.quantity * inv.averageEntryPrice,
        value: inv.quantity * inv.averageEntryPrice // À l'achat, la valeur = prix d'achat * quantité
      }));
      
      // Trier par date
      flows.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Calculer le montant investi cumulé et la valeur pour chaque date
      let cumulativeAmount = 0;
      let cumulativeValueAtPurchase = 0;
      
      const processedFlows: CapitalFlow[] = [];
      
      flows.forEach(flow => {
        cumulativeAmount += flow.amount;
        cumulativeValueAtPurchase += flow.value; // À l'achat, la valeur = montant
        
        // Vérifier si la date existe déjà
        const existingFlow = processedFlows.find(
          f => f.date.toDateString() === flow.date.toDateString()
        );
        
        if (existingFlow) {
          existingFlow.amount += flow.amount;
          existingFlow.value += flow.value;
        } else {
          processedFlows.push({
            date: flow.date,
            amount: cumulativeAmount,
            value: cumulativeValueAtPurchase
          });
        }
      });
      
      // Ajout des dates intermédiaires pour avoir un suivi quotidien
      const today = new Date();
      const lastFlowDate = processedFlows[processedFlows.length - 1].date;
      let currentDate = new Date(lastFlowDate);
      
      // Ajouter une entrée pour chaque jour depuis le dernier achat jusqu'à aujourd'hui
      while (currentDate <= today) {
        // Ne pas ajouter de doublons
        if (!processedFlows.some(f => f.date.toDateString() === currentDate.toDateString())) {
          // Pour les dates intermédiaires, calculer la valeur interpolée entre le prix d'achat et le prix actuel
          let portfolioValue = 0;
          
          for (const inv of this.longTerm.investments) {
            if (new Date(inv.purchaseDate) <= currentDate) {
              // Calculer le pourcentage de progression entre la date d'achat et aujourd'hui
              const purchaseDate = new Date(inv.purchaseDate);
              const totalDays = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
              const daysPassed = (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
              
              if (totalDays <= 0) {
                // Si l'investissement vient d'être acheté, utiliser le prix d'achat
                portfolioValue += inv.quantity * inv.averageEntryPrice;
              } else {
                // Interpoler le prix entre le prix d'achat et le prix actuel
                const progressRatio = Math.min(daysPassed / totalDays, 1);
                const priceDifference = inv.currentPrice - inv.averageEntryPrice;
                const interpolatedPrice = inv.averageEntryPrice + (priceDifference * progressRatio);
                
                portfolioValue += inv.quantity * interpolatedPrice;
              }
            }
          }
          
          processedFlows.push({
            date: new Date(currentDate),
            amount: cumulativeAmount,
            value: portfolioValue
          });
        }
        
        // Avancer d'un jour
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // S'assurer que le dernier point utilise les prix actuels exacts
      const latestFlow = processedFlows.find(f => f.date.toDateString() === today.toDateString());
      if (latestFlow) {
        let actualValue = 0;
        for (const inv of this.longTerm.investments) {
          actualValue += inv.quantity * inv.currentPrice;
        }
        latestFlow.value = actualValue;
      }
      
      // Trier à nouveau après ajout des dates intermédiaires
      processedFlows.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Convertir en format EquityPoint
      this.longTerm.equityCurve = processedFlows.map(flow => ({
        date: flow.date,
        balance: flow.value,
        invested: flow.amount,
      }));
      
      console.log('Mise à jour de la courbe d\'équité terminée:', this.longTerm.equityCurve);
      
      // Sauvegarder dans le localStorage
      this.saveToLocalStorage();
    },

    // Nouvelle action pour mettre à jour les métriques avancées
    setAdvancedMetrics(advancedMetrics: any) {
      console.log("Mise à jour des métriques avancées:", advancedMetrics);
      
      // Vérifier que les métriques avancées sont définies
      if (!advancedMetrics) {
        console.error("Aucune métrique avancée fournie");
        return;
      }
      
      // Initialiser les métriques si elles n'existent pas
      if (!this.trading.metrics) {
        this.trading.metrics = {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRateGlobal: 0,
          winRatePure: 0,
          winRateBreakeven: 0,
          profitFactor: 0,
          averageWin: 0,
          averageLoss: 0,
          expectancy: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          maxConsecutiveWins: 0,
          maxConsecutiveLosses: 0,
          averageTradeDuration: 0,
          valueAtRisk95: 0,
          valueAtRisk99: 0,
          conditionalVaR95: 0,
          conditionalVaR99: 0
        };
      }
      
      // Mettre à jour le winRateGlobal avec la valeur calculée qui inclut les BE
      if (advancedMetrics.globalWinRate !== undefined) {
        this.trading.metrics.winRateGlobal = advancedMetrics.globalWinRate;
        this.trading.metrics.advancedWinRate = advancedMetrics.globalWinRate;
      }
      
      // Mettre à jour toutes les métriques VaR fournies
      if (advancedMetrics.valueAtRisk95 !== undefined) {
        this.trading.metrics.valueAtRisk95 = Math.max(0, advancedMetrics.valueAtRisk95);
      }
      if (advancedMetrics.valueAtRisk99 !== undefined) {
        this.trading.metrics.valueAtRisk99 = Math.max(0, advancedMetrics.valueAtRisk99);
      }
      if (advancedMetrics.conditionalVaR95 !== undefined) {
        this.trading.metrics.conditionalVaR95 = Math.max(0, advancedMetrics.conditionalVaR95);
      }
      if (advancedMetrics.conditionalVaR99 !== undefined) {
        this.trading.metrics.conditionalVaR99 = Math.max(0, advancedMetrics.conditionalVaR99);
      }
      
      console.log("Métriques mises à jour:", this.trading.metrics);
    },
  }
}); 