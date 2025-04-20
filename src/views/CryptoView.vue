<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTradingStore } from '../stores/trading';
import type { CryptoPosition } from '../types/trading';
import { Pie, Doughnut, Line, Bar } from 'vue-chartjs';
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
  Legend
} from 'chart.js';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import { apiService, CryptoIndicators } from '../services/api';
import axios from 'axios';
import { useCryptoStore } from '../stores/crypto';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// URL de base de l'API Binance
const BINANCE_API_URL = 'https://api1.binance.com/api/v3';

const tradingStore = useTradingStore();
const showAddModal = ref(false);
const sortBy = ref('symbol');
const sortDirection = ref('asc');
const showDeleteModal = ref(false);

// Format des dates pour l'affichage
const formatDate = (date: Date) => {
  return date.toLocaleDateString('fr-FR');
};

// Type pour le poids de la police
type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter';

// Positions triées
const sortedPositions = computed(() => {
  if (!tradingStore.crypto.positions.length) return [];
  
  return [...tradingStore.crypto.positions].sort((a, b) => {
    let valueA, valueB;
    
    if (sortBy.value === 'symbol') {
      valueA = a.symbol;
      valueB = b.symbol;
    } else if (sortBy.value === 'quantity') {
      valueA = a.quantity;
      valueB = b.quantity;
    } else if (sortBy.value === 'averageEntryPrice') {
      valueA = a.averageEntryPrice;
      valueB = b.averageEntryPrice;
    } else if (sortBy.value === 'currentPrice') {
      valueA = a.currentPrice;
      valueB = b.currentPrice;
    } else if (sortBy.value === 'profitLoss') {
      valueA = a.profitLoss;
      valueB = b.profitLoss;
    } else if (sortBy.value === 'totalValue') {
      valueA = a.quantity * a.currentPrice;
      valueB = b.quantity * b.currentPrice;
    } else {
      valueA = a[sortBy.value as keyof CryptoPosition];
      valueB = b[sortBy.value as keyof CryptoPosition];
    }
    
    // Direction du tri
    const direction = sortDirection.value === 'asc' ? 1 : -1;
    
    // Tri
    if (valueA === undefined && valueB === undefined) return 0;
    if (valueA === undefined) return 1 * direction;
    if (valueB === undefined) return -1 * direction;
    if (valueA < valueB) return -1 * direction;
    if (valueA > valueB) return 1 * direction;
    return 0;
  });
});

// Calcul de la valeur totale du portfolio
const totalPortfolioValue = computed(() => {
  return sortedPositions.value.reduce((total, position) => {
    return total + (position.quantity * position.currentPrice);
  }, 0);
});

// Calcul du coût total initial
const totalInitialCost = computed(() => {
  return sortedPositions.value.reduce((total, position) => {
    return total + (position.quantity * position.averageEntryPrice);
  }, 0);
});

// Calcul de la performance totale en pourcentage
const totalPerformance = computed(() => {
  if (totalInitialCost.value === 0) return 0;
  return ((totalPortfolioValue.value - totalInitialCost.value) / totalInitialCost.value) * 100;
});

// Définition des couleurs pour les graphiques et autres éléments visuels
const backgroundColors = [
  '#4F46E5', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#20B2AA', // turquoise
  '#FF8C00', // dark orange
  '#7CFC00'  // lime green
];

// Données pour graphique de répartition du portfolio combiné (Binance + Ledger) sans doublons
const portfolioAllocationData = computed(() => {
  const allPositions = [...userPortfolio.value, ...ledgerPortfolio.value];
  if (!allPositions.length) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  // Regrouper les positions par symbole pour éviter les doublons
  const mergedPositions = allPositions.reduce((result: Record<string, {symbol: string, totalValue: number}>, position) => {
    const symbol = position.symbol;
    
    if (!result[symbol]) {
      result[symbol] = {
        symbol,
        totalValue: 0
      };
    }
    
    result[symbol].totalValue += position.totalValue;
    
    return result;
  }, {});
  
  // Convertir en tableau
  const uniquePositions = Object.values(mergedPositions);
  
  // Calculer la valeur totale
  const totalValue = uniquePositions.reduce((sum, position) => {
    return sum + position.totalValue;
  }, 0);
  
  if (totalValue === 0) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  return {
    labels: uniquePositions.map(p => p.symbol),
    datasets: [
      {
        data: uniquePositions.map(p => (p.totalValue / totalValue) * 100),
        backgroundColor: uniquePositions.map((_, index) => backgroundColors[index % backgroundColors.length])
      }
    ]
  };
});

// Ajouter un graphique pour la répartition Binance vs Ledger
const walletDistributionData = computed(() => {
  const binanceTotal = totalPortfolioValueUSD.value;
  const ledgerTotal = totalLedgerPortfolioValueUSD.value;
  const totalValue = binanceTotal + ledgerTotal;
  
  if (totalValue === 0) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  return {
    labels: ['Binance', 'Ledger'],
    datasets: [
      {
        data: [
          (binanceTotal / totalValue) * 100,
          (ledgerTotal / totalValue) * 100
        ],
        backgroundColor: ['#F59E0B', '#3B82F6']
      }
    ]
  };
});

// Données pour graphique de performance par actif des portefeuilles combinés sans doublons
const assetPerformanceData = computed(() => {
  const allPositions = [...userPortfolio.value, ...ledgerPortfolio.value];
  if (!allPositions.length) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  // Regrouper les positions par symbole pour éviter les doublons
  const mergedPositionsMap = allPositions.reduce((result: Record<string, {
    symbol: string, 
    totalValue: number,
    initialValue: number,
    profitLoss: number,
    profitLossPercentage: number
  }>, position) => {
    const symbol = position.symbol;
    
    if (!result[symbol]) {
      result[symbol] = {
        symbol,
        totalValue: 0,
        initialValue: 0,
        profitLoss: 0,
        profitLossPercentage: 0
      };
    }
    
    // Accumuler les valeurs
    result[symbol].totalValue += position.totalValue;
    const initialPositionValue = position.quantity * position.averageBuyPrice;
    result[symbol].initialValue += initialPositionValue;
    result[symbol].profitLoss += position.profitLoss;
    
    return result;
  }, {});
  
  // Calculer les pourcentages de performance globaux pour chaque actif
  Object.values(mergedPositionsMap).forEach(position => {
    position.profitLossPercentage = position.initialValue > 0 
      ? (position.profitLoss / position.initialValue) * 100 
      : 0;
  });
  
  // Convertir en tableau
  const uniquePositions = Object.values(mergedPositionsMap);
  
  // Récupérer les pourcentages de profit/perte consolidés
  const performanceData = uniquePositions.map(p => p.profitLossPercentage);
  
  return {
    labels: uniquePositions.map(p => p.symbol),
    datasets: [
      {
        label: 'Performance (%)',
        data: performanceData,
        backgroundColor: performanceData.map(perf => perf >= 0 ? '#10B981' : '#EF4444')
      }
    ]
  };
});

// Données pour le graphique d'équité des portefeuilles combinés
const equityChartData = computed(() => {
  // On utilise la valeur actuelle combinée des portefeuilles
  const combinedValue = totalPortfolioValueUSD.value + totalLedgerPortfolioValueUSD.value;
  
  // Créons un historique simplifié (aujourd'hui et l'investissement initial)
  const today = new Date();
  const labels = [
    formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)), // 30 jours avant
    formatDate(today)
  ];
  
  const data = [
    totalInitialInvestment.value,
    combinedValue
  ];
  
  return {
    labels: labels,
    datasets: [
      {
        label: 'Valeur des Portefeuilles',
        data: data,
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
});

// Mise à jour des options des graphiques
const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        font: {
          size: 12
        },
        padding: 15
      }
    },
    title: {
      display: true,
      text: 'Répartition du Portfolio',
      font: {
        size: 14,
        weight: 'bold' as FontWeight
      },
      padding: {
        bottom: 10
      }
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          const value = context.raw;
          return `${context.label}: ${value.toFixed(1)}%`;
        }
      },
      backgroundColor: 'rgba(46, 52, 64, 0.9)',
      titleFont: {
        size: 13
      },
      bodyFont: {
        size: 12
      },
      padding: 10,
      borderColor: 'rgba(192, 198, 211, 0.3)',
      borderWidth: 1
    }
  }
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  scales: {
    x: {
      beginAtZero: true,
      grid: {
        color: 'rgba(192, 198, 211, 0.2)'
      },
      ticks: {
        color: 'var(--color-gray-600)',
        font: {
          size: 11
        }
      },
      title: {
        display: true,
        text: 'Performance (%)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as FontWeight
        }
      }
    },
    y: {
      grid: {
        display: false
      },
      ticks: {
        color: 'var(--color-gray-700)',
        font: {
          size: 11
        }
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: true,
      text: 'Performance par Actif',
      font: {
        size: 14,
        weight: 'bold' as FontWeight
      },
      padding: {
        bottom: 10
      }
    },
    tooltip: {
      backgroundColor: 'rgba(46, 52, 64, 0.9)',
      titleFont: {
        size: 13
      },
      bodyFont: {
        size: 12
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
      text: 'Évolution du Portfolio',
      font: {
        size: 14,
        weight: 'bold' as FontWeight
      }
    },
    tooltip: {
      backgroundColor: 'rgba(46, 52, 64, 0.9)',
      mode: 'index' as 'index',
      intersect: false
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(192, 198, 211, 0.2)'
      },
      ticks: {
        color: 'var(--color-gray-600)',
        font: {
          size: 11
        }
      },
      title: {
        display: true,
        text: 'Valeur (€)',
        color: 'var(--color-gray-700)',
        font: {
          size: 12,
          weight: 'bold' as FontWeight
        }
      }
    },
    x: {
      grid: {
        color: 'rgba(192, 198, 211, 0.2)',
        drawBorder: false
      },
      ticks: {
        color: 'var(--color-gray-600)',
        font: {
          size: 11
        }
      }
    }
  },
  elements: {
    line: {
      tension: 0.4,
      borderWidth: 2
    },
    point: {
      radius: 3,
      hoverRadius: 5
    }
  }
};

// Fonction pour changer le tri
function changeSortBy(column: string) {
  if (sortBy.value === column) {
    // Changer la direction si on clique sur la même colonne
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // Nouvelle colonne, réinitialiser à 'asc' par défaut pour les symboles, 'desc' pour les valeurs
    sortBy.value = column;
    sortDirection.value = column === 'symbol' ? 'asc' : 'desc';
  }
}

const newPosition = ref({
  symbol: '',
  quantity: 0,
  averageEntryPrice: 0,
  currentPrice: 0,
  entryDate: new Date()
});

const addPosition = () => {
  const profitLoss = (newPosition.value.currentPrice - newPosition.value.averageEntryPrice) * newPosition.value.quantity;

  tradingStore.addCryptoPosition({
    ...newPosition.value,
    profitLoss
  });
  
  showAddModal.value = false;
  newPosition.value = {
    symbol: '',
    quantity: 0,
    averageEntryPrice: 0,
    currentPrice: 0,
    entryDate: new Date()
  };
};

// Périodes disponibles
const timeframes = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' }
];

const selectedTimeframe = ref('all');

// Filtrer les positions par période d'ajout
const filteredPositions = computed(() => {
  const now = new Date();
  const positions = sortedPositions.value;
  
  switch (selectedTimeframe.value) {
    case 'week':
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return positions.filter(position => new Date(position.entryDate) >= oneWeekAgo);
    case 'month':
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return positions.filter(position => new Date(position.entryDate) >= oneMonthAgo);
    case 'year':
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return positions.filter(position => new Date(position.entryDate) >= oneYearAgo);
    default:
      return positions;
  }
});

const confirmDeleteAll = () => {
  showDeleteModal.value = true;
};

const deleteAllData = () => {
  tradingStore.deleteAllTrades();
  showDeleteModal.value = false;
};

// Fonctions pour gérer la modification et la suppression des positions
const editPosition = (position: CryptoPosition) => {
  // Cette fonction pourrait ouvrir un modal d'édition
  console.log('Édition de la position:', position);
  // Implémentation à venir
};

const deletePosition = (id: string) => {
  tradingStore.deleteCryptoPosition(id);
};

// Ajout des états pour les indicateurs crypto
const cryptoIndicators = ref<CryptoIndicators | null>(null)
const isLoadingIndicators = ref(true)
const hasIndicatorError = ref(false)

// Ajout des états pour les prix Binance
const topCryptoPrices = ref<{symbol: string, price: number, change24h: number}[]>([])
const isLoadingPrices = ref(true)
const hasPricesError = ref(false)

// Ajout des états pour le portefeuille utilisateur Binance
const userPortfolio = ref<any[]>([])
const isLoadingPortfolio = ref(true)
const hasPortfolioError = ref(false)
const totalPortfolioValueUSD = ref(0)
const totalPortfolioProfitLoss = ref(0)
const totalPortfolioProfitLossPercentage = ref(0)

// Ajout des états pour le portefeuille Ledger
const ledgerPortfolio = ref<any[]>([])
const isLoadingLedgerPortfolio = ref(true)
const hasLedgerPortfolioError = ref(false)
const totalLedgerPortfolioValueUSD = ref(0)
const totalLedgerPortfolioProfitLoss = ref(0)
const totalLedgerPortfolioProfitLossPercentage = ref(0)

// États pour l'ajout de position Ledger
const showAddLedgerPositionModal = ref(false)
const isAddingLedgerPosition = ref(false)
const addLedgerPositionError = ref('')
const manualLedgerPosition = ref({
  symbol: '',
  quantity: 0,
  averageEntryPrice: 0,
  currentPrice: 0,
  entryDate: new Date()
})

// États pour la modification de position Ledger
const showEditLedgerPositionModal = ref(false)
const editingLedgerPosition = ref<any>(null)
const isEditingLedgerPosition = ref(false)
const editLedgerPositionError = ref('')

// Ajout des variables pour le rafraîchissement en temps réel
const indicatorsRefreshTimerId = ref<number | null>(null)
const nextRefreshCountdown = ref(60)
const isRefreshingIndicators = ref(false)
const lastRefreshTime = ref<Date | null>(null)

// Ajouter ces variables d'état pour le tri après les autres variables de portfolio
const binanceSortBy = ref('symbol')
const binanceSortDirection = ref('asc')
const ledgerSortBy = ref('symbol')
const ledgerSortDirection = ref('asc')

// Ajouter les fonctions de tri pour les deux portefeuilles
function changeBinanceSortBy(column: string) {
  if (binanceSortBy.value === column) {
    // Changer la direction si on clique sur la même colonne
    binanceSortDirection.value = binanceSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Nouvelle colonne, réinitialiser à 'asc' par défaut pour les symboles, 'desc' pour les valeurs
    binanceSortBy.value = column
    binanceSortDirection.value = column === 'symbol' ? 'asc' : 'desc'
  }
}

function changeLedgerSortBy(column: string) {
  if (ledgerSortBy.value === column) {
    // Changer la direction si on clique sur la même colonne
    ledgerSortDirection.value = ledgerSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Nouvelle colonne, réinitialiser à 'asc' par défaut pour les symboles, 'desc' pour les valeurs
    ledgerSortBy.value = column
    ledgerSortDirection.value = column === 'symbol' ? 'asc' : 'desc'
  }
}

// Ajouter les computed properties pour les portefeuilles triés
const sortedBinancePortfolio = computed(() => {
  if (!userPortfolio.value.length) return []
  
  return [...userPortfolio.value].sort((a, b) => {
    if (binanceSortDirection.value === 'asc') {
      if (binanceSortBy.value === 'symbol') return a.symbol.localeCompare(b.symbol)
      if (binanceSortBy.value === 'quantity') return a.quantity - b.quantity
      if (binanceSortBy.value === 'averageBuyPrice') return a.averageBuyPrice - b.averageBuyPrice
      if (binanceSortBy.value === 'currentPrice') return a.currentPrice - b.currentPrice
      if (binanceSortBy.value === 'totalValue') return a.totalValue - b.totalValue
      if (binanceSortBy.value === 'profitLoss') return a.profitLoss - b.profitLoss
      if (binanceSortBy.value === 'profitLossPercentage') return a.profitLossPercentage - b.profitLossPercentage
      if (binanceSortBy.value === 'change24h') return a.change24h - b.change24h
      if (binanceSortBy.value === 'change7d') return a.change7d - b.change7d
      if (binanceSortBy.value === 'change30d') return a.change30d - b.change30d
    } else {
      if (binanceSortBy.value === 'symbol') return b.symbol.localeCompare(a.symbol)
      if (binanceSortBy.value === 'quantity') return b.quantity - a.quantity
      if (binanceSortBy.value === 'averageBuyPrice') return b.averageBuyPrice - a.averageBuyPrice
      if (binanceSortBy.value === 'currentPrice') return b.currentPrice - a.currentPrice
      if (binanceSortBy.value === 'totalValue') return b.totalValue - a.totalValue
      if (binanceSortBy.value === 'profitLoss') return b.profitLoss - a.profitLoss
      if (binanceSortBy.value === 'profitLossPercentage') return b.profitLossPercentage - a.profitLossPercentage
      if (binanceSortBy.value === 'change24h') return b.change24h - a.change24h
      if (binanceSortBy.value === 'change7d') return b.change7d - a.change7d
      if (binanceSortBy.value === 'change30d') return b.change30d - a.change30d
    }
    return 0
  })
})

const sortedLedgerPortfolio = computed(() => {
  if (!ledgerPortfolio.value.length) return []
  
  return [...ledgerPortfolio.value].sort((a, b) => {
    if (ledgerSortDirection.value === 'asc') {
      if (ledgerSortBy.value === 'symbol') return a.symbol.localeCompare(b.symbol)
      if (ledgerSortBy.value === 'quantity') return a.quantity - b.quantity
      if (ledgerSortBy.value === 'averageBuyPrice') return a.averageBuyPrice - b.averageBuyPrice
      if (ledgerSortBy.value === 'currentPrice') return a.currentPrice - b.currentPrice
      if (ledgerSortBy.value === 'totalValue') return a.totalValue - b.totalValue
      if (ledgerSortBy.value === 'profitLoss') return a.profitLoss - b.profitLoss
      if (ledgerSortBy.value === 'profitLossPercentage') return a.profitLossPercentage - b.profitLossPercentage
      if (ledgerSortBy.value === 'change24h') return a.change24h - b.change24h
      if (ledgerSortBy.value === 'change7d') return a.change7d - b.change7d
      if (ledgerSortBy.value === 'change30d') return a.change30d - b.change30d
    } else {
      if (ledgerSortBy.value === 'symbol') return b.symbol.localeCompare(a.symbol)
      if (ledgerSortBy.value === 'quantity') return b.quantity - a.quantity
      if (ledgerSortBy.value === 'averageBuyPrice') return b.averageBuyPrice - a.averageBuyPrice
      if (ledgerSortBy.value === 'currentPrice') return b.currentPrice - a.currentPrice
      if (ledgerSortBy.value === 'totalValue') return b.totalValue - a.totalValue
      if (ledgerSortBy.value === 'profitLoss') return b.profitLoss - a.profitLoss
      if (ledgerSortBy.value === 'profitLossPercentage') return b.profitLossPercentage - a.profitLossPercentage
      if (ledgerSortBy.value === 'change24h') return b.change24h - a.change24h
      if (ledgerSortBy.value === 'change7d') return b.change7d - a.change7d
      if (ledgerSortBy.value === 'change30d') return b.change30d - a.change30d
    }
    return 0
  })
})

// Fonction pour récupérer les indicateurs de marché crypto
async function fetchCryptoIndicators() {
  isLoadingIndicators.value = true
  hasIndicatorError.value = false
  
  try {
    cryptoIndicators.value = await apiService.getCryptoIndicators()
    lastRefreshTime.value = new Date()
    
    // Mettre à jour les données dans le tradingStore pour qu'elles soient affichées dans l'interface
    if (cryptoIndicators.value) {
      tradingStore.cryptoMetrics.btcFearGreedIndex = cryptoIndicators.value.btcFearGreedIndex || 0
      tradingStore.cryptoMetrics.btcDominance = cryptoIndicators.value.btcDominance || 0
      tradingStore.cryptoMetrics.altcoinSeasonIndex = cryptoIndicators.value.altcoinSeasonIndex || 0
      
      // Sauvegarder dans le localStorage pour persistance
      localStorage.setItem('cryptoMetrics', JSON.stringify(tradingStore.cryptoMetrics))
    }
    
    console.log('Indicateurs mis à jour:', tradingStore.cryptoMetrics)
  } catch (error) {
    console.error('Error fetching crypto indicators:', error)
    hasIndicatorError.value = true
  } finally {
    isLoadingIndicators.value = false
    isRefreshingIndicators.value = false
  }
}

// Fonction pour récupérer les prix des principales cryptos
async function fetchTopCryptoPrices() {
  isLoadingPrices.value = true
  hasPricesError.value = false
  
  try {
    topCryptoPrices.value = await apiService.getTopCryptoPrices()
  } catch (error) {
    console.error('Erreur lors de la récupération des prix crypto:', error)
    hasPricesError.value = true
  } finally {
    isLoadingPrices.value = false
  }
}

// Fonction pour récupérer le portefeuille de l'utilisateur
async function fetchUserPortfolio() {
  isLoadingPortfolio.value = true
  hasPortfolioError.value = false
  
  try {
    userPortfolio.value = await apiService.getUserPortfolio()
    
    // Calculer les totaux
    totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
    totalPortfolioProfitLoss.value = userPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
    
    // Calculer le pourcentage total
    const totalInitialValue = userPortfolio.value.reduce(
      (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
      0
    )
    totalPortfolioProfitLossPercentage.value = 
      (totalPortfolioProfitLoss.value / totalInitialValue) * 100
  } catch (error) {
    console.error('Erreur lors de la récupération du portefeuille utilisateur:', error)
    hasPortfolioError.value = true
  } finally {
    isLoadingPortfolio.value = false
  }
}

// Fonction pour sauvegarder le portefeuille Binance dans le localStorage
function savePortfolioToLocalStorage() {
  localStorage.setItem('userPortfolio', JSON.stringify(userPortfolio.value))
}

// Fonction pour sauvegarder le portefeuille Ledger dans le localStorage
function saveLedgerPortfolioToLocalStorage() {
  localStorage.setItem('ledgerPortfolio', JSON.stringify(ledgerPortfolio.value))
}

// Fonction pour charger le portefeuille Binance depuis le localStorage
function loadPortfolioFromLocalStorage() {
  isLoadingPortfolio.value = true
  try {
    const savedPortfolio = localStorage.getItem('userPortfolio')
    if (savedPortfolio) {
      userPortfolio.value = JSON.parse(savedPortfolio)
      // Mettre à jour les totaux
      totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
      totalPortfolioProfitLoss.value = userPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
      
      // Calculer le pourcentage total
      const totalInitialValue = userPortfolio.value.reduce(
        (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
        0
      )
      totalPortfolioProfitLossPercentage.value = 
        (totalPortfolioProfitLoss.value / totalInitialValue) * 100
    } else {
      // Si aucun portefeuille n'est trouvé, initialiser avec un tableau vide
      userPortfolio.value = []
      totalPortfolioValueUSD.value = 0
      totalPortfolioProfitLoss.value = 0
      totalPortfolioProfitLossPercentage.value = 0
    }
  } catch (error) {
    console.error('Erreur lors du chargement du portefeuille:', error)
    hasPortfolioError.value = true
    userPortfolio.value = []
  } finally {
    // Toujours mettre fin à l'état de chargement, même en cas d'erreur
    isLoadingPortfolio.value = false
  }
}

// Fonction pour charger le portefeuille Ledger depuis le localStorage
function loadLedgerPortfolioFromLocalStorage() {
  isLoadingLedgerPortfolio.value = true
  try {
    const savedPortfolio = localStorage.getItem('ledgerPortfolio')
    if (savedPortfolio) {
      ledgerPortfolio.value = JSON.parse(savedPortfolio)
      // Mettre à jour les totaux
      totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
      totalLedgerPortfolioProfitLoss.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
      
      // Calculer le pourcentage total
      const totalInitialValue = ledgerPortfolio.value.reduce(
        (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
        0
      )
      totalLedgerPortfolioProfitLossPercentage.value = 
        (totalLedgerPortfolioProfitLoss.value / totalInitialValue) * 100
    } else {
      // Si aucun portefeuille n'est trouvé, initialiser avec un tableau vide
      ledgerPortfolio.value = []
      totalLedgerPortfolioValueUSD.value = 0
      totalLedgerPortfolioProfitLoss.value = 0
      totalLedgerPortfolioProfitLossPercentage.value = 0
    }
  } catch (error) {
    console.error('Erreur lors du chargement du portefeuille Ledger:', error)
    hasLedgerPortfolioError.value = true
    ledgerPortfolio.value = []
  } finally {
    // Toujours mettre fin à l'état de chargement, même en cas d'erreur
    isLoadingLedgerPortfolio.value = false
  }
}

// Fonction pour supprimer une position Binance
function deletePortfolioPosition(symbol: string) {
  userPortfolio.value = userPortfolio.value.filter(asset => asset.symbol !== symbol)
  // Mettre à jour les totaux
  totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
  totalPortfolioProfitLoss.value = userPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
  
  // Calculer le pourcentage total
  const totalInitialValue = userPortfolio.value.reduce(
    (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
    0
  )
  totalPortfolioProfitLossPercentage.value = 
    (totalPortfolioProfitLoss.value / totalInitialValue) * 100
  
  // Sauvegarder dans le localStorage
  savePortfolioToLocalStorage()
}

// Fonction pour supprimer une position Ledger
function deleteLedgerPortfolioPosition(symbol: string) {
  ledgerPortfolio.value = ledgerPortfolio.value.filter(asset => asset.symbol !== symbol)
  // Mettre à jour les totaux
  totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
  totalLedgerPortfolioProfitLoss.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
  
  // Calculer le pourcentage total
  const totalInitialValue = ledgerPortfolio.value.reduce(
    (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
    0
  )
  totalLedgerPortfolioProfitLossPercentage.value = 
    (totalLedgerPortfolioProfitLoss.value / totalInitialValue) * 100
  
  // Sauvegarder dans le localStorage
  saveLedgerPortfolioToLocalStorage()
}

// Fonction pour ouvrir le modal de modification Ledger
function openEditLedgerPositionModal(asset: any) {
  editingLedgerPosition.value = { ...asset }
  showEditLedgerPositionModal.value = true
}

// Fonction pour sauvegarder les modifications Ledger
async function saveLedgerPositionEdit() {
  editLedgerPositionError.value = ''
  isEditingLedgerPosition.value = true
  
  try {
    // Vérification des champs
    if (!editingLedgerPosition.value.symbol || !editingLedgerPosition.value.quantity || !editingLedgerPosition.value.averageBuyPrice) {
      editLedgerPositionError.value = 'Tous les champs sont obligatoires'
      return
    }
    
    // Conversion du symbole en majuscules
    const symbol = editingLedgerPosition.value.symbol.toUpperCase()
    
    // Récupérer le prix actuel depuis Binance
    const tickerSymbol = `${symbol}USDT`
    const tickerResponse = await axios.get(`${BINANCE_API_URL}/ticker/price?symbol=${tickerSymbol}`)
    const currentPrice = parseFloat(tickerResponse.data.price)
    
    if (isNaN(currentPrice)) {
      editLedgerPositionError.value = `Impossible de trouver le prix pour ${symbol}`
      return
    }
    
    // Calculer les nouvelles valeurs
    const quantity = editingLedgerPosition.value.quantity
    const entryPrice = editingLedgerPosition.value.averageBuyPrice
    const totalValue = quantity * currentPrice
    const initialValue = quantity * entryPrice
    const profitLoss = totalValue - initialValue
    const profitLossPercentage = (profitLoss / initialValue) * 100
    
    // Mettre à jour la position dans le tableau
    const index = ledgerPortfolio.value.findIndex(p => p.symbol === editingLedgerPosition.value.symbol)
    if (index !== -1) {
      ledgerPortfolio.value[index] = {
        ...editingLedgerPosition.value,
        currentPrice,
        totalValue,
        profitLoss,
        profitLossPercentage
      }
      
      // Mettre à jour les totaux
      totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
      totalLedgerPortfolioProfitLoss.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
      
      // Calculer le pourcentage total
      const totalInitialValue = ledgerPortfolio.value.reduce(
        (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
        0
      )
      totalLedgerPortfolioProfitLossPercentage.value = 
        (totalLedgerPortfolioProfitLoss.value / totalInitialValue) * 100
      
      // Sauvegarder dans le localStorage
      saveLedgerPortfolioToLocalStorage()
    }
    
    // Fermer le modal
    showEditLedgerPositionModal.value = false
    editingLedgerPosition.value = null
  } catch (error) {
    console.error('Erreur lors de la modification de la position Ledger:', error)
    editLedgerPositionError.value = `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
  } finally {
    isEditingLedgerPosition.value = false
  }
}

// Fonction pour ajouter une position manuelle Ledger
async function addManualLedgerPosition() {
  addLedgerPositionError.value = ''
  isAddingLedgerPosition.value = true
  
  try {
    // Vérification des champs
    if (!manualLedgerPosition.value.symbol || !manualLedgerPosition.value.quantity || !manualLedgerPosition.value.averageEntryPrice) {
      addLedgerPositionError.value = 'Tous les champs sont obligatoires'
      return
    }
    
    // Conversion du symbole en majuscules
    const symbol = manualLedgerPosition.value.symbol.toUpperCase()
    
    // Récupérer le prix actuel depuis Binance
    const tickerSymbol = `${symbol}USDT`
    const tickerResponse = await axios.get(`${BINANCE_API_URL}/ticker/price?symbol=${tickerSymbol}`)
    const currentPrice = parseFloat(tickerResponse.data.price)
    
    if (isNaN(currentPrice)) {
      addLedgerPositionError.value = `Impossible de trouver le prix pour ${symbol}`
      return
    }
    
    // Calculer les valeurs
    const quantity = manualLedgerPosition.value.quantity
    const entryPrice = manualLedgerPosition.value.averageEntryPrice
    const totalValue = quantity * currentPrice
    const initialValue = quantity * entryPrice
    const profitLoss = totalValue - initialValue
    const profitLossPercentage = (profitLoss / initialValue) * 100
    
    // Créer la nouvelle position
    const newPosition = {
      symbol,
      quantity,
      averageBuyPrice: entryPrice,
      currentPrice,
      totalValue,
      profitLoss,
      profitLossPercentage
    }
    
    // Ajouter à la liste du portefeuille Ledger
    ledgerPortfolio.value.push(newPosition)
    
    // Mettre à jour les totaux
    totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
    totalLedgerPortfolioProfitLoss.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
    
    // Calculer le pourcentage total
    const totalInitialValue = ledgerPortfolio.value.reduce(
      (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
      0
    )
    totalLedgerPortfolioProfitLossPercentage.value = 
      (totalLedgerPortfolioProfitLoss.value / totalInitialValue) * 100
    
    // Sauvegarder dans le localStorage
    saveLedgerPortfolioToLocalStorage()
    
    // Fermer le modal et réinitialiser le formulaire
    showAddLedgerPositionModal.value = false
    manualLedgerPosition.value = {
      symbol: '',
      quantity: 0,
      averageEntryPrice: 0,
      currentPrice: 0,
      entryDate: new Date()
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la position Ledger:', error)
    addLedgerPositionError.value = `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
  } finally {
    isAddingLedgerPosition.value = false
  }
}

// Fonction pour actualiser les prix des positions Ledger
async function refreshLedgerPositionPrices() {
  try {
    // Récupérer les prix actuels
    const tickerResponse = await axios.get(`${BINANCE_API_URL}/ticker/price`);
    const priceData = tickerResponse.data;
    
    // Récupérer les variations de prix
    const symbols = ledgerPortfolio.value.map(asset => `${asset.symbol}USDT`);
    const priceChanges = await apiService.getCryptoPriceChanges(symbols);
    
    for (const asset of ledgerPortfolio.value) {
      // Trouver le prix actuel
      const tickerInfo = priceData.find((t: any) => t.symbol === `${asset.symbol}USDT`);
      if (tickerInfo) {
        const currentPrice = parseFloat(tickerInfo.price);
        asset.currentPrice = currentPrice;
        asset.totalValue = asset.quantity * currentPrice;
        asset.profitLoss = asset.totalValue - (asset.quantity * asset.averageBuyPrice);
        asset.profitLossPercentage = (asset.profitLoss / (asset.quantity * asset.averageBuyPrice)) * 100;
        
        // Mettre à jour les variations de prix
        const changes = priceChanges[asset.symbol];
        if (changes) {
          asset.change24h = changes.change24h;
          asset.change7d = changes.change7d;
          asset.change30d = changes.change30d;
        }
      }
    }
    
    // Mettre à jour les totaux
    totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
    totalLedgerPortfolioProfitLoss.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
    
    // Calculer le pourcentage total
    const totalInitialValue = ledgerPortfolio.value.reduce(
      (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
      0
    )
    totalLedgerPortfolioProfitLossPercentage.value = 
      (totalLedgerPortfolioProfitLoss.value / totalInitialValue) * 100
    
    // Sauvegarder dans le localStorage
    saveLedgerPortfolioToLocalStorage()
  } catch (error) {
    console.error('Erreur lors de l\'actualisation des prix des positions Ledger:', error)
  }
}

// Fonction pour actualiser les prix des positions Binance
async function refreshPositionPrices() {
  try {
    // Récupérer les prix actuels
    const tickerResponse = await axios.get(`${BINANCE_API_URL}/ticker/price`);
    const priceData = tickerResponse.data;
    
    // Récupérer les variations de prix
    const symbols = userPortfolio.value.map(asset => `${asset.symbol}USDT`);
    const priceChanges = await apiService.getCryptoPriceChanges(symbols);
    
    for (const asset of userPortfolio.value) {
      // Trouver le prix actuel
      const tickerInfo = priceData.find((t: any) => t.symbol === `${asset.symbol}USDT`);
      if (tickerInfo) {
        const currentPrice = parseFloat(tickerInfo.price);
        asset.currentPrice = currentPrice;
        asset.totalValue = asset.quantity * currentPrice;
        asset.profitLoss = asset.totalValue - (asset.quantity * asset.averageBuyPrice);
        asset.profitLossPercentage = (asset.profitLoss / (asset.quantity * asset.averageBuyPrice)) * 100;
        
        // Mettre à jour les variations de prix
        const changes = priceChanges[asset.symbol];
        if (changes) {
          asset.change24h = changes.change24h;
          asset.change7d = changes.change7d;
          asset.change30d = changes.change30d;
        }
      }
    }
    
    // Mettre à jour les totaux
    totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
    totalPortfolioProfitLoss.value = userPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
    
    // Calculer le pourcentage total
    const totalInitialValue = userPortfolio.value.reduce(
      (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
      0
    )
    totalPortfolioProfitLossPercentage.value = 
      (totalPortfolioProfitLoss.value / totalInitialValue) * 100
    
    // Sauvegarder dans le localStorage
    savePortfolioToLocalStorage()
  } catch (error) {
    console.error('Erreur lors de l\'actualisation des prix:', error)
  }
}

onMounted(async () => {
  await fetchCryptoIndicators()
  await fetchTopCryptoPrices()
  // Charger les portefeuilles depuis le localStorage
  loadPortfolioFromLocalStorage()
  loadLedgerPortfolioFromLocalStorage()
  
  // Charger les positions crypto depuis MongoDB
  const cryptoStore = useCryptoStore();
  await cryptoStore.fetchPositions();
  
  // Actualiser les prix des positions existantes
  refreshPositionPrices()
  refreshLedgerPositionPrices()
  
  // Configurer le rafraîchissement périodique des indicateurs
  startIndicatorsRefreshTimer()
  
  // Ajout du fear and greed index
  fetchFearAndGreedIndex()
  
  // Rafraîchir les données toutes les 30 minutes
  const fearGreedInterval = setInterval(fetchFearAndGreedIndex, 30 * 60 * 1000)
  
  onUnmounted(() => {
    clearInterval(fearGreedInterval)
  })
})

// Ajouter cette fonction avant onUnmounted
onUnmounted(() => {
  // Nettoyer les timers lors de la destruction du composant
  if (indicatorsRefreshTimerId.value) {
    clearInterval(indicatorsRefreshTimerId.value)
  }
})

// Fonction pour démarrer le timer de rafraîchissement
function startIndicatorsRefreshTimer() {
  // Initialiser le compteur
  nextRefreshCountdown.value = 60
  
  // Créer un intervalle qui s'exécute chaque seconde
  indicatorsRefreshTimerId.value = window.setInterval(() => {
    // Décrémenter le compteur
    nextRefreshCountdown.value--
    
    // Si le compteur atteint zéro, rafraîchir les données
    if (nextRefreshCountdown.value <= 0) {
      refreshIndicators()
      // Réinitialiser le compteur
      nextRefreshCountdown.value = 60
    }
  }, 1000)
}

// Fonction pour rafraîchir manuellement les indicateurs
async function refreshIndicators() {
  if (isRefreshingIndicators.value) return
  
  isRefreshingIndicators.value = true
  await fetchCryptoIndicators()
}

// Fonctions pour déterminer la classe de couleur en fonction de l'indice
function getFearGreedClass(index: number): string {
  if (index <= 20) return 'bg-red-600'
  if (index <= 40) return 'bg-orange-500'
  if (index <= 60) return 'bg-yellow-400'
  if (index <= 80) return 'bg-green-500'
  return 'bg-green-700'
}

function getFearGreedLabel(index: number): string {
  if (index <= 20) return 'Peur extrême'
  if (index <= 40) return 'Peur'
  if (index <= 60) return 'Neutre'
  if (index <= 80) return 'Avidité'
  return 'Avidité extrême'
}

function getAltcoinSeasonClass(index: number): string {
  if (index <= 20) return 'bg-blue-700'
  if (index <= 50) return 'bg-blue-500'
  if (index <= 75) return 'bg-purple-500'
  return 'bg-purple-700'
}

function getAltcoinSeasonTextClass(index: number): string {
  if (index <= 20) return 'bg-blue-100 text-blue-800'
  if (index <= 50) return 'bg-blue-100 text-blue-800'
  if (index <= 75) return 'bg-purple-100 text-purple-800'
  return 'bg-purple-100 text-purple-800'
}

function getAltcoinSeasonLabel(index: number): string {
  if (index <= 20) return 'Saison Bitcoin'
  if (index <= 50) return 'Transition Bitcoin'
  if (index <= 75) return 'Transition Altcoins'
  return 'Saison Altcoins'
}

function getAltcoinSeasonDescription(index: number): string {
  if (index <= 20) return 'Les investisseurs favorisent Bitcoin. Période idéale pour accumuler du BTC.'
  if (index <= 50) return 'Bitcoin est dominant mais certains altcoins commencent à performer.'
  if (index <= 75) return 'Les altcoins gagnent en momentum, mais Bitcoin reste solide.'
  return 'Forte performance des altcoins par rapport à Bitcoin. Potentiel de gains importants.'
}

// Fonction d'aide pour formater la devise
function formatCurrency(value: number, currency = 'USD', digits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

// Fonction d'aide pour formater les pourcentages
function formatPercentage(value: number, digits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value / 100);
}

// Formulaire pour ajouter une position manuelle Binance
const showAddPositionModal = ref(false)
const manualPosition = ref({
  symbol: '',
  quantity: 0,
  averageEntryPrice: 0,
  currentPrice: 0,
  entryDate: new Date()
})
const isAddingPosition = ref(false)
const addPositionError = ref('')

// Ajout des états pour la modification de position Binance
const showEditPositionModal = ref(false)
const editingPosition = ref<any>(null)
const isEditingPosition = ref(false)
const editPositionError = ref('')

// Fonction pour ouvrir le modal de modification Binance
function openEditPositionModal(asset: any) {
  editingPosition.value = { ...asset }
  showEditPositionModal.value = true
}

// Fonction pour sauvegarder les modifications Binance
async function savePositionEdit() {
  editPositionError.value = ''
  isEditingPosition.value = true
  
  try {
    // Vérification des champs
    if (!editingPosition.value.symbol || !editingPosition.value.quantity || !editingPosition.value.averageBuyPrice) {
      editPositionError.value = 'Tous les champs sont obligatoires'
      return
    }
    
    // Conversion du symbole en majuscules
    const symbol = editingPosition.value.symbol.toUpperCase()
    
    // Récupérer le prix actuel depuis Binance
    const tickerSymbol = `${symbol}USDT`
    const tickerResponse = await axios.get(`${BINANCE_API_URL}/ticker/price?symbol=${tickerSymbol}`)
    const currentPrice = parseFloat(tickerResponse.data.price)
    
    if (isNaN(currentPrice)) {
      editPositionError.value = `Impossible de trouver le prix pour ${symbol}`
      return
    }
    
    // Calculer les nouvelles valeurs
    const quantity = editingPosition.value.quantity
    const entryPrice = editingPosition.value.averageBuyPrice
    const totalValue = quantity * currentPrice
    const initialValue = quantity * entryPrice
    const profitLoss = totalValue - initialValue
    const profitLossPercentage = (profitLoss / initialValue) * 100
    
    // Mettre à jour la position dans le tableau
    const index = userPortfolio.value.findIndex(p => p.symbol === editingPosition.value.symbol)
    if (index !== -1) {
      userPortfolio.value[index] = {
        ...editingPosition.value,
        currentPrice,
        totalValue,
        profitLoss,
        profitLossPercentage
      }
      
      // Mettre à jour les totaux
      totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
      totalPortfolioProfitLoss.value = userPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
      
      // Calculer le pourcentage total
      const totalInitialValue = userPortfolio.value.reduce(
        (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
        0
      )
      totalPortfolioProfitLossPercentage.value = 
        (totalPortfolioProfitLoss.value / totalInitialValue) * 100
      
      // Sauvegarder dans le localStorage
      savePortfolioToLocalStorage()
    }
    
    // Fermer le modal
    showEditPositionModal.value = false
    editingPosition.value = null
  } catch (error) {
    console.error('Erreur lors de la modification de la position:', error)
    editPositionError.value = `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
  } finally {
    isEditingPosition.value = false
  }
}

// Fonction pour ajouter une position manuelle Binance
async function addManualPosition() {
  addPositionError.value = ''
  isAddingPosition.value = true
  
  try {
    // Vérification des champs
    if (!manualPosition.value.symbol || !manualPosition.value.quantity || !manualPosition.value.averageEntryPrice) {
      addPositionError.value = 'Tous les champs sont obligatoires'
      return
    }
    
    // Conversion du symbole en majuscules
    const symbol = manualPosition.value.symbol.toUpperCase()
    
    // Récupérer le prix actuel depuis Binance
    const tickerSymbol = `${symbol}USDT`
    const tickerResponse = await axios.get(`${BINANCE_API_URL}/ticker/price?symbol=${tickerSymbol}`)
    const currentPrice = parseFloat(tickerResponse.data.price)
    
    if (isNaN(currentPrice)) {
      addPositionError.value = `Impossible de trouver le prix pour ${symbol}`
      return
    }
    
    // Calculer les valeurs
    const quantity = manualPosition.value.quantity
    const entryPrice = manualPosition.value.averageEntryPrice
    const totalValue = quantity * currentPrice
    const initialValue = quantity * entryPrice
    const profitLoss = totalValue - initialValue
    const profitLossPercentage = (profitLoss / initialValue) * 100
    
    // Créer la nouvelle position
    const newPosition = {
      symbol,
      quantity,
      averageBuyPrice: entryPrice,
      currentPrice,
      totalValue,
      profitLoss,
      profitLossPercentage
    }
    
    // Ajouter à la liste du portefeuille utilisateur
    userPortfolio.value.push(newPosition)
    
    // Mettre à jour les totaux
    totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
    totalPortfolioProfitLoss.value = userPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
    
    // Calculer le pourcentage total
    const totalInitialValue = userPortfolio.value.reduce(
      (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice), 
      0
    )
    totalPortfolioProfitLossPercentage.value = 
      (totalPortfolioProfitLoss.value / totalInitialValue) * 100
    
    // Sauvegarder dans le localStorage
    savePortfolioToLocalStorage()
    
    // Fermer le modal et réinitialiser le formulaire
    showAddPositionModal.value = false
    manualPosition.value = {
      symbol: '',
      quantity: 0,
      averageEntryPrice: 0,
      currentPrice: 0,
      entryDate: new Date()
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la position:', error)
    addPositionError.value = `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
  } finally {
    isAddingPosition.value = false
  }
}

// Ajout des variables pour le calcul du total combiné
const totalInitialInvestment = computed(() => {
  // Calcul de l'investissement initial pour Binance
  const binanceInitial = userPortfolio.value.reduce(
    (sum: number, asset: any) => sum + (asset.quantity * asset.averageBuyPrice), 
    0
  )
  
  // Calcul de l'investissement initial pour Ledger
  const ledgerInitial = ledgerPortfolio.value.reduce(
    (sum: number, asset: any) => sum + (asset.quantity * asset.averageBuyPrice), 
    0
  )
  
  return binanceInitial + ledgerInitial
})

const totalCombinedPerformance = computed(() => {
  // Valeur totale actuelle
  const totalValue = totalPortfolioValueUSD.value + totalLedgerPortfolioValueUSD.value
  
  // Valeur totale de l'investissement initial
  const initialValue = totalInitialInvestment.value
  
  // Calcul de la performance
  const performanceValue = totalValue - initialValue
  
  // Calcul du pourcentage
  const performancePercentage = initialValue > 0 
    ? (performanceValue / initialValue) * 100 
    : 0
    
  return {
    value: performanceValue,
    percentage: performancePercentage
  }
})

async function addLedgerPosition() {
  if (ledgerPositionErrors.value.length > 0) return
  
  // Vérifier si la position existe déjà
  const existingPosition = ledgerPortfolio.value.find(p => p.symbol === manualLedgerPosition.value.symbol)
  if (existingPosition) {
    ledgerPositionErrors.value = [`Une position en ${manualLedgerPosition.value.symbol} existe déjà dans votre portefeuille.`]
    return
  }
  
  try {
    // Récupérer le prix actuel
    const tickerResponse = await axios.get(`${BINANCE_API_URL}/ticker/price?symbol=${manualLedgerPosition.value.symbol}USDT`)
    const tickerInfo = tickerResponse.data
    const currentPrice = tickerInfo.price ? parseFloat(tickerInfo.price) : 0;

    // Récupérer les variations de prix
    const priceChanges = await apiService.getCryptoPriceChanges([`${manualLedgerPosition.value.symbol}USDT`]);
    const changes = priceChanges[manualLedgerPosition.value.symbol];
    
    const newPosition = {
      symbol: manualLedgerPosition.value.symbol,
      quantity: parseFloat(manualLedgerPosition.value.quantity),
      averageBuyPrice: parseFloat(manualLedgerPosition.value.averageEntryPrice),
      currentPrice,
      totalValue: parseFloat(manualLedgerPosition.value.quantity) * currentPrice,
      profitLoss: (parseFloat(manualLedgerPosition.value.quantity) * currentPrice) - (parseFloat(manualLedgerPosition.value.quantity) * parseFloat(manualLedgerPosition.value.averageEntryPrice)),
      profitLossPercentage: ((parseFloat(manualLedgerPosition.value.quantity) * currentPrice) - (parseFloat(manualLedgerPosition.value.quantity) * parseFloat(manualLedgerPosition.value.averageEntryPrice))) / (parseFloat(manualLedgerPosition.value.quantity) * parseFloat(manualLedgerPosition.value.averageEntryPrice)) * 100,
      change24h: changes?.change24h || 0,
      change7d: changes?.change7d || 0,
      change30d: changes?.change30d || 0
    };
    
    // Ajouter la position au portefeuille
    ledgerPortfolio.value.push(newPosition)
    
    // Recalculer les totaux
    totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.totalValue, 0)
    totalLedgerPortfolioProfitLoss.value = ledgerPortfolio.value.reduce((sum, asset) => sum + asset.profitLoss, 0)
    
    const totalInitialValue = ledgerPortfolio.value.reduce(
      (sum, asset) => sum + (asset.quantity * asset.averageBuyPrice),
      0
    )
    
    totalLedgerPortfolioProfitLossPercentage.value =
      (totalLedgerPortfolioProfitLoss.value / totalInitialValue) * 100
    
    // Sauvegarder le portefeuille
    saveLedgerPortfolioToLocalStorage()
    
    // Réinitialiser le formulaire
    showAddLedgerPositionModal.value = false
    manualLedgerPosition.value = {
      symbol: '',
      quantity: '',
      averageEntryPrice: ''
    }
    ledgerPositionErrors.value = []
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la position:', error)
    ledgerPositionErrors.value = ['Impossible d\'ajouter la position. Veuillez vérifier le symbole et réessayer.']
  }
}

const showAltcoinSeasonInfo = ref(false);

// Ajout du fear and greed index
const fearAndGreedIndex = ref({ value: 50, classification: 'Neutral' });
const fearAndGreedColor = computed(() => {
  const value = fearAndGreedIndex.value.value;
  if (value >= 0 && value <= 20) return '#EF4444'; // Extreme Fear - red
  if (value > 20 && value <= 40) return '#F59E0B'; // Fear - amber
  if (value > 40 && value <= 60) return '#10B981'; // Neutral - emerald
  if (value > 60 && value <= 80) return '#3B82F6'; // Greed - blue
  return '#8B5CF6'; // Extreme Greed - violet
});

// Récupération des données fear and greed
async function fetchFearAndGreedIndex() {
  isLoadingFearGreed.value = true;
  fearGreedError.value = '';
  
  try {
    console.log('Récupération du Fear & Greed Index...');
    const data = await apiService.getFearAndGreedIndex();
    console.log('Fear & Greed Index reçu:', data);
    
    if (data) {
      fearAndGreedIndex.value = data;
      
      // Mettre à jour le store pour que d'autres composants puissent y accéder
      tradingStore.cryptoMetrics.btcFearGreedIndex = data.value || 0;
    } else {
      throw new Error('Données invalides reçues');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'indice Fear and Greed:', error);
    fearGreedError.value = 'Erreur lors du chargement';
  } finally {
    isLoadingFearGreed.value = false;
  }
}

const isLoadingFearGreed = ref(false);
const fearGreedError = ref('');
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Trading Crypto
      </h1>
    </div>

    <!-- Modal de confirmation de suppression -->
    <TransitionRoot appear :show="showDeleteModal" as="template">
      <Dialog as="div" @close="showDeleteModal = false" class="relative z-10">
        <TransitionChild
          as="template"
          enter="duration-300 ease-out"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="duration-200 ease-in"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as="template"
              enter="duration-300 ease-out"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="duration-200 ease-in"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900">
                  Confirmer la suppression
                </DialogTitle>
                <div class="mt-2">
                  <p class="text-sm text-gray-500">
                    Êtes-vous sûr de vouloir supprimer toutes les positions ? Cette action est irréversible.
                  </p>
                </div>

                <div class="mt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                    @click="showDeleteModal = false"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    @click="deleteAllData"
                  >
                    Supprimer
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Overview section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- Répartition des actifs -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          Répartition des Actifs
        </h2>
        <div class="h-64 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Doughnut :data="portfolioAllocationData" :options="pieChartOptions" />
        </div>
      </div>

      <!-- Répartition par portefeuille -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cyan-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Répartition par Portefeuille
        </h2>
        <div class="h-64 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Pie :data="walletDistributionData" :options="pieChartOptions" />
        </div>
      </div>

      <!-- Performance par actif -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Performance par Actif
        </h2>
        <div class="h-64 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Bar :data="assetPerformanceData" :options="barChartOptions" />
        </div>
      </div>
    </div>

    <!-- Indicateurs du Marché -->
    <div class="bg-white shadow rounded-lg p-6 mb-8 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Indicateurs du Marché en Temps Réel
        </h2>
        <div class="flex items-center">
          <div v-if="lastRefreshTime" class="mr-4 text-xs text-gray-500">
            Dernière mise à jour: {{ lastRefreshTime.toLocaleTimeString() }}
            <span class="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Prochain rafraîchissement: {{ nextRefreshCountdown }}s
            </span>
          </div>
          <button 
            @click="refreshIndicators" 
            class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            :disabled="isRefreshingIndicators"
          >
            <svg v-if="isRefreshingIndicators" class="animate-spin -ml-0.5 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="mr-1 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ isRefreshingIndicators ? 'Rafraîchissement...' : 'Rafraîchir' }}
          </button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100 relative">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-yellow-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="flex-grow">
              <div class="flex justify-between items-center">
                <h3 class="text-sm font-medium text-gray-500">Fear & Greed Index</h3>
                <button 
                  @click="fetchFearAndGreedIndex" 
                  class="ml-2 p-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                  :disabled="isLoadingFearGreed"
                  title="Rafraîchir l'indice Fear & Greed"
                >
                  <svg 
                    v-if="isLoadingFearGreed" 
                    class="animate-spin h-3 w-3" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg 
                    v-else 
                    class="h-3 w-3" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                </button>
              </div>
              <div v-if="fearGreedError" class="text-red-500 text-xs mb-1">{{ fearGreedError }}</div>
              <p class="text-2xl font-bold text-gray-900">{{ fearAndGreedIndex.value }}</p>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div class="h-1.5 rounded-full" :style="{ width: `${fearAndGreedIndex.value}%`, backgroundColor: fearAndGreedColor }"></div>
              </div>
              <div class="flex justify-between items-center mt-1">
                <span class="text-xs font-medium" :style="{ color: fearAndGreedColor }">
                  {{ fearAndGreedIndex.classification }}
                </span>
                <span class="text-xs text-gray-500">Source: API</span>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-orange-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Dominance BTC</h3>
              <p class="text-2xl font-bold text-gray-900">{{ tradingStore.cryptoMetrics.btcDominance.toFixed(1) }}%</p>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div class="bg-orange-600 h-1.5 rounded-full" :style="{ width: `${Math.min(tradingStore.cryptoMetrics.btcDominance, 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-blue-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Saison Altcoins</h3>
              <p class="text-2xl font-bold text-gray-900">{{ tradingStore.cryptoMetrics.altcoinSeasonIndex }}</p>
              <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div 
                  :class="getAltcoinSeasonClass(tradingStore.cryptoMetrics.altcoinSeasonIndex)" 
                  class="h-2.5 rounded-full" 
                  :style="{ width: `${tradingStore.cryptoMetrics.altcoinSeasonIndex}%` }"
                ></div>
              </div>
              <div class="flex justify-between mt-1 text-xs text-gray-500">
                <span>Bitcoin</span>
                <span>Altcoins</span>
              </div>
              <div class="mt-2">
                <span class="px-2 py-1 text-xs font-medium rounded-full" 
                  :class="getAltcoinSeasonTextClass(tradingStore.cryptoMetrics.altcoinSeasonIndex)">
                  {{ getAltcoinSeasonLabel(tradingStore.cryptoMetrics.altcoinSeasonIndex) }}
                </span>
              </div>
              <p class="mt-2 text-xs text-gray-600">
                {{ getAltcoinSeasonDescription(tradingStore.cryptoMetrics.altcoinSeasonIndex) }}
              </p>
              <div class="mt-2 flex items-center">
                <span class="text-xs text-gray-400">Source: Blockchain Center / CoinGecko</span>
                <button @click="showAltcoinSeasonInfo = true" class="ml-1 text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Prix des principales cryptomonnaies -->
    <div class="bg-white shadow rounded-lg p-6 mb-8 transition-all duration-300 hover:shadow-lg">
      <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        Prix Cryptomonnaies (via Binance)
        <button 
          @click="fetchTopCryptoPrices" 
          class="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full hover:bg-indigo-200 transition-colors"
        >
          Actualiser
        </button>
      </h2>
      
      <div v-if="isLoadingPrices" class="flex justify-center items-center py-8">
        <svg class="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="ml-2 text-gray-600">Chargement des prix...</span>
      </div>
      
      <div v-else-if="hasPricesError" class="bg-red-50 p-4 rounded-md text-red-600">
        Impossible de récupérer les prix depuis Binance. Veuillez réessayer plus tard.
      </div>
      
      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          v-for="crypto in topCryptoPrices" 
          :key="crypto.symbol" 
          class="bg-gray-50 p-6 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="p-2.5 rounded-full" :class="crypto.change24h >= 0 ? 'bg-green-100' : 'bg-red-100'">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  :class="crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'"
                  class="h-7 w-7" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    v-if="crypto.change24h >= 0" 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    stroke-width="2" 
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                  />
                  <path 
                    v-else 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    stroke-width="2" 
                    d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" 
                  />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-bold text-gray-900">{{ crypto.symbol }}</h3>
                <p class="text-sm text-gray-500">Binance</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xl font-bold text-gray-900">{{ formatCurrency(crypto.price, 'USD') }}</p>
              <p 
                class="text-sm font-medium" 
                :class="crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ crypto.change24h >= 0 ? '+' : '' }}{{ crypto.change24h.toFixed(2) }}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Nouveau panneau récapitulatif des portefeuilles combinés -->
    <div class="mt-8 bg-white p-6 rounded-lg shadow">
      <h2 class="text-xl font-bold text-gray-900 mb-6">
        Résumé Global des Portefeuilles
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-blue-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">Valeur Totale Combinée</h3>
              <p class="text-2xl font-bold text-gray-900">{{ formatCurrency(totalPortfolioValueUSD + totalLedgerPortfolioValueUSD, 'USD') }}</p>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-purple-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">Investissement Initial Total</h3>
              <p class="text-2xl font-bold text-gray-900">{{ formatCurrency(totalInitialInvestment, 'USD') }}</p>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md" :class="totalCombinedPerformance.percentage >= 0 ? 'bg-green-100' : 'bg-red-100'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="totalCombinedPerformance.percentage >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">Performance Globale</h3>
              <p class="text-2xl font-bold" :class="totalCombinedPerformance.percentage >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ totalCombinedPerformance.percentage >= 0 ? '+' : '' }}{{ totalCombinedPerformance.percentage.toFixed(2) }}%
              </p>
              <p class="text-sm" :class="totalCombinedPerformance.value >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ formatCurrency(totalCombinedPerformance.value, 'USD') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mon Portefeuille Binance -->
    <div class="mt-8 bg-white shadow rounded-lg p-6 mb-8 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Mon Portefeuille Binance
        </h2>
        <div class="flex space-x-2">
          <button
            @click="refreshPositionPrices"
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser les prix
          </button>
          
          <button
            @click="showAddPositionModal = true"
            class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter une position
          </button>
        </div>
      </div>
      
      <div v-if="isLoadingPortfolio" class="flex justify-center items-center py-8">
        <svg class="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="ml-2 text-gray-600">Chargement du portefeuille...</span>
      </div>
      
      <div v-else-if="hasPortfolioError" class="bg-red-50 p-4 rounded-md text-red-600">
        Impossible de récupérer les données de votre portefeuille. Veuillez réessayer plus tard.
      </div>
      
      <div v-else>
        <!-- Résumé du portefeuille -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md bg-blue-100 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Valeur Totale</h3>
                <p class="text-2xl font-bold text-gray-900">{{ formatCurrency(totalPortfolioValueUSD, 'USD') }}</p>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md" :class="totalPortfolioProfitLoss >= 0 ? 'bg-green-100' : 'bg-red-100'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="totalPortfolioProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path v-if="totalPortfolioProfitLoss >= 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Profit/Perte</h3>
                <p class="text-2xl font-bold" :class="totalPortfolioProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ formatCurrency(totalPortfolioProfitLoss, 'USD') }}
                </p>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md" :class="totalPortfolioProfitLossPercentage >= 0 ? 'bg-green-100' : 'bg-red-100'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="totalPortfolioProfitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Performance</h3>
                <p class="text-2xl font-bold" :class="totalPortfolioProfitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ totalPortfolioProfitLossPercentage >= 0 ? '+' : '' }}{{ totalPortfolioProfitLossPercentage.toFixed(2) }}%
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Tableau des actifs -->
        <div class="overflow-x-auto bg-gray-50 rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('symbol')">
                  Actif
                  <span v-if="binanceSortBy === 'symbol'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('quantity')">
                  Quantité
                  <span v-if="binanceSortBy === 'quantity'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('averageBuyPrice')">
                  Prix d'achat moyen
                  <span v-if="binanceSortBy === 'averageBuyPrice'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('currentPrice')">
                  Prix actuel
                  <span v-if="binanceSortBy === 'currentPrice'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('totalValue')">
                  Valeur totale
                  <span v-if="binanceSortBy === 'totalValue'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('profitLoss')">
                  Gain/Perte
                  <span v-if="binanceSortBy === 'profitLoss'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('change24h')">
                  24h %
                  <span v-if="binanceSortBy === 'change24h'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('change7d')">
                  7j %
                  <span v-if="binanceSortBy === 'change7d'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeBinanceSortBy('change30d')">
                  30j %
                  <span v-if="binanceSortBy === 'change30d'" class="ml-1">
                    {{ binanceSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="asset in sortedBinancePortfolio" :key="asset.symbol" class="hover:bg-gray-50 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="rounded-full w-8 h-8 flex items-center justify-center mr-3" :style="{ backgroundColor: `rgba(${Math.floor(Math.random() * 155) + 100}, ${Math.floor(Math.random() * 155) + 100}, ${Math.floor(Math.random() * 155) + 100}, 0.1)` }">
                      <span class="text-xs font-bold">{{ asset.symbol.slice(0, 2) }}</span>
                    </div>
                    <div class="text-sm font-medium text-gray-900">{{ asset.symbol }}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ asset.quantity.toFixed(asset.quantity < 1 ? 6 : 2) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatCurrency(asset.averageBuyPrice, 'USD') }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatCurrency(asset.currentPrice, 'USD') }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatCurrency(asset.totalValue, 'USD') }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <span class="text-sm font-medium mr-2" :class="asset.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
                      {{ formatCurrency(asset.profitLoss, 'USD') }}
                    </span>
                    <svg v-if="asset.profitLoss >= 0" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ asset.change24h >= 0 ? '+' : '' }}{{ asset.change24h?.toFixed(2) }}%
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="asset.change7d >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ asset.change7d >= 0 ? '+' : '' }}{{ asset.change7d?.toFixed(2) }}%
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="asset.change30d >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ asset.change30d >= 0 ? '+' : '' }}{{ asset.change30d?.toFixed(2) }}%
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    @click="openEditPositionModal(asset)" 
                    class="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors duration-150"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    @click="deletePortfolioPosition(asset.symbol)" 
                    class="text-red-600 hover:text-red-900 transition-colors duration-150"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="userPortfolio.length === 0">
                <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">
                  Aucun actif trouvé dans votre portefeuille Binance.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="mt-4 text-xs text-gray-500">
          <p>* Les prix sont mis à jour en temps réel depuis Binance.</p>
          <p>* Ces données sont sauvegardées localement dans votre navigateur.</p>
        </div>
      </div>
    </div>

    <!-- Mon Portefeuille Ledger -->
    <div class="mt-8 bg-white shadow rounded-lg p-6 mb-8 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
          Mon Portefeuille Ledger
        </h2>
        <div class="flex space-x-2">
          <button
            @click="refreshLedgerPositionPrices"
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser les prix
          </button>
          
          <button
            @click="showAddLedgerPositionModal = true"
            class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter une position
          </button>
        </div>
      </div>
      
      <div v-if="isLoadingLedgerPortfolio" class="flex justify-center items-center py-8">
        <svg class="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="ml-2 text-gray-600">Chargement du portefeuille Ledger...</span>
      </div>
      
      <div v-else-if="hasLedgerPortfolioError" class="bg-red-50 p-4 rounded-md text-red-600">
        Impossible de récupérer les données de votre portefeuille Ledger. Veuillez réessayer plus tard.
      </div>
      
      <div v-else>
        <!-- Résumé du portefeuille -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md bg-gray-100 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Valeur Totale</h3>
                <p class="text-2xl font-bold text-gray-900">{{ formatCurrency(totalLedgerPortfolioValueUSD, 'USD') }}</p>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md" :class="totalLedgerPortfolioProfitLoss >= 0 ? 'bg-green-100' : 'bg-red-100'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="totalLedgerPortfolioProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path v-if="totalLedgerPortfolioProfitLoss >= 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Profit/Perte</h3>
                <p class="text-2xl font-bold" :class="totalLedgerPortfolioProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ formatCurrency(totalLedgerPortfolioProfitLoss, 'USD') }}
                </p>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-md" :class="totalLedgerPortfolioProfitLossPercentage >= 0 ? 'bg-green-100' : 'bg-red-100'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="totalLedgerPortfolioProfitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Performance</h3>
                <p class="text-2xl font-bold" :class="totalLedgerPortfolioProfitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ totalLedgerPortfolioProfitLossPercentage >= 0 ? '+' : '' }}{{ totalLedgerPortfolioProfitLossPercentage.toFixed(2) }}%
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Tableau des actifs -->
        <div class="overflow-x-auto bg-gray-50 rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('symbol')">
                  Actif
                  <span v-if="ledgerSortBy === 'symbol'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('quantity')">
                  Quantité
                  <span v-if="ledgerSortBy === 'quantity'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('averageBuyPrice')">
                  Prix d'achat moyen
                  <span v-if="ledgerSortBy === 'averageBuyPrice'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('currentPrice')">
                  Prix actuel
                  <span v-if="ledgerSortBy === 'currentPrice'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('totalValue')">
                  Valeur totale
                  <span v-if="ledgerSortBy === 'totalValue'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('profitLoss')">
                  Gain/Perte
                  <span v-if="ledgerSortBy === 'profitLoss'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('change24h')">
                  24h %
                  <span v-if="ledgerSortBy === 'change24h'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('change7d')">
                  7j %
                  <span v-if="ledgerSortBy === 'change7d'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="changeLedgerSortBy('change30d')">
                  30j %
                  <span v-if="ledgerSortBy === 'change30d'" class="ml-1">
                    {{ ledgerSortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="asset in sortedLedgerPortfolio" :key="asset.symbol" class="hover:bg-gray-50 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="rounded-full w-8 h-8 flex items-center justify-center mr-3" :style="{ backgroundColor: `rgba(${Math.floor(Math.random() * 155) + 100}, ${Math.floor(Math.random() * 155) + 100}, ${Math.floor(Math.random() * 155) + 100}, 0.1)` }">
                      <span class="text-xs font-bold">{{ asset.symbol.slice(0, 2) }}</span>
                    </div>
                    <div class="text-sm font-medium text-gray-900">{{ asset.symbol }}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ asset.quantity.toFixed(asset.quantity < 1 ? 6 : 2) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatCurrency(asset.averageBuyPrice, 'USD') }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatCurrency(asset.currentPrice, 'USD') }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatCurrency(asset.totalValue, 'USD') }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <span class="text-sm font-medium mr-2" :class="asset.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
                      {{ formatCurrency(asset.profitLoss, 'USD') }}
                    </span>
                    <svg v-if="asset.profitLoss >= 0" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ asset.change24h >= 0 ? '+' : '' }}{{ asset.change24h?.toFixed(2) }}%
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="asset.change7d >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ asset.change7d >= 0 ? '+' : '' }}{{ asset.change7d?.toFixed(2) }}%
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="asset.change30d >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ asset.change30d >= 0 ? '+' : '' }}{{ asset.change30d?.toFixed(2) }}%
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    @click="openEditLedgerPositionModal(asset)" 
                    class="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors duration-150"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    @click="deleteLedgerPortfolioPosition(asset.symbol)" 
                    class="text-red-600 hover:text-red-900 transition-colors duration-150"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="ledgerPortfolio.length === 0">
                <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">
                  Aucun actif trouvé dans votre portefeuille Ledger.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="mt-4 text-xs text-gray-500">
          <p>* Les prix sont mis à jour en temps réel depuis Binance.</p>
          <p>* Ajoutez vos actifs stockés sur votre Ledger pour suivre leur performance.</p>
        </div>
      </div>
    </div>

    <!-- Modal d'Ajout de Position -->
    <div v-if="showAddModal" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Ajouter une Nouvelle Position</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Symbole</label>
                <input type="text" v-model="newPosition.symbol" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Quantité</label>
                <input type="number" v-model="newPosition.quantity" step="0.00000001" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Prix Moyen d'Entrée</label>
                <input type="number" v-model="newPosition.averageEntryPrice" step="0.01" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Prix Actuel</label>
                <input type="number" v-model="newPosition.currentPrice" step="0.01" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="button"
              @click="addPosition"
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

    <!-- Modal pour ajouter une position -->
    <TransitionRoot appear :show="showAddLedgerPositionModal" as="template">
      <Dialog as="div" @close="showAddLedgerPositionModal = false" class="relative z-10">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-200"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900">
                  Ajouter une position crypto
                </DialogTitle>
                
                <div class="mt-4">
                  <form @submit.prevent="addManualLedgerPosition">
                    <div class="mb-4">
                      <label for="symbol" class="block text-sm font-medium text-gray-700">Symbole</label>
                      <input 
                        type="text" 
                        id="symbol" 
                        v-model="manualLedgerPosition.symbol" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="ex: BTC, ETH, TAO..."
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="quantity" class="block text-sm font-medium text-gray-700">Quantité</label>
                      <input 
                        type="number" 
                        id="quantity" 
                        v-model="manualLedgerPosition.quantity" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.000001"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="price" class="block text-sm font-medium text-gray-700">Prix moyen d'achat (USD)</label>
                      <input 
                        type="number" 
                        id="price" 
                        v-model="manualLedgerPosition.averageEntryPrice" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div v-if="addLedgerPositionError" class="mb-4 p-2 bg-red-100 text-red-700 rounded">
                      {{ addLedgerPositionError }}
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                      <button 
                        type="button" 
                        @click="showAddLedgerPositionModal = false" 
                        class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Annuler
                      </button>
                      <button 
                        type="submit" 
                        class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        :disabled="isAddingLedgerPosition"
                      >
                        <svg v-if="isAddingLedgerPosition" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {{ isAddingLedgerPosition ? 'Ajout en cours...' : 'Ajouter' }}
                      </button>
                    </div>
                  </form>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Modal pour modifier une position Ledger -->
    <TransitionRoot appear :show="showEditLedgerPositionModal" as="template">
      <Dialog as="div" @close="showEditLedgerPositionModal = false" class="relative z-10">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-200"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900">
                  Modifier la position Ledger
                </DialogTitle>
                
                <div class="mt-4">
                  <form @submit.prevent="saveLedgerPositionEdit">
                    <div class="mb-4">
                      <label for="edit-ledger-symbol" class="block text-sm font-medium text-gray-700">Symbole</label>
                      <input 
                        type="text" 
                        id="edit-ledger-symbol" 
                        v-model="editingLedgerPosition.symbol" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="edit-ledger-quantity" class="block text-sm font-medium text-gray-700">Quantité</label>
                      <input 
                        type="number" 
                        id="edit-ledger-quantity" 
                        v-model="editingLedgerPosition.quantity" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.000001"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="edit-ledger-price" class="block text-sm font-medium text-gray-700">Prix moyen d'achat (USD)</label>
                      <input 
                        type="number" 
                        id="edit-ledger-price" 
                        v-model="editingLedgerPosition.averageBuyPrice" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div v-if="editLedgerPositionError" class="mb-4 p-2 bg-red-100 text-red-700 rounded">
                      {{ editLedgerPositionError }}
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                      <button 
                        type="button" 
                        @click="showEditLedgerPositionModal = false" 
                        class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Annuler
                      </button>
                      <button 
                        type="submit" 
                        class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        :disabled="isEditingLedgerPosition"
                      >
                        <svg v-if="isEditingLedgerPosition" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {{ isEditingLedgerPosition ? 'Modification en cours...' : 'Enregistrer' }}
                      </button>
                    </div>
                  </form>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Modal pour ajouter une position Binance -->
    <TransitionRoot appear :show="showAddPositionModal" as="template">
      <Dialog as="div" @close="showAddPositionModal = false" class="relative z-10">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-200"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900">
                  Ajouter une position Binance
                </DialogTitle>
                
                <div class="mt-4">
                  <form @submit.prevent="addManualPosition">
                    <div class="mb-4">
                      <label for="symbol" class="block text-sm font-medium text-gray-700">Symbole</label>
                      <input 
                        type="text" 
                        id="symbol" 
                        v-model="manualPosition.symbol" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="BTC"
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="quantity" class="block text-sm font-medium text-gray-700">Quantité</label>
                      <input 
                        type="number" 
                        id="quantity" 
                        v-model="manualPosition.quantity" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.000001"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="price" class="block text-sm font-medium text-gray-700">Prix moyen d'achat (USD)</label>
                      <input 
                        type="number" 
                        id="price" 
                        v-model="manualPosition.averageEntryPrice" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div v-if="addPositionError" class="mb-4 p-2 bg-red-100 text-red-700 rounded">
                      {{ addPositionError }}
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                      <button 
                        type="button" 
                        @click="showAddPositionModal = false" 
                        class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Annuler
                      </button>
                      <button 
                        type="submit" 
                        class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        :disabled="isAddingPosition"
                      >
                        <svg v-if="isAddingPosition" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {{ isAddingPosition ? 'Ajout en cours...' : 'Ajouter' }}
                      </button>
                    </div>
                  </form>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Modal pour modifier une position Binance -->
    <TransitionRoot appear :show="showEditPositionModal" as="template">
      <Dialog as="div" @close="showEditPositionModal = false" class="relative z-10">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-200"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900">
                  Modifier la position Binance
                </DialogTitle>
                
                <div class="mt-4">
                  <form @submit.prevent="savePositionEdit">
                    <div class="mb-4">
                      <label for="edit-symbol" class="block text-sm font-medium text-gray-700">Symbole</label>
                      <input 
                        type="text" 
                        id="edit-symbol" 
                        v-model="editingPosition.symbol" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="edit-quantity" class="block text-sm font-medium text-gray-700">Quantité</label>
                      <input 
                        type="number" 
                        id="edit-quantity" 
                        v-model="editingPosition.quantity" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.000001"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div class="mb-4">
                      <label for="edit-price" class="block text-sm font-medium text-gray-700">Prix moyen d'achat (USD)</label>
                      <input 
                        type="number" 
                        id="edit-price" 
                        v-model="editingPosition.averageBuyPrice" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div v-if="editPositionError" class="mb-4 p-2 bg-red-100 text-red-700 rounded">
                      {{ editPositionError }}
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                      <button 
                        type="button" 
                        @click="showEditPositionModal = false" 
                        class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Annuler
                      </button>
                      <button 
                        type="submit" 
                        class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        :disabled="isEditingPosition"
                      >
                        <svg v-if="isEditingPosition" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {{ isEditingPosition ? 'Modification en cours...' : 'Enregistrer' }}
                      </button>
                    </div>
                  </form>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Modal d'information sur la saison des altcoins -->
    <el-dialog v-model="showAltcoinSeasonInfo" title="Indice de Saison des Altcoins" width="500px">
      <div class="p-4">
        <h3 class="text-lg font-medium text-gray-900 mb-3">Qu'est-ce que l'indice de saison des altcoins?</h3>
        <p class="text-sm text-gray-600 mb-3">
          L'indice de saison des altcoins est un indicateur qui mesure si le marché des cryptomonnaies est actuellement favorable à Bitcoin ou aux altcoins (toutes les autres cryptomonnaies).
        </p>
        
        <div class="bg-gray-50 p-3 rounded-md mb-3">
          <h4 class="font-medium text-gray-900 mb-2">Comment interpréter l'indice:</h4>
          <ul class="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li><span class="text-blue-700 font-medium">0-20:</span> Saison Bitcoin - BTC surperforme la majorité des altcoins.</li>
            <li><span class="text-blue-500 font-medium">21-50:</span> Transition Bitcoin - BTC reste dominant mais certains altcoins commencent à bien performer.</li>
            <li><span class="text-purple-500 font-medium">51-75:</span> Transition Altcoins - Les altcoins gagnent en force, certains surperforment BTC.</li>
            <li><span class="text-purple-700 font-medium">76-100:</span> Saison Altcoins - La majorité des altcoins surperforment Bitcoin.</li>
          </ul>
        </div>
        
        <h3 class="text-lg font-medium text-gray-900 mb-2">Sources des données</h3>
        <p class="text-sm text-gray-600 mb-3">
          L'indice utilise principalement les données de Blockchain Center (blockchaincenter.net) lorsque disponibles. 
          Si ces données ne sont pas accessibles, un algorithme propriétaire calcule l'indice en utilisant:
        </p>
        <ul class="list-disc pl-5 text-sm text-gray-600 mb-4">
          <li>La dominance de Bitcoin dans le marché global</li>
          <li>La dominance d'Ethereum par rapport à Bitcoin</li>
          <li>La dominance globale des altcoins</li>
        </ul>
        
        <h3 class="text-lg font-medium text-gray-900 mb-2">Stratégies d'investissement</h3>
        <div class="bg-gray-50 p-3 rounded-md">
          <p class="text-sm text-gray-600 mb-2">Selon la phase du marché, vous pourriez adapter votre stratégie:</p>
          <ul class="list-disc pl-5 text-sm text-gray-600">
            <li><span class="font-medium">Saison Bitcoin:</span> Privilégier l'accumulation de BTC</li>
            <li><span class="font-medium">Transition:</span> Allocation mixte BTC/grands altcoins</li>
            <li><span class="font-medium">Saison Altcoins:</span> Explorer des opportunités dans les altcoins avec de solides fondamentaux</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showAltcoinSeasonInfo = false">Fermer</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template> 