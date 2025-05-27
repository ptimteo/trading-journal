<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useTradingStore } from '../stores/trading';
import { calculatePerformanceMetrics, calculateAlpha } from '../utils/performanceMetrics';
import { Line } from 'vue-chartjs';

const tradingStore = useTradingStore();
const alphaValue = ref(0);
const totalReturnValue = ref(0);

// Variables pour les stats des trades
const trades = computed(() => tradingStore.trading.trades);
const winningTrades = computed(() => trades.value.filter(t => t.profitLoss > 0).length);
const breakEvenTrades = computed(() => trades.value.filter(t => t.profitLoss === 0).length);

// Calcul des métriques standard
const metrics = computed(() => {
  // Obtenir le nombre de trades et le nombre de trades gagnants directement
  const trades = tradingStore.trading.trades;
  const winningTrades = trades.filter(t => t.profitLoss > 0);
  const breakEvenTrades = trades.filter(t => t.profitLoss === 0);
  
  // Calculer directement le taux de réussite pur (incluant les BE dans le total)
  const calculatedPureWinRate = trades.length > 0 ? 
    (winningTrades.length / trades.length) * 100 : 0;
  
  // Recalculer les métriques de base à partir des trades actuels
  const baseMetrics = calculatePerformanceMetrics(trades);
  
  // Récupérer les métriques avancées stockées dans le store
  const storeMetrics = tradingStore.tradingMetrics;
  
  // Fusionner avec nos valeurs calculées en privilégiant les valeurs du store pour les métriques avancées
  const adjustedMetrics = {
    ...baseMetrics,
    pureWinRate: calculatedPureWinRate, // Forcer l'utilisation de notre calcul
    globalWinRate: storeMetrics.winRateGlobal,
    breakEvenRate: breakEvenTrades.length > 0 ? (breakEvenTrades.length / trades.length) * 100 : 0,
    shortDurationWinRate: baseMetrics.shortDurationWinRate + baseMetrics.shortDurationBreakEvenRate,
    mediumDurationWinRate: baseMetrics.mediumDurationWinRate + baseMetrics.mediumDurationBreakEvenRate,
    longDurationWinRate: baseMetrics.longDurationWinRate + baseMetrics.longDurationBreakEvenRate,
    veryLongDurationWinRate: baseMetrics.veryLongDurationWinRate + baseMetrics.veryLongDurationBreakEvenRate,
    // Utiliser les valeurs avancées du store si elles existent, sinon celles calculées
    averageMonthlyPerformance: storeMetrics.averageMonthlyPerformance !== undefined ? 
      storeMetrics.averageMonthlyPerformance : baseMetrics.averageMonthlyPerformance,
    annualizedReturn: storeMetrics.annualizedReturn !== undefined ? 
      storeMetrics.annualizedReturn : baseMetrics.annualizedReturn,
    returnVolatility: storeMetrics.returnVolatility !== undefined ? 
      storeMetrics.returnVolatility : baseMetrics.returnVolatility,
    valueAtRisk95: storeMetrics.valueAtRisk95 !== undefined ? 
      storeMetrics.valueAtRisk95 : baseMetrics.valueAtRisk95,
    valueAtRisk99: storeMetrics.valueAtRisk99 !== undefined ? 
      storeMetrics.valueAtRisk99 : baseMetrics.valueAtRisk99,
    conditionalVaR95: storeMetrics.conditionalVaR95 !== undefined ? 
      storeMetrics.conditionalVaR95 : baseMetrics.conditionalVaR95,
    conditionalVaR99: storeMetrics.conditionalVaR99 !== undefined ? 
      storeMetrics.conditionalVaR99 : baseMetrics.conditionalVaR99
  };
  
  console.log('Métriques ajustées avec valeurs du store:', {
    calculatedPureWinRate,
    winningTrades: winningTrades.length,
    totalTrades: trades.length,
    breakEvenTrades: breakEvenTrades.length,
    pureWinRate: adjustedMetrics.pureWinRate,
    globalWinRate: adjustedMetrics.globalWinRate,
    breakEvenRate: adjustedMetrics.breakEvenRate,
    storeWinRateGlobal: tradingStore.tradingMetrics.winRateGlobal,
    storeWinRatePure: tradingStore.tradingMetrics.winRatePure,
    averageMonthlyPerformance: adjustedMetrics.averageMonthlyPerformance,
    annualizedReturn: adjustedMetrics.annualizedReturn,
    returnVolatility: adjustedMetrics.returnVolatility
  });
  
  return adjustedMetrics;
});

// Données du benchmark
const benchmarkMetrics = ref({
  annualizedReturn: 0,
  totalReturn: 0,
  maxDrawdown: 0,
  volatility: 0,
  sharpeRatio: 0,
  sortinoRatio: 0
});

// Données du S&P 500
const sp500Data = ref<{ date: string; close: number }[]>([]);
const isLoadingBenchmark = ref(false);
const benchmarkError = ref('');

// Récupération des données du S&P 500
const fetchSP500Data = async () => {
  isLoadingBenchmark.value = true;
  benchmarkError.value = '';
  
  try {
    const res = await fetch('http://localhost:3000/sp500');
    if (!res.ok) {
      throw new Error(`Erreur HTTP: ${res.status}`);
    }
    
    const json = await res.json();
    
    // Formatage simplifié : on garde seulement la date et la clôture
    sp500Data.value = json.map((point: any) => ({
      date: point.date.split('T')[0],
      close: point.close
    }));
    
    // Calcul des métriques du benchmark
    if (sp500Data.value.length > 0) {
      calculateBenchmarkMetrics();
    }
    
  } catch (err: any) {
    console.error('Erreur de récupération du S&P 500:', err);
    benchmarkError.value = `Erreur de récupération: ${err.message}`;
  } finally {
    isLoadingBenchmark.value = false;
  }
};

// Calcul des métriques du benchmark
const calculateBenchmarkMetrics = () => {
  if (sp500Data.value.length < 2) return;
  
  // 1. Sélection de la période correspondant à la stratégie
  let firstTradeDate, lastTradeDate;
  
  if (tradingStore.trading.trades.length > 0) {
    const sortedTrades = [...tradingStore.trading.trades].sort((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    
    firstTradeDate = new Date(sortedTrades[0].entryDate);
    lastTradeDate = new Date(sortedTrades[sortedTrades.length - 1].exitDate);
  } else {
    return; // Pas de trades, impossible de calculer
  }
  
  // 2. Filtrer les données S&P 500 pour correspondre à la période
  const filteredData = sp500Data.value.filter(point => {
    const pointDate = new Date(point.date);
    return pointDate >= firstTradeDate && pointDate <= lastTradeDate;
  });
  
  if (filteredData.length < 2) {
    benchmarkError.value = "Pas assez de données pour la période de trading";
    return;
  }
  
  // 3. Calcul du rendement total
  const firstPrice = filteredData[0].close;
  const lastPrice = filteredData[filteredData.length - 1].close;
  const totalReturn = ((lastPrice - firstPrice) / firstPrice) * 100;
  
  // 4. Calcul du rendement annualisé
  const strategyDurationDays = metrics.value.strategyDuration;
  const annualizedReturn = (Math.pow(1 + totalReturn / 100, 365 / strategyDurationDays) - 1) * 100;
  
  // 5. Calcul de la volatilité
  const returns: number[] = [];
  for (let i = 1; i < filteredData.length; i++) {
    const dailyReturn = (filteredData[i].close - filteredData[i-1].close) / filteredData[i-1].close;
    returns.push(dailyReturn);
  }
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const volatility = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  ) * 100; // En pourcentage
  
  // 6. Calcul des drawdowns
  let peak = filteredData[0].close;
  let maxDrawdown = 0;
  for (const point of filteredData) {
    if (point.close > peak) {
      peak = point.close;
    }
    
    const drawdown = ((peak - point.close) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  // 7. Calcul des ratios
  const riskFreeRate = 0.05; // Le même que dans notre stratégie
  const sharpeRatio = (avgReturn - riskFreeRate/365) / (volatility/100/Math.sqrt(365));
  
  // Pour Sortino, on ne considère que les retours négatifs
  const negativeReturns = returns.filter(r => r < 0);
  const downsideDeviation = negativeReturns.length > 0 
    ? Math.sqrt(
        negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / negativeReturns.length
      )
    : 0.0001; // Éviter division par 0
  
  const sortinoRatio = (avgReturn - riskFreeRate/365) / (downsideDeviation/Math.sqrt(365));
  
  // Mise à jour des métriques du benchmark
  benchmarkMetrics.value = {
    annualizedReturn,
    totalReturn,
    maxDrawdown,
    volatility,
    sharpeRatio,
    sortinoRatio
  };
};

// Récupérer les données du benchmark à l'initialisation du composant
onMounted(async () => {
  if (tradingStore.trading.trades.length > 0) {
    // Forcer le recalcul des métriques avec les nouvelles formules
    await forceRefreshMetrics();
    
    // Récupérer les données du S&P 500
    fetchSP500Data();
  }
});

// Fonction pour forcer la mise à jour des métriques avec les nouvelles formules
const forceRefreshMetrics = async () => {
  console.log("Forçage du recalcul des métriques avec les formules corrigées...");
  
  // Calculer le retour total (en pourcentage)
  totalReturnValue.value = tradingStore.trading.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
  // Calculer l'alpha par rapport au S&P500 (fonction asynchrone)
  alphaValue.value = await calculateAlpha(tradingStore.trading.trades, totalReturnValue.value);
  
  // Recalculer les métriques de performance complètes
  const updatedMetrics = calculatePerformanceMetrics(tradingStore.trading.trades);
  
  // Log des valeurs calculées pour vérification
  console.log("Métriques recalculées:");
  console.log("VaR (95%):", updatedMetrics.valueAtRisk95.toFixed(2) + "%");
  console.log("VaR (99%):", updatedMetrics.valueAtRisk99.toFixed(2) + "%");
  console.log("CVaR (95%):", updatedMetrics.conditionalVaR95.toFixed(2) + "%");
  console.log("CVaR (99%):", updatedMetrics.conditionalVaR99.toFixed(2) + "%");
  console.log("Moyenne mensuelle:", updatedMetrics.averageMonthlyPerformance.toFixed(2) + "%");
  console.log("Rendement annualisé:", updatedMetrics.annualizedReturn.toFixed(2) + "%");
  console.log("Volatilité:", updatedMetrics.returnVolatility.toFixed(2) + "%");
  console.log("Durée de la stratégie (jours):", updatedMetrics.strategyDuration);
  console.log("Rendement total:", totalReturnValue.value.toFixed(2) + "%");
  
  // Mettre à jour les valeurs avancées dans le store
  tradingStore.setAdvancedMetrics({
    globalWinRate: updatedMetrics.globalWinRate,
    valueAtRisk95: updatedMetrics.valueAtRisk95,
    valueAtRisk99: updatedMetrics.valueAtRisk99,
    conditionalVaR95: updatedMetrics.conditionalVaR95,
    conditionalVaR99: updatedMetrics.conditionalVaR99,
    averageMonthlyPerformance: updatedMetrics.averageMonthlyPerformance,
    annualizedReturn: updatedMetrics.annualizedReturn,
    returnVolatility: updatedMetrics.returnVolatility
  });
  
  return updatedMetrics;
};

// Observer les changements dans les trades pour recalculer les métriques
watch(
  () => tradingStore.trading.trades,
  async (newTrades) => {
    if (newTrades.length > 0) {
      // Utiliser la fonction de rafraîchissement des métriques
      await forceRefreshMetrics();
      
      // Si le benchmark a été chargé, recalculer les métriques du benchmark également
      if (sp500Data.value.length > 0) {
        calculateBenchmarkMetrics();
      }
    }
  },
  { deep: true } // Surveiller les changements profonds dans le tableau de trades
);

// Calcul du Beta (Volatilité relative par rapport au marché)
const calculateBeta = () => {
  if (sp500Data.value.length < 2 || tradingStore.trading.trades.length === 0) return 0;
  
  // Récupérer les dates de début et fin de la stratégie
  const sortedTrades = [...tradingStore.trading.trades].sort((a, b) => 
    new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
  );
  
  const firstTradeDate = new Date(sortedTrades[0].entryDate);
  const lastTradeDate = new Date(sortedTrades[sortedTrades.length - 1].exitDate);
  
  // Filtrer les données S&P 500 pour la même période
  const filteredData = sp500Data.value.filter(point => {
    const pointDate = new Date(point.date);
    return pointDate >= firstTradeDate && pointDate <= lastTradeDate;
  });
  
  if (filteredData.length < 10) {
    console.warn("Pas assez de données pour calculer un beta fiable");
    return 0;
  }
  
  // Calculer les rendements journaliers du S&P 500
  const marketReturns: number[] = [];
  for (let i = 1; i < filteredData.length; i++) {
    const dailyReturn = (filteredData[i].close - filteredData[i-1].close) / filteredData[i-1].close;
    marketReturns.push(dailyReturn);
  }
  
  // Reconstruire les rendements de la stratégie pour chaque jour
  // Cette partie est approximative car nous n'avons pas les rendements quotidiens exacts
  // Nous utilisons les trades pour estimer les rendements
  
  // Créer un tableau de dates entre la première et la dernière date de trade
  const dates: Date[] = [];
  let currentDate = new Date(firstTradeDate);
  while (currentDate <= lastTradeDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Calculer les rendements quotidiens de la stratégie (approximativement)
  // Nous répartissons le P&L de chaque trade sur sa durée
  const strategyReturns = new Array(dates.length - 1).fill(0);
  
  for (const trade of sortedTrades) {
    const entryDate = new Date(trade.entryDate);
    const exitDate = new Date(trade.exitDate);
    const durationDays = Math.max(1, Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyPL = trade.profitLoss / durationDays;
    
    // Ajouter le P&L quotidien aux jours correspondants
    for (let i = 0; i < dates.length - 1; i++) {
      const currentDate = dates[i];
      if (currentDate >= entryDate && currentDate <= exitDate) {
        strategyReturns[i] += dailyPL;
      }
    }
  }
  
  // Aligner les rendements du marché et de la stratégie pour avoir la même longueur
  const minLength = Math.min(marketReturns.length, strategyReturns.length);
  const alignedMarketReturns = marketReturns.slice(0, minLength);
  const alignedStrategyReturns = strategyReturns.slice(0, minLength);
  
  // Calculer la covariance et la variance
  const marketAvg = alignedMarketReturns.reduce((sum, r) => sum + r, 0) / alignedMarketReturns.length;
  const strategyAvg = alignedStrategyReturns.reduce((sum, r) => sum + r, 0) / alignedStrategyReturns.length;
  
  let covariance = 0;
  let marketVariance = 0;
  
  for (let i = 0; i < alignedMarketReturns.length; i++) {
    covariance += (alignedMarketReturns[i] - marketAvg) * (alignedStrategyReturns[i] - strategyAvg);
    marketVariance += Math.pow(alignedMarketReturns[i] - marketAvg, 2);
  }
  
  covariance /= alignedMarketReturns.length;
  marketVariance /= alignedMarketReturns.length;
  
  // Calculer le beta
  const beta = marketVariance > 0 ? covariance / marketVariance : 0;
  
  return beta;
};

// Ajouter beta aux métriques du benchmark
const beta = computed(() => {
  return calculateBeta();
});

const formatNumber = (value: number, decimals: number = 2) => {
  return value.toFixed(decimals);
};

const formatPercentage = (value: number) => {
  return `${formatNumber(value, 1)}%`;
};

const formatCurrency = (value: number) => {
  return `${formatNumber(value)}€`;
};

// Fonction pour formater les durées (heures en heures:minutes)
const formatDuration = (hours: number) => {
  const hoursPart = Math.floor(hours);
  const minutesPart = Math.round((hours - hoursPart) * 60);
  return `${hoursPart}h${minutesPart > 0 ? ` ${minutesPart}min` : ''}`;
};

// Mise à jour de la fonction pour formater l'Alpha
const formatAlpha = (value: number) => {
  if (isNaN(value) || !isFinite(value)) {
    return "N/A";
  }
  return formatPercentage(value);
};
</script>

<template>
  <div class="bg-white shadow-lg rounded-xl p-6">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-900 text-center">Performance Avancée</h2>
      <button 
        @click="forceRefreshMetrics" 
        class="text-sm font-medium px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        title="Forcer le recalcul des métriques de performance"
      >
        Recalculer les métriques
      </button>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Colonne 1: Vue d'ensemble et taux de réussite -->
      <div class="space-y-6">
        <!-- Vue d'ensemble -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Vue d'ensemble</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Trades</h4>
              <p class="text-xl font-bold text-gray-900">{{ metrics.totalTrades }}
                <span class="text-xs text-gray-500">(BE: {{ Math.round(metrics.totalTrades * metrics.breakEvenRate / 100) }})</span>
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Durée Stratégie</h4>
              <p class="text-xl font-bold text-gray-900">{{ formatNumber(metrics.strategyDuration) }} j</p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Win Rate (avec BE)</h4>
              <p class="text-xl font-bold" :class="metrics.globalWinRate >= 50 ? 'text-green-600' : 'text-red-600'">
                {{ formatPercentage(metrics.globalWinRate) }}
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Profit Factor</h4>
              <p class="text-xl font-bold" :class="metrics.profitFactor >= 1.5 ? 'text-green-600' : metrics.profitFactor >= 1 ? 'text-amber-600' : 'text-red-600'">
                {{ formatNumber(metrics.profitFactor) }}
              </p>
            </div>
          </div>
        </div>
        
        <!-- Taux de réussite -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Taux de réussite</h3>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-sm font-medium text-gray-700">Win Rate Global (avec BE)</span>
                <span class="text-sm font-medium" :class="metrics.globalWinRate >= 50 ? 'text-green-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.globalWinRate) }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-green-600 h-2 rounded-full" :style="{ width: `${Math.min(metrics.globalWinRate, 100)}%` }"></div>
              </div>
              
              <div class="flex justify-between mb-1 mt-3">
                <span class="text-sm font-medium text-gray-700">Win Rate Pur (% de trades gagnants)</span>
                <span class="text-sm font-medium" :class="metrics.pureWinRate >= 50 ? 'text-green-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.pureWinRate) }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-green-600 h-2 rounded-full" :style="{ width: `${Math.min(metrics.pureWinRate, 100)}%` }"></div>
              </div>
              <div class="mt-1 text-xs text-gray-500 text-center">
                <span>4 trades gagnants sur 8 trades (BE inclus)</span>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-sm font-medium text-gray-700">Break Even Rate</span>
                <span class="text-sm font-medium text-gray-700">{{ formatPercentage(metrics.breakEvenRate) }}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-400 h-2 rounded-full" :style="{ width: `${Math.min(metrics.breakEvenRate, 100)}%` }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-sm font-medium text-gray-700">Loss Rate</span>
                <span class="text-sm font-medium text-red-600">{{ formatPercentage(metrics.lossRate) }}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-red-500 h-2 rounded-full" :style="{ width: `${Math.min(metrics.lossRate, 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Séquences -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Séquences & Risques</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Max Wins</h4>
              <p class="text-xl font-bold text-green-600">{{ metrics.maxConsecutiveWins }}</p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Max Losses</h4>
              <p class="text-xl font-bold text-red-600">{{ metrics.maxConsecutiveLosses }}</p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Risk of Ruin</h4>
              <p class="text-xl font-bold text-gray-900">{{ formatPercentage(metrics.riskOfRuin) }}</p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Drawdown Max</h4>
              <p class="text-xl font-bold text-red-600">{{ formatPercentage(metrics.maxDrawdown) }}</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Colonne 2: Analyse temporelle et Performance/Espérance -->
      <div class="space-y-6">
        <!-- Performance (déplacé de la colonne 3) -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Performance</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Rendement Annualisé</h4>
              <p class="text-xl font-bold" :class="metrics.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatPercentage(metrics.annualizedReturn) }}
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Moyenne Mensuelle</h4>
              <p class="text-xl font-bold" :class="metrics.averageMonthlyPerformance >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatPercentage(metrics.averageMonthlyPerformance) }}
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Alpha vs S&P500</h4>
              <p class="text-xl font-bold" :class="totalReturnValue - benchmarkMetrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatPercentage(totalReturnValue - benchmarkMetrics.totalReturn) }}
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Volatilité</h4>
              <p class="text-xl font-bold text-gray-900">{{ formatPercentage(metrics.returnVolatility) }}</p>
            </div>
            </div>
          </div>
          
        <!-- Espérance (déplacé de la colonne 3) -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Espérance</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Espérance (brut)</h4>
              <p class="text-xl font-bold" :class="metrics.grossExpectancy >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatPercentage(metrics.grossExpectancy) }}
              </p>
                </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Espérance (net)</h4>
              <p class="text-xl font-bold" :class="metrics.netExpectancy >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatPercentage(metrics.netExpectancy) }}
              </p>
                </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Expectancy Score</h4>
              <p class="text-xl font-bold" :class="metrics.expectancyScore >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatNumber(metrics.expectancyScore) }}
              </p>
              </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Drawdown Max</h4>
              <p class="text-xl font-bold text-red-600">{{ formatPercentage(metrics.maxDrawdown) }}</p>
            </div>
            </div>
          </div>
          
        <!-- Frais et Commissions (déplacé ici depuis la colonne 1) -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Frais et Commissions</h3>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <div class="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p class="text-xs text-gray-500 mb-1">Total des frais</p>
                <p class="text-sm font-medium text-gray-900">{{ formatNumber(metrics.totalFees) }}</p>
                </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Total des spreads</p>
                <p class="text-sm font-medium text-gray-900">{{ formatNumber(metrics.totalSpread) }}</p>
                </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Total des commissions</p>
                <p class="text-sm font-medium text-gray-900">{{ formatNumber(metrics.totalCommission) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Coût total</p>
                <p class="text-lg font-bold text-indigo-600">{{ formatNumber(metrics.totalCosts) }}</p>
                </div>
                </div>
            
            <div class="flex items-center justify-between pt-2 border-t border-gray-200">
              <div>
                <p class="text-xs text-gray-500">% du profit total</p>
                <p class="text-sm font-bold" :class="metrics.costsPercentage <= 15 ? 'text-green-600' : metrics.costsPercentage <= 30 ? 'text-amber-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.costsPercentage) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Profit sans frais</p>
                <p class="text-sm font-bold" :class="metrics.potentialProfitWithoutCosts >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.potentialProfitWithoutCosts) }}
                </p>
                </div>
                </div>
              </div>
          
          <p class="text-sm text-gray-700 mt-2" v-if="metrics.costsPercentage > 0">
            <span v-if="metrics.costsPercentage <= 10">
              Les frais représentent seulement <strong>{{ formatPercentage(metrics.costsPercentage) }}</strong> de votre profit total, ce qui est excellent.
              Votre stratégie reste très rentable même après déduction des coûts de transaction.
            </span>
            <span v-else-if="metrics.costsPercentage <= 25">
              Les frais représentent <strong>{{ formatPercentage(metrics.costsPercentage) }}</strong> de votre profit total.
              Cette proportion est acceptable mais pourrait être améliorée en optimisant la taille des positions ou en réduisant la fréquence des trades.
            </span>
            <span v-else>
              Les frais représentent <strong>{{ formatPercentage(metrics.costsPercentage) }}</strong> de votre profit total, ce qui est élevé.
              Envisagez de réduire le nombre de trades ou d'augmenter leur rentabilité moyenne pour améliorer votre performance nette.
            </span>
          </p>
            </div>
          </div>
          
      <!-- Colonne 3: Comparaison Benchmark, Ratios -->
      <div class="space-y-6">
        <!-- Benchmark Comparison - Maintenant en première position dans la colonne 3 -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex justify-between items-center">
            <span>Comparaison S&P 500</span>
            <button 
              @click="fetchSP500Data" 
              class="text-xs font-medium px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              :disabled="isLoadingBenchmark"
            >
              {{ isLoadingBenchmark ? 'Chargement...' : 'Rafraîchir' }}
            </button>
          </h3>
          
          <div v-if="benchmarkError" class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {{ benchmarkError }}
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Métrique</th>
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stratégie</th>
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S&P 500</th>
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Δ</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">Rendement Total (Alpha)</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="totalReturnValue >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(totalReturnValue) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="benchmarkMetrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(benchmarkMetrics.totalReturn) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="totalReturnValue - benchmarkMetrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(totalReturnValue - benchmarkMetrics.totalReturn) }}
                  </td>
                </tr>
                <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">Rendement Annualisé</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="metrics.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(metrics.annualizedReturn) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="benchmarkMetrics.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(benchmarkMetrics.annualizedReturn) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="metrics.annualizedReturn - benchmarkMetrics.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(metrics.annualizedReturn - benchmarkMetrics.annualizedReturn) }}
                  </td>
                </tr>
                <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">Max Drawdown</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs text-red-600">
                    {{ formatPercentage(metrics.maxDrawdown) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs text-red-600">
                    {{ formatPercentage(benchmarkMetrics.maxDrawdown) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="benchmarkMetrics.maxDrawdown - metrics.maxDrawdown >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(benchmarkMetrics.maxDrawdown - metrics.maxDrawdown) }}
                  </td>
                </tr>
                <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">Volatilité</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                    {{ formatPercentage(metrics.returnVolatility) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                    {{ formatPercentage(benchmarkMetrics.volatility) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="benchmarkMetrics.volatility - metrics.returnVolatility >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatPercentage(benchmarkMetrics.volatility - metrics.returnVolatility) }}
                  </td>
                </tr>
                <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">Ratio de Sharpe</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="metrics.sharpeRatio >= 1 ? 'text-green-600' : 'text-gray-900'">
                    {{ formatNumber(metrics.sharpeRatio) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="benchmarkMetrics.sharpeRatio >= 1 ? 'text-green-600' : 'text-gray-900'">
                    {{ formatNumber(benchmarkMetrics.sharpeRatio) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="metrics.sharpeRatio - benchmarkMetrics.sharpeRatio >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatNumber(metrics.sharpeRatio - benchmarkMetrics.sharpeRatio) }}
                  </td>
                </tr>
                <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">Ratio de Sortino</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="metrics.sortinoRatio >= 1 ? 'text-green-600' : 'text-gray-900'">
                    {{ formatNumber(metrics.sortinoRatio) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="benchmarkMetrics.sortinoRatio >= 1 ? 'text-green-600' : 'text-gray-900'">
                    {{ formatNumber(benchmarkMetrics.sortinoRatio) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="metrics.sortinoRatio - benchmarkMetrics.sortinoRatio >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ formatNumber(metrics.sortinoRatio - benchmarkMetrics.sortinoRatio) }}
                  </td>
                </tr>
                <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">Beta (vs S&P 500)</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="beta > 0 ? (beta < 1 ? 'text-green-600' : 'text-amber-600') : 'text-gray-900'">
                    {{ formatNumber(beta) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                    1.00
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs" :class="beta < 1 ? 'text-green-600' : 'text-amber-600'">
                    {{ formatNumber(beta - 1) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="sp500Data.length === 0 && !isLoadingBenchmark && !benchmarkError" class="text-xs text-gray-500 mt-2 text-center italic">
              Données du benchmark non disponibles. Utilisez le bouton pour récupérer les données du S&P 500.
            </p>
            <p v-if="isLoadingBenchmark" class="text-xs text-blue-500 mt-2 text-center">
              Chargement des données du S&P 500...
            </p>
            <p v-if="sp500Data.length > 0 && !benchmarkError" class="text-xs text-green-500 mt-2 text-center">
              {{ sp500Data.length }} points chargés ({{ sp500Data[0].date }} à {{ sp500Data[sp500Data.length - 1].date }})
            </p>
          </div>
        </div>
        
        <!-- Ratios d'analyse -->
        <div class="bg-gray-50 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Ratios d'analyse</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Ratio de Calmar</h4>
              <p class="text-xl font-bold" :class="metrics.calmarRatio >= 1 ? 'text-green-600' : 'text-gray-900'">
                {{ formatNumber(metrics.calmarRatio) }}
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Ratio de Sharpe</h4>
              <p class="text-xl font-bold" :class="metrics.sharpeRatio >= 1 ? 'text-green-600' : 'text-gray-900'">
                {{ formatNumber(metrics.sharpeRatio) }}
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Ratio de Sortino</h4>
              <p class="text-xl font-bold" :class="metrics.sortinoRatio >= 1 ? 'text-green-600' : 'text-gray-900'">
                {{ formatNumber(metrics.sortinoRatio) }}
              </p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Ratio Gain/Perte</h4>
              <p class="text-xl font-bold" :class="metrics.gainLossRatio >= 1.5 ? 'text-green-600' : 'text-gray-900'">
                {{ formatNumber(metrics.gainLossRatio) }}
              </p>
            </div>
            </div>
          </div>
        </div>
      </div>
      
    <!-- Analyse Temporelle (pleine largeur) -->
    <div class="bg-gray-50 rounded-lg shadow p-4 mt-6">
      <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Analyse Temporelle</h3>
      <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="bg-white p-3 rounded-lg shadow-sm">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Min</h4>
          <p class="text-xl font-bold text-gray-900">{{ formatDuration(metrics.minTradeDuration) }}</p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Moyenne</h4>
          <p class="text-xl font-bold text-gray-900">{{ formatDuration(metrics.averageTradeDuration) }}</p>
            </div>
            <div class="bg-white p-3 rounded-lg shadow-sm">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Max</h4>
          <p class="text-xl font-bold text-gray-900">{{ formatDuration(metrics.maxTradeDuration) }}</p>
            </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-3 rounded-lg shadow-sm">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Win Rate par Durée</h4>
          <div class="space-y-2">
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-xs font-medium text-gray-700">Courts (&lt;2h)</span>
                <span class="text-xs font-medium" :class="metrics.shortDurationWinRate >= 50 ? 'text-green-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.shortDurationWinRate) }} (avec BE)
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full" :style="{ width: `${Math.min(metrics.shortDurationWinRate, 100)}%` }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-xs font-medium text-gray-700">Moyens (2-24h)</span>
                <span class="text-xs font-medium" :class="metrics.mediumDurationWinRate >= 50 ? 'text-green-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.mediumDurationWinRate) }} (avec BE)
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-indigo-600 h-2 rounded-full" :style="{ width: `${Math.min(metrics.mediumDurationWinRate, 100)}%` }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-xs font-medium text-gray-700">Longs (24-48h)</span>
                <span class="text-xs font-medium" :class="metrics.longDurationWinRate >= 50 ? 'text-green-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.longDurationWinRate) }} (avec BE)
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-purple-600 h-2 rounded-full" :style="{ width: `${Math.min(metrics.longDurationWinRate, 100)}%` }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-xs font-medium text-gray-700">Très longs (&gt;48h)</span>
                <span class="text-xs font-medium" :class="metrics.veryLongDurationWinRate >= 50 ? 'text-green-600' : 'text-red-600'">
                  {{ formatPercentage(metrics.veryLongDurationWinRate) }} (avec BE)
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-pink-600 h-2 rounded-full" :style="{ width: `${Math.min(metrics.veryLongDurationWinRate, 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
        
            <div class="bg-white p-3 rounded-lg shadow-sm">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Corrélation Durée/Performance</h4>
          <p class="text-sm text-gray-900 font-medium">{{ metrics.durationCorrelation }}</p>
          <p class="text-xs text-gray-600 mt-2">
            Catégories: courts &lt;2h, moyens 2-24h, longs 24-48h, très longs &gt;48h.
            Adaptez votre stratégie en fonction des durées qui fonctionnent le mieux pour votre style de trading.
              </p>
            </div>
          </div>
        </div>
        
    <!-- Interprétation (section pleine largeur) -->
    <div class="bg-gray-50 rounded-lg shadow p-4 mt-6">
          <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Interprétations</h3>
          
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Colonne 1 -->
        <div class="space-y-6">
          <!-- Section durée des trades -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Durée des trades</h4>
            <p class="text-sm text-gray-700">
              Vos trades varient de <span class="font-medium">{{ formatDuration(metrics.minTradeDuration) }}</span> à 
              <span class="font-medium">{{ formatDuration(metrics.maxTradeDuration) }}</span> (moyenne: 
              <span class="font-medium">{{ formatDuration(metrics.averageTradeDuration) }}</span>).
              {{ metrics.durationCorrelation }}
            </p>
            <p class="text-xs text-gray-600 mt-2">
              Catégories: courts &lt;2h, moyens 2-24h, longs 24-48h, très longs &gt;48h.
              Adaptez votre stratégie en fonction des durées qui fonctionnent le mieux pour votre style de trading.
            </p>
          </div>
          
          <!-- Section profitabilité -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Profitabilité</h4>
            <p class="text-sm text-gray-700" v-if="metrics.profitFactor >= 1.5">
              Avec un Profit Factor de {{ formatNumber(metrics.profitFactor) }} et un Win Rate de {{ formatPercentage(metrics.globalWinRate) }} (BE inclus), 
              votre stratégie montre une bonne rentabilité. Le ratio de Sharpe de {{ formatNumber(metrics.sharpeRatio) }} 
              indique un bon rapport rendement/risque.
            </p>
            <p class="text-sm text-gray-700" v-else-if="metrics.profitFactor >= 1">
              Avec un Profit Factor de {{ formatNumber(metrics.profitFactor) }}, votre stratégie est rentable
              mais présente une marge d'amélioration. Un Win Rate de {{ formatPercentage(metrics.globalWinRate) }} (BE inclus)
              est acceptable mais pourrait être optimisé.
            </p>
            <p class="text-sm text-gray-700" v-else>
              Un Profit Factor de {{ formatNumber(metrics.profitFactor) }} indique que votre stratégie n'est pas
              rentable actuellement. Réévaluez votre approche et considérez d'ajuster votre gestion du risque.
            </p>
          </div>
          
          <!-- Section Alpha -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Comparaison au marché</h4>
            <p class="text-sm text-gray-700" v-if="totalReturnValue - benchmarkMetrics.totalReturn > 5">
              Votre stratégie surperforme significativement le S&P500 avec un alpha de {{ formatPercentage(totalReturnValue - benchmarkMetrics.totalReturn) }}.
              Cette performance supérieure indique un avantage compétitif durable.
            </p>
            <p class="text-sm text-gray-700" v-else-if="totalReturnValue - benchmarkMetrics.totalReturn > 0">
              Avec un alpha de {{ formatPercentage(totalReturnValue - benchmarkMetrics.totalReturn) }}, votre stratégie surperforme légèrement le S&P500.
              Continuez à optimiser pour maintenir cet avantage.
            </p>
            <p class="text-sm text-gray-700" v-else-if="totalReturnValue - benchmarkMetrics.totalReturn >= -5 && totalReturnValue - benchmarkMetrics.totalReturn <= 0">
              Votre stratégie se situe proche du benchmark avec un alpha de {{ formatPercentage(totalReturnValue - benchmarkMetrics.totalReturn) }}.
              Considérez des ajustements pour surperformer le marché.
            </p>
            <p class="text-sm text-gray-700" v-else>
              Avec un alpha de {{ formatPercentage(totalReturnValue - benchmarkMetrics.totalReturn) }}, votre stratégie sous-performe le S&P500.
              Réévaluez votre approche pour améliorer la performance relative.
            </p>
        </div>
      </div>
        
        <!-- Colonne 2 -->
        <div class="space-y-6">
          <!-- Section Beta -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Beta (Volatilité relative)</h4>
            <p class="text-sm text-gray-700" v-if="beta > 0 && beta < 0.8">
              Avec un beta de {{ formatNumber(beta) }}, votre stratégie est moins volatile que le S&P500.
              Cela indique une approche défensive qui pourrait surperformer dans des marchés baissiers.
            </p>
            <p class="text-sm text-gray-700" v-else-if="beta >= 0.8 && beta <= 1.2">
              Votre beta de {{ formatNumber(beta) }} indique une volatilité similaire au marché.
              Votre stratégie tend à suivre les mouvements généraux du S&P500.
            </p>
            <p class="text-sm text-gray-700" v-else-if="beta > 1.2">
              Avec un beta élevé de {{ formatNumber(beta) }}, votre stratégie est plus volatile que le marché.
              Cela peut générer des rendements supérieurs en marché haussier mais des pertes plus importantes en marché baissier.
            </p>
            <p class="text-sm text-gray-700" v-else>
              Le beta n'a pas pu être calculé avec précision. Cela peut être dû à un manque de données
              ou à une corrélation insuffisante entre votre stratégie et le marché.
            </p>
          </div>
          
          <!-- Section Volatilité et Drawdown -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">Volatilité et Drawdown</h4>
            <p class="text-sm text-gray-700" v-if="benchmarkMetrics.volatility - metrics.returnVolatility > 2">
              Avec une volatilité de {{ formatPercentage(metrics.returnVolatility) }} contre {{ formatPercentage(benchmarkMetrics.volatility) }} 
              pour le S&P500, votre stratégie affiche une stabilité supérieure. Cet écart de {{ formatPercentage(benchmarkMetrics.volatility - metrics.returnVolatility) }} 
              suggère une bonne maîtrise du risque.
            </p>
            <p class="text-sm text-gray-700" v-else-if="Math.abs(benchmarkMetrics.volatility - metrics.returnVolatility) <= 2">
              La volatilité de votre stratégie ({{ formatPercentage(metrics.returnVolatility) }}) est comparable à celle du S&P500 
              ({{ formatPercentage(benchmarkMetrics.volatility) }}). Votre approche présente un niveau de risque similaire au marché.
            </p>
            <p class="text-sm text-gray-700" v-else>
              La volatilité de votre stratégie ({{ formatPercentage(metrics.returnVolatility) }}) est supérieure à celle du S&P500 
              ({{ formatPercentage(benchmarkMetrics.volatility) }}). Cette différence de {{ formatPercentage(metrics.returnVolatility - benchmarkMetrics.volatility) }} 
              indique un risque plus élevé qui devrait être compensé par des rendements proportionnels.
            </p>
            
            <p class="text-sm text-gray-700 mt-2" v-if="benchmarkMetrics.maxDrawdown - metrics.maxDrawdown > 5">
              Votre drawdown maximal ({{ formatPercentage(metrics.maxDrawdown) }}) est significativement inférieur à celui du S&P500 
              ({{ formatPercentage(benchmarkMetrics.maxDrawdown) }}), ce qui indique une excellente résistance aux corrections de marché.
            </p>
            <p class="text-sm text-gray-700 mt-2" v-else-if="Math.abs(benchmarkMetrics.maxDrawdown - metrics.maxDrawdown) <= 5">
              Votre drawdown maximal ({{ formatPercentage(metrics.maxDrawdown) }}) est proche de celui du S&P500 
              ({{ formatPercentage(benchmarkMetrics.maxDrawdown) }}). Votre stratégie réagit de manière similaire aux corrections de marché.
            </p>
            <p class="text-sm text-gray-700 mt-2" v-else>
              Votre drawdown maximal ({{ formatPercentage(metrics.maxDrawdown) }}) est plus important que celui du S&P500 
              ({{ formatPercentage(benchmarkMetrics.maxDrawdown) }}). Cette différence négative suggère une vulnérabilité accrue aux corrections de marché.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Section pleine largeur -->
      <div class="mt-6">
        <!-- Section Ratios de performance ajustés au risque -->
        <div class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Ratios Sharpe et Sortino</h4>
          <p class="text-sm text-gray-700" v-if="metrics.sharpeRatio - benchmarkMetrics.sharpeRatio > 0.3">
            Votre ratio de Sharpe ({{ formatNumber(metrics.sharpeRatio) }}) est nettement supérieur à celui du S&P500 
            ({{ formatNumber(benchmarkMetrics.sharpeRatio) }}). Cette différence de {{ formatNumber(metrics.sharpeRatio - benchmarkMetrics.sharpeRatio) }} 
            démontre une efficience supérieure de votre stratégie en termes de rendement ajusté au risque.
          </p>
          <p class="text-sm text-gray-700" v-else-if="Math.abs(metrics.sharpeRatio - benchmarkMetrics.sharpeRatio) <= 0.3">
            Votre ratio de Sharpe ({{ formatNumber(metrics.sharpeRatio) }}) est comparable à celui du S&P500 
            ({{ formatNumber(benchmarkMetrics.sharpeRatio) }}). L'efficience de votre stratégie en termes de rendement/risque 
            est proche de celle du marché.
          </p>
          <p class="text-sm text-gray-700" v-else>
            Votre ratio de Sharpe ({{ formatNumber(metrics.sharpeRatio) }}) est inférieur à celui du S&P500 
            ({{ formatNumber(benchmarkMetrics.sharpeRatio) }}). Cet écart négatif indique que le rendement obtenu 
            ne compense pas suffisamment le risque pris par rapport au marché.
          </p>
          
          <p class="text-sm text-gray-700 mt-2" v-if="metrics.sortinoRatio - benchmarkMetrics.sortinoRatio > 0.3">
            Votre ratio de Sortino ({{ formatNumber(metrics.sortinoRatio) }}) dépasse celui du S&P500 
            ({{ formatNumber(benchmarkMetrics.sortinoRatio) }}). Cette performance indique une excellente gestion 
            du risque baissier et une capacité à limiter les pertes pendant que vous générez des rendements.
          </p>
          <p class="text-sm text-gray-700 mt-2" v-else-if="Math.abs(metrics.sortinoRatio - benchmarkMetrics.sortinoRatio) <= 0.3">
            Votre ratio de Sortino ({{ formatNumber(metrics.sortinoRatio) }}) est similaire à celui du S&P500 
            ({{ formatNumber(benchmarkMetrics.sortinoRatio) }}). Votre gestion du risque baissier est comparable à celle du marché.
          </p>
          <p class="text-sm text-gray-700 mt-2" v-else>
            Votre ratio de Sortino ({{ formatNumber(metrics.sortinoRatio) }}) est inférieur à celui du S&P500 
            ({{ formatNumber(benchmarkMetrics.sortinoRatio) }}). Cette différence suggère que votre stratégie est plus 
            exposée aux mouvements baissiers que le marché général.
          </p>
        </div>
        
        <!-- Section Rendement annualisé -->
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-2">Rendement Annualisé</h4>
          <p class="text-sm text-gray-700" v-if="metrics.annualizedReturn - benchmarkMetrics.annualizedReturn > 5">
            Votre rendement annualisé de {{ formatPercentage(metrics.annualizedReturn) }} surpasse significativement 
            celui du S&P500 ({{ formatPercentage(benchmarkMetrics.annualizedReturn) }}). Cette surperformance de 
            {{ formatPercentage(metrics.annualizedReturn - benchmarkMetrics.annualizedReturn) }} confirme l'efficacité 
            de votre stratégie à long terme.
          </p>
          <p class="text-sm text-gray-700" v-else-if="metrics.annualizedReturn - benchmarkMetrics.annualizedReturn > 0">
            Votre rendement annualisé de {{ formatPercentage(metrics.annualizedReturn) }} dépasse légèrement 
            celui du S&P500 ({{ formatPercentage(benchmarkMetrics.annualizedReturn) }}). Cette surperformance modeste 
            indique que votre stratégie ajoute de la valeur, mais pourrait être optimisée davantage.
          </p>
          <p class="text-sm text-gray-700" v-else-if="metrics.annualizedReturn - benchmarkMetrics.annualizedReturn >= -3">
            Votre rendement annualisé de {{ formatPercentage(metrics.annualizedReturn) }} est légèrement inférieur 
            à celui du S&P500 ({{ formatPercentage(benchmarkMetrics.annualizedReturn) }}). Cet écart modeste pourrait 
            être comblé par quelques ajustements stratégiques.
          </p>
          <p class="text-sm text-gray-700" v-else>
            Votre rendement annualisé de {{ formatPercentage(metrics.annualizedReturn) }} est nettement inférieur 
            à celui du S&P500 ({{ formatPercentage(benchmarkMetrics.annualizedReturn) }}). Cet écart significatif 
            de {{ formatPercentage(benchmarkMetrics.annualizedReturn - metrics.annualizedReturn) }} suggère qu'un ETF 
            sur le S&P500 pourrait être une alternative plus rentable actuellement.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>