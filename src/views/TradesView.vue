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
  
  // Calculer la durée de la stratégie
  const trades = tradingStore.trading.trades;
  let strategyDuration = 0;
  let startDate = null;
  let endDate = null;
  
  if (trades.length > 0) {
    const sortedTrades = [...trades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    startDate = new Date(sortedTrades[0].entryDate);
    endDate = new Date(sortedTrades[sortedTrades.length - 1].exitDate);
    strategyDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)); // en jours
  }
  
  // Créer un objet d'archive avec les données actuelles
  const archiveData = {
    id: Date.now().toString(),
    name: archiveName.value.trim(),
    dateArchived: new Date(),
    strategyDuration: strategyDuration,
    startDate: startDate,
    endDate: endDate,
    initialCapital: tradingStore.initialCapital,
    finalCapital: currentCapital.value,
    totalTrades: tradingStore.trading.trades.length,
    performance: performancePercent.value,
    winRate: tradingStats.value.winRate,
    breakEvenRate: tradingStats.value.breakEvenRate,
    lossRate: tradingStats.value.lossRate,
    maxDrawdown: tradingStats.value.maxDrawdown,
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
  
  alert(`Stratégie "${archiveData.name}" archivée avec succès !\n\nPerformance archivée : ${performancePercent.value.toFixed(2)}%\nNouvel échantillon démarré avec ${currentCapital.value.toFixed(2)}€`);
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
    if (months === 1) return `1 mois ${days} jour${days > 1 ? 's' : ''}`;
    if (days === 0) return `${months} mois`;
    return `${months} mois ${days} jour${days > 1 ? 's' : ''}`;
  }
  const years = Math.floor(duration / 365);
  const months = Math.floor((duration % 365) / 30);
  if (years === 1 && months === 0) return '1 an';
  if (years === 1) return `1 an ${months} mois`;
  if (months === 0) return `${years} ans`;
  return `${years} ans ${months} mois`;
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

  // Extraire les percentiles finaux (dernier point des projections)
  const finalP10 = monteCarloResults.value.pathPercentiles.p10[monteCarloResults.value.pathPercentiles.p10.length - 1];
  const finalP50 = monteCarloResults.value.pathPercentiles.p50[monteCarloResults.value.pathPercentiles.p50.length - 1];
  const finalP90 = monteCarloResults.value.pathPercentiles.p90[monteCarloResults.value.pathPercentiles.p90.length - 1];
  
  // Déterminer la probabilité de profit (estimation basée sur les percentiles)
  let profitProbability;
  if (finalP50 > 0) {
    profitProbability = finalP10 > 0 ? 0.95 : 0.75;
  } else {
    profitProbability = finalP90 > 0 ? 0.25 : 0.05;
  }
  profitProbability = Math.round(profitProbability * 100);
  
  // Déterminer le niveau de risque
  let riskLevel, mainMessage, details;
  
  if (finalP10 > 0) {
    riskLevel = "low";
    mainMessage = "Profil de risque favorable";
    details = `Votre stratégie présente un profil de risque très favorable. Avec une probabilité d'environ ${profitProbability}% d'être profitable après 500 trades, même dans les scénarios pessimistes (P10), vous restez en positif. La performance médiane projetée est de ${finalP50.toFixed(1)}%.`;
  } else if (finalP50 > 0 && finalP10 < 0) {
    riskLevel = "medium";
    mainMessage = "Profil de risque équilibré";
    details = `Votre stratégie présente un équilibre entre risque et rendement. Avec une probabilité d'environ ${profitProbability}% d'être profitable après 500 trades, la performance médiane projetée est de ${finalP50.toFixed(1)}%. Cependant, dans les scénarios pessimistes (P10), vous pourriez perdre jusqu'à ${Math.abs(finalP10).toFixed(1)}%.`;
  } else if (finalP50 < 0 && finalP90 > 0) {
    riskLevel = "high";
    mainMessage = "Profil de risque préoccupant";
    details = `Votre stratégie présente un risque élevé. Avec une probabilité d'environ ${profitProbability}% d'être profitable après 500 trades, la performance médiane projetée est négative à ${finalP50.toFixed(1)}%. Seuls les scénarios optimistes (P90) montrent un profit de ${finalP90.toFixed(1)}%.`;
  } else {
    riskLevel = "very-high";
    mainMessage = "Profil de risque très défavorable";
    details = `Votre stratégie présente un risque extrêmement élevé. Avec une probabilité d'environ ${profitProbability}% d'être profitable après 500 trades, même les scénarios optimistes (P90) montrent des pertes. Reconsidérez vos règles de trading.`;
  }
  
  return {
    mainMessage,
    details,
    riskLevel,
    profitProbability,
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
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        Journal des Trades
      </h1>
      <div class="flex space-x-2">
        <button 
          @click="showAdvancedPerformance = !showAdvancedPerformance" 
          class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {{ showAdvancedPerformance ? 'Masquer Détails' : 'Voir Détails' }}
        </button>
        <button 
          @click="showTradingStrategy = !showTradingStrategy" 
          class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors duration-150"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {{ showTradingStrategy ? 'Masquer Stratégie' : 'Voir Stratégie' }}
        </button>
      </div>
    </div>
    
    <!-- Stratégie de Trading et S&P 500 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 mt-6">
      <!-- Stratégie de Trading -->
      <div class="bg-white shadow rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Stratégie de Trading
          </h2>
          <span class="text-base font-medium" :class="strategyPerformance >= 0 ? 'text-green-600' : 'text-red-600'">
            {{ formatPercent(strategyPerformance) }}
          </span>
        </div>
        <div class="h-64 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Line :data="strategyChartData" :options="strategyChartOptions" />
        </div>
      </div>

      <!-- Benchmark S&P 500 -->
      <div class="bg-white shadow rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Benchmark S&P 500
          </h2>
          <span v-if="sp500Data.length > 0" class="text-base font-medium" :class="sp500Performance >= 0 ? 'text-green-600' : 'text-red-600'">
            {{ formatPercent(sp500Performance) }}
          </span>
          <button v-else @click="fetchSP500Data" class="text-sm bg-indigo-600 text-white py-1 px-3 rounded hover:bg-indigo-700 transition-colors">
            Récupérer les données
          </button>
        </div>
        
        <div class="h-64 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md">
          <div v-if="sp500Data.length === 0 && !isLoadingSP500 && !sp500Error" class="h-full flex items-center justify-center">
            <div class="text-center">
              <p class="text-gray-500 mb-2">Données S&P 500 non disponibles</p>
              <button 
                @click="fetchSP500Data" 
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Récupérer les données
              </button>
            </div>
          </div>
          <div v-else-if="isLoadingSP500" class="h-full flex items-center justify-center">
            <p class="text-indigo-600">Chargement des données du S&P 500...</p>
          </div>
          <div v-else-if="sp500Error" class="h-full flex items-center justify-center">
            <div class="text-center">
              <p class="text-red-600 mb-2">{{ sp500Error }}</p>
              <button 
                @click="fetchSP500Data" 
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Réessayer
              </button>
            </div>
          </div>
          <Line v-else :data="sp500ChartData" :options="sp500ChartOptions" />
        </div>
        <div class="mt-2 flex justify-end">
          <span class="text-sm text-gray-600">Alpha: {{ formatPercent(strategyPerformance - sp500Performance) }}</span>
        </div>
      </div>
    </div>
    
    <!-- Capital et Timeframe -->
    <div class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Capital Trading
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md bg-indigo-100 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Capital Initial</h3>
                <div class="flex items-center">
                  <input type="number" v-model="initialCapital" class="text-lg font-bold text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none focus:border-indigo-500 w-28" />
                  <span class="ml-1 text-lg font-bold text-gray-900">€</span>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md bg-green-100 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Capital Actuel</h3>
                <div class="flex items-center">
                  <p class="text-lg font-bold text-gray-900">{{ currentCapital.toFixed(2) }}€</p>
                  <span class="ml-2 px-2 py-0.5 text-xs font-medium rounded-full" :class="performancePercent >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                    {{ performancePercent >= 0 ? '+' : '' }}{{ performancePercent.toFixed(2) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap justify-center sm:justify-between sm:col-span-2 gap-2">
            <button @click="updateInitialCapital" class="inline-flex items-center px-3 py-2 text-sm font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors duration-150">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Mettre à jour
            </button>
            <button 
              @click="archiveStrategy" 
              class="inline-flex items-center px-3 py-2 text-sm font-medium rounded transition-colors duration-150"
              :class="tradingStore.trading.trades.length > 0 
                ? 'text-amber-700 bg-amber-100 hover:bg-amber-200' 
                : 'text-gray-400 bg-gray-100 cursor-not-allowed'"
              :disabled="!tradingStore.trading.trades.length"
              :title="tradingStore.trading.trades.length > 0 ? 'Archiver la période actuelle' : 'Aucun trade à archiver'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8l6 6m0 0l6-6m-6 6V3m-9 5a2 2 0 002 2h10a2 2 0 002-2M7 19h10a2 2 0 002-2v-1a2 2 0 00-2-2H7a2 2 0 00-2 2v1a2 2 0 002 2z" />
              </svg>
              Archiver ({{ tradingStore.trading.trades.length }})
            </button>
            <button @click="resetAll" class="inline-flex items-center px-3 py-2 text-sm font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 transition-colors duration-150">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>
      
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Période d'Analyse
        </h2>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:bg-gray-100">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tf in timeframes"
              :key="tf.value"
              @click="selectedTimeframe = tf.value"
              class="px-4 py-2 text-sm font-medium rounded-md transition-all duration-150"
              :class="selectedTimeframe === tf.value 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'"
            >
              {{ tf.label }}
            </button>
          </div>
          <div class="mt-4 text-sm text-gray-500 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ sortedTrades.length }} trades sur la période sélectionnée</span>
            <div class="relative ml-2 group">
              <span 
                v-if="evaluateTradeCount().show" 
                class="px-2 py-0.5 rounded-full text-xs font-medium cursor-help"
                :class="evaluateTradeCount().class"
              >
                {{ evaluateTradeCount().label }}
              </span>
              <div v-if="evaluateTradeCount().show" class="absolute z-10 left-0 -bottom-2 transform translate-y-full w-64 px-4 py-2 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <span class="text-xs font-medium text-gray-800">{{ evaluateTradeCount().advice }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div class="bg-white shadow rounded-lg p-6 mb-6 transition-all duration-300 hover:shadow-lg">
      <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Performance Globale
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Card 1: Trades -->
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-indigo-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Trades</h3>
              <div class="flex items-center">
                <p class="text-lg font-bold text-gray-900">{{ tradingStats.totalTrades }}</p>
                <span 
                  v-if="evaluateTradeCount().show" 
                  class="ml-2 px-2 py-0.5 text-xs font-medium rounded-full cursor-help"
                  :class="evaluateTradeCount().class"
                >
                  {{ evaluateTradeCount().label }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Card 2: Win Rate -->
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-green-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 class="text-sm font-medium text-gray-500">Win Rate</h4>
              <div class="flex items-center">
                <p class="mt-1 text-2xl font-semibold text-gray-900">{{ tradingStats.winRate.toFixed(1) }}%</p>
                <span class="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" 
                  :class="{
                    'bg-green-100 text-green-800': tradingStats.winRate >= 60,
                    'bg-blue-100 text-blue-800': tradingStats.winRate >= 50 && tradingStats.winRate < 60,
                    'bg-yellow-100 text-yellow-800': tradingStats.winRate >= 40 && tradingStats.winRate < 50,
                    'bg-red-100 text-red-800': tradingStats.winRate < 40
                  }">
                  {{ tradingStats.winRate >= 60 ? 'excellent' : tradingStats.winRate >= 50 ? 'bon' : tradingStats.winRate >= 40 ? 'moyen' : 'à améliorer' }}
                </span>
              </div>
              <div class="flex items-center mt-1 text-xs text-gray-500">
                <span>incluant {{ tradingStats.breakEvenTrades }} BE ({{ tradingStats.breakEvenRate.toFixed(1) }}%)</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div :class="{'bg-green-600': tradingStats.winRate >= 50, 'bg-red-600': tradingStats.winRate < 50}" class="h-1.5 rounded-full" :style="{ width: `${Math.min(tradingStats.winRate, 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Card 3: Profit/Loss -->
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md" :class="tradingStats.netProfitLoss >= 0 ? 'bg-green-100' : 'bg-red-100'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="tradingStats.netProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path v-if="tradingStats.netProfitLoss >= 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div>
              <h4 class="text-sm font-medium text-gray-500">Profit/Perte Net</h4>
              <p class="mt-1 text-2xl font-semibold" :class="tradingStats.netProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ tradingStats.netProfitLoss >= 0 ? '+' : '' }}{{ tradingStats.netProfitLoss.toFixed(2) }}%
              </p>
              <div class="mt-1 text-xs text-gray-500 flex items-center">
                <span>{{ tradingStats.totalTrades ? `${(tradingStats.netProfitLoss / tradingStats.totalTrades).toFixed(2)}% par trade` : '0% par trade' }}</span>
                <span v-if="tradingStats.expectancy" class="ml-2 px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">E: {{ tradingStats.expectancy.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Card 4: Drawdown -->
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-red-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 class="text-sm font-medium text-gray-500">Drawdown Max</h4>
              <p class="mt-1 text-2xl font-semibold text-red-600">{{ tradingStats.maxDrawdown.toFixed(2) }}%</p>
              <div class="mt-1 text-xs flex items-center justify-between">
                <span class="text-gray-500">Consécutifs:</span>
                <div>
                  <span class="text-green-600 font-medium">+{{ tradingStats.maxConsecutiveWins }}</span>
                  <span class="mx-1 text-gray-400">/</span>
                  <span class="text-red-600 font-medium">-{{ tradingStats.maxConsecutiveLosses }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="flex justify-center mt-4">
        <button 
          @click="showAdvancedPerformance = !showAdvancedPerformance" 
          class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150"
          :class="showAdvancedPerformance ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path v-if="showAdvancedPerformance" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          {{ showAdvancedPerformance ? 'Masquer les métriques avancées' : 'Afficher les métriques avancées' }}
        </button>
      </div>
      
      <!-- Métriques avancées conditionnelles -->
      <div v-if="showAdvancedPerformance" class="mt-6">
        <AdvancedPerformancePanel class="col-span-1 lg:col-span-3" />
      </div>

      <!-- Panneau de stratégie de trading -->
      <div v-if="showTradingStrategy" class="mt-6">
        <TradingStrategyPanel />
      </div>
      
      <!-- Bouton pour afficher/masquer les archives -->
      <div class="flex justify-center mt-6">
        <button 
          @click="showArchives = !showArchives" 
          class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150"
          :class="showArchives ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path v-if="showArchives" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          {{ showArchives ? 'Masquer les archives' : 'Afficher les archives' }}
          <span class="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-white bg-opacity-20">
            {{ getArchives().length }}
          </span>
        </button>
      </div>
      
      <!-- Archives de stratégies -->
      <div v-if="showArchives" class="mt-6">
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8l6 6m0 0l6-6m-6 6V3m-9 5a2 2 0 002 2h10a2 2 0 002-2M7 19h10a2 2 0 002-2v-1a2 2 0 00-2-2H7a2 2 0 00-2 2v1a2 2 0 002 2z" />
            </svg>
            Archives des Stratégies
          </h2>
          
          <div v-if="archives.length === 0" class="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p class="text-gray-500">Aucune stratégie archivée</p>
            <p class="text-sm text-gray-400 mt-1">Utilisez le bouton "Archiver" pour sauvegarder vos périodes de trading</p>
          </div>
          
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="archive in archives.slice().reverse()" 
              :key="archive.id"
              class="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-all duration-200"
            >
              <div class="flex justify-between items-start mb-3">
                <h3 class="font-medium text-gray-900">{{ archive.name }}</h3>
                <button 
                  @click="deleteArchive(archive.id, archive.name)"
                  class="text-red-500 hover:text-red-700 transition-colors"
                  title="Supprimer l'archive"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              
              <div class="space-y-2 text-sm">
                <!-- Durée de la stratégie -->
                <div class="flex justify-between">
                  <span class="text-gray-600">Durée :</span>
                  <span class="font-medium">{{ formatStrategyDuration(archive.strategyDuration || 0) }}</span>
                </div>
                
                <!-- Nombre de trades -->
                <div class="flex justify-between">
                  <span class="text-gray-600">Trades :</span>
                  <span class="font-medium">{{ archive.totalTrades }}</span>
                </div>
                
                <!-- Performance -->
                <div class="flex justify-between">
                  <span class="text-gray-600">Performance :</span>
                  <span class="font-medium" :class="archive.performance >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ archive.performance >= 0 ? '+' : '' }}{{ archive.performance.toFixed(2) }}%
                  </span>
                </div>
                
                <!-- Win Rate -->
                <div class="flex justify-between">
                  <span class="text-gray-600">Win Rate :</span>
                  <span class="font-medium" :class="{
                    'text-green-600': (archive.winRate || 0) >= 60,
                    'text-blue-600': (archive.winRate || 0) >= 50 && (archive.winRate || 0) < 60,
                    'text-yellow-600': (archive.winRate || 0) >= 40 && (archive.winRate || 0) < 50,
                    'text-red-600': (archive.winRate || 0) < 40
                  }">
                    {{ (archive.winRate || 0).toFixed(1) }}%
                  </span>
                </div>
                
                <!-- BE Rate -->
                <div class="flex justify-between">
                  <span class="text-gray-600">BE Rate :</span>
                  <span class="font-medium text-gray-700">{{ (archive.breakEvenRate || 0).toFixed(1) }}%</span>
                </div>
                
                <!-- Loss Rate -->
                <div class="flex justify-between">
                  <span class="text-gray-600">Loss Rate :</span>
                  <span class="font-medium text-red-600">{{ (archive.lossRate || 0).toFixed(1) }}%</span>
                </div>
                
                <!-- Drawdown Max -->
                <div class="flex justify-between">
                  <span class="text-gray-600">Drawdown Max :</span>
                  <span class="font-medium text-red-600">{{ (archive.maxDrawdown || 0).toFixed(2) }}%</span>
                </div>
                
                <!-- Capital (section réduite) -->
                <div class="pt-2 border-t border-gray-200">
                  <div class="flex justify-between text-xs text-gray-500">
                    <span>{{ archive.initialCapital.toFixed(0) }}€ → {{ archive.finalCapital.toFixed(0) }}€</span>
                    <span>{{ new Date(archive.dateArchived).toLocaleDateString('fr-FR') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Bouton pour afficher/masquer le calendrier de trading -->
    <div class="flex justify-center mt-6 mb-6">
      <button 
        @click="showTradingCalendar = !showTradingCalendar" 
        class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150"
        :class="showTradingCalendar ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="showTradingCalendar" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        {{ showTradingCalendar ? 'Masquer le calendrier de trading' : 'Afficher le calendrier de trading' }}
      </button>
        </div>
    
    <!-- Calendrier de Trading (conditionnel) -->
    <div v-if="showTradingCalendar">
      <TradingCalendar />
      </div>
      
    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Monthly Performance -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Performance Mensuelle
        </h2>
        <div class="h-64 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Bar :data="monthlyPerformanceData" :options="barChartOptions" />
        </div>
      </div>
      
      <!-- Pie Charts: Long/Short and Win/Loss -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          Répartition des Trades
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 rounded-lg p-4 transition-all duration-300 hover:shadow-md">
            <h3 class="text-sm font-medium text-gray-700 text-center mb-2">Long / Short</h3>
            <div class="h-40">
              <Doughnut :data="directionChartData" :options="pieChartOptions" />
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-center">
              <div class="bg-green-50 rounded p-2">
                <p class="text-xs font-medium text-gray-500">Long</p>
                <p class="text-lg font-bold text-gray-900">{{ tradingStats.longTrades }}</p>
                <p class="text-xs text-green-600 font-medium">{{ tradingStats.longWinRate.toFixed(1) }}% win rate</p>
              </div>
              <div class="bg-red-50 rounded p-2">
                <p class="text-xs font-medium text-gray-500">Short</p>
                <p class="text-lg font-bold text-gray-900">{{ tradingStats.shortTrades }}</p>
                <p class="text-xs text-red-600 font-medium">{{ tradingStats.shortWinRate.toFixed(1) }}% win rate</p>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 rounded-lg p-4 transition-all duration-300 hover:shadow-md">
            <h3 class="text-sm font-medium text-gray-700 text-center mb-2">Gagnants / Perdants</h3>
            <div class="h-40">
              <Doughnut :data="winLossChartData" :options="pieChartOptions" />
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-center">
              <div class="bg-green-50 rounded p-2">
                <p class="text-xs font-medium text-gray-500">Gagnants</p>
                <p class="text-lg font-bold text-gray-900">{{ tradingStats.winningTrades }}</p>
                <p class="text-xs text-green-600 font-medium">+{{ tradingStats.totalProfit.toFixed(2) }}%</p>
              </div>
              <div class="bg-red-50 rounded p-2">
                <p class="text-xs font-medium text-gray-500">Perdants</p>
                <p class="text-lg font-bold text-gray-900">{{ tradingStats.losingTrades }}</p>
                <p class="text-xs text-red-600 font-medium">{{ tradingStats.totalLoss.toFixed(2) }}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Symbol Win Rate -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Win Rate par Symbole
        </h2>
        <div class="h-64 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Bar :data="symbolWinRateData" :options="barChartOptionsSymbol" />
        </div>
      </div>
      
      <!-- Évolution des Win/Loss/BE au cours du temps -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cyan-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Évolution des Performances
        </h2>
        <div class="h-64 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Line :data="winRateEvolutionData" :options="winRateEvolutionOptions" />
        </div>
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="bg-blue-50 rounded-lg p-3">
            <div class="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-sm">
                <p class="font-medium text-blue-800 mb-1">Historique Complet des Stratégies</p>
                <p class="text-blue-700">
                  Ce graphique affiche l'évolution de vos performances sur toutes vos stratégies, 
                  incluant les périodes archivées. Les points orange indiquent les mois où vous aviez 
                  des stratégies archivées, permettant de visualiser votre progression globale dans le temps.
                </p>
                <div class="mt-2 flex items-center space-x-4 text-xs">
                  <div class="flex items-center">
                    <div class="w-3 h-3 bg-orange-400 rounded-full mr-1"></div>
                    <span>Stratégies archivées</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-3 h-3 bg-cyan-500 rounded-full mr-1"></div>
                    <span>Stratégie actuelle</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Alpha au cours du temps et Simulation Monte Carlo dans un grid de 2 colonnes -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <!-- Alpha au cours du temps -->
      <div class="bg-white shadow rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Alpha au cours du temps
          </h2>
          <div class="flex items-center space-x-2 text-xs">
            <span class="font-medium text-gray-700">vs S&P 500</span>
          </div>
        </div>
        
        <div class="h-80 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md relative">
          <div v-if="sp500Data.length === 0" class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <p class="text-gray-500 mb-2">Données S&P 500 non disponibles</p>
              <button 
                @click="fetchSP500Data" 
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Récupérer les données
              </button>
            </div>
          </div>
          <Line v-else :data="alphaChartData" :options="alphaChartOptions" />
        </div>
        <div v-if="sp500Data.length > 0" class="mt-3 text-xs text-gray-500 italic text-center">
          Valeurs positives = surperformance de votre stratégie
        </div>
      </div>
      
      <!-- Simulation Monte Carlo -->
      <div class="bg-white shadow rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Simulation Monte Carlo (500 trades)
          </h2>
        </div>
        
        <div class="h-80 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md relative">
          <div v-if="!monteCarloResults.simulationPaths.length" class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <p class="text-gray-500 mb-2">Pas assez de données</p>
              <p class="text-xs text-gray-400">Ajoutez au moins 5 trades</p>
            </div>
          </div>
          <Line v-else :data="monteCarloChartData" :options="monteCarloChartOptions" />
        </div>
        
        <div v-if="monteCarloResults.simulationPaths.length > 0" class="mt-3 grid grid-cols-2 gap-2">
          <div class="bg-white p-2 rounded-lg shadow-sm">
            <p class="text-xs text-gray-500">Probabilité de profit</p>
            <p class="text-sm font-bold text-emerald-600">{{ formatPercentage(monteCarloResults.profitProbability) }}</p>
          </div>
          <div class="bg-white p-2 rounded-lg shadow-sm">
            <p class="text-xs text-gray-500">Médiane (P50)</p>
            <p class="text-sm font-bold" :class="monteCarloResults.percentiles.p50 >= 0 ? 'text-emerald-600' : 'text-red-600'">
              {{ formatPercentage(monteCarloResults.percentiles.p50) }}
            </p>
          </div>
          <div class="bg-white p-2 rounded-lg shadow-sm">
            <p class="text-xs text-gray-500">Risque de drawdown >25%</p>
            <p class="text-sm font-bold text-red-600">{{ formatPercentage(monteCarloResults.drawdownRisk) }}</p>
          </div>
          <div class="bg-white p-2 rounded-lg shadow-sm">
            <p class="text-xs text-gray-500">Pire scénario</p>
            <p class="text-sm font-bold text-red-600">{{ formatPercentage(monteCarloResults.percentiles.min) }}</p>
          </div>
        </div>

        <!-- Ajout de l'interprétation Monte Carlo -->
        <div v-if="monteCarloResults.simulationPaths.length > 0" class="mt-3 bg-gray-50 p-3 rounded-lg">
          <h4 class="font-medium text-gray-700 mb-2 text-sm">Interprétation</h4>
          <p class="text-sm font-medium mb-2" 
             :class="{
               'text-green-600': monteCarloInterpretation.riskLevel === 'low', 
               'text-amber-600': monteCarloInterpretation.riskLevel === 'medium',
               'text-orange-600': monteCarloInterpretation.riskLevel === 'high',
               'text-red-600': monteCarloInterpretation.riskLevel === 'very-high'
             }">
            {{ monteCarloInterpretation.mainMessage }}
          </p>
          <p class="text-xs text-gray-600">
            {{ monteCarloInterpretation.details }}
          </p>
          <div class="flex justify-between mt-2 text-xs">
            <span class="text-red-600">Pessimiste (P10): {{ monteCarloInterpretation.finalP10 !== undefined ? formatPercentage(monteCarloInterpretation.finalP10) : '0.0%' }}</span>
            <span class="text-blue-600">Médiane (P50): {{ monteCarloInterpretation.finalP50 !== undefined ? formatPercentage(monteCarloInterpretation.finalP50) : '0.0%' }}</span>
            <span class="text-green-600">Optimiste (P90): {{ monteCarloInterpretation.finalP90 !== undefined ? formatPercentage(monteCarloInterpretation.finalP90) : '0.0%' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bootstrap Resampling et VaR dans un grid de 2 colonnes -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <!-- Bootstrap Resampling -->
      <div class="bg-white shadow rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Bootstrap Resampling
      </h2>
    </div>
    
    <div class="h-80 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md relative">
      <div v-if="!bootstrapResults.equityCurves.length" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <p class="text-gray-500 mb-2">Pas assez de données</p>
          <p class="text-xs text-gray-400">Ajoutez au moins 5 trades</p>
        </div>
      </div>
      <Line v-else :data="bootstrapChartData" :options="bootstrapChartOptions" />
    </div>
    
    <div v-if="bootstrapResults.equityCurves.length > 0" class="mt-3 grid grid-cols-2 gap-2">
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Rendement final moyen</p>
        <p class="text-sm font-bold text-emerald-600">{{ formatPercentage(bootstrapResults.statistics.finalReturns.p50) }}</p>
      </div>
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Maximum de drawdown</p>
        <p class="text-sm font-bold text-red-600">{{ formatPercentage(bootstrapResults.statistics.maxDrawdowns.max) }}</p>
      </div>
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Sharpe Ratio</p>
        <p class="text-sm font-bold" :class="bootstrapResults.statistics.sharpeRatios.p50 >= 0 ? 'text-emerald-600' : 'text-red-600'">
          {{ formatPercentage(bootstrapResults.statistics.sharpeRatios.p50) }}
        </p>
      </div>
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Pire scénario</p>
        <p class="text-sm font-bold text-red-600">{{ formatPercentage(bootstrapResults.statistics.finalReturns.min) }}</p>
      </div>
    </div>
    
    <!-- Ajout de l'interprétation Bootstrap Resampling -->
    <div v-if="bootstrapResults.equityCurves.length > 0" class="mt-3 bg-gray-50 p-3 rounded-lg">
      <h4 class="font-medium text-gray-700 mb-2 text-sm">Interprétation</h4>
      <p class="text-sm font-bold mb-2" 
         :class="{
           'text-green-600': bootstrapResults.statistics.finalReturns.min > 0,
           'text-blue-600': bootstrapResults.statistics.finalReturns.min <= 0 && bootstrapResults.statistics.finalReturns.p50 > Math.abs(bootstrapResults.statistics.finalReturns.min),
           'text-amber-600': bootstrapResults.statistics.finalReturns.min <= 0 && bootstrapResults.statistics.finalReturns.p50 > 0 && bootstrapResults.statistics.finalReturns.p50 <= Math.abs(bootstrapResults.statistics.finalReturns.min),
           'text-red-600': bootstrapResults.statistics.finalReturns.p50 <= 0
         }">
        {{ bootstrapResults.statistics.finalReturns.min > 0 ? 'Robustesse exceptionnelle' : 
           bootstrapResults.statistics.finalReturns.min <= 0 && bootstrapResults.statistics.finalReturns.p50 > Math.abs(bootstrapResults.statistics.finalReturns.min) ? 'Bonnes perspectives avec risque limité' :
           bootstrapResults.statistics.finalReturns.min <= 0 && bootstrapResults.statistics.finalReturns.p50 > 0 ? 'Risque/rendement équilibré' :
           bootstrapResults.statistics.finalReturns.p50 <= 0 && bootstrapResults.statistics.finalReturns.max > 0 ? 'Profil de risque préoccupant' :
           'Haute probabilité de perte' }}
      </p>
      <p class="text-xs text-gray-600">
        {{ bootstrapResults.statistics.finalReturns.min > 0 ? 
          `Votre stratégie démontre une robustesse exceptionnelle. Même dans les pires scénarios de resampling, elle reste profitable avec un rendement minimum de ${formatPercentage(bootstrapResults.statistics.finalReturns.min)}.` : 
          bootstrapResults.statistics.finalReturns.min <= 0 && bootstrapResults.statistics.finalReturns.p50 > Math.abs(bootstrapResults.statistics.finalReturns.min) ?
          `Votre stratégie affiche de bonnes perspectives avec un rendement médian de ${formatPercentage(bootstrapResults.statistics.finalReturns.p50)}. Le risque est limité, avec une perte maximale de ${formatPercentage(Math.abs(bootstrapResults.statistics.finalReturns.min))} dans les pires scénarios.` :
          bootstrapResults.statistics.finalReturns.p50 > 0 ?
          `Votre stratégie présente un équilibre entre risque et rendement. Le rendement médian est positif à ${formatPercentage(bootstrapResults.statistics.finalReturns.p50)}, mais dans les pires scénarios, vous pourriez perdre jusqu'à ${formatPercentage(Math.abs(bootstrapResults.statistics.finalReturns.min))}.` :
          bootstrapResults.statistics.finalReturns.max > 0 ?
          `Votre stratégie présente un profil de risque préoccupant. Le rendement médian est négatif à ${formatPercentage(bootstrapResults.statistics.finalReturns.p50)}. Seuls les meilleurs scénarios montrent un profit (max: ${formatPercentage(bootstrapResults.statistics.finalReturns.max)}).` :
          `Votre stratégie présente une haute probabilité de perte. Le rendement médian est négatif à ${formatPercentage(bootstrapResults.statistics.finalReturns.p50)}, et même les meilleurs scénarios ne montrent pas de profit substantiel.` }}
      </p>
      <div class="flex justify-between mt-2 text-xs font-medium">
        <span class="text-red-600">Pire: {{ formatPercentage(bootstrapResults.statistics.finalReturns.min) }}</span>
        <span class="text-blue-600">Médiane: {{ formatPercentage(bootstrapResults.statistics.finalReturns.p50) }}</span>
        <span class="text-green-600">Meilleur: {{ formatPercentage(bootstrapResults.statistics.finalReturns.max) }}</span>
      </div>
    </div>
  </div>
  
  <!-- Value at Risk (VaR) -->
  <div class="bg-white shadow rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-semibold text-gray-900 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Value at Risk (VaR)
      </h2>
    </div>
    
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-blue-50 p-3 rounded-lg">
        <h4 class="font-medium text-gray-700 mb-2 text-sm">VaR (95%)</h4>
        <div class="flex justify-between items-center">
          <span class="text-xl font-bold text-blue-600">{{ tradingStore.tradingMetrics.valueAtRisk95 ? tradingStore.tradingMetrics.valueAtRisk95.toFixed(2) : '0.00' }}%</span>
          <span class="text-sm text-gray-500">du capital</span>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          Perte maximale attendue (95% confiance)
        </p>
      </div>
      
      <div class="bg-red-50 p-3 rounded-lg">
        <h4 class="font-medium text-gray-700 mb-2 text-sm">VaR (99%)</h4>
        <div class="flex justify-between items-center">
          <span class="text-xl font-bold text-red-600">{{ tradingStore.tradingMetrics.valueAtRisk99 ? tradingStore.tradingMetrics.valueAtRisk99.toFixed(2) : '0.00' }}%</span>
          <span class="text-sm text-gray-500">du capital</span>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          Perte maximale attendue (99% confiance)
        </p>
      </div>
      
      <div class="bg-purple-50 p-3 rounded-lg">
        <h4 class="font-medium text-gray-700 mb-2 text-sm">Expected Shortfall (95%)</h4>
        <div class="flex justify-between items-center">
          <span class="text-xl font-bold text-purple-600">{{ tradingStore.tradingMetrics.conditionalVaR95 ? tradingStore.tradingMetrics.conditionalVaR95.toFixed(2) : '0.00' }}%</span>
          <span class="text-sm text-gray-500">du capital</span>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          Perte moyenne dans les pires 5% des cas
        </p>
      </div>
      
      <div class="bg-orange-50 p-3 rounded-lg">
        <h4 class="font-medium text-gray-700 mb-2 text-sm">Expected Shortfall (99%)</h4>
        <div class="flex justify-between items-center">
          <span class="text-xl font-bold text-orange-600">{{ tradingStore.tradingMetrics.conditionalVaR99 ? tradingStore.tradingMetrics.conditionalVaR99.toFixed(2) : '0.00' }}%</span>
          <span class="text-sm text-gray-500">du capital</span>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          Perte moyenne dans les pires 1% des cas
        </p>
      </div>
    </div>
    
    <div class="mt-3 bg-gray-50 p-3 rounded-lg">
      <h4 class="font-medium text-gray-700 mb-2 text-sm">Interprétation</h4>
      <p v-if="tradingStore.tradingMetrics.valueAtRisk95 && tradingStore.tradingMetrics.valueAtRisk95 > 10" 
         class="text-sm text-red-600 mb-2 font-medium">
        Attention : Une VaR(95%) supérieure à 10% indique un niveau de risque élevé pour votre stratégie.
      </p>
      <p v-else-if="tradingStore.tradingMetrics.valueAtRisk95 && tradingStore.tradingMetrics.valueAtRisk95 < 5" 
         class="text-sm text-green-600 mb-2 font-medium">
        Votre stratégie présente un niveau de risque modéré avec une VaR(95%) inférieure à 5%.
      </p>
      <p class="text-xs text-gray-600">
        La Value at Risk (VaR) mesure la perte potentielle maximale avec un certain niveau de confiance,
        tandis que l'Expected Shortfall mesure la perte moyenne attendue dans les pires scénarios.
      </p>
    </div>
  </div>

  <!-- Geometric Brownian Motion (GBM) en pleine largeur -->
  <div class="bg-white shadow rounded-lg p-4 transition-all duration-300 hover:shadow-lg mb-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-semibold text-gray-900 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Geometric Brownian Motion
      </h2>
      <div class="flex items-center space-x-2">
        <div class="flex items-center space-x-1">
          <label class="text-xs font-medium text-gray-700">μ:</label>
          <input 
            type="number" 
            v-model.number="gbmParams.mu" 
            min="-0.5" 
            max="0.5" 
            step="0.01" 
            class="w-16 px-1 py-0.5 text-xs border rounded"
          />
        </div>
        <div class="flex items-center space-x-1">
          <label class="text-xs font-medium text-gray-700">σ:</label>
          <input 
            type="number" 
            v-model.number="gbmParams.sigma" 
            min="0.01" 
            max="1" 
            step="0.01" 
            class="w-16 px-1 py-0.5 text-xs border rounded"
          />
        </div>
        <div class="flex items-center space-x-1">
          <label class="text-xs font-medium text-gray-700">Horizon:</label>
          <input 
            type="number" 
            v-model.number="gbmParams.timeHorizon" 
            min="0.1" 
            max="10" 
            step="0.1" 
            class="w-16 px-1 py-0.5 text-xs border rounded"
          />
        </div>
      </div>
    </div>
    
    <div class="h-80 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md relative">
      <div v-if="!gbmResults || !gbmResults.simulations || !gbmResults.simulations.length" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <p class="text-gray-500 mb-2">Pas assez de données</p>
          <p class="text-xs text-gray-400">Ajoutez au moins 5 trades</p>
        </div>
      </div>
      <Line v-else :data="gbmChartData" :options="gbmChartOptions" />
    </div>
    
    <div v-if="gbmResults && gbmResults.simulations && gbmResults.simulations.length > 0" class="mt-3 grid grid-cols-4 gap-3">
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Rendement médian</p>
        <p class="text-sm font-bold" :class="gbmStats && gbmStats.medianReturn >= 0 ? 'text-emerald-600' : 'text-red-600'">
          {{ gbmStats ? formatPercentage(gbmStats.medianReturn) : '0.0%' }}
        </p>
      </div>
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Volatilité</p>
        <p class="text-sm font-bold text-gray-900">{{ gbmStats ? formatPercentage(gbmStats.medianVolatility) : '0.0%' }}</p>
      </div>
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Drawdown max</p>
        <p class="text-sm font-bold text-red-600">{{ gbmStats ? formatPercentage(gbmStats.medianDrawdown) : '0.0%' }}</p>
      </div>
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <p class="text-xs text-gray-500">Ratio de Sharpe</p>
        <p class="text-sm font-bold" :class="gbmStats && gbmStats.medianSharpe >= 1 ? 'text-emerald-600' : 'text-gray-900'">
          {{ gbmStats ? formatNumber(gbmStats.medianSharpe) : '0.0' }}
        </p>
      </div>
    </div>
    
    <div v-if="gbmResults && gbmResults.simulations && gbmResults.simulations.length > 0" class="mt-3 bg-gray-50 p-3 rounded-lg">
      <h4 class="font-medium text-gray-700 mb-2 text-sm">Interprétation</h4>
      <p class="text-sm font-bold mb-2" 
         :class="{
           'text-green-600': gbmStats && gbmStats.medianReturn > 15 && gbmStats.profitProbability > 0.8,
           'text-blue-600': gbmStats && gbmStats.medianReturn > 0 && gbmStats.profitProbability > 0.6,
           'text-amber-600': gbmStats && gbmStats.medianReturn > 0 && gbmStats.profitProbability <= 0.6,
           'text-red-600': gbmStats && gbmStats.medianReturn <= 0
         }">
        {{ gbmStats && gbmStats.medianReturn > 15 && gbmStats.profitProbability > 0.8 ? 'Modèle très favorable' :
           gbmStats && gbmStats.medianReturn > 0 && gbmStats.profitProbability > 0.6 ? 'Modèle favorable' :
           gbmStats && gbmStats.medianReturn > 0 && gbmStats.profitProbability <= 0.6 ? 'Modèle incertain' :
           'Modèle défavorable' }}
      </p>
      <p class="text-xs text-gray-600">
        Le modèle de Geometric Brownian Motion (GBM) simule l'évolution possible de votre capital selon 
        un rendement moyen (μ) de {{ formatPercentage(gbmParams.mu * 100) }} et une volatilité (σ) de {{ formatPercentage(gbmParams.sigma * 100) }}. 
        Sur un horizon de {{ Math.round(gbmParams.timeHorizon * 252) }} jours de trading, le rendement médian projeté est de 
        {{ gbmStats ? formatPercentage(gbmStats.medianReturn) : '0%' }} avec une probabilité de profit de 
        {{ gbmStats ? formatPercentage(gbmStats.profitProbability * 100) : '0%' }}.
      </p>
      <div class="flex justify-between mt-2 text-xs font-medium">
        <span class="text-red-600">Drawdown max: {{ gbmStats ? formatPercentage(gbmStats.medianDrawdown) : '0%' }}</span>
        <span class="text-blue-600">Sharpe Ratio: {{ gbmStats ? formatNumber(gbmStats.medianSharpe) : '0' }}</span>
        <span class="text-green-600">Prob. profit: {{ gbmStats ? formatPercentage(gbmStats.profitProbability * 100) : '0%' }}</span>
      </div>
        </div>
      </div>
    </div>
    
    <!-- Widgets Investing.com (pleine largeur) -->
    <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Informations Marché
      </h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-gray-50 rounded-lg p-4 transition-all duration-300 hover:shadow-md overflow-hidden">
          <iframe src="https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=2,3&features=datepicker,timezone,timeselector,filters&countries=6,37,5,22,35,4,72&calType=week&timeZone=58&lang=5" width="100%" height="467" frameborder="0" allowtransparency="true" marginwidth="0" marginheight="0"></iframe>
          <div class="poweredBy" style="font-family: Arial, Helvetica, sans-serif;">
            <span style="font-size: 11px;color: #333333;text-decoration: none;">Calendrier économique fourni par <a href="https://fr.investing.com/" rel="nofollow" target="_blank" style="font-size: 11px;color: #06529D; font-weight: bold;" class="underline_link">Investing.com France</a>, portail leader de la bourse.</span>
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg p-4 transition-all duration-300 hover:shadow-md overflow-hidden">
          <iframe src="https://ssltsw.investing.com?lang=5&forex=1,3,9,2,5,6,4&commodities=8830,8836,8831,8849,8833,8862,8832&indices=172,175,166,179,27,170,174&stocks=345,346,347,348,349,350,352&tabs=1,2,3,4" width="100%" height="467"></iframe>
          <div class="poweredBy" style="font-family:arial,helvetica,sans-serif; direction:ltr;">
            <span style="font-size: 11px;color: #333333;text-decoration: none;">Widget Résumé technique fourni par <a href="https://fr.investing.com/" rel="nofollow" target="_blank" style="font-size: 11px;color: #06529D; font-weight: bold;" class="underline_link">Investing.com France</a>.</span>
          </div>
        </div>
      </div>
      
      <!-- Deuxième rangée de widgets -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div class="bg-gray-50 rounded-lg p-4 transition-all duration-300 hover:shadow-md overflow-hidden">
          <iframe frameborder="0" scrolling="no" height="253" width="100%" allowtransparency="true" marginwidth="0" marginheight="0" src="https://ssltools.investing.com/technical_summary.php?pairs=166,170,172,175,178&curr-name-color=%230059B0&fields=5m,15m,1h,1d&force_lang=5"></iframe>
          <div class="poweredBy" style="font-family: Arial, Helvetica, sans-serif;">
            <span style="font-size: 11px;color: #333333;text-decoration: none;">Analyse technique fournie par <a href="https://fr.investing.com/" rel="nofollow" target="_blank" style="font-size: 11px;color: #06529D; font-weight: bold;" class="underline_link">Investing.com France</a>.</span>
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg p-4 transition-all duration-300 hover:shadow-md overflow-hidden flex flex-col items-center justify-center">
          <iframe frameborder="0" scrolling="no" height="150" width="350" allowtransparency="true" marginwidth="0" marginheight="0" src="https://sslirates.investing.com/index.php?rows=5&bg1=FFFFFF&bg2=F1F5F8&text_color=333333&enable_border=show&border_color=0452A1&header_bg=0452A1&header_text=FFFFFF&force_lang=5"></iframe>
          <div class="mt-2">
            <table width="200">
              <tbody>
                <tr>
                  <td style="text-align:left">
                    <a href="//www.investing.com" rel="nofollow" target="_blank">
                      <img style="vertical-align:middle;" title="Investing.com" alt="Investing.com" border="0" src="https://92f8049275b46d631f32-c598b43a8fdedd4f0b9230706bd7ad18.ssl.cf1.rackcdn.com/forexpros_en_logo.png">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="font-size: 11px;color: #333333;text-decoration: none;">Taux d'Intérêt fournis par <a href="https://fr.investing.com/" rel="nofollow" target="_blank" style="font-size: 11px;color: #06529D; font-weight: bold;" class="underline_link">Investing.com France</a>.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Trades Table -->
    <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Historique des Trades
        </h2>
        <button 
          @click="showAddModal = true" 
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Ajouter un Trade
        </button>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('symbol')"
              >
                <div class="flex items-center space-x-1">
                  <span>Symbole</span>
                  <span v-if="sortBy === 'symbol'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('timeframe')"
              >
                <div class="flex items-center space-x-1">
                  <span>Timeframe</span>
                  <span v-if="sortBy === 'timeframe'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('direction')"
              >
                <div class="flex items-center space-x-1">
                  <span>Direction</span>
                  <span v-if="sortBy === 'direction'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('quantity')"
              >
                <div class="flex items-center space-x-1">
                  <span>Quantité</span>
                  <span v-if="sortBy === 'quantity'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('risk')"
              >
                <div class="flex items-center space-x-1">
                  <span>Risque</span>
                  <span v-if="sortBy === 'risk'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('entryDate')"
              >
                <div class="flex items-center space-x-1">
                  <span>Date d'entrée</span>
                  <span v-if="sortBy === 'entryDate'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('exitDate')"
              >
                <div class="flex items-center space-x-1">
                  <span>Date de sortie</span>
                  <span v-if="sortBy === 'exitDate'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('duration')"
              >
                <div class="flex items-center space-x-1">
                  <span>Durée (h)</span>
                  <span v-if="sortBy === 'duration'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                @click="changeSortBy('profitLoss')"
              >
                <div class="flex items-center space-x-1">
                  <span>P/L (%)</span>
                  <span v-if="sortBy === 'profitLoss'" class="text-gray-700">
                    <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="trade in sortedTrades" :key="trade.id" class="transition-colors duration-150 hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ trade.symbol }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ trade.timeframe === '1m' ? '1 minute' :
                   trade.timeframe === '5m' ? '5 minutes' :
                   trade.timeframe === '15m' ? '15 minutes' :
                   trade.timeframe === '30m' ? '30 minutes' :
                   trade.timeframe === '1h' ? '1 heure' :
                   trade.timeframe === '4h' ? '4 heures' :
                   trade.timeframe === '1d' ? '1 jour' :
                   trade.timeframe === '1w' ? '1 semaine' : trade.timeframe
                }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full py-1" :class="trade.direction === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                  {{ trade.direction }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ trade.quantity }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {{ trade.risk }}%
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(trade.entryDate) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(trade.exitDate) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ calculateDuration(trade.entryDate, trade.exitDate) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" :class="trade.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
                <div class="flex items-center">
                  <span class="mr-1">{{ trade.profitLoss >= 0 ? '+' : '' }}{{ trade.profitLoss }}%</span>
                  <svg v-if="trade.profitLoss >= 0" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div class="flex max-w-xs overflow-hidden">
                  <span class="truncate">{{ trade.notes }}</span>
                  <button v-if="trade.notes" class="ml-1 text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="flex items-center space-x-2 justify-center">
                  <button
                    @click="editTrade(trade)"
                    class="text-indigo-600 hover:text-indigo-900 transition-colors duration-150 p-1 rounded-full hover:bg-indigo-50"
                    title="Modifier"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="tradingStore.deleteTrade(trade.id)"
                    class="text-red-600 hover:text-red-900 transition-colors duration-150 p-1 rounded-full hover:bg-red-50"
                    title="Supprimer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="sortedTrades.length === 0">
              <td colspan="11" class="px-6 py-10 text-center text-gray-500">
                <div class="flex flex-col items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p class="text-lg font-medium mb-1">Aucune transaction</p>
                  <p class="text-sm mb-4">Ajoutez votre première transaction en cliquant sur le bouton "Ajouter un Trade".</p>
                  <button
                    @click="showAddModal = true"
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Ajouter un Trade
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal d'Ajout de Trade -->
    <div v-if="showAddModal" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Ajouter un Nouveau Trade</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Symbole</label>
                <select v-model="newTrade.symbol" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="SP500">SP500</option>
                  <option value="NS100">NS100</option>
                  <option value="DAX40">DAX40</option>
                  <option value="XAAUSD">XAAUSD</option>
                  <option value="BTC">BTC</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Direction</label>
                <select v-model="newTrade.direction" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="LONG">Long</option>
                  <option value="SHORT">Short</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">P/L (en %)</label>
                <input type="number" v-model="newTrade.profitLoss" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Quantité</label>
                <input type="number" v-model="newTrade.quantity" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Timeframe</label>
                <select v-model="newTrade.timeframe" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="1m">1 minute</option>
                  <option value="5m">5 minutes</option>
                  <option value="15m">15 minutes</option>
                  <option value="30m">30 minutes</option>
                  <option value="1h">1 heure</option>
                  <option value="4h">4 heures</option>
                  <option value="1d">1 jour</option>
                  <option value="1w">1 semaine</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Risque</label>
                <select v-model="newTrade.risk" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="0.25">0.25%</option>
                  <option value="0.5">0.5%</option>
                  <option value="1">1%</option>
                  <option value="1.5">1.5%</option>
                  <option value="2">2%</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Date et Heure d'Entrée</label>
                <input type="datetime-local" v-model="newTrade.entryDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Date et Heure de Sortie</label>
                <input type="datetime-local" v-model="newTrade.exitDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Notes</label>
                <textarea v-model="newTrade.notes" rows="3" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"></textarea>
              </div>
              
              <div class="border-t border-gray-200 pt-4 mt-4">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Frais et Commissions</h4>
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Frais</label>
                    <input type="number" step="0.01" v-model="newTrade.fees" placeholder="0.00" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Spread</label>
                    <input type="number" step="0.01" v-model="newTrade.spread" placeholder="0.00" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Commission</label>
                    <input type="number" step="0.01" v-model="newTrade.commission" placeholder="0.00" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="button"
              @click="addTrade"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
            >
              Ajouter
            </button>
            <button
              type="button"
              @click="showAddModal = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal d'Édition de Trade -->
    <div v-if="showEditModal && editingTrade" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Modifier le Trade</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Symbole</label>
                <select v-model="editingTrade.symbol" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="SP500">SP500</option>
                  <option value="NS100">NS100</option>
                  <option value="DAX40">DAX40</option>
                  <option value="XAAUSD">XAAUSD</option>
                  <option value="BTC">BTC</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Direction</label>
                <select v-model="editingTrade.direction" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="LONG">Long</option>
                  <option value="SHORT">Short</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">P/L (en %)</label>
                <input type="number" v-model="editingTrade.profitLoss" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Quantité</label>
                <input type="number" v-model="editingTrade.quantity" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Timeframe</label>
                <select v-model="editingTrade.timeframe" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="1m">1 minute</option>
                  <option value="5m">5 minutes</option>
                  <option value="15m">15 minutes</option>
                  <option value="30m">30 minutes</option>
                  <option value="1h">1 heure</option>
                  <option value="4h">4 heures</option>
                  <option value="1d">1 jour</option>
                  <option value="1w">1 semaine</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Risque</label>
                <select v-model="editingTrade.risk" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="0.25">0.25%</option>
                  <option value="0.5">0.5%</option>
                  <option value="1">1%</option>
                  <option value="1.5">1.5%</option>
                  <option value="2">2%</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Date et Heure d'Entrée</label>
                <input type="datetime-local" v-model="editingTrade.entryDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Date et Heure de Sortie</label>
                <input type="datetime-local" v-model="editingTrade.exitDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Notes</label>
                <textarea v-model="editingTrade.notes" rows="3" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"></textarea>
              </div>
              
              <div class="border-t border-gray-200 pt-4 mt-4">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Frais et Commissions</h4>
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Frais</label>
                    <input type="number" step="0.01" v-model="editingTrade.fees" placeholder="0.00" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Spread</label>
                    <input type="number" step="0.01" v-model="editingTrade.spread" placeholder="0.00" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Commission</label>
                    <input type="number" step="0.01" v-model="editingTrade.commission" placeholder="0.00" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="button"
              @click="updateTrade"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
            >
              Enregistrer
            </button>
            <button
              type="button"
              @click="showEditModal = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal d'Archivage -->
    <div v-if="showArchiveModal" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div>
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8l6 6m0 0l6-6m-6 6V3m-9 5a2 2 0 002 2h10a2 2 0 002-2M7 19h10a2 2 0 002-2v-1a2 2 0 00-2-2H7a2 2 0 00-2 2v1a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 text-center mb-4">Archiver la Stratégie</h3>
            
            <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-blue-700">
                    Cette action va :
                  </p>
                  <ul class="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
                    <li>Sauvegarder {{ tradingStore.trading.trades.length }} trades dans les archives</li>
                    <li>Réinitialiser le capital au niveau actuel ({{ currentCapital.toFixed(2) }}€)</li>
                    <li>Effacer tous les trades pour repartir sur un nouvel échantillon</li>
                  </ul>
                  <p class="mt-2 text-sm text-blue-700 font-medium">
                    Cette action est irréversible.
                  </p>
                </div>
              </div>
            </div>

            <div class="mb-4">
              <label for="archive-name" class="block text-sm font-medium text-gray-700 mb-2">
                Nom de l'archive
              </label>
              <input 
                id="archive-name"
                type="text" 
                v-model="archiveName" 
                placeholder="Ex: Stratégie Q1 2024, Test Breakout, etc."
                class="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                @keyup.enter="confirmArchive"
              />
            </div>

            <div class="bg-gray-50 rounded-lg p-3 mb-4">
              <h4 class="text-sm font-medium text-gray-700 mb-3">Résumé de la période actuelle :</h4>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Trades :</span>
                  <span class="font-medium">{{ tradingStore.trading.trades.length }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Performance :</span>
                  <span class="font-medium" :class="performancePercent >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ performancePercent >= 0 ? '+' : '' }}{{ performancePercent.toFixed(2) }}%
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Win Rate :</span>
                  <span class="font-medium" :class="{
                    'text-green-600': tradingStats.winRate >= 60,
                    'text-blue-600': tradingStats.winRate >= 50 && tradingStats.winRate < 60,
                    'text-yellow-600': tradingStats.winRate >= 40 && tradingStats.winRate < 50,
                    'text-red-600': tradingStats.winRate < 40
                  }">
                    {{ tradingStats.winRate.toFixed(1) }}%
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Drawdown Max :</span>
                  <span class="font-medium text-red-600">{{ tradingStats.maxDrawdown.toFixed(2) }}%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Capital initial :</span>
                  <span class="font-medium">{{ tradingStore.initialCapital.toFixed(0) }}€</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Capital actuel :</span>
                  <span class="font-medium">{{ currentCapital.toFixed(0) }}€</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="button"
              @click="confirmArchive"
              :disabled="!archiveName.trim()"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:col-start-2 sm:text-sm transition-colors duration-150"
              :class="archiveName.trim() 
                ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500' 
                : 'bg-gray-400 cursor-not-allowed'"
            >
              Archiver
            </button>
            <button
              type="button"
              @click="showArchiveModal = false; archiveName = ''"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template> 