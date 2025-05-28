<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useTradingStore } from '../stores/trading';
import type { Trade } from '../types/trading';
import { Line, Bar, Pie, Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import AdvancedPerformancePanel from '../components/AdvancedPerformancePanel.vue';
import TradingStrategyPanel from '../components/TradingStrategyPanel.vue';
import TradingCalendar from '../components/TradingCalendar.vue';
import { runMonteCarloSimulation, type MonteCarloResult } from '../utils/monteCarloSimulation';
import { runBootstrapResampling, type BootstrapResult } from '../utils/bootstrapResampling';
import { useTradesStore } from '../stores/trades';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const tradingStore = useTradingStore();

const showAddModal = ref(false);
const showAdvancedPerformance = ref(false); // Masqué par défaut
const showTradingStrategy = ref(false);
const showTradingCalendar = ref(false); // Masqué par défaut
const showArchives = ref(false); // Masqué par défaut
const sortBy = ref('exitDate');
const sortDirection = ref('desc');
const selectedTimeframe = ref('all'); // 'month', 'year', 'all'

// Capital initial et calculs associés
const initialCapital = ref(tradingStore.initialCapital);
const updateInitialCapital = () => {
  tradingStore.updateInitialCapital(initialCapital.value);
};

// Fonction de réinitialisation complète
const resetAll = () => {
  if (confirm('Êtes-vous sûr de vouloir effacer toutes vos données ? Cette action est irréversible.')) {
    tradingStore.resetAllData();
    // Rafraîchir la page pour s'assurer que tous les composants sont mis à jour
    window.location.reload();
  }
};

// Variables pour le modal d'archivage
const showArchiveModal = ref(false);
const archiveName = ref('');
const archivesUpdateTrigger = ref(0);

// Fonction d'archivage de la période de stratégie
const archiveStrategy = () => {
  if (!tradingStore.trading.trades.length) {
    alert('Aucun trade à archiver.');
    return;
  }
  
  // Générer un nom par défaut
  archiveName.value = `Stratégie ${new Date().toLocaleDateString('fr-FR')}`;
  showArchiveModal.value = true;
};

// Fonction pour confirmer l'archivage avec le nom personnalisé
const confirmArchive = () => {
  if (!archiveName.value.trim()) {
    alert('Veuillez saisir un nom pour l\'archive.');
    return;
  }
  
  // Calculer la durée de la stratégie basée sur l'écart entre premier et dernier trade
  const trades = tradingStore.trading.trades;
  let strategyDuration = 0;
  let startDate = null;
  let endDate = null;
  
  if (trades.length > 0) {
    // Trier les trades par date d'entrée pour obtenir le premier trade
    const sortedByEntry = [...trades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    // Trier les trades par date de sortie pour obtenir le dernier trade
    const sortedByExit = [...trades].sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
    
    startDate = new Date(sortedByEntry[0].entryDate);
    endDate = new Date(sortedByExit[sortedByExit.length - 1].exitDate);
    strategyDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)); // en jours
  }
  
  // Calculer le drawdown maximum réel basé sur la courbe d'équité
  let realMaxDrawdown = 0;
  if (tradingStore.trading.equityCurve.length > 1) {
    let peak = tradingStore.trading.equityCurve[0].balance;
    
    for (const point of tradingStore.trading.equityCurve) {
      if (point.balance > peak) {
        peak = point.balance;
      }
      const drawdown = ((peak - point.balance) / peak) * 100;
      realMaxDrawdown = Math.max(realMaxDrawdown, drawdown);
    }
  }
  
  // Calculer les métriques réelles à partir des trades
  const winningTrades = trades.filter(t => t.profitLoss > 0);
  const losingTrades = trades.filter(t => t.profitLoss < 0);
  const breakEvenTrades = trades.filter(t => t.profitLoss === 0);
  
  const realWinRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const realBreakEvenRate = trades.length > 0 ? (breakEvenTrades.length / trades.length) * 100 : 0;
  const realLossRate = trades.length > 0 ? (losingTrades.length / trades.length) * 100 : 0;
  
  // Calculer le profit factor réel
  const totalProfit = winningTrades.reduce((sum, t) => sum + t.profitLoss, 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profitLoss, 0));
  const realProfitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
  
  // Calculer l'expectancy réelle
  const realExpectancy = trades.length > 0 ? trades.reduce((sum, t) => sum + t.profitLoss, 0) / trades.length : 0;
  
  // Calculer les gains/pertes consécutifs maximaux
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  
  // Trier les trades par date de sortie pour analyser la séquence
  const chronologicalTrades = [...trades].sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
  
  chronologicalTrades.forEach(trade => {
    if (trade.profitLoss > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else if (trade.profitLoss < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    } else {
      // Trade break-even - on peut choisir de ne pas casser la série ou de la casser
      // Ici on choisit de ne pas casser la série pour les break-even
    }
  });
  
  // Créer un objet d'archive avec les données réelles calculées
  const archiveData = {
    id: Date.now().toString(),
    name: archiveName.value.trim(),
    dateArchived: new Date(),
    strategyDuration: strategyDuration,
    startDate: startDate,
    endDate: endDate,
    initialCapital: tradingStore.initialCapital,
    finalCapital: currentCapital.value,
    totalTrades: trades.length,
    performance: performancePercent.value,
    winRate: realWinRate,
    breakEvenRate: realBreakEvenRate,
    lossRate: realLossRate,
    maxDrawdown: realMaxDrawdown,
    profitFactor: realProfitFactor,
    expectancy: realExpectancy,
    maxConsecutiveWins: maxWinStreak,
    maxConsecutiveLosses: maxLossStreak,
    totalProfit: totalProfit,
    totalLoss: totalLoss,
    averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
    averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
    trades: [...tradingStore.trading.trades],
    metrics: { ...tradingStore.trading.metrics },
    equityCurve: [...tradingStore.trading.equityCurve]
  };
  
  // Sauvegarder dans les archives (localStorage)
  const existingArchives = JSON.parse(localStorage.getItem('quantify_strategy_archives') || '[]');
  existingArchives.push(archiveData);
  localStorage.setItem('quantify_strategy_archives', JSON.stringify(existingArchives));
  
  // Réinitialiser le capital initial au niveau actuel
  tradingStore.updateInitialCapital(currentCapital.value);
  
  // Effacer tous les trades
  tradingStore.trading.trades = [];
  tradingStore.trading.equityCurve = [{
    date: new Date(),
    balance: currentCapital.value
  }];
  
  // Réinitialiser les métriques
  tradingStore.updateTradingMetrics();
  tradingStore.saveToLocalStorage();
  
  // Déclencher la réactivité pour les archives
  archivesUpdateTrigger.value++;
  
  // Fermer le modal et réinitialiser
  showArchiveModal.value = false;
  archiveName.value = '';
  
  alert(`Stratégie "${archiveData.name}" archivée avec succès !\n\nPerformance archivée : ${performancePercent.value.toFixed(2)}%\nDrawdown max réel : ${realMaxDrawdown.toFixed(2)}%\nDurée : ${formatStrategyDuration(strategyDuration)}\nNouvel échantillon démarré avec ${currentCapital.value.toFixed(2)}€`);
};

// Computed property pour les archives (réactive)
const archives = computed(() => {
  // Utiliser archivesUpdateTrigger pour forcer la réactivité
  archivesUpdateTrigger.value;
  return JSON.parse(localStorage.getItem('quantify_strategy_archives') || '[]');
});

// Fonction pour récupérer les archives (pour compatibilité)
const getArchives = () => {
  return archives.value;
};

// Fonction pour formater la durée de la stratégie
const formatStrategyDuration = (duration: number) => {
  if (duration === 0) return 'N/A';
  if (duration < 1) return 'Moins d\'1 jour';
  if (duration === 1) return '1 jour';
  if (duration < 7) return `${duration} jours`;
  if (duration < 30) {
    const weeks = Math.floor(duration / 7);
    const days = duration % 7;
    if (weeks === 1 && days === 0) return '1 semaine';
    if (weeks === 1) return `1 semaine ${days} jour${days > 1 ? 's' : ''}`;
    if (days === 0) return `${weeks} semaines`;
    return `${weeks} semaines ${days} jour${days > 1 ? 's' : ''}`;
  }
  if (duration < 365) {
    const months = Math.floor(duration / 30);
    const days = duration % 30;
    if (months === 1 && days === 0) return '1 mois';
    if (months === 1 && days < 7) return `1 mois ${days} jour${days > 1 ? 's' : ''}`;
    if (months === 1) {
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      if (weeks === 1 && remainingDays === 0) return '1 mois 1 semaine';
      if (weeks === 1) return `1 mois 1 semaine ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
      return `1 mois ${days} jours`;
    }
    if (days === 0) return `${months} mois`;
    if (days < 7) return `${months} mois ${days} jour${days > 1 ? 's' : ''}`;
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (weeks === 1 && remainingDays === 0) return `${months} mois 1 semaine`;
    if (weeks === 1) return `${months} mois 1 semaine ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
    return `${months} mois ${days} jours`;
  }
  const years = Math.floor(duration / 365);
  const remainingDays = duration % 365;
  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;
  
  if (years === 1 && months === 0 && days === 0) return '1 an';
  if (years === 1 && months === 0) return `1 an ${days} jour${days > 1 ? 's' : ''}`;
  if (years === 1 && days === 0) return `1 an ${months} mois`;
  if (years === 1) return `1 an ${months} mois ${days} jour${days > 1 ? 's' : ''}`;
  if (months === 0 && days === 0) return `${years} ans`;
  if (months === 0) return `${years} ans ${days} jour${days > 1 ? 's' : ''}`;
  if (days === 0) return `${years} ans ${months} mois`;
  return `${years} ans ${months} mois ${days} jour${days > 1 ? 's' : ''}`;
};

// Fonction pour supprimer une archive
const deleteArchive = (archiveId: string, archiveName: string) => {
  if (confirm(`Êtes-vous sûr de vouloir supprimer l'archive "${archiveName}" ?\n\nCette action est irréversible.`)) {
    const currentArchives = JSON.parse(localStorage.getItem('quantify_strategy_archives') || '[]');
    const filteredArchives = currentArchives.filter((archive: any) => archive.id !== archiveId);
    localStorage.setItem('quantify_strategy_archives', JSON.stringify(filteredArchives));
    
    // Déclencher la réactivité
    archivesUpdateTrigger.value++;
    
    alert(`Archive "${archiveName}" supprimée avec succès.`);
  }
};

// Fonction pour calculer le ratio gain/perte d'une archive
const calculateGainLossRatio = (archive: any) => {
  if (!archive.averageWin || !archive.averageLoss || archive.averageLoss === 0) {
    return archive.averageWin > 0 ? '∞' : '0.00';
  }
  const ratio = Math.abs(archive.averageWin / archive.averageLoss);
  return ratio.toFixed(2);
};

// Fonction pour obtenir la couleur du ratio gain/perte
const getGainLossRatioColor = (archive: any) => {
  const ratio = parseFloat(calculateGainLossRatio(archive));
  if (isNaN(ratio)) return 'text-gray-600';
  if (ratio >= 2) return 'text-green-600';
  if (ratio >= 1.5) return 'text-blue-600';
  if (ratio >= 1) return 'text-yellow-600';
  return 'text-red-600';
};

// Fonction pour calculer le nombre de trades par jour
const calculateTradesPerDay = (archive: any) => {
  if (!archive.strategyDuration || archive.strategyDuration === 0) return '0.00';
  const tradesPerDay = archive.totalTrades / archive.strategyDuration;
  return tradesPerDay.toFixed(2);
};

// Calcul du capital actuel
const currentCapital = computed(() => {
  if (!tradingStore.trading.equityCurve.length) return initialCapital.value;
  return tradingStore.trading.equityCurve[tradingStore.trading.equityCurve.length - 1].balance;
});

// Calcul de la performance en pourcentage
const performancePercent = computed(() => {
  if (initialCapital.value === 0) return 0;
  return ((currentCapital.value - initialCapital.value) / initialCapital.value) * 100;
});

// Format des dates pour l'affichage
const formatDate = (date: Date | string) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleDateString('fr-FR');
};

// Fonction pour formater les pourcentages
const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

// Transactions triées
const sortedTrades = computed(() => {
  if (!tradingStore.trading.trades.length) return [];
  
  let filteredTrades = [...tradingStore.trading.trades];
  
  // Filtrer par période si nécessaire
  const now = new Date();
  
  switch (selectedTimeframe.value) {
    case 'week':
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTrades = filteredTrades.filter(trade => new Date(trade.exitDate as Date | string) >= oneWeekAgo);
      break;
    case 'month':
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      filteredTrades = filteredTrades.filter(trade => new Date(trade.exitDate as Date | string) >= oneMonthAgo);
      break;
    case 'year':
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      filteredTrades = filteredTrades.filter(trade => new Date(trade.exitDate as Date | string) >= oneYearAgo);
      break;
    default:
      // Ne pas filtrer si 'all' est sélectionné
      break;
  }
  
  return filteredTrades.sort((a, b) => {
    let valueA: any;
    let valueB: any;
    
    if (sortBy.value === 'exitDate') {
      valueA = new Date(a.exitDate).getTime();
      valueB = new Date(b.exitDate).getTime();
    } else if (sortBy.value === 'entryDate') {
      valueA = new Date(a.entryDate).getTime();
      valueB = new Date(b.entryDate).getTime();
    } else if (sortBy.value === 'profitLoss') {
      valueA = a.profitLoss;
      valueB = b.profitLoss;
    } else if (sortBy.value === 'symbol') {
      valueA = a.symbol;
      valueB = b.symbol;
    } else {
      valueA = a[sortBy.value as keyof Trade];
      valueB = b[sortBy.value as keyof Trade];
    }
    
    // Direction du tri
    const direction = sortDirection.value === 'asc' ? 1 : -1;
    
    // Tri avec vérification que les valeurs ne sont pas undefined
    if (valueA !== undefined && valueB !== undefined) {
      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
    }
    return 0;
  });
});

// Statistiques de trading filtrées selon la période sélectionnée
const tradingStats = computed(() => {
  const trades = sortedTrades.value;
  
  if (!trades.length) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfitLoss: 0,
      expectancy: 0,
      averageTradeDuration: 0,
      longTrades: 0,
      shortTrades: 0,
      longWinRate: 0,
      shortWinRate: 0,
      lossRate: 0,
      gainLossRatio: 0,
      maxDrawdown: 0,
      maxConsecutiveLosses: 0,
      maxConsecutiveWins: 0,
      annualizedReturn: 0,
      volatility: 0,
      breakEvenTrades: 0,
      breakEvenRate: 0
    };
  }
  
  // Calculer les statistiques
  let winningTrades = trades.filter(t => t.profitLoss > 0);
  let losingTrades = trades.filter(t => t.profitLoss < 0);
  let longTrades = trades.filter(t => t.direction === 'LONG');
  let shortTrades = trades.filter(t => t.direction === 'SHORT');
  let longWinningTrades = longTrades.filter(t => t.profitLoss > 0);
  let shortWinningTrades = shortTrades.filter(t => t.profitLoss > 0);
  
  let totalProfit = winningTrades.reduce((acc, t) => acc + t.profitLoss, 0);
  let totalLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.profitLoss, 0));
  
  // Calcul du profit factor (même formule que dans le store)
  let profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
  
  // Calcul de la durée moyenne des trades en jours
  let totalDuration = trades.reduce((acc, t) => {
    const entryDate = new Date(t.entryDate);
    const exitDate = new Date(t.exitDate);
    const duration = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24); // en jours
    return acc + duration;
  }, 0);

  // Calcul du drawdown max
  let maxDrawdown = 0;
  let peak = 0;
  let balance = 0;
  trades.forEach(trade => {
    // Convertir le P/L de pourcentage à valeur absolue basée sur le capital initial
    const plValue = (trade.profitLoss / 100) * initialCapital.value;
    balance += plValue;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
  });
  
  // Convertir le drawdown en pourcentage du capital initial
  maxDrawdown = (maxDrawdown / initialCapital.value) * 100;

  // Calcul des pertes/gains consécutifs max
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

  // Calcul du rendement annualisé
  const firstTrade = new Date(trades[0].entryDate);
  const lastTrade = new Date(trades[trades.length - 1].exitDate);
  const days = (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24);
  const annualizedReturn = (Math.pow(1 + (totalProfit - totalLoss) / 10000, 365 / days) - 1) * 100;

  // Calcul de la volatilité
  const returns = trades.map(t => t.profitLoss);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;
  
  // Calcul des trades break-even
  const breakEvenTrades = trades.filter(t => t.profitLoss === 0);
  const breakEvenRate = (breakEvenTrades.length / trades.length) * 100;
  
  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: trades.length ? (winningTrades.length / trades.length) * 100 + breakEvenRate : 0, // Inclure les break-even dans le win rate
    profitFactor: profitFactor, // Utiliser la variable calculée plus haut
    averageWin: winningTrades.length ? totalProfit / winningTrades.length : 0,
    averageLoss: losingTrades.length ? -totalLoss / losingTrades.length : 0,
    totalProfit: totalProfit,
    totalLoss: -totalLoss,
    netProfitLoss: totalProfit - totalLoss,
    expectancy: trades.length ? (totalProfit - totalLoss) / trades.length : 0,
    averageTradeDuration: trades.length ? totalDuration / trades.length : 0,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    breakEvenTrades: breakEvenTrades.length,
    breakEvenRate: breakEvenRate,
    longWinRate: longTrades.length ? (longWinningTrades.length / longTrades.length) * 100 + (longTrades.filter(t => t.profitLoss === 0).length / longTrades.length) * 100 : 0,
    shortWinRate: shortTrades.length ? (shortWinningTrades.length / shortTrades.length) * 100 + (shortTrades.filter(t => t.profitLoss === 0).length / shortTrades.length) * 100 : 0,
    lossRate: trades.length ? (losingTrades.length / trades.length) * 100 : 0,
    gainLossRatio: losingTrades.length > 0 ? (totalProfit / winningTrades.length) / (totalLoss / losingTrades.length) : winningTrades.length > 0 ? Infinity : 0,
    maxDrawdown: maxDrawdown,
    maxConsecutiveLosses: maxLosses,
    maxConsecutiveWins: maxWins,
    annualizedReturn: annualizedReturn,
    volatility: volatility
  };
});

// Données pour le graphique répartition Long/Short
const directionChartData = computed(() => {
  const { longTrades, shortTrades } = tradingStats.value;
  return {
    labels: ['Long', 'Short'],
    datasets: [
      {
        backgroundColor: ['#10B981', '#EF4444'],
        data: [longTrades, shortTrades]
      }
    ]
  };
});

// Données pour le graphique répartition Gagnant/Perdant
const winLossChartData = computed(() => {
  const { winningTrades, losingTrades } = tradingStats.value;
  return {
    labels: ['Gagnants', 'Perdants'],
    datasets: [
      {
        backgroundColor: ['#10B981', '#EF4444'],
        data: [winningTrades, losingTrades]
      }
    ]
  };
});

// Données pour le graphique de performance mensuelle
const monthlyPerformanceData = computed(() => {
  const trades = tradingStore.trading.trades;
  if (!trades.length) return { labels: [], datasets: [{ data: [], backgroundColor: '#4F46E5' }] };
  
  // Créer un tableau des 6 derniers mois
  const today = new Date();
  const months: string[] = [];
  const monthlyProfit: Record<string, number> = {};
  const monthlyTradeCount: Record<string, number> = {}; // Compteur de trades par mois
  
  // Générer les 6 derniers mois
  for (let i = 5; i >= 0; i--) {
    const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
    months.push(monthKey);
    monthlyProfit[monthKey] = 0;
    monthlyTradeCount[monthKey] = 0; // Initialiser le compteur à 0
  }
  
  // Calculer le profit et compter les trades pour chaque mois
  trades.forEach(trade => {
    const exitDate = new Date(trade.exitDate);
    const monthKey = `${exitDate.getFullYear()}-${exitDate.getMonth() + 1}`;
    if (monthlyProfit[monthKey] !== undefined) {
      // On stocke directement le pourcentage
      monthlyProfit[monthKey] += trade.profitLoss;
      monthlyTradeCount[monthKey]++; // Incrémenter le compteur de trades
    }
  });
  
  // Formater les labels des mois
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const formattedLabels = months.map(m => {
    const [year, month] = m.split('-');
    return `${monthNames[Number(month) - 1]} ${year}`;
  });
  
  return {
    labels: formattedLabels,
    datasets: [
      {
        label: 'Performance Mensuelle (%)',
        data: months.map(m => monthlyProfit[m]),
        backgroundColor: months.map(m => monthlyProfit[m] >= 0 ? '#10B981' : '#EF4444'),
        // Stocker les données des nombres de trades comme metadata pour les tooltips
        monthlyTradeCount: months.map(m => monthlyTradeCount[m])
      }
    ]
  };
});

// Ajouter les données du S&P 500
const sp500Data = ref<{ date: string; close: number }[]>([]);
const isLoadingSP500 = ref(false);
const sp500Error = ref('');

// Fonction pour récupérer les données du S&P 500
const fetchSP500Data = async () => {
  isLoadingSP500.value = true;
  sp500Error.value = '';
  
  try {
    const res = await fetch('http://localhost:3000/api/yahoo/^GSPC');
    if (!res.ok) {
      throw new Error(`Erreur HTTP: ${res.status}`);
    }
    
    const json = await res.json();
    
    // Formatage simplifié : on garde seulement la date et la clôture
    sp500Data.value = json.map((point: any) => ({
      date: point.date.split('T')[0],
      close: point.close
    }));
    
  } catch (err: any) {
    console.error('Erreur de récupération du S&P 500:', err);
    sp500Error.value = `Erreur de récupération: ${err.message}`;
  } finally {
    isLoadingSP500.value = false;
  }
};

// Calcul de la performance du SP500 sur la période
const sp500Performance = computed(() => {
  if (sp500Data.value.length < 2) return 0;

  // Filtrer les données pour avoir la même période que les trades
  let filteredData = sp500Data.value;
  
  if (tradingStore.trading.trades.length > 0) {
    const sortedTrades = [...tradingStore.trading.trades].sort((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    
    const firstTradeDate = new Date(sortedTrades[0].entryDate);
    
    filteredData = sp500Data.value.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= firstTradeDate && pointDate <= new Date(); // Jusqu'à aujourd'hui
    });
  }
  
  if (filteredData.length < 2) return 0;
  
  const firstValue = filteredData[0].close;
  const lastValue = filteredData[filteredData.length - 1].close;
  
  return ((lastValue - firstValue) / firstValue) * 100;
});

// Données réactives pour le S&P 500
const sp500ChartData = computed(() => {
  if (sp500Data.value.length === 0) {
    return {
      labels: [],
      datasets: [{
        label: 'S&P 500',
        data: [],
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Filtrer les données pour avoir la même période que les trades
  let filteredData = sp500Data.value;
  
  if (tradingStore.trading.trades.length > 0) {
    const sortedTrades = [...tradingStore.trading.trades].sort((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    
    const firstTradeDate = new Date(sortedTrades[0].entryDate);
    
    filteredData = sp500Data.value.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= firstTradeDate && pointDate <= new Date(); // Jusqu'à aujourd'hui
    });
  }
  
  if (filteredData.length === 0) return { labels: [], datasets: [] };
  
  // Utiliser le prix réel au lieu de normaliser en base 100
  return {
    labels: filteredData.map(point => {
      const dateParts = point.date.split('-');
      return `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}`;
    }),
    datasets: [{
      label: 'S&P 500 (Prix réel)',
      data: filteredData.map(point => point.close),
      borderColor: '#DC2626',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };
});

// Configuration pour le graphique de base (commun)
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: 'rgba(46, 52, 64, 0.9)',
      titleFont: {
        size: 14,
      },
      bodyFont: {
        size: 13,
      },
      padding: 12,
      borderColor: 'rgba(192, 198, 211, 0.3)',
      borderWidth: 1,
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(192, 198, 211, 0.2)',
      },
      ticks: {
        color: 'var(--color-gray-600)',
        font: {
          size: 11,
        },
      },
      title: {
        display: true,
        text: 'Valeur (€)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      }
    },
    x: {
      grid: {
        color: 'rgba(192, 198, 211, 0.2)',
        drawBorder: false,
      },
      ticks: {
        color: 'var(--color-gray-600)',
        font: {
          size: 11,
        },
        maxRotation: 45,
        minRotation: 45,
      },
      title: {
        display: true,
        text: 'Date',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  },
  elements: {
    point: {
      radius: 3,
      hoverRadius: 5,
    },
    line: {
      borderWidth: 2,
    }
  }
};

// Configuration pour le graphique S&P 500
const sp500ChartOptions = {
  ...baseChartOptions,
  plugins: {
    ...baseChartOptions.plugins,
    title: {
      display: true,
      text: 'S&P 500',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    }
  }
};

// Configuration pour le graphique Stratégie de Trading
const strategyChartOptions = {
  ...baseChartOptions,
  plugins: {
    ...baseChartOptions.plugins,
    title: {
      display: true,
      text: 'Stratégie de Trading',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    }
  }
};

// Format pour les pourcentages
const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Modifier la fonction equityChartData pour inclure les données du S&P 500
const equityChartData = computed(() => {
  // Récupérer les dates des points d'équity de la stratégie
  const strategyDates = tradingStore.trading.equityCurve.map(point => new Date(point.date));
  
  // Préparer les données du benchmark (S&P 500)
  let benchmarkData: { date: Date; value: number }[] = [];
  
  if (sp500Data.value.length > 0 && strategyDates.length > 0) {
    // Trouver la première et dernière date de la stratégie
    const firstStrategyDate = strategyDates[0];
    const lastStrategyDate = strategyDates[strategyDates.length - 1];
    
    // Filtrer les données du S&P 500 pour correspondre à la période
    const filteredSP500 = sp500Data.value.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= firstStrategyDate && pointDate <= lastStrategyDate;
    });
    
    if (filteredSP500.length > 0) {
      // Adapter l'échelle du S&P 500 pour qu'elle corresponde visuellement à celle de la stratégie
      // et convertir en euros pour une comparaison cohérente
      const firstSP500Price = filteredSP500[0].close;
      const firstStrategyBalance = tradingStore.trading.equityCurve[0].balance;
      
      // Facteur d'échelle pour convertir les points S&P 500 en euros comparables à la stratégie
      const scaleFactor = firstStrategyBalance / firstSP500Price;
      
      benchmarkData = filteredSP500.map(point => ({
        date: new Date(point.date),
        value: point.close * scaleFactor // Valeur en euros
      }));
    }
  }
  
  // Préparer les données pour le graphique
  return {
    labels: tradingStore.trading.equityCurve.map(point => formatDate(point.date)),
    datasets: [
      {
        label: 'Stratégie (€)',
        data: tradingStore.trading.equityCurve.map(point => point.balance), // Déjà en euros
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'S&P 500 (Équivalent €)',
        data: benchmarkData.length > 0 
          ? strategyDates.map(date => {
              // Trouver le point de benchmark le plus proche de cette date
              const closestPoint = benchmarkData.reduce((closest, point) => {
                const currentDiff = Math.abs(date.getTime() - point.date.getTime());
                const closestDiff = Math.abs(date.getTime() - closest.date.getTime());
                return currentDiff < closestDiff ? point : closest;
              }, benchmarkData[0]);
              
              return closestPoint.value;
            })
          : tradingStore.trading.equityCurve.map(() => null), // Données vides si pas de S&P 500
        borderColor: '#EF4444',
        borderDash: [5, 5],
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        tension: 0.4,
        fill: false
      }
    ]
  };
});

// Données pour le graphique répartition win rate par symbole
const symbolWinRateData = computed(() => {
  const trades = sortedTrades.value;
  if (!trades.length) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  // Regrouper les trades par symbole
  const symbolGroups: Record<string, { total: number, wins: number }> = {};
  
  trades.forEach(trade => {
    if (!symbolGroups[trade.symbol]) {
      symbolGroups[trade.symbol] = { total: 0, wins: 0 };
    }
    symbolGroups[trade.symbol].total++;
    if (trade.profitLoss > 0) {
      symbolGroups[trade.symbol].wins++;
    }
  });
  
  // Calculer le win rate pour chaque symbole
  const symbols = Object.keys(symbolGroups);
  const winRates = symbols.map(symbol => {
    const { total, wins } = symbolGroups[symbol];
    return total > 0 ? (wins / total) * 100 : 0;
  });
  
  return {
    labels: symbols,
    datasets: [
      {
        label: 'Win Rate (%)',
        data: winRates,
        backgroundColor: symbols.map(() => '#4F46E5'),
      }
    ]
  };
});

// Options des graphiques
const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const
    }
  }
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Performance (%)'
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: true,
      text: 'Performance Mensuelle'
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          // Récupérer le nombre de trades du mois actuel
          const tradeCount = context.dataset.monthlyTradeCount[context.dataIndex];
          const value = context.raw;
          return [
            `Performance: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
            `Nombre de trades: ${tradeCount}`
          ];
        }
      }
    }
  }
};

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    },
    title: {
      display: true,
      text: 'Courbe d\'Équité'
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: 'Capital (€)'
      }
    }
  }
};

// Options du graphique win rate par symbole
const barChartOptionsSymbol = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      title: {
        display: true,
        text: 'Win Rate (%)'
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: true,
      text: 'Win Rate par Symbole'
    }
  }
};

// Fonction pour changer le tri
function changeSortBy(column: string) {
  if (sortBy.value === column) {
    // Changer la direction si on clique sur la même colonne
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // Nouvelle colonne, réinitialiser à 'desc' par défaut
    sortBy.value = column;
    sortDirection.value = 'desc';
  }
}

// Fonction de tri
function sortTrades(a: Trade, b: Trade) {
  // Helper to parse date strings
  const parseDate = (dateStr: Date | string) => {
    if (dateStr instanceof Date) {
      return dateStr.getTime();
    } else {
      return new Date(dateStr).getTime();
    }
  };
  
  // Special handling for duration (calculate from entry and exit dates)
  if (sortBy.value === 'duration') {
    const durationA = a.exitDate && a.entryDate ? (parseDate(a.exitDate) - parseDate(a.entryDate)) / (1000 * 60 * 60) : 0;
    const durationB = b.exitDate && b.entryDate ? (parseDate(b.exitDate) - parseDate(b.entryDate)) / (1000 * 60 * 60) : 0;
    
    return sortDirection.value === 'asc' ? durationA - durationB : durationB - durationA;
  }
  
  // Handle date fields
  if (sortBy.value === 'entryDate' || sortBy.value === 'exitDate') {
    const dateA = parseDate(a[sortBy.value as keyof Trade] as Date | string || '');
    const dateB = parseDate(b[sortBy.value as keyof Trade] as Date | string || '');
    
    return sortDirection.value === 'asc' ? dateA - dateB : dateB - dateA;
  }
  
  // Handle numeric fields
  if (sortBy.value === 'profitLoss' || sortBy.value === 'quantity' || sortBy.value === 'risk') {
    const numA = Number(a[sortBy.value as keyof Trade] || 0);
    const numB = Number(b[sortBy.value as keyof Trade] || 0);
    
    return sortDirection.value === 'asc' ? numA - numB : numB - numA;
  }
  
  // Handle string fields (default)
  const strA = String(a[sortBy.value as keyof Trade] || '').toLowerCase();
  const strB = String(b[sortBy.value as keyof Trade] || '').toLowerCase();
  
  if (sortDirection.value === 'asc') {
    return strA.localeCompare(strB);
  } else {
    return strB.localeCompare(strA);
  }
}

// Nouveau trade
const newTrade = ref<Trade>({
  id: Date.now().toString(),
  symbol: '',
  direction: 'LONG',
  quantity: 0,
  entryPrice: 0,
  exitPrice: 0,
  entryDate: new Date(),
  exitDate: new Date(),
  strategy: '',
  notes: '',
  profitLoss: 0,
  timeframe: '1h',
  risk: 1
});

const addTrade = () => {
  // Convertir les dates en objets Date
  const entryDate = new Date(newTrade.value.entryDate);
  const exitDate = new Date(newTrade.value.exitDate);

  // Le P/L est maintenant saisi en pourcentage
  const profitLossPercentage = parseFloat(newTrade.value.profitLoss.toString());

  tradingStore.addTrade({
    ...newTrade.value,
    entryDate,
    exitDate,
    profitLoss: profitLossPercentage, // Directement en pourcentage
    entryPrice: 0, // Valeur par défaut car non utilisée
    exitPrice: 0, // Valeur par défaut car non utilisée
    strategy: 'Default' // Valeur par défaut car non utilisée
  });
  showAddModal.value = false;
  newTrade.value = {
    id: Date.now().toString(),
    symbol: 'SP500',
    direction: 'LONG',
    quantity: 0,
    entryPrice: 0,
    exitPrice: 0,
    entryDate: new Date(),
    exitDate: new Date(),
    strategy: '',
    notes: '',
    profitLoss: 0,
    timeframe: '1h',
    risk: 1
  };
};

// Réinitialiser le formulaire
const resetForm = () => {
  showAddModal.value = false;
  newTrade.value = {
    id: Date.now().toString(),
    symbol: '',
    direction: 'LONG',
    quantity: 0,
    entryPrice: 0,
    exitPrice: 0,
    entryDate: new Date(),
    exitDate: new Date(),
    strategy: '',
    notes: '',
    profitLoss: 0,
    timeframe: '1h',
    risk: 1
  };
};

// Périodes disponibles
const timeframes = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' }
];

// Fonction pour évaluer si le nombre de trades est approprié pour la période
function evaluateTradeCount() {
  const count = sortedTrades.value.length;
  let result = { show: false, class: '', label: '', advice: '' };

  switch (selectedTimeframe.value) {
    case 'week':
      result.show = true;
      if (count < 1) {
        result.class = 'bg-red-100 text-red-800';
        result.label = 'trop peu';
        result.advice = 'Pour une semaine, vous devriez idéalement avoir entre 1 et 3 trades. Augmentez votre fréquence de trading tout en restant sélectif.';
      } else if (count >= 1 && count <= 3) {
        result.class = 'bg-green-100 text-green-800';
        result.label = 'moyenne';
        result.advice = 'Excellent ! 1 à 3 trades par semaine est une fréquence optimale pour la plupart des traders particuliers.';
      } else {
        result.class = 'bg-yellow-100 text-yellow-800';
        result.label = 'élevé';
        result.advice = 'Votre fréquence de trading est élevée. Assurez-vous de ne pas surtraiter et de maintenir votre discipline.';
      }
      break;
    case 'month':
      result.show = true;
      if (count < 6) {
        result.class = 'bg-red-100 text-red-800';
        result.label = 'trop peu';
        result.advice = 'Pour un mois complet, vous devriez idéalement avoir entre 6 et 10 trades. Cherchez plus d\'opportunités de qualité.';
      } else if (count >= 6 && count <= 10) {
        result.class = 'bg-green-100 text-green-800';
        result.label = 'moyenne';
        result.advice = 'Parfait ! 6 à 10 trades par mois vous permet d\'être actif tout en restant sélectif sur vos opportunités.';
      } else {
        result.class = 'bg-yellow-100 text-yellow-800';
        result.label = 'élevé';
        result.advice = 'Votre nombre de trades mensuel est élevé. Vérifiez si votre processus de sélection est suffisamment rigoureux.';
      }
      break;
    case 'year':
      result.show = true;
      if (count < 85) {
        result.class = 'bg-red-100 text-red-800';
        result.label = 'trop peu';
        result.advice = 'Pour une année complète, l\'idéal est entre 85 et 105 trades. Augmentez votre fréquence pour obtenir un échantillon statistique plus significatif.';
      } else if (count >= 85 && count <= 105) {
        result.class = 'bg-green-100 text-green-800';
        result.label = 'moyenne';
        result.advice = 'Excellent ! Un volume annuel de 85 à 105 trades est idéal pour développer une performance statistiquement significative.';
      } else {
        result.class = 'bg-yellow-100 text-yellow-800';
        result.label = 'élevé';
        result.advice = 'Votre volume annuel est élevé. Assurez-vous que chaque trade respecte votre stratégie et que vous ne tombez pas dans le surtrading.';
      }
      break;
    default:
      result.show = false;
      break;
  }

  return result;
}

onMounted(async () => {
  // Charger d'abord les données depuis MongoDB
  const tradesStore = useTradesStore();
  tradesStore.fetchTrades();
  
  if (tradingStore.trading.trades.length > 0) {
    // Récupérer les données du S&P 500
    fetchSP500Data();
    runMonteCarlo();
    runBootstrap();
  }
});

// Exécuter la simulation au chargement et quand les trades changent
watch(
  () => tradingStore.trading.trades.length,
  () => {
    runMonteCarlo();
    runBootstrap();
  }
);

// Ajouter ces variables et fonctions après la ligne `useTradesStore`
const showEditModal = ref(false);
const editingTrade = ref<Trade | null>(null);

// Ajouter cette fonction pour formater les dates pour l'input datetime-local
const formatDateForInput = (date: Date | string): string => {
  const d = new Date(date);
  return d.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
};

// Fonction pour éditer un trade
const editTrade = (trade: Trade) => {
  // Créer une copie profonde pour ne pas modifier l'original directement
  editingTrade.value = JSON.parse(JSON.stringify(trade));
  
  // S'assurer que les dates sont au format ISO pour l'input datetime-local
  if (editingTrade.value && editingTrade.value.entryDate) {
    // Stocker temporairement la date formatée pour l'affichage
    const formattedEntryDate = formatDateForInput(new Date(editingTrade.value.entryDate as unknown as string));
    // Utiliser une propriété temporaire pour stocker le format string nécessaire pour l'input
    (editingTrade.value as any).entryDateForInput = formattedEntryDate;
  }
  if (editingTrade.value && editingTrade.value.exitDate) {
    // Stocker temporairement la date formatée pour l'affichage  
    const formattedExitDate = formatDateForInput(new Date(editingTrade.value.exitDate as unknown as string));
    // Utiliser une propriété temporaire pour stocker le format string nécessaire pour l'input
    (editingTrade.value as any).exitDateForInput = formattedExitDate;
  }
  showEditModal.value = true;
};

// Fonction pour mettre à jour un trade
const updateTrade = () => {
  if (editingTrade.value) {
    // Convertir les dates en objets Date
    const entryDate = new Date(editingTrade.value.entryDate as unknown as string);
    const exitDate = new Date(editingTrade.value.exitDate as unknown as string);
    
    // Mettre à jour le trade dans le store
    const updatedTrade: Trade = {
      ...editingTrade.value,
      entryDate,
      exitDate,
      profitLoss: parseFloat(editingTrade.value.profitLoss.toString())
    };
    
    // Trouver l'index du trade à mettre à jour
    const index = tradingStore.trading.trades.findIndex(t => t.id === updatedTrade.id);
    if (index !== -1) {
      // Mettre à jour le trade
      tradingStore.trading.trades[index] = updatedTrade;
      // Mettre à jour les métriques et sauvegarder
      tradingStore.updateTradingMetrics();
      tradingStore.updateEquityCurve();
      tradingStore.saveToLocalStorage();
    }
    
    // Fermer le modal
    showEditModal.value = false;
    editingTrade.value = null;
  }
};

function calculateDuration(entryDate: Date | string, exitDate: Date | string): string {
  if (!entryDate || !exitDate) {
    return '-';
  }
  
  const entry = entryDate instanceof Date ? entryDate : new Date(entryDate);
  const exit = exitDate instanceof Date ? exitDate : new Date(exitDate);
  const diffMs = exit.getTime() - entry.getTime();
  
  // Différence en heures (arrondie à 2 décimales)
  const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  
  return `${diffHours}h`;
}

// Modifier la fonction equityChartData pour avoir seulement les données de la stratégie
const strategyChartData = computed(() => {
  if (tradingStore.trading.equityCurve.length === 0) {
    return {
      labels: [],
      datasets: [{
        label: 'Performance Stratégie de Trading (€)',
        data: [],
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Utiliser directement les valeurs en euros au lieu de normaliser en base 100
  return {
    labels: tradingStore.trading.equityCurve.map(point => formatDate(point.date)),
    datasets: [
      {
        label: 'Performance Stratégie de Trading (€)',
        data: tradingStore.trading.equityCurve.map(point => point.balance),
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
});

// Calcul de la performance de la stratégie
const strategyPerformance = computed(() => {
  if (tradingStore.trading.equityCurve.length < 2) return 0;
  
  const firstValue = tradingStore.trading.equityCurve[0].balance;
  const lastValue = tradingStore.trading.equityCurve[tradingStore.trading.equityCurve.length - 1].balance;
  
  return ((lastValue - firstValue) / firstValue) * 100;
});

// Calcul de la surperformance par rapport au SP500 (Alpha)
const alphaPerformance = computed(() => {
  return strategyPerformance.value - sp500Performance.value;
});

// Graphique d'Alpha (écart de performance entre stratégie et S&P 500)
const alphaChartData = computed(() => {
  if (tradingStore.trading.equityCurve.length === 0 || sp500Data.value.length === 0) {
    return {
      labels: [],
      datasets: [{
        label: 'Alpha vs S&P 500',
        data: [],
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Récupérer les dates des trades pour filtrer les données du S&P 500
  const tradeDates = tradingStore.trading.equityCurve.map(point => new Date(point.date));
  const firstTradeDate = tradeDates.length > 0 ? tradeDates[0] : new Date();
  const lastTradeDate = tradeDates.length > 0 ? tradeDates[tradeDates.length - 1] : new Date();
  
  // Filtrer les données S&P 500 pour la même période
  const filteredSP500 = sp500Data.value.filter(point => {
    const pointDate = new Date(point.date);
    return pointDate >= firstTradeDate && pointDate <= lastTradeDate;
  });
  
  if (filteredSP500.length < 2) {
    return {
      labels: [],
      datasets: [{
        label: 'Alpha vs S&P 500',
        data: [],
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Normaliser les deux séries pour commencer à 100
  const baseValueStrategy = tradingStore.trading.equityCurve[0].balance;
  const baseValueSP500 = filteredSP500[0].close;
  
  // Créer un tableau de dates communes pour les deux séries
  const dateRangeStart = firstTradeDate.getTime();
  const dateRangeEnd = lastTradeDate.getTime();
  
  // Interpoler les valeurs du S&P 500 pour les dates d'équity
  const interpolatedAlpha = [];
  const labels = [];
  
  for (const equityPoint of tradingStore.trading.equityCurve) {
    const equityDate = new Date(equityPoint.date);
    
    // Normaliser la valeur de la stratégie
    const strategyValue = (equityPoint.balance / baseValueStrategy) * 100;
    
    // Trouver la valeur correspondante du S&P 500 pour cette date
    let sp500Value = null;
    
    // Recherche de la valeur S&P 500 la plus proche
    let closestDate = null;
    let minDiff = Infinity;
    
    for (const sp500Point of filteredSP500) {
      const sp500Date = new Date(sp500Point.date);
      const timeDiff = Math.abs(equityDate.getTime() - sp500Date.getTime());
      
      if (timeDiff < minDiff) {
        minDiff = timeDiff;
        closestDate = sp500Date;
        sp500Value = (sp500Point.close / baseValueSP500) * 100;
      }
    }
    
    // Si on a trouvé une valeur S&P 500 correspondante, calculer l'alpha
    if (sp500Value !== null) {
      const alphaValue = strategyValue - sp500Value;
      interpolatedAlpha.push(alphaValue);
      labels.push(formatDate(equityPoint.date));
    }
  }
  
  return {
    labels,
    datasets: [{
      label: 'Alpha (Stratégie - S&P 500)',
      data: interpolatedAlpha,
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      tension: 0.4,
      fill: true,
      borderWidth: 2,
      pointBackgroundColor: '#8B5CF6',
      pointBorderColor: '#FFFFFF',
      pointRadius: 3,
      pointHoverRadius: 5,
    }]
  };
});

// Configuration pour le graphique Alpha
const alphaChartOptions = {
  ...baseChartOptions,
  plugins: {
    ...baseChartOptions.plugins,
    title: {
      display: true,
      text: 'Alpha vs S&P 500',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    },
    tooltip: {
      ...baseChartOptions.plugins.tooltip,
      callbacks: {
        label: (context: any) => {
          return `Alpha: ${context.parsed.y >= 0 ? '+' : ''}${context.parsed.y.toFixed(2)}%`;
        }
      }
    }
  },
  scales: {
    ...baseChartOptions.scales,
    y: {
      ...baseChartOptions.scales.y,
      title: {
        display: true,
        text: 'Alpha (%)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: (context: any) => {
          if (context.tick.value === 0) {
            return 'rgba(0, 0, 0, 0.2)'; // Ligne zéro plus foncée
          }
          return 'rgba(192, 198, 211, 0.2)';
        },
        lineWidth: (context: any) => {
          if (context.tick.value === 0) {
            return 2; // Ligne zéro plus épaisse
          }
          return 1;
        },
      },
    }
  }
};

// Données de simulation Monte Carlo
const monteCarloResults = ref<MonteCarloResult>({
  percentiles: {
    min: 0,
    p1: 0,
    p5: 0,
    p10: 0,
    p25: 0,
    p50: 0,
    p75: 0,
    p90: 0,
    p95: 0,
    p99: 0,
    max: 0
  },
  profitProbability: 0,
  drawdownRisk: 0,
  simulationPaths: [],
  pathPercentiles: {
    p5: [],
    p10: [],
    p25: [],
    p50: [],
    p75: [],
    p90: [],
    p95: []
  },
  statistics: {
    meanFinalReturn: 0,
    stdDevFinalReturn: 0,
    skewness: 0,
    kurtosis: 0,
    maxDrawdownDistribution: {
      mean: 0,
      median: 0,
      p95: 0
    },
    recoveryRatePercentage: 0
  }
});

// Fonction pour exécuter la simulation Monte Carlo
function runMonteCarlo() {
  monteCarloResults.value = runMonteCarloSimulation(
    tradingStore.trading.trades,
    100, // 100 simulations
    500  // projeter sur 500 trades
  );
}

// Données pour le graphique Monte Carlo
const monteCarloChartData = computed(() => {
  if (!monteCarloResults.value.simulationPaths.length) {
    return {
      labels: [],
      datasets: []
    };
  }

  // Créer des labels pour chaque étape (trade)
  const numSteps = monteCarloResults.value.simulationPaths[0].length;
  const labels = Array.from({ length: numSteps }, (_, i) => `${i}`);

  // Créer les datasets pour les chemins individuels
  const pathDatasets = monteCarloResults.value.simulationPaths.map((path, index) => ({
    label: `Simulation ${index + 1}`,
    data: path,
    borderColor: `rgba(128, 128, 128, 0.3)`,
    borderWidth: 1,
    pointRadius: 0,
    fill: false,
    tension: 0.2,
    hidden: false
  }));

  // Ajouter les datasets pour les percentiles
  const percentileDatasets = [
    {
      label: 'Percentile 10',
      data: monteCarloResults.value.pathPercentiles.p10,
      borderColor: 'rgba(239, 68, 68, 0.8)', // Rouge
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Percentile 25',
      data: monteCarloResults.value.pathPercentiles.p25,
      borderColor: 'rgba(245, 158, 11, 0.8)', // Ambre
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Médiane (P50)',
      data: monteCarloResults.value.pathPercentiles.p50,
      borderColor: 'rgba(16, 185, 129, 0.8)', // Émeraude
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 3,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Percentile 75',
      data: monteCarloResults.value.pathPercentiles.p75,
      borderColor: 'rgba(59, 130, 246, 0.8)', // Bleu
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Percentile 90',
      data: monteCarloResults.value.pathPercentiles.p90,
      borderColor: 'rgba(139, 92, 246, 0.8)', // Violet
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    }
  ];

  // Combiner tous les datasets (chemins en arrière-plan, percentiles en premier plan)
  return {
    labels,
    datasets: [...pathDatasets, ...percentileDatasets]
  };
});

// Options pour le graphique Monte Carlo
const monteCarloChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Projection Monte Carlo (500 trades)',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        title: (items: any[]) => {
          return `Trade #${items[0].label}`;
        },
        label: (context: any) => {
          const datasetLabel = context.dataset.label;
          const value = context.parsed.y;
          return `${datasetLabel}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
        }
      }
    },
    legend: {
      position: 'top' as const,
      labels: {
        filter: (item: any) => {
          // Cacher les labels des chemins individuels
          return !item.text.startsWith('Simulation');
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Nombre de trades',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: 'rgba(192, 198, 211, 0.2)',
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Performance (%)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: (context: any) => {
          if (context.tick.value === 0) {
            return 'rgba(0, 0, 0, 0.2)'; // Ligne zéro plus foncée
          }
          return 'rgba(192, 198, 211, 0.2)';
        },
        lineWidth: (context: any) => {
          if (context.tick.value === 0) {
            return 2; // Ligne zéro plus épaisse
          }
          return 1;
        },
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  }
};

// Définissons un type local pour les trades avec des dates flexibles
interface TradeWithFlexibleDates extends Omit<Trade, 'entryDate' | 'exitDate'> {
  entryDate: Date | string;
  exitDate: Date | string;
}

// Données de Bootstrap Resampling
const bootstrapResults = ref<BootstrapResult>({
  equityCurves: [],
  statistics: {
    finalReturns: {
      min: 0,
      p5: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p95: 0,
      max: 0
    },
    maxDrawdowns: {
      min: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      max: 0
    },
    sharpeRatios: {
      min: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      max: 0
    }
  },
  timePoints: [],
  percentileCurves: {
    p5: [],
    p25: [],
    p50: [],
    p75: [],
    p95: []
  }
});

// Fonction pour exécuter le Bootstrap Resampling
function runBootstrap() {
  const initialCapitalValue = initialCapital.value || 100;
  bootstrapResults.value = runBootstrapResampling(
    tradingStore.trading.trades,
    1000, // 1000 simulations
    initialCapitalValue
  );
}

// Données pour le graphique de Bootstrap Resampling
const bootstrapChartData = computed(() => {
  if (!bootstrapResults.value.equityCurves.length) {
    return {
      labels: [],
      datasets: []
    };
  }

  // Créer des labels pour les points de temps (pourcentage)
  const labels = bootstrapResults.value.timePoints.map(t => `${t.toFixed(0)}%`);

  // Créer les datasets pour les courbes individuelles (en gris clair)
  const curvesDatasets = bootstrapResults.value.equityCurves.map((curve, index) => ({
    label: `Simulation ${index + 1}`,
    data: curve,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    borderWidth: 1,
    pointRadius: 0,
    fill: false,
    tension: 0.1
  }));

  // Ajouter les datasets pour les percentiles
  const percentileDatasets = [
    {
      label: '5ème Percentile',
      data: bootstrapResults.value.percentileCurves.p5,
      borderColor: 'rgba(239, 68, 68, 0.8)', // Rouge
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    },
    {
      label: '25ème Percentile',
      data: bootstrapResults.value.percentileCurves.p25,
      borderColor: 'rgba(245, 158, 11, 0.8)', // Ambre
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: '+1'
    },
    {
      label: 'Médiane',
      data: bootstrapResults.value.percentileCurves.p50,
      borderColor: 'rgba(16, 185, 129, 0.8)', // Émeraude
      backgroundColor: 'transparent',
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    },
    {
      label: '75ème Percentile',
      data: bootstrapResults.value.percentileCurves.p75,
      borderColor: 'rgba(59, 130, 246, 0.8)', // Bleu
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: '-1'
    },
    {
      label: '95ème Percentile',
      data: bootstrapResults.value.percentileCurves.p95,
      borderColor: 'rgba(139, 92, 246, 0.8)', // Violet
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    }
  ];

  return {
    labels,
    datasets: [...curvesDatasets, ...percentileDatasets]
  };
});

// Options pour le graphique de Bootstrap Resampling
const bootstrapChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Distribution des Performances (Bootstrap Resampling)',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        title: (items: any[]) => {
          return `Progression ${items[0].label}`;
        },
        label: (context: any) => {
          const datasetLabel = context.dataset.label;
          const value = context.parsed.y;
          return `${datasetLabel}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
        }
      }
    },
    legend: {
      position: 'top' as const,
      labels: {
        filter: (item: any) => {
          // Cacher les labels des simulations individuelles
          return !item.text.startsWith('Simulation');
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Progression de la stratégie',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: 'rgba(192, 198, 211, 0.2)',
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Performance (%)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: (context: any) => {
          if (context.tick.value === 0) {
            return 'rgba(0, 0, 0, 0.2)'; // Ligne zéro plus foncée
          }
          return 'rgba(192, 198, 211, 0.2)';
        },
        lineWidth: (context: any) => {
          if (context.tick.value === 0) {
            return 2; // Ligne zéro plus épaisse
          }
          return 1;
        },
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  }
};

// Exécuter le bootstrap resampling au chargement et quand les trades changent
watch(
  () => tradingStore.trading.trades.length,
  () => {
    runBootstrap();
  }
);

// Exécuter les simulations au montage et charger les données
onMounted(() => {
  // Charger d'abord les données depuis MongoDB
  const tradesStore = useTradesStore();
  tradesStore.fetchTrades();
  
  if (tradingStore.trading.trades.length > 0) {
    // Récupérer les données du S&P 500
    fetchSP500Data();
    runMonteCarlo();
    runBootstrap();
  }
});

// Paramètres pour le modèle de Geometric Brownian Motion
const gbmParams = ref({
  initialPrice: 100,
  mu: 0.1,
  sigma: 0.2,
  deltaT: 1/252,
  timeHorizon: 1
});

// Résultats pour le modèle de Geometric Brownian Motion
const gbmResults = ref<{
  simulations: any[];
  percentiles?: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  }
}>({
  simulations: []
});

// Statistiques pour le modèle de Geometric Brownian Motion
const gbmStats = ref({
  medianReturn: 0,
  medianVolatility: 0,
  medianDrawdown: 0,
  medianSharpe: 0,
  profitProbability: 0
});

// Fonction pour formater un nombre en pourcentage
const formatNumber = (value: number): string => {
  return value.toFixed(2);
};

// Fonction pour simuler le modèle de Geometric Brownian Motion
function simulateGBM() {
  import('../utils/geometricBrownianMotion').then(({ simulateMultipleGBM }) => {
    const results = simulateMultipleGBM(gbmParams.value, 100);
    gbmResults.value = results;
    calculateGBMStats();
  });
}

// Calculer les statistiques pour le modèle de Geometric Brownian Motion
function calculateGBMStats() {
  if (!gbmResults.value.simulations.length) return;
  
  const returns = gbmResults.value.simulations.map(sim => sim.stats.totalReturn);
  
  // Calculer la médiane des rendements
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const medianReturn = sortedReturns[Math.floor(sortedReturns.length / 2)];
  
  // Calculer la volatilité médiane
  const volatilities = gbmResults.value.simulations.map(sim => sim.stats.volatility);
  const sortedVolatilities = [...volatilities].sort((a, b) => a - b);
  const medianVolatility = sortedVolatilities[Math.floor(sortedVolatilities.length / 2)];
  
  // Calculer le drawdown médian
  const drawdowns = gbmResults.value.simulations.map(sim => sim.stats.maxDrawdown);
  const sortedDrawdowns = [...drawdowns].sort((a, b) => a - b);
  const medianDrawdown = sortedDrawdowns[Math.floor(sortedDrawdowns.length / 2)];
  
  // Calculer le ratio de Sharpe médian
  const sharpeRatios = gbmResults.value.simulations.map(sim => sim.stats.sharpeRatio);
  const sortedSharpeRatios = [...sharpeRatios].sort((a, b) => a - b);
  const medianSharpe = sortedSharpeRatios[Math.floor(sortedSharpeRatios.length / 2)];
  
  // Calculer la probabilité de profit
  const profitProbability = returns.filter(r => r > 0).length / returns.length;
  
  gbmStats.value = {
    medianReturn,
    medianVolatility,
    medianDrawdown,
    medianSharpe,
    profitProbability
  };
}

// Données pour le graphique de Geometric Brownian Motion
const gbmChartData = computed(() => {
  if (!gbmResults.value.simulations.length || !gbmResults.value.percentiles) {
    return {
      labels: [],
      datasets: []
    };
  }
  
  const timePoints = gbmResults.value.simulations[0].timePoints;
  const percentiles = gbmResults.value.percentiles;
  
  return {
    labels: timePoints.map((t: number) => `${(t * 252).toFixed(0)}j`),
    datasets: [
      {
        label: 'P10',
        data: percentiles.p10,
        borderColor: 'rgba(255, 99, 132, 0.8)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: 'P25',
        data: percentiles.p25,
        borderColor: 'rgba(255, 159, 64, 0.8)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        fill: '+1',
        borderWidth: 1,
        pointRadius: 0
      },
      {
        label: 'P50 (Médiane)',
        data: percentiles.p50,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: 'P75',
        data: percentiles.p75,
        borderColor: 'rgba(75, 192, 192, 0.8)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: '+1',
        borderWidth: 1,
        pointRadius: 0
      },
      {
        label: 'P90',
        data: percentiles.p90,
        borderColor: 'rgba(153, 102, 255, 0.8)',
        backgroundColor: 'rgba(153, 102, 255, 0.1)',
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      }
    ]
  };
});

// Options pour le graphique de Geometric Brownian Motion
const gbmChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      mode: 'index' as const,
      intersect: false
    },
    legend: {
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        font: {
          size: 10
        }
      }
    },
    title: {
      display: true,
      text: 'Geometric Brownian Motion - Évolution du capital'
    }
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Jours de trading'
      }
    },
    y: {
      title: {
        display: true,
        text: 'Capital'
      }
    }
  }
};

// Simuler le GBM au chargement et à chaque modification des paramètres
watch([gbmParams], () => {
  simulateGBM();
}, { immediate: true });

// Interprétation des résultats de Monte Carlo
const monteCarloInterpretation = computed(() => {
  if (!monteCarloResults.value.simulationPaths.length) {
    return {
      mainMessage: "Pas assez de données pour l'interprétation",
      details: "Ajoutez au moins 5 trades pour générer une interprétation.",
      riskLevel: "unknown"
    };
  }

  const finalP10 = monteCarloResults.value.percentiles.p10;
  const finalP50 = monteCarloResults.value.percentiles.p50;
  const finalP90 = monteCarloResults.value.percentiles.p90;
  
  let riskLevel: 'low' | 'medium' | 'high' | 'very-high' = 'medium';
  let mainMessage = '';
  let details = '';
  
  if (finalP10 > 0 && finalP50 > 20) {
    riskLevel = 'low';
    mainMessage = 'Stratégie très prometteuse avec risque limité';
    details = `Même dans les pires scénarios (P10), votre stratégie reste profitable. La médiane à ${finalP50.toFixed(1)}% indique un excellent potentiel.`;
  } else if (finalP10 > -10 && finalP50 > 10) {
    riskLevel = 'medium';
    mainMessage = 'Stratégie équilibrée avec bon potentiel';
    details = `Votre stratégie montre un bon équilibre risque/rendement. Dans 90% des cas, vous ne perdrez pas plus de ${Math.abs(finalP10).toFixed(1)}%.`;
  } else if (finalP10 > -25 && finalP50 > 0) {
    riskLevel = 'high';
    mainMessage = 'Stratégie risquée mais potentiellement rentable';
    details = `Attention au risque élevé : dans 10% des cas, vous pourriez perdre plus de ${Math.abs(finalP10).toFixed(1)}%. Cependant, la médiane reste positive.`;
  } else {
    riskLevel = 'very-high';
    mainMessage = 'Stratégie très risquée - révision recommandée';
    details = `Votre stratégie présente un risque très élevé avec des pertes potentielles importantes. Une révision de votre approche est fortement recommandée.`;
  }
  
  return {
    riskLevel,
    mainMessage,
    details,
    finalP10,
    finalP50,
    finalP90
  };
});

// Évolution des Win/Loss/BE au cours du temps (incluant les archives)
const winRateEvolutionData = computed(() => {
  // Récupérer les trades actuels et les archives
  const currentTrades = sortedTrades.value;
  const archives = getArchives();
  
  // Combiner tous les trades (actuels + archivés)
  let allTrades: Trade[] = [...currentTrades];
  
  // Ajouter les trades des archives
  archives.forEach((archive: any) => {
    if (archive.trades && Array.isArray(archive.trades)) {
      allTrades = [...allTrades, ...archive.trades];
    }
  });
  
  if (allTrades.length === 0) return { labels: [], datasets: [] };
  
  // Regrouper les trades par mois
  const tradesByMonth: Record<string, Trade[]> = {};
  allTrades.forEach(trade => {
    const date = new Date(trade.entryDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!tradesByMonth[monthKey]) {
      tradesByMonth[monthKey] = [];
    }
    tradesByMonth[monthKey].push(trade);
  });
  
  // Trier les mois
  const sortedMonths = Object.keys(tradesByMonth).sort();
  
  // Calculer les statistiques pour chaque mois
  const winRates: number[] = [];
  const longWinRates: number[] = [];
  const shortWinRates: number[] = [];
  const profitFactors: number[] = [];
  const strategyMarkers: string[] = []; // Pour marquer les changements de stratégie
  
  sortedMonths.forEach(month => {
    const monthTrades = tradesByMonth[month];
    const wins = monthTrades.filter(t => t.profitLoss > 0).length;
    const losses = monthTrades.filter(t => t.profitLoss < 0).length;
    const longTrades = monthTrades.filter(t => t.direction === 'LONG');
    const shortTrades = monthTrades.filter(t => t.direction === 'SHORT');
    
    const longWins = longTrades.filter(t => t.profitLoss > 0).length;
    const shortWins = shortTrades.filter(t => t.profitLoss > 0).length;
    
    const totalWinAmount = monthTrades.filter(t => t.profitLoss > 0).reduce((sum, t) => sum + t.profitLoss, 0);
    const totalLossAmount = Math.abs(monthTrades.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0));
    
    winRates.push(monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0);
    longWinRates.push(longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0);
    shortWinRates.push(shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0);
    profitFactors.push(totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0);
    
    // Vérifier si ce mois contient des trades d'archives (changement de stratégie)
    const hasArchivedTrades = monthTrades.some(trade => {
      return archives.some((archive: any) => 
        archive.trades && archive.trades.some((archiveTrade: any) => archiveTrade.id === trade.id)
      );
    });
    strategyMarkers.push(hasArchivedTrades ? 'archived' : 'current');
  });
  
  // Formater les étiquettes des mois (Jan 2023, Fév 2023, etc.)
  const formattedMonths = sortedMonths.map(month => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(date);
  });
  
  return {
    labels: formattedMonths,
    datasets: [
      {
        label: 'Win Rate Global (%)',
        data: winRates,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#F59E0B' : 'rgba(75, 192, 192, 1)'
        ),
        pointBorderColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#D97706' : 'rgba(75, 192, 192, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      },
      {
        label: 'Long Win Rate (%)',
        data: longWinRates,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#F59E0B' : 'rgba(54, 162, 235, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      },
      {
        label: 'Short Win Rate (%)',
        data: shortWinRates,
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#F59E0B' : 'rgba(255, 99, 132, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      },
      {
        label: 'Profit Factor',
        data: profitFactors,
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 2,
        tension: 0.2,
        yAxisID: 'y1',
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#DC2626' : 'rgba(255, 206, 86, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      }
    ]
  };
});

// Options pour le graphique d'évolution des performances
const winRateEvolutionOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    },
    title: {
      display: true,
      text: 'Évolution des Performances (Historique Complet)'
    },
    subtitle: {
      display: true,
      text: '🟡 Points orange = Stratégies archivées | 🔵 Points normaux = Stratégie actuelle',
      font: {
        size: 11
      },
      color: '#6B7280'
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            if (context.dataset.label === 'Profit Factor') {
              label += context.parsed.y.toFixed(2);
            } else {
              label += context.parsed.y.toFixed(1) + '%';
            }
          }
          return label;
        },
        afterLabel: function(context: any) {
          // Ajouter une indication si c'est une période archivée
          const archives = getArchives();
          const monthLabel = context.label;
          
          // Vérifier si ce mois correspond à une archive
          const isArchived = archives.some((archive: any) => {
            if (!archive.dateArchived) return false;
            const archiveDate = new Date(archive.dateArchived);
            const archiveMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(archiveDate);
            return archiveMonth === monthLabel;
          });
          
          return isArchived ? '📁 Période archivée' : '';
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Win Rate (%)'
      },
      min: 0,
      max: 100
    },
    y1: {
      beginAtZero: true,
      position: 'right' as const,
      grid: {
        drawOnChartArea: false
      },
      title: {
        display: true,
        text: 'Profit Factor'
      },
      min: 0,
      max: 10
    }
  }
};

// Fonction pour déboguer le calcul de VaR
const debugVaRCalculation = async () => {
  console.log('=== DEBUG VaR CALCULATION ===');
  console.log('Nombre de trades:', tradingStore.trading.trades.length);
  console.log('Trades:', tradingStore.trading.trades);
  
  if (tradingStore.trading.trades.length === 0) {
    console.log('Aucun trade disponible pour le calcul de VaR');
    return;
  }
  
  // Recalculer les métriques manuellement
  const { calculateVaR, calculateConditionalVaR } = await import('../utils/performanceMetrics');
  
  console.log('Recalcul des métriques VaR...');
  const var95 = calculateVaR(tradingStore.trading.trades, 0.95);
  const var99 = calculateVaR(tradingStore.trading.trades, 0.99);
  const cvar95 = calculateConditionalVaR(tradingStore.trading.trades, 0.95);
  const cvar99 = calculateConditionalVaR(tradingStore.trading.trades, 0.99);
  
  console.log('Résultats du recalcul:');
  console.log('VaR 95%:', var95);
  console.log('VaR 99%:', var99);
  console.log('CVaR 95%:', cvar95);
  console.log('CVaR 99%:', cvar99);
  
  console.log('Métriques actuelles dans le store:');
  console.log('VaR 95%:', tradingStore.tradingMetrics.valueAtRisk95);
  console.log('VaR 99%:', tradingStore.tradingMetrics.valueAtRisk99);
  console.log('CVaR 95%:', tradingStore.tradingMetrics.conditionalVaR95);
  console.log('CVaR 99%:', tradingStore.tradingMetrics.conditionalVaR99);
  
  // Forcer la mise à jour des métriques
  tradingStore.setAdvancedMetrics({
    valueAtRisk95: var95,
    valueAtRisk99: var99,
    conditionalVaR95: cvar95,
    conditionalVaR99: cvar99
  });
  
  console.log('Métriques mises à jour!');
  console.log('=== FIN DEBUG VaR ===');
};

// Variables pour la génération de trades aléatoires
const showGeneratorModal = ref(false);
const generatorConfig = ref({
  numberOfTrades: 20,
  strategyStyle: 'balanced',
  timeRange: 30 // en jours
});

// Styles de stratégies prédéfinis
const strategyStyles = {
  conservative: {
    name: 'Conservatrice',
    description: 'Win rate élevé (70-80%), gains modérés (0.5-2%), pertes limitées',
    winRate: 0.75,
    avgWin: 1.2,
    avgLoss: -0.8,
    maxWin: 3.0,
    maxLoss: -2.0,
    tradeDurationRange: [2, 24], // en heures
    symbols: ['SP500', 'DAX40'],
    timeframes: ['1h', '4h', '1d']
  },
  aggressive: {
    name: 'Agressive',
    description: 'Win rate moyen (45-55%), gains élevés (1-5%), pertes importantes',
    winRate: 0.50,
    avgWin: 2.8,
    avgLoss: -2.2,
    maxWin: 8.0,
    maxLoss: -6.0,
    tradeDurationRange: [0.5, 8], // en heures
    symbols: ['BTC', 'NS100', 'XAAUSD'],
    timeframes: ['15m', '30m', '1h']
  },
  balanced: {
    name: 'Équilibrée',
    description: 'Win rate équilibré (55-65%), gains et pertes modérés',
    winRate: 0.60,
    avgWin: 1.8,
    avgLoss: -1.4,
    maxWin: 4.5,
    maxLoss: -3.5,
    tradeDurationRange: [1, 12], // en heures
    symbols: ['SP500', 'NS100', 'DAX40'],
    timeframes: ['30m', '1h', '4h']
  },
  scalping: {
    name: 'Scalping',
    description: 'Win rate élevé (65-75%), gains faibles (0.2-1%), trades très courts',
    winRate: 0.70,
    avgWin: 0.6,
    avgLoss: -0.4,
    maxWin: 1.5,
    maxLoss: -1.0,
    tradeDurationRange: [0.1, 2], // en heures
    symbols: ['SP500', 'NS100', 'DAX40'],
    timeframes: ['1m', '5m', '15m']
  },
  swing: {
    name: 'Swing Trading',
    description: 'Win rate moyen (50-60%), gains élevés (2-6%), trades longs',
    winRate: 0.55,
    avgWin: 3.5,
    avgLoss: -2.8,
    maxWin: 10.0,
    maxLoss: -8.0,
    tradeDurationRange: [24, 168], // en heures (1-7 jours)
    symbols: ['SP500', 'BTC', 'XAAUSD'],
    timeframes: ['4h', '1d', '1w']
  }
};

// Fonction pour générer un nombre aléatoire dans une plage
const randomInRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// Fonction pour générer une distribution normale approximative
const normalRandom = (mean: number, stdDev: number): number => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
};

// Fonction pour générer des trades aléatoires
const generateRandomTrades = () => {
  const style = strategyStyles[generatorConfig.value.strategyStyle as keyof typeof strategyStyles];
  const trades: any[] = [];
  
  // Date de début (il y a X jours)
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (generatorConfig.value.timeRange * 24 * 60 * 60 * 1000));
  
  for (let i = 0; i < generatorConfig.value.numberOfTrades; i++) {
    // Déterminer si c'est un trade gagnant
    const isWin = Math.random() < style.winRate;
    
    // Générer le P/L
    let profitLoss: number;
    if (isWin) {
      // Trade gagnant - distribution normale autour de la moyenne
      profitLoss = Math.max(0.1, normalRandom(style.avgWin, style.avgWin * 0.3));
      profitLoss = Math.min(profitLoss, style.maxWin);
    } else {
      // Trade perdant - distribution normale autour de la moyenne (négative)
      profitLoss = Math.min(-0.1, normalRandom(style.avgLoss, Math.abs(style.avgLoss) * 0.3));
      profitLoss = Math.max(profitLoss, style.maxLoss);
    }
    
    // Générer les dates
    const entryTime = randomInRange(startDate.getTime(), endDate.getTime());
    const entryDate = new Date(entryTime);
    
    // Durée du trade
    const durationHours = randomInRange(style.tradeDurationRange[0], style.tradeDurationRange[1]);
    const exitDate = new Date(entryTime + (durationHours * 60 * 60 * 1000));
    
    // Sélectionner symbole et timeframe aléatoirement
    const symbol = style.symbols[Math.floor(Math.random() * style.symbols.length)];
    const timeframe = style.timeframes[Math.floor(Math.random() * style.timeframes.length)];
    
    // Direction aléatoire
    const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    
    // Risque aléatoire
    const riskOptions = [0.25, 0.5, 1, 1.5, 2];
    const risk = riskOptions[Math.floor(Math.random() * riskOptions.length)];
    
    // Générer des frais aléatoires (optionnels)
    const fees = Math.random() > 0.7 ? randomInRange(0.5, 3.0) : 0;
    const spread = Math.random() > 0.8 ? randomInRange(0.1, 1.0) : 0;
    const commission = Math.random() > 0.9 ? randomInRange(0.2, 1.5) : 0;
    
    const trade = {
      id: `generated_${Date.now()}_${i}`,
      symbol,
      direction,
      quantity: Math.floor(randomInRange(1, 10)),
      entryPrice: 0, // Non utilisé dans notre système
      exitPrice: 0, // Non utilisé dans notre système
      entryDate,
      exitDate,
      strategy: style.name,
      notes: `Trade généré automatiquement - Style: ${style.name}`,
      profitLoss: Math.round(profitLoss * 100) / 100, // Arrondir à 2 décimales
      timeframe,
      risk,
      fees: Math.round(fees * 100) / 100,
      spread: Math.round(spread * 100) / 100,
      commission: Math.round(commission * 100) / 100
    };
    
    trades.push(trade);
  }
  
  // Trier les trades par date d'entrée
  trades.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  
  return trades;
};

// Fonction pour confirmer et ajouter les trades générés
const confirmGenerateRandomTrades = () => {
  const generatedTrades = generateRandomTrades();
  const style = strategyStyles[generatorConfig.value.strategyStyle as keyof typeof strategyStyles];
  
  const confirmMessage = `Êtes-vous sûr de vouloir générer ${generatorConfig.value.numberOfTrades} trades avec le style "${style.name}" ?

Caractéristiques:
- ${style.description}
- Période: ${generatorConfig.value.timeRange} derniers jours
- Win rate approximatif: ${Math.round(style.winRate * 100)}%

Cette action ajoutera les trades à votre historique existant.`;

  if (confirm(confirmMessage)) {
    // Ajouter tous les trades générés
    generatedTrades.forEach(trade => {
      tradingStore.addTrade(trade);
    });
    
    showGeneratorModal.value = false;
    
    // Message de confirmation
    alert(`${generatedTrades.length} trades ont été générés avec succès !

Style: ${style.name}
Trades gagnants: ${generatedTrades.filter(t => t.profitLoss > 0).length}
Trades perdants: ${generatedTrades.filter(t => t.profitLoss < 0).length}
Trades break-even: ${generatedTrades.filter(t => t.profitLoss === 0).length}

Performance totale: ${generatedTrades.reduce((sum, t) => sum + t.profitLoss, 0).toFixed(2)}%`);
  }
};

// Modifier la fonction equityChartData pour avoir seulement les données de la stratégie
const strategyChartData = computed(() => {
  if (tradingStore.trading.equityCurve.length === 0) {
    return {
      labels: [],
      datasets: [{
        label: 'Performance Stratégie de Trading (€)',
        data: [],
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Utiliser directement les valeurs en euros au lieu de normaliser en base 100
  return {
    labels: tradingStore.trading.equityCurve.map(point => formatDate(point.date)),
    datasets: [
      {
        label: 'Performance Stratégie de Trading (€)',
        data: tradingStore.trading.equityCurve.map(point => point.balance),
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
});

// Calcul de la performance de la stratégie
const strategyPerformance = computed(() => {
  if (tradingStore.trading.equityCurve.length < 2) return 0;
  
  const firstValue = tradingStore.trading.equityCurve[0].balance;
  const lastValue = tradingStore.trading.equityCurve[tradingStore.trading.equityCurve.length - 1].balance;
  
  return ((lastValue - firstValue) / firstValue) * 100;
});

// Calcul de la surperformance par rapport au SP500 (Alpha)
const alphaPerformance = computed(() => {
  return strategyPerformance.value - sp500Performance.value;
});

// Graphique d'Alpha (écart de performance entre stratégie et S&P 500)
const alphaChartData = computed(() => {
  if (tradingStore.trading.equityCurve.length === 0 || sp500Data.value.length === 0) {
    return {
      labels: [],
      datasets: [{
        label: 'Alpha vs S&P 500',
        data: [],
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Récupérer les dates des trades pour filtrer les données du S&P 500
  const tradeDates = tradingStore.trading.equityCurve.map(point => new Date(point.date));
  const firstTradeDate = tradeDates.length > 0 ? tradeDates[0] : new Date();
  const lastTradeDate = tradeDates.length > 0 ? tradeDates[tradeDates.length - 1] : new Date();
  
  // Filtrer les données S&P 500 pour la même période
  const filteredSP500 = sp500Data.value.filter(point => {
    const pointDate = new Date(point.date);
    return pointDate >= firstTradeDate && pointDate <= lastTradeDate;
  });
  
  if (filteredSP500.length < 2) {
    return {
      labels: [],
      datasets: [{
        label: 'Alpha vs S&P 500',
        data: [],
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Normaliser les deux séries pour commencer à 100
  const baseValueStrategy = tradingStore.trading.equityCurve[0].balance;
  const baseValueSP500 = filteredSP500[0].close;
  
  // Créer un tableau de dates communes pour les deux séries
  const dateRangeStart = firstTradeDate.getTime();
  const dateRangeEnd = lastTradeDate.getTime();
  
  // Interpoler les valeurs du S&P 500 pour les dates d'équity
  const interpolatedAlpha = [];
  const labels = [];
  
  for (const equityPoint of tradingStore.trading.equityCurve) {
    const equityDate = new Date(equityPoint.date);
    
    // Normaliser la valeur de la stratégie
    const strategyValue = (equityPoint.balance / baseValueStrategy) * 100;
    
    // Trouver la valeur correspondante du S&P 500 pour cette date
    let sp500Value = null;
    
    // Recherche de la valeur S&P 500 la plus proche
    let closestDate = null;
    let minDiff = Infinity;
    
    for (const sp500Point of filteredSP500) {
      const sp500Date = new Date(sp500Point.date);
      const timeDiff = Math.abs(equityDate.getTime() - sp500Date.getTime());
      
      if (timeDiff < minDiff) {
        minDiff = timeDiff;
        closestDate = sp500Date;
        sp500Value = (sp500Point.close / baseValueSP500) * 100;
      }
    }
    
    // Si on a trouvé une valeur S&P 500 correspondante, calculer l'alpha
    if (sp500Value !== null) {
      const alphaValue = strategyValue - sp500Value;
      interpolatedAlpha.push(alphaValue);
      labels.push(formatDate(equityPoint.date));
    }
  }
  
  return {
    labels,
    datasets: [{
      label: 'Alpha (Stratégie - S&P 500)',
      data: interpolatedAlpha,
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      tension: 0.4,
      fill: true,
      borderWidth: 2,
      pointBackgroundColor: '#8B5CF6',
      pointBorderColor: '#FFFFFF',
      pointRadius: 3,
      pointHoverRadius: 5,
    }]
  };
});

// Configuration pour le graphique Alpha
const alphaChartOptions = {
  ...baseChartOptions,
  plugins: {
    ...baseChartOptions.plugins,
    title: {
      display: true,
      text: 'Alpha vs S&P 500',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    },
    tooltip: {
      ...baseChartOptions.plugins.tooltip,
      callbacks: {
        label: (context: any) => {
          return `Alpha: ${context.parsed.y >= 0 ? '+' : ''}${context.parsed.y.toFixed(2)}%`;
        }
      }
    }
  },
  scales: {
    ...baseChartOptions.scales,
    y: {
      ...baseChartOptions.scales.y,
      title: {
        display: true,
        text: 'Alpha (%)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: (context: any) => {
          if (context.tick.value === 0) {
            return 'rgba(0, 0, 0, 0.2)'; // Ligne zéro plus foncée
          }
          return 'rgba(192, 198, 211, 0.2)';
        },
        lineWidth: (context: any) => {
          if (context.tick.value === 0) {
            return 2; // Ligne zéro plus épaisse
          }
          return 1;
        },
      },
    }
  }
};

// Données de simulation Monte Carlo
const monteCarloResults = ref<MonteCarloResult>({
  percentiles: {
    min: 0,
    p1: 0,
    p5: 0,
    p10: 0,
    p25: 0,
    p50: 0,
    p75: 0,
    p90: 0,
    p95: 0,
    p99: 0,
    max: 0
  },
  profitProbability: 0,
  drawdownRisk: 0,
  simulationPaths: [],
  pathPercentiles: {
    p5: [],
    p10: [],
    p25: [],
    p50: [],
    p75: [],
    p90: [],
    p95: []
  },
  statistics: {
    meanFinalReturn: 0,
    stdDevFinalReturn: 0,
    skewness: 0,
    kurtosis: 0,
    maxDrawdownDistribution: {
      mean: 0,
      median: 0,
      p95: 0
    },
    recoveryRatePercentage: 0
  }
});

// Fonction pour exécuter la simulation Monte Carlo
function runMonteCarlo() {
  monteCarloResults.value = runMonteCarloSimulation(
    tradingStore.trading.trades,
    100, // 100 simulations
    500  // projeter sur 500 trades
  );
}

// Données pour le graphique Monte Carlo
const monteCarloChartData = computed(() => {
  if (!monteCarloResults.value.simulationPaths.length) {
    return {
      labels: [],
      datasets: []
    };
  }

  // Créer des labels pour chaque étape (trade)
  const numSteps = monteCarloResults.value.simulationPaths[0].length;
  const labels = Array.from({ length: numSteps }, (_, i) => `${i}`);

  // Créer les datasets pour les chemins individuels
  const pathDatasets = monteCarloResults.value.simulationPaths.map((path, index) => ({
    label: `Simulation ${index + 1}`,
    data: path,
    borderColor: `rgba(128, 128, 128, 0.3)`,
    borderWidth: 1,
    pointRadius: 0,
    fill: false,
    tension: 0.2,
    hidden: false
  }));

  // Ajouter les datasets pour les percentiles
  const percentileDatasets = [
    {
      label: 'Percentile 10',
      data: monteCarloResults.value.pathPercentiles.p10,
      borderColor: 'rgba(239, 68, 68, 0.8)', // Rouge
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Percentile 25',
      data: monteCarloResults.value.pathPercentiles.p25,
      borderColor: 'rgba(245, 158, 11, 0.8)', // Ambre
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Médiane (P50)',
      data: monteCarloResults.value.pathPercentiles.p50,
      borderColor: 'rgba(16, 185, 129, 0.8)', // Émeraude
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 3,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Percentile 75',
      data: monteCarloResults.value.pathPercentiles.p75,
      borderColor: 'rgba(59, 130, 246, 0.8)', // Bleu
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    },
    {
      label: 'Percentile 90',
      data: monteCarloResults.value.pathPercentiles.p90,
      borderColor: 'rgba(139, 92, 246, 0.8)', // Violet
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.2
    }
  ];

  // Combiner tous les datasets (chemins en arrière-plan, percentiles en premier plan)
  return {
    labels,
    datasets: [...pathDatasets, ...percentileDatasets]
  };
});

// Options pour le graphique Monte Carlo
const monteCarloChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Projection Monte Carlo (500 trades)',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        title: (items: any[]) => {
          return `Trade #${items[0].label}`;
        },
        label: (context: any) => {
          const datasetLabel = context.dataset.label;
          const value = context.parsed.y;
          return `${datasetLabel}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
        }
      }
    },
    legend: {
      position: 'top' as const,
      labels: {
        filter: (item: any) => {
          // Cacher les labels des chemins individuels
          return !item.text.startsWith('Simulation');
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Nombre de trades',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: 'rgba(192, 198, 211, 0.2)',
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Performance (%)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: (context: any) => {
          if (context.tick.value === 0) {
            return 'rgba(0, 0, 0, 0.2)'; // Ligne zéro plus foncée
          }
          return 'rgba(192, 198, 211, 0.2)';
        },
        lineWidth: (context: any) => {
          if (context.tick.value === 0) {
            return 2; // Ligne zéro plus épaisse
          }
          return 1;
        },
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  }
};

// Définissons un type local pour les trades avec des dates flexibles
interface TradeWithFlexibleDates extends Omit<Trade, 'entryDate' | 'exitDate'> {
  entryDate: Date | string;
  exitDate: Date | string;
}

// Données de Bootstrap Resampling
const bootstrapResults = ref<BootstrapResult>({
  equityCurves: [],
  statistics: {
    finalReturns: {
      min: 0,
      p5: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p95: 0,
      max: 0
    },
    maxDrawdowns: {
      min: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      max: 0
    },
    sharpeRatios: {
      min: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      max: 0
    }
  },
  timePoints: [],
  percentileCurves: {
    p5: [],
    p25: [],
    p50: [],
    p75: [],
    p95: []
  }
});

// Fonction pour exécuter le Bootstrap Resampling
function runBootstrap() {
  const initialCapitalValue = initialCapital.value || 100;
  bootstrapResults.value = runBootstrapResampling(
    tradingStore.trading.trades,
    1000, // 1000 simulations
    initialCapitalValue
  );
}

// Données pour le graphique de Bootstrap Resampling
const bootstrapChartData = computed(() => {
  if (!bootstrapResults.value.equityCurves.length) {
    return {
      labels: [],
      datasets: []
    };
  }

  // Créer des labels pour les points de temps (pourcentage)
  const labels = bootstrapResults.value.timePoints.map(t => `${t.toFixed(0)}%`);

  // Créer les datasets pour les courbes individuelles (en gris clair)
  const curvesDatasets = bootstrapResults.value.equityCurves.map((curve, index) => ({
    label: `Simulation ${index + 1}`,
    data: curve,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    borderWidth: 1,
    pointRadius: 0,
    fill: false,
    tension: 0.1
  }));

  // Ajouter les datasets pour les percentiles
  const percentileDatasets = [
    {
      label: '5ème Percentile',
      data: bootstrapResults.value.percentileCurves.p5,
      borderColor: 'rgba(239, 68, 68, 0.8)', // Rouge
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    },
    {
      label: '25ème Percentile',
      data: bootstrapResults.value.percentileCurves.p25,
      borderColor: 'rgba(245, 158, 11, 0.8)', // Ambre
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: '+1'
    },
    {
      label: 'Médiane',
      data: bootstrapResults.value.percentileCurves.p50,
      borderColor: 'rgba(16, 185, 129, 0.8)', // Émeraude
      backgroundColor: 'transparent',
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    },
    {
      label: '75ème Percentile',
      data: bootstrapResults.value.percentileCurves.p75,
      borderColor: 'rgba(59, 130, 246, 0.8)', // Bleu
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: '-1'
    },
    {
      label: '95ème Percentile',
      data: bootstrapResults.value.percentileCurves.p95,
      borderColor: 'rgba(139, 92, 246, 0.8)', // Violet
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    }
  ];

  return {
    labels,
    datasets: [...curvesDatasets, ...percentileDatasets]
  };
});

// Options pour le graphique de Bootstrap Resampling
const bootstrapChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Distribution des Performances (Bootstrap Resampling)',
      font: {
        size: 16,
        weight: 'bold' as const,
      }
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        title: (items: any[]) => {
          return `Progression ${items[0].label}`;
        },
        label: (context: any) => {
          const datasetLabel = context.dataset.label;
          const value = context.parsed.y;
          return `${datasetLabel}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
        }
      }
    },
    legend: {
      position: 'top' as const,
      labels: {
        filter: (item: any) => {
          // Cacher les labels des simulations individuelles
          return !item.text.startsWith('Simulation');
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Progression de la stratégie',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: 'rgba(192, 198, 211, 0.2)',
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Performance (%)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as const,
        }
      },
      grid: {
        color: (context: any) => {
          if (context.tick.value === 0) {
            return 'rgba(0, 0, 0, 0.2)'; // Ligne zéro plus foncée
          }
          return 'rgba(192, 198, 211, 0.2)';
        },
        lineWidth: (context: any) => {
          if (context.tick.value === 0) {
            return 2; // Ligne zéro plus épaisse
          }
          return 1;
        },
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  }
};

// Exécuter le bootstrap resampling au chargement et quand les trades changent
watch(
  () => tradingStore.trading.trades.length,
  () => {
    runBootstrap();
  }
);

// Exécuter les simulations au montage et charger les données
onMounted(() => {
  // Charger d'abord les données depuis MongoDB
  const tradesStore = useTradesStore();
  tradesStore.fetchTrades();
  
  if (tradingStore.trading.trades.length > 0) {
    // Récupérer les données du S&P 500
    fetchSP500Data();
    runMonteCarlo();
    runBootstrap();
  }
});

// Paramètres pour le modèle de Geometric Brownian Motion
const gbmParams = ref({
  initialPrice: 100,
  mu: 0.1,
  sigma: 0.2,
  deltaT: 1/252,
  timeHorizon: 1
});

// Résultats pour le modèle de Geometric Brownian Motion
const gbmResults = ref<{
  simulations: any[];
  percentiles?: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  }
}>({
  simulations: []
});

// Statistiques pour le modèle de Geometric Brownian Motion
const gbmStats = ref({
  medianReturn: 0,
  medianVolatility: 0,
  medianDrawdown: 0,
  medianSharpe: 0,
  profitProbability: 0
});

// Fonction pour formater un nombre en pourcentage
const formatNumber = (value: number): string => {
  return value.toFixed(2);
};

// Fonction pour simuler le modèle de Geometric Brownian Motion
function simulateGBM() {
  import('../utils/geometricBrownianMotion').then(({ simulateMultipleGBM }) => {
    const results = simulateMultipleGBM(gbmParams.value, 100);
    gbmResults.value = results;
    calculateGBMStats();
  });
}

// Calculer les statistiques pour le modèle de Geometric Brownian Motion
function calculateGBMStats() {
  if (!gbmResults.value.simulations.length) return;
  
  const returns = gbmResults.value.simulations.map(sim => sim.stats.totalReturn);
  
  // Calculer la médiane des rendements
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const medianReturn = sortedReturns[Math.floor(sortedReturns.length / 2)];
  
  // Calculer la volatilité médiane
  const volatilities = gbmResults.value.simulations.map(sim => sim.stats.volatility);
  const sortedVolatilities = [...volatilities].sort((a, b) => a - b);
  const medianVolatility = sortedVolatilities[Math.floor(sortedVolatilities.length / 2)];
  
  // Calculer le drawdown médian
  const drawdowns = gbmResults.value.simulations.map(sim => sim.stats.maxDrawdown);
  const sortedDrawdowns = [...drawdowns].sort((a, b) => a - b);
  const medianDrawdown = sortedDrawdowns[Math.floor(sortedDrawdowns.length / 2)];
  
  // Calculer le ratio de Sharpe médian
  const sharpeRatios = gbmResults.value.simulations.map(sim => sim.stats.sharpeRatio);
  const sortedSharpeRatios = [...sharpeRatios].sort((a, b) => a - b);
  const medianSharpe = sortedSharpeRatios[Math.floor(sortedSharpeRatios.length / 2)];
  
  // Calculer la probabilité de profit
  const profitProbability = returns.filter(r => r > 0).length / returns.length;
  
  gbmStats.value = {
    medianReturn,
    medianVolatility,
    medianDrawdown,
    medianSharpe,
    profitProbability
  };
}

// Données pour le graphique de Geometric Brownian Motion
const gbmChartData = computed(() => {
  if (!gbmResults.value.simulations.length || !gbmResults.value.percentiles) {
    return {
      labels: [],
      datasets: []
    };
  }
  
  const timePoints = gbmResults.value.simulations[0].timePoints;
  const percentiles = gbmResults.value.percentiles;
  
  return {
    labels: timePoints.map((t: number) => `${(t * 252).toFixed(0)}j`),
    datasets: [
      {
        label: 'P10',
        data: percentiles.p10,
        borderColor: 'rgba(255, 99, 132, 0.8)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: 'P25',
        data: percentiles.p25,
        borderColor: 'rgba(255, 159, 64, 0.8)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        fill: '+1',
        borderWidth: 1,
        pointRadius: 0
      },
      {
        label: 'P50 (Médiane)',
        data: percentiles.p50,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: 'P75',
        data: percentiles.p75,
        borderColor: 'rgba(75, 192, 192, 0.8)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: '+1',
        borderWidth: 1,
        pointRadius: 0
      },
      {
        label: 'P90',
        data: percentiles.p90,
        borderColor: 'rgba(153, 102, 255, 0.8)',
        backgroundColor: 'rgba(153, 102, 255, 0.1)',
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      }
    ]
  };
});

// Options pour le graphique de Geometric Brownian Motion
const gbmChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      mode: 'index' as const,
      intersect: false
    },
    legend: {
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        font: {
          size: 10
        }
      }
    },
    title: {
      display: true,
      text: 'Geometric Brownian Motion - Évolution du capital'
    }
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Jours de trading'
      }
    },
    y: {
      title: {
        display: true,
        text: 'Capital'
      }
    }
  }
};

// Simuler le GBM au chargement et à chaque modification des paramètres
watch([gbmParams], () => {
  simulateGBM();
}, { immediate: true });

// Interprétation des résultats de Monte Carlo
const monteCarloInterpretation = computed(() => {
  if (!monteCarloResults.value.simulationPaths.length) {
    return {
      mainMessage: "Pas assez de données pour l'interprétation",
      details: "Ajoutez au moins 5 trades pour générer une interprétation.",
      riskLevel: "unknown"
    };
  }
  
  const finalP10 = monteCarloResults.value.percentiles.p10;
  const finalP50 = monteCarloResults.value.percentiles.p50;
  const finalP90 = monteCarloResults.value.percentiles.p90;
  
  let riskLevel: 'low' | 'medium' | 'high' | 'very-high' = 'medium';
  let mainMessage = '';
  let details = '';
  
  if (finalP10 > 0 && finalP50 > 20) {
    riskLevel = 'low';
    mainMessage = 'Stratégie très prometteuse avec risque limité';
    details = `Même dans les pires scénarios (P10), votre stratégie reste profitable. La médiane à ${finalP50.toFixed(1)}% indique un excellent potentiel.`;
  } else if (finalP10 > -10 && finalP50 > 10) {
    riskLevel = 'medium';
    mainMessage = 'Stratégie équilibrée avec bon potentiel';
    details = `Votre stratégie montre un bon équilibre risque/rendement. Dans 90% des cas, vous ne perdrez pas plus de ${Math.abs(finalP10).toFixed(1)}%.`;
  } else if (finalP10 > -25 && finalP50 > 0) {
    riskLevel = 'high';
    mainMessage = 'Stratégie risquée mais potentiellement rentable';
    details = `Attention au risque élevé : dans 10% des cas, vous pourriez perdre plus de ${Math.abs(finalP10).toFixed(1)}%. Cependant, la médiane reste positive.`;
  } else {
    riskLevel = 'very-high';
    mainMessage = 'Stratégie très risquée - révision recommandée';
    details = `Votre stratégie présente un risque très élevé avec des pertes potentielles importantes. Une révision de votre approche est fortement recommandée.`;
  }
  
  return {
    riskLevel,
    mainMessage,
    details,
    finalP10,
    finalP50,
    finalP90
  };
});

// Évolution des Win/Loss/BE au cours du temps (incluant les archives)
const winRateEvolutionData = computed(() => {
  // Récupérer les trades actuels et les archives
  const currentTrades = sortedTrades.value;
  const archives = getArchives();
  
  // Combiner tous les trades (actuels + archivés)
  let allTrades: Trade[] = [...currentTrades];
  
  // Ajouter les trades des archives
  archives.forEach((archive: any) => {
    if (archive.trades && Array.isArray(archive.trades)) {
      allTrades = [...allTrades, ...archive.trades];
    }
  });
  
  if (allTrades.length === 0) return { labels: [], datasets: [] };
  
  // Regrouper les trades par mois
  const tradesByMonth: Record<string, Trade[]> = {};
  allTrades.forEach(trade => {
    const date = new Date(trade.entryDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!tradesByMonth[monthKey]) {
      tradesByMonth[monthKey] = [];
    }
    tradesByMonth[monthKey].push(trade);
  });
  
  // Trier les mois
  const sortedMonths = Object.keys(tradesByMonth).sort();
  
  // Calculer les statistiques pour chaque mois
  const winRates: number[] = [];
  const longWinRates: number[] = [];
  const shortWinRates: number[] = [];
  const profitFactors: number[] = [];
  const strategyMarkers: string[] = []; // Pour marquer les changements de stratégie
  
  sortedMonths.forEach(month => {
    const monthTrades = tradesByMonth[month];
    const wins = monthTrades.filter(t => t.profitLoss > 0).length;
    const losses = monthTrades.filter(t => t.profitLoss < 0).length;
    const longTrades = monthTrades.filter(t => t.direction === 'LONG');
    const shortTrades = monthTrades.filter(t => t.direction === 'SHORT');
    
    const longWins = longTrades.filter(t => t.profitLoss > 0).length;
    const shortWins = shortTrades.filter(t => t.profitLoss > 0).length;
    
    const totalWinAmount = monthTrades.filter(t => t.profitLoss > 0).reduce((sum, t) => sum + t.profitLoss, 0);
    const totalLossAmount = Math.abs(monthTrades.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0));
    
    winRates.push(monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0);
    longWinRates.push(longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0);
    shortWinRates.push(shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0);
    profitFactors.push(totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0);
    
    // Vérifier si ce mois contient des trades d'archives (changement de stratégie)
    const hasArchivedTrades = monthTrades.some(trade => {
      return archives.some((archive: any) => 
        archive.trades && archive.trades.some((archiveTrade: any) => archiveTrade.id === trade.id)
      );
    });
    strategyMarkers.push(hasArchivedTrades ? 'archived' : 'current');
  });
  
  // Formater les étiquettes des mois (Jan 2023, Fév 2023, etc.)
  const formattedMonths = sortedMonths.map(month => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(date);
  });
  
  return {
    labels: formattedMonths,
    datasets: [
      {
        label: 'Win Rate Global (%)',
        data: winRates,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#F59E0B' : 'rgba(75, 192, 192, 1)'
        ),
        pointBorderColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#D97706' : 'rgba(75, 192, 192, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      },
      {
        label: 'Long Win Rate (%)',
        data: longWinRates,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#F59E0B' : 'rgba(54, 162, 235, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      },
      {
        label: 'Short Win Rate (%)',
        data: shortWinRates,
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#F59E0B' : 'rgba(255, 99, 132, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      },
      {
        label: 'Profit Factor',
        data: profitFactors,
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 2,
        tension: 0.2,
        yAxisID: 'y1',
        pointBackgroundColor: strategyMarkers.map(marker => 
          marker === 'archived' ? '#DC2626' : 'rgba(255, 206, 86, 1)'
        ),
        pointRadius: strategyMarkers.map(marker => marker === 'archived' ? 6 : 4)
      }
    ]
  };
});

// Options pour le graphique d'évolution des performances
const winRateEvolutionOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    },
    title: {
      display: true,
      text: 'Évolution des Performances (Historique Complet)'
    },
    subtitle: {
      display: true,
      text: '🟡 Points orange = Stratégies archivées | 🔵 Points normaux = Stratégie actuelle',
      font: {
        size: 11
      },
      color: '#6B7280'
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            if (context.dataset.label === 'Profit Factor') {
              label += context.parsed.y.toFixed(2);
            } else {
              label += context.parsed.y.toFixed(1) + '%';
            }
          }
          return label;
        },
        afterLabel: function(context: any) {
          // Ajouter une indication si c'est une période archivée
          const archives = getArchives();
          const monthLabel = context.label;
          
          // Vérifier si ce mois correspond à une archive
          const isArchived = archives.some((archive: any) => {
            if (!archive.dateArchived) return false;
            const archiveDate = new Date(archive.dateArchived);
            const archiveMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(archiveDate);
            return archiveMonth === monthLabel;
          });
          
          return isArchived ? '📁 Période archivée' : '';
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Win Rate (%)'
      },
      min: 0,
      max: 100
    },
    y1: {
      beginAtZero: true,
      position: 'right' as const,
      grid: {
        drawOnChartArea: false
      },
      title: {
        display: true,
        text: 'Profit Factor'
      },
      min: 0,
      max: 10
    }
  }
};

// Fonction pour déboguer le calcul de VaR
const debugVaRCalculation = async () => {
  console.log('=== DEBUG VaR CALCULATION ===');
  console.log('Nombre de trades:', tradingStore.trading.trades.length);
  console.log('Trades:', tradingStore.trading.trades);
  
  if (tradingStore.trading.trades.length === 0) {
    console.log('Aucun trade disponible pour le calcul de VaR');
    return;
  }
  
  // Recalculer les métriques manuellement
  const { calculateVaR, calculateConditionalVaR } = await import('../utils/performanceMetrics');
  
  console.log('Recalcul des métriques VaR...');
  const var95 = calculateVaR(tradingStore.trading.trades, 0.95);
  const var99 = calculateVaR(tradingStore.trading.trades, 0.99);
  const cvar95 = calculateConditionalVaR(tradingStore.trading.trades, 0.95);
  const cvar99 = calculateConditionalVaR(tradingStore.trading.trades, 0.99);
  
  console.log('Résultats du recalcul:');
  console.log('VaR 95%:', var95);
  console.log('VaR 99%:', var99);
  console.log('CVaR 95%:', cvar95);
  console.log('CVaR 99%:', cvar99);
  
  console.log('Métriques actuelles dans le store:');
  console.log('VaR 95%:', tradingStore.tradingMetrics.valueAtRisk95);
  console.log('VaR 99%:', tradingStore.tradingMetrics.valueAtRisk99);
  console.log('CVaR 95%:', tradingStore.tradingMetrics.conditionalVaR95);
  console.log('CVaR 99%:', tradingStore.tradingMetrics.conditionalVaR99);
  
  // Forcer la mise à jour des métriques
  tradingStore.setAdvancedMetrics({
    valueAtRisk95: var95,
    valueAtRisk99: var99,
    conditionalVaR95: cvar95,
    conditionalVaR99: cvar99
  });
  
  console.log('Métriques mises à jour!');
  console.log('=== FIN DEBUG VaR ===');
};

// Variables pour la génération de trades aléatoires
const showGeneratorModal = ref(false);
const generatorConfig = ref({
  numberOfTrades: 20,
  strategyStyle: 'balanced',
  timeRange: 30 // en jours
});

// Styles de stratégies prédéfinis
const strategyStyles = {
  conservative: {
    name: 'Conservatrice',
    description: 'Win rate élevé (70-80%), gains modérés (0.5-2%), pertes limitées',
    winRate: 0.75,
    avgWin: 1.2,
    avgLoss: -0.8,
    maxWin: 3.0,
    maxLoss: -2.0,
    tradeDurationRange: [2, 24], // en heures
    symbols: ['SP500', 'DAX40'],
    timeframes: ['1h', '4h', '1d']
  },
  aggressive: {
    name: 'Agressive',
    description: 'Win rate moyen (45-55%), gains élevés (1-5%), pertes importantes',
    winRate: 0.50,
    avgWin: 2.8,
    avgLoss: -2.2,
    maxWin: 8.0,
    maxLoss: -6.0,
    tradeDurationRange: [0.5, 8], // en heures
    symbols: ['BTC', 'NS100', 'XAAUSD'],
    timeframes: ['15m', '30m', '1h']
  },
  balanced: {
    name: 'Équilibrée',
    description: 'Win rate équilibré (55-65%), gains et pertes modérés',
    winRate: 0.60,
    avgWin: 1.8,
    avgLoss: -1.4,
    maxWin: 4.5,
    maxLoss: -3.5,
    tradeDurationRange: [1, 12], // en heures
    symbols: ['SP500', 'NS100', 'DAX40'],
    timeframes: ['30m', '1h', '4h']
  },
  scalping: {
    name: 'Scalping',
    description: 'Win rate élevé (65-75%), gains faibles (0.2-1%), trades très courts',
    winRate: 0.70,
    avgWin: 0.6,
    avgLoss: -0.4,
    maxWin: 1.5,
    maxLoss: -1.0,
    tradeDurationRange: [0.1, 2], // en heures
    symbols: ['SP500', 'NS100', 'DAX40'],
    timeframes: ['1m', '5m', '15m']
  },
  swing: {
    name: 'Swing Trading',
    description: 'Win rate moyen (50-60%), gains élevés (2-6%), trades longs',
    winRate: 0.55,
    avgWin: 3.5,
    avgLoss: -2.8,
    maxWin: 10.0,
    maxLoss: -8.0,
    tradeDurationRange: [24, 168], // en heures (1-7 jours)
    symbols: ['SP500', 'BTC', 'XAAUSD'],
    timeframes: ['4h', '1d', '1w']
  }
};

// Fonction pour générer un nombre aléatoire dans une plage
const randomInRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// Fonction pour générer une distribution normale approximative
const normalRandom = (mean: number, stdDev: number): number => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
};

// Fonction pour générer des trades aléatoires
const generateRandomTrades = () => {
  const style = strategyStyles[generatorConfig.value.strategyStyle as keyof typeof strategyStyles];
  const trades: any[] = [];
  
  // Date de début (il y a X jours)
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (generatorConfig.value.timeRange * 24 * 60 * 60 * 1000));
  
  for (let i = 0; i < generatorConfig.value.numberOfTrades; i++) {
    // Déterminer si c'est un trade gagnant
    const isWin = Math.random() < style.winRate;
    
    // Générer le P/L
    let profitLoss: number;
    if (isWin) {
      // Trade gagnant - distribution normale autour de la moyenne
      profitLoss = Math.max(0.1, normalRandom(style.avgWin, style.avgWin * 0.3));
      profitLoss = Math.min(profitLoss, style.maxWin);
    } else {
      // Trade perdant - distribution normale autour de la moyenne (négative)
      profitLoss = Math.min(-0.1, normalRandom(style.avgLoss, Math.abs(style.avgLoss) * 0.3));
      profitLoss = Math.max(profitLoss, style.maxLoss);
    }
    
    // Générer les dates
    const entryTime = randomInRange(startDate.getTime(), endDate.getTime());
    const entryDate = new Date(entryTime);
    
    // Durée du trade
    const durationHours = randomInRange(style.tradeDurationRange[0], style.tradeDurationRange[1]);
    const exitDate = new Date(entryTime + (durationHours * 60 * 60 * 1000));
    
    // Sélectionner symbole et timeframe aléatoirement
    const symbol = style.symbols[Math.floor(Math.random() * style.symbols.length)];
    const timeframe = style.timeframes[Math.floor(Math.random() * style.timeframes.length)];
    
    // Direction aléatoire
    const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    
    // Risque aléatoire
    const riskOptions = [0.25, 0.5, 1, 1.5, 2];
    const risk = riskOptions[Math.floor(Math.random() * riskOptions.length)];
    
    // Générer des frais aléatoires (optionnels)
    const fees = Math.random() > 0.7 ? randomInRange(0.5, 3.0) : 0;
    const spread = Math.random() > 0.8 ? randomInRange(0.1, 1.0) : 0;
    const commission = Math.random() > 0.9 ? randomInRange(0.2, 1.5) : 0;
    
    const trade = {
      id: `generated_${Date.now()}_${i}`,
      symbol,
      direction,
      quantity: Math.floor(randomInRange(1, 10)),
      entryPrice: 0, // Non utilisé dans notre système
      exitPrice: 0, // Non utilisé dans notre système
      entryDate,
      exitDate,
      strategy: style.name,
      notes: `Trade généré automatiquement - Style: ${style.name}`,
      profitLoss: Math.round(profitLoss * 100) / 100, // Arrondir à 2 décimales
      timeframe,
      risk,
      fees: Math.round(fees * 100) / 100,
      spread: Math.round(spread * 100) / 100,
      commission: Math.round(commission * 100) / 100
    };
    
    trades.push(trade);
  }
  
  // Trier les trades par date d'entrée
  trades.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  
  return trades;
};

// Fonction pour confirmer et ajouter les trades générés
const confirmGenerateRandomTrades = () => {
  const generatedTrades = generateRandomTrades();
  const style = strategyStyles[generatorConfig.value.strategyStyle as keyof typeof strategyStyles];
  
  const confirmMessage = `Êtes-vous sûr de vouloir générer ${generatorConfig.value.numberOfTrades} trades avec le style "${style.name}" ?

Caractéristiques:
- ${style.description}
- Période: ${generatorConfig.value.timeRange} derniers jours
- Win rate approximatif: ${Math.round(style.winRate * 100)}%

Cette action ajoutera les trades à votre historique existant.`;

  if (confirm(confirmMessage)) {
    // Ajouter tous les trades générés
    generatedTrades.forEach(trade => {
      tradingStore.addTrade(trade);
    });
    
    showGeneratorModal.value = false;
    
    // Message de confirmation
    alert(`${generatedTrades.length} trades ont été générés avec succès !

Style: ${style.name}
Trades gagnants: ${generatedTrades.filter(t => t.profitLoss > 0).length}
Trades perdants: ${generatedTrades.filter(t => t.profitLoss < 0).length}
Trades break-even: ${generatedTrades.filter(t => t.profitLoss === 0).length}

Performance totale: ${generatedTrades.reduce((sum, t) => sum + t.profitLoss, 0).toFixed(2)}%`);
  }
};

// Modifier la fonction equityChartData pour avoir seulement les données de la stratégie
const strategyChartData = computed(() => {
  if (tradingStore.trading.equityCurve.length === 0) {
    return {
      labels: [],
      datasets: [{
        label: 'Performance Stratégie de Trading (€)',
        data: [],
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }
  
  // Utiliser directement les valeurs en euros au lieu de normaliser en base 100
  return {
    labels: tradingStore.trading.equityCurve.map(point => formatDate(point.date)),
    datasets: [
      {
        label: 'Performance Stratégie de Trading (€)',
        data: tradingStore.trading.equityCurve.map(point => point.balance),
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
});

// Calcul de la performance de la stratégie
const strategyPerformance = computed(() => {
  if (tradingStore.trading.equityCurve.length < 2) return 0;
</script>
