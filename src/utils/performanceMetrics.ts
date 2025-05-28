import type { Trade } from '../types/trading';

interface PerformanceMetrics {
  totalTrades: number;
  strategyDuration: number;
  globalWinRate: number;
  pureWinRate: number;
  breakEvenRate: number;
  lossRate: number;
  grossExpectancy: number;
  netExpectancy: number;
  profitFactor: number;
  gainLossRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  sharpeRatio: number;
  sortinoRatio: number;
  riskOfRuin: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  annualizedReturn: number;
  expectancyScore: number;
  returnVolatility: number;
  averageTradeDuration: number; // Durée moyenne d'un trade en heures
  minTradeDuration: number; // Durée minimale d'un trade en heures
  maxTradeDuration: number; // Durée maximale d'un trade en heures
  averageMonthlyPerformance: number; // Moyenne mensuelle en pourcentage
  shortDurationWinRate: number; // Taux de réussite des trades courts (<2h)
  mediumDurationWinRate: number; // Taux de réussite des trades moyens (2-24h)
  longDurationWinRate: number; // Taux de réussite des trades longs (24-48h)
  veryLongDurationWinRate: number; // Taux de réussite des trades très longs (>48h)
  shortDurationBreakEvenRate: number; // Taux de BE des trades courts
  mediumDurationBreakEvenRate: number; // Taux de BE des trades moyens
  longDurationBreakEvenRate: number; // Taux de BE des trades longs
  veryLongDurationBreakEvenRate: number; // Taux de BE des trades très longs
  durationCorrelation: string; // Analyse de la corrélation durée/performance
  alpha: number; // Alpha par rapport au S&P500
  totalFees: number; // Total des frais
  totalSpread: number; // Total des spreads
  totalCommission: number; // Total des commissions
  totalCosts: number; // Total de tous les coûts (frais + spread + commission)
  costsPercentage: number; // Pourcentage des coûts par rapport au gain total
  potentialProfitWithoutCosts: number; // Profit potentiel sans les coûts
  valueAtRisk95: number; // Value at Risk avec un niveau de confiance de 95%
  valueAtRisk99: number; // Value at Risk avec un niveau de confiance de 99%
  conditionalVaR95: number; // Conditional Value at Risk (Expected Shortfall) à 95%
  conditionalVaR99: number; // Conditional Value at Risk (Expected Shortfall) à 99%
}

// Fonction pour récupérer les données du S&P500 depuis Yahoo Finance
// Cette fonction sera appelée en arrière-plan
async function getSP500PerformanceData(startDate: Date, endDate: Date): Promise<number> {
  try {
    // Utiliser le format YYYY-MM-DD pour les dates
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Convertir en timestamps pour Yahoo Finance
    const start = Math.floor(startDate.getTime() / 1000);
    const end = Math.floor(endDate.getTime() / 1000);
    
    // URL pour les données du ticker
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${start}&period2=${end}&interval=1d`;
    
    // Configuration des headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    // Faire la requête avec fetch
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`Erreur lors de la récupération des données: ${response.status}`);
      return 0;
    }
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
      console.error('Données invalides pour S&P500');
      return 0;
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const closePrices = quotes.close;
    
    if (!closePrices || closePrices.length < 2) {
      console.error('Pas assez de données de prix pour calculer la performance');
      return 0;
    }
    
    // Calculer la performance en pourcentage
    const initialPrice = closePrices[0];
    const finalPrice = closePrices[closePrices.length - 1];
    const sp500Performance = ((finalPrice - initialPrice) / initialPrice) * 100;
    
    return sp500Performance;
  } catch (error) {
    console.error('Erreur lors du calcul de la performance du S&P500:', error);
    return 0;
  }
}

// Fonction pour calculer l'alpha (en utilisant des données mises en cache si disponibles)
let cachedSP500Performance: { startDate: string; endDate: string; performance: number } | null = null;

export async function calculateAlpha(trades: Trade[], totalReturn: number): Promise<number> {
  if (!trades.length) return 0;
  
  // Trier les trades par date
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
  );
  
  const firstTradeDate = new Date(sortedTrades[0].entryDate);
  const lastTradeDate = new Date(sortedTrades[sortedTrades.length - 1].exitDate);
  
  // Vérifier si nous avons des données mises en cache qui correspondent à notre période
  const startDateStr = firstTradeDate.toISOString().split('T')[0];
  const endDateStr = lastTradeDate.toISOString().split('T')[0];
  
  let sp500Performance = 0;
  
  if (cachedSP500Performance && 
      cachedSP500Performance.startDate === startDateStr && 
      cachedSP500Performance.endDate === endDateStr) {
    sp500Performance = cachedSP500Performance.performance;
  } else {
    sp500Performance = await getSP500PerformanceData(firstTradeDate, lastTradeDate);
    cachedSP500Performance = {
      startDate: startDateStr,
      endDate: endDateStr,
      performance: sp500Performance
    };
  }
  
  // Calculer l'alpha (performance de la stratégie - performance du benchmark)
  const alpha = totalReturn - sp500Performance;
  
  return alpha;
}

/**
 * Calcule la Value at Risk (VaR) pour un niveau de confiance donné
 * @param trades Liste des trades
 * @param confidenceLevel Niveau de confiance (ex: 0.95 pour 95%)
 * @returns La VaR en pourcentage du capital
 */
export function calculateVaR(trades: Trade[], confidenceLevel: number): number {
  // Minimum 2 trades pour avoir un échantillon minimal (réduit de 3 à 2)
  if (trades.length < 2) {
    console.warn(`Pas assez de trades (${trades.length}) pour une estimation fiable de la VaR. Minimum 2 requis.`);
    return 0;
  }
  
  // Extraire les rendements des trades et assurer qu'ils sont exprimés en pourcentage
  const returns = trades.map(trade => trade.profitLoss);
  console.log(`Calcul VaR (${confidenceLevel * 100}%) avec ${returns.length} trades.`);
  console.log(`Rendements des trades:`, returns.slice(0, 10), returns.length > 10 ? '...' : '');
  
  // Trier les rendements par ordre croissant
  returns.sort((a, b) => a - b);
  console.log(`Rendements triés (premiers 10):`, returns.slice(0, 10), returns.length > 10 ? '...' : '');
  
  // Calculer l'indice correspondant au niveau de confiance
  const index = Math.floor(returns.length * (1 - confidenceLevel));
  console.log(`Indice calculé: ${index} pour ${returns.length} trades et niveau de confiance ${confidenceLevel}`);
  
  // Vérification et ajustement de l'indice pour éviter les erreurs
  const safeIndex = Math.max(0, Math.min(index, returns.length - 1));
  
  if (index !== safeIndex) {
    console.warn(`Indice VaR ajusté de ${index} à ${safeIndex} pour rester dans les limites valides.`);
  }
  
  // Cas spécial : si tous les trades sont positifs ou nuls
  if (returns[0] >= 0) {
    console.log(`Tous les trades sont positifs ou nuls. VaR sera basée sur le plus petit gain.`);
    // Dans ce cas, la VaR est le plus petit gain (ou 0 si le plus petit est 0)
    const var_value = Math.max(0, returns[0]);
    console.log(`VaR (${confidenceLevel * 100}%) calculée (tous trades positifs): ${var_value.toFixed(2)}%`);
    return var_value;
  }
  
  // La VaR est la perte maximale attendue au niveau de confiance spécifié
  // On retourne une valeur positive pour représenter une perte
  const var_value = Math.abs(returns[safeIndex]);
  console.log(`VaR (${confidenceLevel * 100}%) calculée: ${var_value.toFixed(2)}% (indice ${safeIndex}, valeur: ${returns[safeIndex]})`);
  
  return var_value;
}

/**
 * Calcule la Conditional Value at Risk (CVaR) également appelée Expected Shortfall
 * @param trades Liste des trades
 * @param confidenceLevel Niveau de confiance (ex: 0.95 pour 95%)
 * @returns La CVaR en pourcentage du capital
 */
export function calculateConditionalVaR(trades: Trade[], confidenceLevel: number): number {
  // Minimum 2 trades pour avoir un échantillon minimal (réduit de 3 à 2)
  if (trades.length < 2) {
    console.warn(`Pas assez de trades (${trades.length}) pour une estimation fiable de la CVaR. Minimum 2 requis.`);
    return 0;
  }
  
  // Extraire les rendements des trades
  const returns = trades.map(trade => trade.profitLoss);
  console.log(`Calcul CVaR (${confidenceLevel * 100}%) avec ${returns.length} trades.`);
  
  // Trier les rendements par ordre croissant
  returns.sort((a, b) => a - b);
  
  // Calculer l'indice correspondant au niveau de confiance
  const index = Math.floor(returns.length * (1 - confidenceLevel));
  console.log(`CVaR - Indice calculé: ${index} pour ${returns.length} trades`);
  
  // Vérification et ajustement de l'indice pour éviter les erreurs
  const safeIndex = Math.max(1, Math.min(index, returns.length - 1));
  
  if (index !== safeIndex) {
    console.warn(`Indice CVaR ajusté de ${index} à ${safeIndex} pour rester dans les limites valides.`);
  }
  
  // Cas spécial : si tous les trades sont positifs ou nuls
  if (returns[0] >= 0) {
    console.log(`Tous les trades sont positifs ou nuls. CVaR sera basée sur les plus petits gains.`);
    // Dans ce cas, prendre la moyenne des plus petits gains
    const worstReturns = returns.slice(0, Math.max(1, safeIndex));
    const cvar_value = worstReturns.reduce((sum, r) => sum + r, 0) / worstReturns.length;
    console.log(`CVaR (${confidenceLevel * 100}%) calculée (tous trades positifs): ${cvar_value.toFixed(2)}%`);
    return Math.max(0, cvar_value);
  }
  
  // Sélectionner les rendements en-dessous du seuil de VaR
  // En cas de très peu de données, prendre au moins le pire rendement
  const worstReturns = returns.slice(0, safeIndex);
  
  // Si aucun rendement n'a été sélectionné, prendre le pire
  if (worstReturns.length === 0 && returns.length > 0) {
    worstReturns.push(returns[0]);
  }
  
  // La CVaR est la moyenne des pires pertes au-delà du seuil de VaR
  // On retourne une valeur positive pour représenter une perte
  if (worstReturns.length === 0) {
    console.warn("Impossible de calculer la CVaR: aucun rendement sélectionné.");
    return 0;
  }
  
  const cvar_value = Math.abs(worstReturns.reduce((sum, r) => sum + r, 0) / worstReturns.length);
  console.log(`CVaR (${confidenceLevel * 100}%) calculée: ${cvar_value.toFixed(2)}% (moyenne des ${worstReturns.length} pires trades)`);
  console.log(`Pires rendements utilisés:`, worstReturns);
  return cvar_value;
}

export function calculatePerformanceMetrics(trades: Trade[]): PerformanceMetrics {
  console.log(`Calcul des métriques pour ${trades.length} trades`);
  if (!trades.length) {
    return {
      totalTrades: 0,
      strategyDuration: 0,
      globalWinRate: 0,
      pureWinRate: 0,
      breakEvenRate: 0,
      lossRate: 0,
      grossExpectancy: 0,
      netExpectancy: 0,
      profitFactor: 0,
      gainLossRatio: 0,
      maxDrawdown: 0,
      calmarRatio: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      riskOfRuin: 0,
      maxConsecutiveLosses: 0,
      maxConsecutiveWins: 0,
      annualizedReturn: 0,
      expectancyScore: 0,
      returnVolatility: 0,
      averageTradeDuration: 0,
      minTradeDuration: 0,
      maxTradeDuration: 0,
      averageMonthlyPerformance: 0,
      shortDurationWinRate: 0,
      mediumDurationWinRate: 0,
      longDurationWinRate: 0,
      veryLongDurationWinRate: 0,
      shortDurationBreakEvenRate: 0,
      mediumDurationBreakEvenRate: 0,
      longDurationBreakEvenRate: 0,
      veryLongDurationBreakEvenRate: 0,
      durationCorrelation: "Pas de données",
      alpha: 0,
      totalFees: 0,
      totalSpread: 0,
      totalCommission: 0,
      totalCosts: 0,
      costsPercentage: 0,
      potentialProfitWithoutCosts: 0,
      valueAtRisk95: 0,
      valueAtRisk99: 0,
      conditionalVaR95: 0,
      conditionalVaR99: 0
    };
  }

  // Trier les trades par date
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
  );

  // Durée de la stratégie en jours
  const firstTrade = new Date(sortedTrades[0].entryDate);
  const lastTrade = new Date(sortedTrades[sortedTrades.length - 1].exitDate);
  const strategyDuration = (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24);

  // Calcul des trades gagnants, perdants et break-even
  const winningTrades = trades.filter(t => t.profitLoss > 0);
  const losingTrades = trades.filter(t => t.profitLoss < 0);
  const breakEvenTrades = trades.filter(t => t.profitLoss === 0);

  // Taux de réussite
  const globalWinRate = (winningTrades.length / trades.length) * 100;
  const pureWinRate = (winningTrades.length / (trades.length - breakEvenTrades.length)) * 100;
  const breakEvenRate = (breakEvenTrades.length / trades.length) * 100;
  const lossRate = (losingTrades.length / trades.length) * 100;

  // Calcul des gains et pertes
  const totalProfit = winningTrades.reduce((sum, t) => sum + t.profitLoss, 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profitLoss, 0));
  
  // Calcul des frais, spreads et commissions
  const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);
  const totalSpread = trades.reduce((sum, t) => sum + (t.spread || 0), 0);
  const totalCommission = trades.reduce((sum, t) => sum + (t.commission || 0), 0);
  const totalCosts = totalFees + totalSpread + totalCommission;
  
  // Calcul du profit total et du profit sans les coûts
  const totalProfitLoss = trades.reduce((sum, t) => sum + t.profitLoss, 0);
  const potentialProfitWithoutCosts = totalProfitLoss + totalCosts;
  
  // Calcul du pourcentage que représentent les coûts par rapport au profit total
  const costsPercentage = totalProfitLoss !== 0 ? (totalCosts / Math.abs(totalProfitLoss)) * 100 : 0;

  // Espérance de gain
  const grossExpectancy = trades.reduce((sum, t) => sum + t.profitLoss, 0) / trades.length;
  const netExpectancy = (totalProfit - totalLoss) / trades.length;

  // Profit Factor et Ratio Gain/Perte
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  const gainLossRatio = losingTrades.length > 0 ? 
    (totalProfit / winningTrades.length) / (totalLoss / losingTrades.length) : 
    winningTrades.length > 0 ? Infinity : 0;

  // Calcul du Drawdown max
  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve = trades.map(trade => {
    balance += trade.profitLoss;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
    return balance;
  });

  // Ratio de Calmar (Return / Max Drawdown)
  const totalReturn = balance;
  const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : totalReturn > 0 ? Infinity : 0;

  // Calcul des retours quotidiens pour Sharpe et Sortino
  const dailyReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const dailyReturn = (equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1];
    dailyReturns.push(dailyReturn);
  }

  // Ratio de Sharpe (assumant un taux sans risque de 2%)
  const riskFreeRate = 0.02;
  const averageReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const returnStdDev = Math.sqrt(
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - averageReturn, 2), 0) / dailyReturns.length
  );
  const sharpeRatio = (averageReturn - riskFreeRate) / returnStdDev;

  // Ratio de Sortino (utilisant uniquement les retours négatifs)
  const negativeReturns = dailyReturns.filter(r => r < 0);
  const downsideStdDev = Math.sqrt(
    negativeReturns.reduce((sum, r) => sum + Math.pow(r - averageReturn, 2), 0) / negativeReturns.length
  );
  const sortinoRatio = (averageReturn - riskFreeRate) / downsideStdDev;

  // Risk of Ruin (simplifié)
  const riskOfRuin = Math.pow(lossRate / 100, 3);

  // Max Consecutive Wins/Losses
  let currentStreak = 0;
  let maxWins = 0;
  let maxLosses = 0;
  let currentMaxWins = 0;
  let currentMaxLosses = 0;

  trades.forEach(trade => {
    if (trade.profitLoss > 0) {
      currentMaxWins++;
      currentMaxLosses = 0;
      maxWins = Math.max(maxWins, currentMaxWins);
    } else if (trade.profitLoss < 0) {
      currentMaxLosses++;
      currentMaxWins = 0;
      maxLosses = Math.max(maxLosses, currentMaxLosses);
    }
  });

  // Annualized Return - Utiliser la formule standard pour annualiser un rendement
  let annualizedReturn = 0;
  if (strategyDuration > 0) {
    // Convertir le rendement total en décimal
    const totalReturnDecimal = totalReturn / 100;
    
    // Calculer le rendement annualisé avec la formule: (1 + r)^(365/t) - 1
    // où r = rendement total (en décimal) et t = durée en jours
    annualizedReturn = (Math.pow(1 + totalReturnDecimal, 365 / strategyDuration) - 1) * 100;
  }

  // Calcul de la performance moyenne mensuelle
  // Utiliser la durée totale de la stratégie et le rendement total pour calculer une moyenne mensuelle exacte
  let averageMonthlyPerformance = 0;
  if (strategyDuration > 0) {
    // Convertir la durée en jours en nombre de mois (approximatif)
    const monthsCount = strategyDuration / 30.44; // 30.44 = nombre moyen de jours par mois
    
    // Si la stratégie a duré moins d'un mois, considérer la performance totale comme mensuelle
    if (monthsCount < 1) {
      averageMonthlyPerformance = totalReturn;
    } else {
      // Calculer la moyenne mensuelle à partir du rendement total et du nombre de mois
      // Utiliser la formule: (1 + r)^(1/n) - 1 pour obtenir le rendement mensuel équivalent
      // où r = rendement total (en décimal) et n = nombre de mois
      const totalReturnDecimal = totalReturn / 100;
      const monthlyReturnDecimal = Math.pow(1 + totalReturnDecimal, 1 / monthsCount) - 1;
      averageMonthlyPerformance = monthlyReturnDecimal * 100;
    }
  }

  // Expectancy Score
  const averageWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
  const expectancyScore = (globalWinRate * averageWin) - (lossRate * averageLoss);

  // Volatilité des retours - calcul amélioré
  let returnVolatility = 0;
  if (strategyDuration > 0) {
    // Si nous avons des données quotidiennes, utiliser l'écart-type des rendements quotidiens
    if (dailyReturns.length > 0) {
      // Calculer l'écart-type des rendements quotidiens
      const dailyStdDev = returnStdDev;
      
      // Annualiser la volatilité (multiplier par racine carrée du nombre de jours de trading dans une année)
      // On utilise généralement 252 jours de trading pour une année
      returnVolatility = dailyStdDev * Math.sqrt(252) * 100;
    } else {
      // Si nous n'avons pas de rendements quotidiens, estimer la volatilité à partir du rendement total
      // et de la durée de la stratégie (approximation)
      const totalReturnDecimal = totalReturn / 100;
      const annualizedReturnValue = Math.pow(1 + totalReturnDecimal, 365 / strategyDuration) - 1;
      
      // Estimer la volatilité annualisée comme étant environ 2 fois le rendement annualisé
      // (approximation grossière basée sur le ratio de Sharpe moyen historique)
      returnVolatility = Math.abs(annualizedReturnValue) * 200;
    }
  }

  // Calcul des durées des trades et statistiques associées
  const tradeDurations = trades.map(trade => {
    const entryDate = new Date(trade.entryDate);
    const exitDate = new Date(trade.exitDate);
    return {
      duration: (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60), // En heures
      isWinning: trade.profitLoss > 0,
      isBreakEven: trade.profitLoss === 0,
      profitLoss: trade.profitLoss
    };
  });
  
  // Durée moyenne, minimale et maximale
  const totalTradeDuration = tradeDurations.reduce((sum, t) => sum + t.duration, 0);
  const averageTradeDuration = totalTradeDuration / trades.length;
  const minTradeDuration = Math.min(...tradeDurations.map(t => t.duration));
  const maxTradeDuration = Math.max(...tradeDurations.map(t => t.duration));
  
  // Analyse par durée de trade avec les nouvelles catégories
  const shortDurationTrades = tradeDurations.filter(t => t.duration < 2); // Moins de 2 heures
  const mediumDurationTrades = tradeDurations.filter(t => t.duration >= 2 && t.duration <= 24); // Entre 2 et 24 heures
  const longDurationTrades = tradeDurations.filter(t => t.duration > 24 && t.duration <= 48); // Entre 24 et 48 heures
  const veryLongDurationTrades = tradeDurations.filter(t => t.duration > 48); // Plus de 48 heures
  
  // Taux de réussite par durée
  const shortDurationWinRate = shortDurationTrades.length > 0 
    ? (shortDurationTrades.filter(t => t.isWinning).length / shortDurationTrades.length) * 100 
    : 0;
  
  const mediumDurationWinRate = mediumDurationTrades.length > 0 
    ? (mediumDurationTrades.filter(t => t.isWinning).length / mediumDurationTrades.length) * 100 
    : 0;
  
  const longDurationWinRate = longDurationTrades.length > 0 
    ? (longDurationTrades.filter(t => t.isWinning).length / longDurationTrades.length) * 100 
    : 0;
    
  const veryLongDurationWinRate = veryLongDurationTrades.length > 0 
    ? (veryLongDurationTrades.filter(t => t.isWinning).length / veryLongDurationTrades.length) * 100 
    : 0;
  
  // Taux de break-even par durée
  const shortDurationBreakEvenRate = shortDurationTrades.length > 0 
    ? (shortDurationTrades.filter(t => t.isBreakEven).length / shortDurationTrades.length) * 100 
    : 0;
  
  const mediumDurationBreakEvenRate = mediumDurationTrades.length > 0 
    ? (mediumDurationTrades.filter(t => t.isBreakEven).length / mediumDurationTrades.length) * 100 
    : 0;
  
  const longDurationBreakEvenRate = longDurationTrades.length > 0 
    ? (longDurationTrades.filter(t => t.isBreakEven).length / longDurationTrades.length) * 100 
    : 0;
    
  const veryLongDurationBreakEvenRate = veryLongDurationTrades.length > 0 
    ? (veryLongDurationTrades.filter(t => t.isBreakEven).length / veryLongDurationTrades.length) * 100 
    : 0;
  
  // Déterminer la meilleure performance selon la durée
  let durationCorrelation = "Pas de données suffisantes";
  
  // Créer un tableau avec les catégories qui ont au moins quelques trades
  const validCategories = [
    { name: "courts (<2h)", rate: shortDurationWinRate, count: shortDurationTrades.length },
    { name: "moyens (2-24h)", rate: mediumDurationWinRate, count: mediumDurationTrades.length },
    { name: "longs (24-48h)", rate: longDurationWinRate, count: longDurationTrades.length },
    { name: "très longs (>48h)", rate: veryLongDurationWinRate, count: veryLongDurationTrades.length }
  ].filter(cat => cat.count >= 3); // Filtrer les catégories avec au moins 3 trades
  
  if (validCategories.length >= 2) {
    // Trouver la catégorie avec le meilleur taux de réussite
    const bestCategory = validCategories.reduce((best, current) => 
      current.rate > best.rate ? current : best, validCategories[0]);
    
    durationCorrelation = `Les trades ${bestCategory.name} ont les meilleurs résultats (${formatWinRate(bestCategory.rate)})`;
  } else if (validCategories.length === 1) {
    durationCorrelation = `Seuls les trades ${validCategories[0].name} ont suffisamment de données (${formatWinRate(validCategories[0].rate)})`;
  }

  // Calcul de l'alpha (temporairement à 0 car c'est une fonction asynchrone)
  // L'alpha réel sera calculé séparément avec calculateAlpha
  const alpha = 0;

  // Calcul des valeurs à risque (VaR)
  console.log("Début du calcul des métriques VaR...");
  const valueAtRisk95 = calculateVaR(trades, 0.95);
  const valueAtRisk99 = calculateVaR(trades, 0.99);
  const conditionalVaR95 = calculateConditionalVaR(trades, 0.95);
  const conditionalVaR99 = calculateConditionalVaR(trades, 0.99);
  console.log("Résumé des métriques VaR calculées:");
  console.log(`- VaR (95%): ${valueAtRisk95.toFixed(2)}%`);
  console.log(`- VaR (99%): ${valueAtRisk99.toFixed(2)}%`);
  console.log(`- CVaR (95%): ${conditionalVaR95.toFixed(2)}%`);
  console.log(`- CVaR (99%): ${conditionalVaR99.toFixed(2)}%`);

  return {
    totalTrades: trades.length,
    strategyDuration,
    globalWinRate,
    pureWinRate,
    breakEvenRate,
    lossRate,
    grossExpectancy,
    netExpectancy,
    profitFactor,
    gainLossRatio,
    maxDrawdown,
    calmarRatio,
    sharpeRatio,
    sortinoRatio,
    riskOfRuin,
    maxConsecutiveLosses: maxLosses,
    maxConsecutiveWins: maxWins,
    annualizedReturn,
    expectancyScore,
    returnVolatility,
    averageTradeDuration,
    minTradeDuration,
    maxTradeDuration,
    averageMonthlyPerformance,
    shortDurationWinRate,
    mediumDurationWinRate,
    longDurationWinRate,
    veryLongDurationWinRate,
    shortDurationBreakEvenRate,
    mediumDurationBreakEvenRate,
    longDurationBreakEvenRate,
    veryLongDurationBreakEvenRate,
    durationCorrelation,
    alpha,
    totalFees,
    totalSpread,
    totalCommission,
    totalCosts,
    costsPercentage,
    potentialProfitWithoutCosts,
    valueAtRisk95,
    valueAtRisk99,
    conditionalVaR95,
    conditionalVaR99
  };
}

// Fonction utilitaire pour formater le taux de réussite
function formatWinRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
} 