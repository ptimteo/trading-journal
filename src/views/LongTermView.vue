<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue';
import { useTradingStore } from '../stores/trading';
import { useLongTermStore } from '../stores/longTerm';
import type { LongTermInvestment } from '../types/trading';
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
import FinancialAnalysisBot from '../components/FinancialAnalysisBot.vue';

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

const tradingStore = useTradingStore();
const showAddModal = ref(false);
const sortBy = ref('purchaseDate');
const sortDirection = ref('desc');
const showDeleteModal = ref(false);

// Format des dates pour l'affichage
const formatDate = (date: Date) => {
  return date.toLocaleDateString('fr-FR');
};

// Investissements triés
const sortedInvestments = computed(() => {
  if (!tradingStore.longTerm.investments.length) return [];
  
  return [...tradingStore.longTerm.investments].sort((a, b) => {
    let valueA, valueB;
    
    if (sortBy.value === 'purchaseDate') {
      valueA = new Date(a.purchaseDate).getTime();
      valueB = new Date(b.purchaseDate).getTime();
    } else if (sortBy.value === 'symbol') {
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
    } else if (sortBy.value === 'strategy') {
      valueA = a.strategy;
      valueB = b.strategy;
    } else {
      valueA = a[sortBy.value as keyof LongTermInvestment];
      valueB = b[sortBy.value as keyof LongTermInvestment];
    }
    
    // Direction du tri
    const direction = sortDirection.value === 'asc' ? 1 : -1;
    
    // Tri
    if (valueA < valueB) return -1 * direction;
    if (valueA > valueB) return 1 * direction;
    return 0;
  });
});

// Calcul de la valeur totale du portfolio
const totalPortfolioValue = computed(() => {
  return sortedInvestments.value.reduce((total, investment) => {
    return total + (investment.quantity * investment.currentPrice);
  }, 0);
});

// Calcul du coût total initial
const totalInitialCost = computed(() => {
  return sortedInvestments.value.reduce((total, investment) => {
    return total + (investment.quantity * investment.averageEntryPrice);
  }, 0);
});

// Calcul du profit/perte total en pourcentage
const totalProfitLossPercentage = computed(() => {
  const totalValue = totalPortfolioValue.value;
  const totalCost = totalInitialCost.value;
  
  if (totalCost === 0) return 0;
  return ((totalValue - totalCost) / totalCost) * 100;
});

// Calcul des statistiques par type de portefeuille (au lieu de par stratégie)
const portfolioTypeStats = computed(() => {
  const investments = sortedInvestments.value;
  if (!investments.length) return [];
  
  // Regrouper les investissements par type de portefeuille
  const portfolioGroups: Record<string, LongTermInvestment[]> = {};
  
  investments.forEach(inv => {
    const type = inv.portfolioType || 'Non classé'; // Utiliser 'Non classé' si aucun type n'est défini
    if (!portfolioGroups[type]) {
      portfolioGroups[type] = [];
    }
    portfolioGroups[type].push(inv);
  });
  
  // Calculer les statistiques pour chaque type de portefeuille
  return Object.keys(portfolioGroups).map(type => {
    const invs = portfolioGroups[type];
    const initialCost = invs.reduce((sum, inv) => sum + (inv.quantity * inv.averageEntryPrice), 0);
    const currentValue = invs.reduce((sum, inv) => sum + (inv.quantity * inv.currentPrice), 0);
    const profitLoss = currentValue - initialCost;
    const performance = initialCost === 0 ? 0 : (profitLoss / initialCost) * 100;
    
    return {
      type,
      count: invs.length,
      initialCost,
      currentValue,
      profitLoss,
      performance,
      allocation: totalPortfolioValue.value === 0 ? 0 : (currentValue / totalPortfolioValue.value) * 100
    };
  }).sort((a, b) => b.currentValue - a.currentValue);
});

// Données pour le graphique de répartition par type de portefeuille
const portfolioAllocationData = computed(() => {
  const stats = portfolioTypeStats.value;
  if (!stats.length) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  // Générer des couleurs différentes pour chaque type de portefeuille
  const backgroundColors = [
    '#4F46E5', // Indigo
    '#10B981', // Émeraude
    '#F59E0B', // Ambre
    '#EF4444', // Rouge
    '#8B5CF6', // Violet
    '#EC4899', // Rose
    '#06B6D4', // Cyan
    '#14B8A6'  // Turquoise
  ];
  
  return {
    labels: stats.map(s => s.type),
    datasets: [
      {
        data: stats.map(s => s.allocation),
        backgroundColor: stats.map((_, index) => backgroundColors[index % backgroundColors.length])
      }
    ]
  };
});

// Données pour le graphique de performance par type de portefeuille
const portfolioPerformanceData = computed(() => {
  const stats = portfolioTypeStats.value;
  if (!stats.length) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  return {
    labels: stats.map(s => s.type),
    datasets: [
      {
        label: 'Performance (%)',
        data: stats.map(s => s.performance),
        backgroundColor: stats.map(s => s.performance >= 0 ? '#10B981' : '#EF4444')
      }
    ]
  };
});

// Données pour le graphique d'évolution du portfolio
const equityChartData = computed(() => {
  return {
    labels: tradingStore.longTerm.equityCurve.map(point => formatDate(point.date)),
    datasets: [
      {
        label: 'Valeur du Portfolio',
        data: tradingStore.longTerm.equityCurve.map(point => point.balance),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.1,
        fill: false
      },
      {
        label: 'Montant Investi',
        data: tradingStore.longTerm.equityCurve.map(point => point.invested || 0), // Utiliser 0 si undefined
        borderColor: '#9CA3AF',
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderDash: [5, 5],
        tension: 0.1,
        fill: false
      }
    ]
  };
});

// Données pour le graphique de performance par actif
const assetPerformanceData = computed(() => {
  const investments = sortedInvestments.value;
  if (!investments.length) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  
  // Calculer le pourcentage de profit/perte pour chaque position
  const performanceData = investments.map(inv => {
    const initialCost = inv.quantity * inv.averageEntryPrice;
    const currentValue = inv.quantity * inv.currentPrice;
    return initialCost === 0 ? 0 : ((currentValue - initialCost) / initialCost) * 100;
  });
  
  return {
    labels: investments.map(inv => inv.symbol),
    datasets: [
      {
        label: 'Performance (%)',
        data: performanceData,
        backgroundColor: performanceData.map(perf => perf >= 0 ? '#10B981' : '#EF4444')
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
      position: 'right' as const
    },
    title: {
      display: true,
      text: 'Répartition par Stratégie'
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          const value = context.raw;
          return `${context.label}: ${value.toFixed(1)}%`;
        }
      }
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
      text: 'Performance par Stratégie'
    }
  }
};

const assetBarChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  scales: {
    x: {
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
      text: 'Performance par Actif'
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
      text: 'Évolution du Portfolio'
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
          }
          return label;
        },
        footer: function(tooltipItems: any[]) {
          const datasetIndex = tooltipItems[0].datasetIndex;
          const dataIndex = tooltipItems[0].dataIndex;
          
          // Si c'est la valeur du portfolio, calculer le profit/perte vs montant investi
          if (datasetIndex === 0 && tradingStore.longTerm.equityCurve[dataIndex]) {
            const point = tradingStore.longTerm.equityCurve[dataIndex];
            const invested = point.invested || 0;
            
            if (invested > 0) {
              const profitLoss = point.balance - invested;
              const percentage = (profitLoss / invested) * 100;
              return `Gain/Perte: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(profitLoss)} (${percentage.toFixed(2)}%)`;
            }
          }
          return '';
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: 'Valeur (€)'
      }
    }
  }
};

// Fonction pour changer le tri
function changeSortBy(column: string) {
  if (sortBy.value === column) {
    // Changer la direction si on clique sur la même colonne
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // Nouvelle colonne, réinitialiser à 'asc' par défaut pour les symboles/stratégies, 'desc' pour les autres
    sortBy.value = column;
    sortDirection.value = ['symbol', 'strategy'].includes(column) ? 'asc' : 'desc';
  }
}

// État pour le nouvel investissement
const newInvestment = ref({
  symbol: 'SP500',
  quantity: 0,
  averageEntryPrice: 0,
  currentPrice: 0,
  purchaseDate: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD pour input date
  strategy: 'DCA',
  portfolioType: 'PEA Boursorama', // Valeur par défaut
  profitLoss: 0
});

// Liste des symboles prédéfinis pour le sélecteur
const predefinedSymbols = [
  'SP500',
  'NS100',
  'CAC40',
  'MSCI W',
  'WLD SWP PEA',
  'PANIER DYNAMIQUE'
];

// Variables pour l'édition
const currentEditingId = ref('');
const isEditing = ref(false);

// Ajouter une surveillance sur le changement du type de portefeuille
watch(() => newInvestment.value.portfolioType, (newType) => {
  if (newType === 'PEA PROFILE DYNAMIQUE') {
    // Si PEA PROFILE DYNAMIQUE est sélectionné, forcer le symbole à "PANIER DYNAMIQUE"
    newInvestment.value.symbol = 'PANIER DYNAMIQUE';
  }
});

// Données pour le S&P 500
const sp500Data = ref<{ date: string; close: number }[]>([]);
const isLoadingSP500 = ref(false);
const sp500Error = ref('');

// Prix actuels des ETFs spécifiques
const currentETFPrices = ref({
  cw8: 0,
  cacc: 0,
  pust: 0,
  p500h: 0
});
const isLoadingETFPrices = ref(false);
const etfPricesError = ref('');

// Fonction pour récupérer le prix actuel depuis Yahoo Finance
async function fetchYahooFinancePrice(symbol: string): Promise<number | null> {
  try {
    // Adapter le symbole pour Yahoo Finance si nécessaire
    let yahooSymbol = symbol;
    
    // Mappings pour les indices et ETFs courants
    const symbolMapping: Record<string, string> = {
      'SP500': '^GSPC',
      'NS100': '^NDX',
      'CAC40': '^FCHI',
      'MSCI W': 'URTH',
      'WLD SWP PEA': 'EWLD.PA',
      'PANIER DYNAMIQUE': 'N/A', // Pas de ticker spécifique
      'CW8': 'CW8.PA',
      'CACC': 'CACC.PA',
      'PUST': 'PUST.PA',
      'P500H': 'P500H.PA'
    };
    
    if (symbolMapping[symbol]) {
      yahooSymbol = symbolMapping[symbol];
    }
    
    // Si le symbole est N/A, on ne peut pas récupérer de prix
    if (yahooSymbol === 'N/A') {
      console.log(`Symbole ${symbol} non supporté par Yahoo Finance`);
      return null;
    }
    
    console.log(`Récupération du prix pour ${yahooSymbol}`);
    
    // Utiliser un proxy CORS pour éviter les problèmes de requête cross-origin
    const proxyUrl = 'https://corsproxy.io/?';
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d`;
    
    // Faire la requête via le proxy
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Vérifier si la réponse contient des données valides
    if (data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      console.log(`Prix obtenu pour ${yahooSymbol}: ${price}`);
      return price;
    } else {
      console.error(`Données invalides pour ${yahooSymbol}:`, data);
      return null;
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération du prix pour ${symbol}:`, error);
    // Afficher un message plus détaillé dans la console
    if (error instanceof Error) {
      console.error(`Détail de l'erreur: ${error.message}`);
    }
    return null;
  }
}

// Fonction pour récupérer les prix actuels des ETFs depuis le backend
async function fetchETFPrices() {
  isLoadingETFPrices.value = true;
  etfPricesError.value = '';
  
  try {
    console.log('Récupération des prix des ETFs depuis le backend');
    
    // Liste des tickers à récupérer
    const tickers = {
      cw8: 'CW8.PA',
      cacc: 'CACC.PA',
      pust: 'PUST.PA',
      p500h: 'P500H.PA'
    };
    
    // Récupérer les prix pour chaque ticker
    for (const [key, yahooSymbol] of Object.entries(tickers)) {
      const price = await fetchYahooFinancePrice(key.toUpperCase());
      if (price !== null) {
        currentETFPrices.value[key as keyof typeof currentETFPrices.value] = price;
        console.log(`Prix pour ${key}: ${price}`);
        
        // Mettre à jour les investissements correspondants dans le portfolio
        updateInvestmentWithETFPrice(key.toUpperCase(), price);
      }
    }
    
    // Mettre à jour les métriques et la courbe d'équité avec les nouveaux prix
    tradingStore.updateLongTermMetrics();
    tradingStore.updateLongTermEquityCurve();
    tradingStore.saveToLocalStorage();
    
    // Marquer la dernière mise à jour
    lastUpdateTime.value = new Date();
    
  } catch (err: any) {
    console.error('Erreur de récupération des prix des ETFs:', err);
    etfPricesError.value = `Erreur de récupération: ${err.message}`;
  } finally {
    isLoadingETFPrices.value = false;
  }
}

// Fonction pour mettre à jour un investissement avec le prix d'un ETF
function updateInvestmentWithETFPrice(symbol: string, price: number) {
  const investments = tradingStore.longTerm.investments;
  
  for (const investment of investments) {
    if (investment.symbol === symbol) {
      // Calculer le nouveau profit/perte
      const profitLoss = ((price - investment.averageEntryPrice) / investment.averageEntryPrice) * 100;
      
      // Mettre à jour l'investissement
      investment.currentPrice = price;
      investment.profitLoss = profitLoss;
      console.log(`Mise à jour de l'investissement ${symbol} avec le prix ${price}, P/L: ${profitLoss.toFixed(2)}%`);
    }
  }
}

// Variables pour le suivi des mises à jour automatiques
const autoUpdateEnabled = ref<boolean>(false);
const lastUpdateTime = ref<Date | null>(null);
const dailyUpdateScheduled = ref<boolean>(false);
let updateInterval: number | null = null;
let dailyUpdateTimeout: number | null = null;

// Ajouter des données pour le suivi des variations quotidiennes
const dailyPerformance = ref<Record<string, { value: number, change: number, changePercent: number }>>({});

// Fonction pour formatter l'heure
function formatTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Fonction pour calculer la date de la prochaine mise à jour à 18h
function getNextUpdate18h(): Date {
  const now = new Date();
  const next18h = new Date(now);
  
  // Définir l'heure à 18:00:00
  next18h.setHours(18, 0, 0, 0);
  
  // Si l'heure actuelle est déjà passée 18h, programmer pour le lendemain
  if (now.getHours() >= 18) {
    next18h.setDate(next18h.getDate() + 1);
  }
  
  return next18h;
}

// Fonction pour planifier la mise à jour quotidienne à 18h
function scheduleDailyUpdate() {
  // Annuler tout timeout existant
  if (dailyUpdateTimeout !== null) {
    window.clearTimeout(dailyUpdateTimeout);
    dailyUpdateTimeout = null;
  }
  
  const next18h = getNextUpdate18h();
  const timeUntilNext = next18h.getTime() - new Date().getTime();
  
  console.log(`Prochaine mise à jour quotidienne programmée à ${next18h.toLocaleString('fr-FR')} (dans ${Math.round(timeUntilNext / 60000)} min)`);
  
  // Programmer la mise à jour
  dailyUpdateTimeout = window.setTimeout(() => {
    console.log('Exécution de la mise à jour quotidienne à 18h');
    updateDailyPerformance();
    
    // Reprogrammer pour le lendemain
    scheduleDailyUpdate();
  }, timeUntilNext);
  
  dailyUpdateScheduled.value = true;
}

// Fonction pour calculer et enregistrer la performance quotidienne
async function updateDailyPerformance() {
  console.log('Calcul de la performance quotidienne à 18h');
  
  try {
    const investments = tradingStore.longTerm.investments;
    const date = new Date();
    const dateString = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
    
    // Récupérer les données de la veille si elles existent
    const previousDayData = localStorage.getItem(`longterm-daily-${dateString.substring(0, 8)}${(date.getDate() - 1).toString().padStart(2, '0')}`);
    const previousPrices: Record<string, number> = previousDayData ? JSON.parse(previousDayData) : {};
    
    // Préparer les données du jour
    const todayPrices: Record<string, number> = {};
    const performanceData: Record<string, { value: number, change: number, changePercent: number }> = {};
    
    // Mettre à jour les prix actuels
    for (const investment of investments) {
      const newPrice = await fetchYahooFinancePrice(investment.symbol);
      
      if (newPrice !== null) {
        // Mettre à jour le prix actuel
        investment.currentPrice = newPrice;
        // Recalculer le profit/perte
        investment.profitLoss = ((newPrice - investment.averageEntryPrice) / investment.averageEntryPrice) * 100;
        
        // Enregistrer le prix pour aujourd'hui
        todayPrices[investment.symbol] = newPrice;
        
        // Calculer la performance quotidienne
        const previousPrice = previousPrices[investment.symbol] || investment.averageEntryPrice;
        const dailyChange = newPrice - previousPrice;
        const dailyChangePercent = previousPrice > 0 ? (dailyChange / previousPrice) * 100 : 0;
        
        performanceData[investment.symbol] = {
          value: newPrice,
          change: dailyChange,
          changePercent: dailyChangePercent
        };
        
        console.log(`${investment.symbol}: ${previousPrice.toFixed(2)} → ${newPrice.toFixed(2)} | Variation: ${dailyChange.toFixed(2)} (${dailyChangePercent.toFixed(2)}%)`);
      }
    }
    
    // Sauvegarder les prix du jour pour comparaison future
    localStorage.setItem(`longterm-daily-${dateString}`, JSON.stringify(todayPrices));
    
    // Sauvegarder les données de performance
    localStorage.setItem(`longterm-performance-${dateString}`, JSON.stringify(performanceData));
    
    // Mettre à jour les métriques et la courbe d'équité
    tradingStore.updateLongTermMetrics();
    tradingStore.updateLongTermEquityCurve();
    tradingStore.saveToLocalStorage();
    
    console.log(`Performance quotidienne enregistrée pour le ${dateString}`);
    lastUpdateTime.value = new Date();
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la performance quotidienne:', error);
  }
}

// Vérifier si une mise à jour quotidienne a déjà été programmée
onMounted(async () => {
  // Charger les investments depuis MongoDB
  const longTermStore = useLongTermStore();
  await longTermStore.fetchInvestments();
  
  // Appeler updateLongTermEquityCurve au chargement de la page
  tradingStore.updateLongTermEquityCurve();
  
  // Charger les données de performance les plus récentes
  loadLatestPerformanceData();
  
  // Désactiver les mises à jour automatiques
  if (updateInterval !== null) {
    window.clearInterval(updateInterval);
    updateInterval = null;
  }
  
  if (dailyUpdateTimeout !== null) {
    window.clearTimeout(dailyUpdateTimeout);
    dailyUpdateTimeout = null;
  }
  
  // Récupérer les prix des ETFs
  fetchETFPrices();
  
  // Mettre à jour les données et la courbe d'équité au chargement de la page
  updateAllData();
  
  // Initialiser les valeurs de simulation avec les données réelles du portefeuille
  nextTick(() => {
    if (totalPortfolioValue.value > 0) {
      monteCarloSimulation.value.initial = totalPortfolioValue.value;
      compoundSimulation.value.initial = totalPortfolioValue.value;
      goalCalculation.value.currentAmount = totalPortfolioValue.value;
      
      // Fixer les taux de rendement à 8% comme demandé
      monteCarloSimulation.value.expectedReturn = 8;
      compoundSimulation.value.rate = 8;
      goalCalculation.value.annualReturn = 8;
      
      // Définir les valeurs par défaut demandées
      monteCarloSimulation.value.monthlyContribution = 500; // 500€ par mois
      monteCarloSimulation.value.simulations = 10000; // 10000 simulations
      
      // Définir un montant mensuel par défaut pour les autres simulations
      compoundSimulation.value.monthly = 500;
      goalCalculation.value.monthlyContribution = 500;
      
      // Définir un objectif financier à 1 000 000 €
      goalCalculation.value.targetAmount = 1000000;
      
      // Définir une volatilité adaptée au type d'investissements
      const volatility = getRecommendedVolatility();
      monteCarloSimulation.value.volatility = volatility;
    } else {
      // Si pas de données de portefeuille, utiliser des valeurs par défaut
      monteCarloSimulation.value.initial = 10000;
      monteCarloSimulation.value.expectedReturn = 8;
      monteCarloSimulation.value.monthlyContribution = 500;
      monteCarloSimulation.value.simulations = 10000;
      compoundSimulation.value.initial = 10000;
      compoundSimulation.value.rate = 8;
      compoundSimulation.value.monthly = 500;
      goalCalculation.value.currentAmount = 10000;
      goalCalculation.value.monthlyContribution = 500;
      goalCalculation.value.annualReturn = 8;
    }
  });
});

// Nettoyer les intervalles et timeouts lors de la destruction du composant
onUnmounted(() => {
  if (updateInterval !== null) {
    window.clearInterval(updateInterval);
    updateInterval = null;
  }
  if (dailyUpdateTimeout !== null) {
    window.clearTimeout(dailyUpdateTimeout);
    dailyUpdateTimeout = null;
  }
});

// Fonction pour mettre à jour tous les prix
async function updateAllPrices() {
  try {
    lastUpdateTime.value = new Date();
    const investments = tradingStore.longTerm.investments;
    const updatedCount = {
      success: 0,
      failed: 0
    };
    
    // Afficher une notification de démarrage
    const notification = document.createElement('div');
    notification.classList.add('fixed', 'bottom-4', 'right-4', 'bg-blue-100', 'text-blue-700', 'p-4', 'rounded-lg', 'shadow-lg', 'z-50');
    notification.id = 'price-update-notification';
    notification.innerHTML = `<div class="flex items-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Récupération des prix en cours...</div>`;
    document.body.appendChild(notification);
    
    // D'abord, récupérer les prix des ETFs
    await fetchETFPrices();
    
    // Pour chaque investissement, vérifier s'il correspond à un ETF déjà mis à jour
    for (const investment of investments) {
      // Mettre à jour le message de notification
      notification.innerHTML = `<div class="flex items-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Récupération du prix pour ${investment.symbol}...</div>`;

      try {
        // Vérifier si c'est un des ETFs déjà mis à jour
        let updatedFromETF = false;
        
        if (investment.symbol === 'CW8') {
          investment.currentPrice = currentETFPrices.value.cw8;
          updatedFromETF = true;
        } else if (investment.symbol === 'CACC') {
          investment.currentPrice = currentETFPrices.value.cacc;
          updatedFromETF = true;
        } else if (investment.symbol === 'PUST') {
          investment.currentPrice = currentETFPrices.value.pust;
          updatedFromETF = true;
        } else if (investment.symbol === 'P500H') {
          investment.currentPrice = currentETFPrices.value.p500h;
          updatedFromETF = true;
        }
        
        if (updatedFromETF) {
          // Recalculer le profit/perte
          investment.profitLoss = ((investment.currentPrice - investment.averageEntryPrice) / investment.averageEntryPrice) * 100;
          updatedCount.success++;
          continue; // Passer au suivant
        }
        
        // Si ce n'est pas un ETF déjà mis à jour, récupérer le prix depuis Yahoo Finance
        const newPrice = await fetchYahooFinancePrice(investment.symbol);
        
        if (newPrice !== null) {
          // Recalculer le profit/perte
          const profitLoss = ((newPrice - investment.averageEntryPrice) / investment.averageEntryPrice) * 100;
          
          // Mettre à jour l'investissement
          investment.currentPrice = newPrice;
          investment.profitLoss = profitLoss;
          updatedCount.success++;
        } else {
          updatedCount.failed++;
        }
      } catch (innerError) {
        console.error(`Erreur lors de la mise à jour du prix pour ${investment.symbol}:`, innerError);
        updatedCount.failed++;
      }
    }
    
    // Mettre à jour les métriques et sauvegarder
    tradingStore.updateLongTermMetrics();
    
    // Mettre à jour la courbe d'équité avec les nouveaux prix
    tradingStore.updateLongTermEquityCurve();
    
    tradingStore.saveToLocalStorage();
    
    // Supprimer la notification temporaire
    document.getElementById('price-update-notification')?.remove();
    
    // Créer une notification de résultat
    const resultNotification = document.createElement('div');
    const isSuccess = updatedCount.success > 0;
    const bgColor = isSuccess ? 'bg-green-100' : 'bg-red-100';
    const textColor = isSuccess ? 'text-green-700' : 'text-red-700';
    const iconColor = isSuccess ? 'text-green-500' : 'text-red-500';
    const icon = isSuccess ? 
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>' : 
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    
    resultNotification.classList.add('fixed', 'bottom-4', 'right-4', bgColor, textColor, 'p-4', 'rounded-lg', 'shadow-lg', 'z-50');
    resultNotification.innerHTML = `<div class="flex items-center">${icon}Mise à jour terminée! ${updatedCount.success} prix mis à jour, ${updatedCount.failed} échecs.</div>`;
    document.body.appendChild(resultNotification);
    
    // Supprimer la notification après 5 secondes
    setTimeout(() => {
      resultNotification.remove();
    }, 5000);
    
    console.log(`Mise à jour terminée à ${formatTime(lastUpdateTime.value)}! ${updatedCount.success} prix mis à jour, ${updatedCount.failed} échecs.`);
    
    if (!autoUpdateEnabled.value && updatedCount.failed > 0) {
      alert(`Attention: ${updatedCount.failed} prix n'ont pas pu être mis à jour. Vérifiez la console pour plus de détails.`);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des prix:', error);
    
    // Supprimer la notification temporaire si elle existe
    document.getElementById('price-update-notification')?.remove();
    
    // Afficher une notification d'erreur
    const errorNotification = document.createElement('div');
    errorNotification.classList.add('fixed', 'bottom-4', 'right-4', 'bg-red-100', 'text-red-700', 'p-4', 'rounded-lg', 'shadow-lg', 'z-50');
    errorNotification.innerHTML = `<div class="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>Erreur lors de la mise à jour des prix: ${error instanceof Error ? error.message : String(error)}</div>`;
    document.body.appendChild(errorNotification);
    
    // Supprimer la notification après 5 secondes
    setTimeout(() => {
      errorNotification.remove();
    }, 5000);
    
    if (!autoUpdateEnabled.value) {
      alert(`Erreur lors de la mise à jour des prix: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Fonction pour démarrer la mise à jour automatique
function toggleAutoUpdate() {
  autoUpdateEnabled.value = !autoUpdateEnabled.value;
  
  if (autoUpdateEnabled.value) {
    // Mise à jour immédiate
    updateAllPrices();
    
    // Configuration de l'intervalle (15 minutes = 15 * 60 * 1000 ms)
    updateInterval = window.setInterval(() => {
      console.log('Exécution de la mise à jour automatique...');
      updateAllPrices();
    }, 15 * 60 * 1000);
    
    console.log('Mise à jour automatique activée - prochaine mise à jour dans 15 minutes');
  } else {
    // Arrêter l'intervalle si désactivé
    if (updateInterval !== null) {
      window.clearInterval(updateInterval);
      updateInterval = null;
    }
    console.log('Mise à jour automatique désactivée');
  }
}

// Ajouter un investissement
const addInvestment = async () => {
  // Si on est en mode édition, appeler updateInvestment sinon ajouter un nouvel investissement
  if (isEditing.value) {
    updateInvestment();
    return;
  }
  
  try {
    console.log('Tentative d\'ajout d\'investissement:', newInvestment.value);
    
    // Vérifier que toutes les valeurs requises sont présentes
    if (!newInvestment.value.symbol || 
        !newInvestment.value.quantity || 
        !newInvestment.value.averageEntryPrice) {
      console.error('Valeurs manquantes dans le formulaire');
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    // S'assurer que les champs numériques sont bien des nombres
    const quantity = parseFloat(String(newInvestment.value.quantity));
    const averageEntryPrice = parseFloat(String(newInvestment.value.averageEntryPrice));
    
    // Tenter de récupérer le prix actuel depuis Yahoo Finance
    let currentPrice = 0;
    
    if (!newInvestment.value.currentPrice || parseFloat(String(newInvestment.value.currentPrice)) === 0) {
      const yahooPrice = await fetchYahooFinancePrice(newInvestment.value.symbol);
      
      if (yahooPrice !== null) {
        currentPrice = yahooPrice;
      } else {
        // Si le prix n'a pas pu être récupéré, demander à l'utilisateur de le saisir manuellement
        const manualPrice = prompt(
          `Le prix pour ${newInvestment.value.symbol} n'a pas pu être récupéré automatiquement. Veuillez entrer le prix actuel manuellement:`,
          averageEntryPrice.toString()
        );
        
        if (manualPrice !== null) {
          currentPrice = parseFloat(manualPrice);
        } else {
          // Si l'utilisateur annule, utiliser le prix d'entrée comme prix actuel
          currentPrice = averageEntryPrice;
        }
      }
    } else {
      currentPrice = parseFloat(String(newInvestment.value.currentPrice));
    }
    
    // Calculer le profit/perte en pourcentage
    const profitLoss = ((currentPrice - averageEntryPrice) / averageEntryPrice) * 100;
    
    // Créer l'objet d'investissement correctement typé
    const investmentToAdd = {
      symbol: newInvestment.value.symbol,
      quantity: quantity,
      averageEntryPrice: averageEntryPrice,
      currentPrice: currentPrice,
      purchaseDate: new Date(newInvestment.value.purchaseDate),
      strategy: newInvestment.value.strategy,
      portfolioType: newInvestment.value.portfolioType,
      profitLoss: profitLoss
    };
    
    console.log('Investissement à ajouter:', investmentToAdd);
    
    // Ajouter l'investissement au store
    tradingStore.addLongTermInvestment(investmentToAdd);
    
    // Mettre à jour la courbe d'équité
    tradingStore.updateLongTermEquityCurve();
    
    console.log('Investissement ajouté avec succès');
    
    // Réinitialiser le formulaire
    newInvestment.value = {
      symbol: 'SP500',
      quantity: 0,
      averageEntryPrice: 0,
      currentPrice: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      strategy: 'DCA',
      portfolioType: 'PEA Boursorama',
      profitLoss: 0
    };
    
    // Fermer le modal
    showAddModal.value = false;
    
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'investissement:', error);
    alert(`Erreur lors de l'ajout: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Mettre à jour un investissement existant
const updateInvestment = () => {
  try {
    console.log('Mise à jour de l\'investissement:', currentEditingId.value);
    
    // Vérifier que toutes les valeurs requises sont présentes
    if (!newInvestment.value.symbol || 
        !newInvestment.value.quantity || 
        !newInvestment.value.averageEntryPrice || 
        !newInvestment.value.currentPrice) {
      console.error('Valeurs manquantes dans le formulaire');
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    // S'assurer que les champs numériques sont bien des nombres
    const quantity = parseFloat(String(newInvestment.value.quantity));
    const averageEntryPrice = parseFloat(String(newInvestment.value.averageEntryPrice));
    const currentPrice = parseFloat(String(newInvestment.value.currentPrice));
    
    // Calculer le profit/perte en pourcentage
    const profitLoss = ((currentPrice - averageEntryPrice) / averageEntryPrice) * 100;
    
    // Trouver l'index de l'investissement à mettre à jour
    const investmentIndex = tradingStore.longTerm.investments.findIndex(inv => inv.id === currentEditingId.value);
    
    if (investmentIndex === -1) {
      console.error('Investissement non trouvé');
      alert('Erreur: Investissement non trouvé');
      return;
    }
    
    // Mettre à jour l'investissement
    tradingStore.longTerm.investments[investmentIndex] = {
      ...tradingStore.longTerm.investments[investmentIndex],
      symbol: newInvestment.value.symbol,
      quantity: quantity,
      averageEntryPrice: averageEntryPrice,
      currentPrice: currentPrice,
      purchaseDate: new Date(newInvestment.value.purchaseDate),
      strategy: newInvestment.value.strategy,
      portfolioType: newInvestment.value.portfolioType,
      profitLoss: profitLoss
    };
    
    console.log('Investissement mis à jour avec succès');
    
    // Mettre à jour les métriques et sauvegarder
    tradingStore.updateLongTermMetrics();
    tradingStore.saveToLocalStorage();
    
    // Mettre à jour la courbe d'équité
    tradingStore.updateLongTermEquityCurve();
    
    // Réinitialiser le formulaire
    newInvestment.value = {
      symbol: 'SP500',
      quantity: 0,
      averageEntryPrice: 0,
      currentPrice: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      strategy: 'DCA',
      portfolioType: 'PEA Boursorama',
      profitLoss: 0
    };
    
    // Réinitialiser les variables d'édition
    currentEditingId.value = '';
    isEditing.value = false;
    
    // Fermer le modal
    showAddModal.value = false;
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'investissement:', error);
    alert(`Erreur lors de la mise à jour: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Fonction pour supprimer un investissement
const deleteInvestment = (id: string) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cet investissement ?')) {
    tradingStore.deleteLongTermInvestment(id);
    // Mettre à jour la courbe d'équité après la suppression
    tradingStore.updateLongTermEquityCurve();
  }
};

// Ajouter la période de filtrage
const filterPeriod = ref('all'); // 'week', 'month', 'year', 'all'

// Filtrer les investissements par période
const filteredInvestments = computed(() => {
  const now = new Date();
  const investments = sortedInvestments.value;
  
  switch (filterPeriod.value) {
    case 'week':
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return investments.filter(inv => new Date(inv.purchaseDate) >= oneWeekAgo);
    case 'month':
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return investments.filter(inv => new Date(inv.purchaseDate) >= oneMonthAgo);
    case 'year':
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return investments.filter(inv => new Date(inv.purchaseDate) >= oneYearAgo);
    default:
      return investments;
  }
});

function confirmDeleteAll() {
  showDeleteModal.value = true;
}

function deleteAllData() {
  tradingStore.deleteAllTrades();
  showDeleteModal.value = false;
}

// Fonction pour charger les données de performance les plus récentes
function loadLatestPerformanceData() {
  try {
    const date = new Date();
    let currentDate = new Date(date);
    let foundData = false;
    
    // Essayer de charger les données à partir de la date actuelle, puis revenir en arrière jusqu'à 7 jours
    for (let i = 0; i < 7; i++) {
      const dateString = currentDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
      const performanceData = localStorage.getItem(`longterm-performance-${dateString}`);
      
      if (performanceData) {
        dailyPerformance.value = JSON.parse(performanceData);
        console.log(`Données de performance chargées pour ${dateString}:`, dailyPerformance.value);
        foundData = true;
        break;
      }
      
      // Essayer le jour précédent
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    if (!foundData) {
      console.log('Aucune donnée de performance récente trouvée');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données de performance:', error);
  }
}

// Fonction pour générer une couleur cohérente basée sur le symbole
function getColorForSymbol(symbol: string) {
  // Liste de couleurs prédéfinies
  const colors = [
    '#4F46E5', // indigo
    '#10B981', // emerald
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#3B82F6', // blue
    '#F97316', // orange
    '#A855F7'  // purple
  ];
  
  // Utiliser la somme des codes ASCII des caractères comme hash simple
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Assurer que le hash est positif et le mapper à l'index du tableau de couleurs
  hash = Math.abs(hash);
  const colorIndex = hash % colors.length;
  
  return colors[colorIndex];
}

// Fonction pour éditer un investissement
const editInvestment = (investment: LongTermInvestment) => {
  // Copier les données de l'investissement dans le formulaire
  newInvestment.value = {
    symbol: investment.symbol,
    quantity: investment.quantity,
    averageEntryPrice: investment.averageEntryPrice,
    currentPrice: investment.currentPrice,
    purchaseDate: investment.purchaseDate instanceof Date 
      ? investment.purchaseDate.toISOString().split('T')[0] 
      : new Date(investment.purchaseDate).toISOString().split('T')[0],
    strategy: investment.strategy,
    portfolioType: investment.portfolioType,
    profitLoss: investment.profitLoss
  };
  
  // Sauvegarder l'ID de l'investissement pour le mettre à jour
  currentEditingId.value = investment.id;
  
  // Ouvrir le modal pour l'édition
  showAddModal.value = true;
  isEditing.value = true;
};

// Fonction pour mettre à jour la courbe d'équité long terme
function updateEquityCurve() {
  tradingStore.updateLongTermEquityCurve();
}

// Calcul du rendement mensuel moyen (estimé)
const averageMonthlyReturn = computed(() => {
  const equityCurve = tradingStore.longTerm.equityCurve;
  
  // Besoin d'au moins 2 points pour calculer un rendement
  if (equityCurve.length < 2) return 0;
  
  // Prendre le premier et le dernier point de la courbe
  const firstPoint = equityCurve[0];
  const lastPoint = equityCurve[equityCurve.length - 1];
  
  // Calculer le nombre de mois écoulés
  const firstDate = firstPoint.date instanceof Date ? firstPoint.date : new Date(firstPoint.date);
  const lastDate = lastPoint.date instanceof Date ? lastPoint.date : new Date(lastPoint.date);
  
  const monthsDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                     (lastDate.getMonth() - firstDate.getMonth());
  
  // Si moins d'un mois s'est écoulé, utiliser une estimation proportionnelle
  const timeElapsedInMonths = Math.max(monthsDiff, 0.1);
  
  // Calculer le rendement total
  const totalReturn = (lastPoint.balance - firstPoint.balance) / firstPoint.balance;
  
  // Calculer le rendement mensuel moyen (en pourcentage)
  return (Math.pow(1 + totalReturn, 1 / timeElapsedInMonths) - 1) * 100;
});

// Calcul de la tendance récente (en prenant les 3 derniers points si disponibles)
const recentTrend = computed(() => {
  const equityCurve = tradingStore.longTerm.equityCurve;
  
  // Besoin d'au moins 2 points pour identifier une tendance
  if (equityCurve.length < 2) return { direction: 'stable', value: 0 };
  
  // Prendre les 3 derniers points (ou moins si pas assez de points)
  const recentPoints = equityCurve.slice(-Math.min(3, equityCurve.length));
  
  // Calculer les variations entre points consécutifs
  const variations = [];
  for (let i = 1; i < recentPoints.length; i++) {
    const prevValue = recentPoints[i-1].balance;
    const currentValue = recentPoints[i].balance;
    const variation = (currentValue - prevValue) / prevValue * 100;
    variations.push(variation);
  }
  
  // Calculer la moyenne des variations
  const avgVariation = variations.reduce((sum, var_) => sum + var_, 0) / variations.length;
  
  // Déterminer la direction de la tendance
  let direction;
  if (avgVariation > 1) direction = 'en forte hausse';
  else if (avgVariation > 0.2) direction = 'en hausse';
  else if (avgVariation < -1) direction = 'en forte baisse';
  else if (avgVariation < -0.2) direction = 'en baisse';
  else direction = 'stable';
  
  return { 
    direction, 
    value: avgVariation 
  };
});

// Variables pour la simulation Monte Carlo
const monteCarloSimulation = ref({
  initial: 1000,
  expectedReturn: 8,
  volatility: 15,
  years: 10,
  simulations: 10000,
  monthlyContribution: 500 // Ajout du montant d'investissement mensuel
});

// Volatilités prédéfinies avec explications
const volatilityOptions = [
  { value: 5, label: "5% - Livrets et obligations d'État (risque très faible)" },
  { value: 8, label: "8% - Obligations d'entreprises et fonds diversifiés prudents (risque faible)" },
  { value: 12, label: "12% - Portefeuille équilibré actions/obligations (risque modéré)" },
  { value: 15, label: "15% - Actions grandes capitalisations et fonds diversifiés (risque moyen)" },
  { value: 18, label: "18% - Actions pures (risque élevé)" },
  { value: 25, label: "25% - Actions small caps et marchés émergents (risque très élevé)" },
  { value: 35, label: "35% - Cryptomonnaies et actifs alternatifs (risque extrême)" }
];

// Variables pour la simulation des intérêts composés
const compoundSimulation = ref({
  initial: 1000,
  rate: 8,
  monthly: 100,
  years: 10
});

// Variables pour le calcul d'objectifs
const goalCalculation = ref({
  targetAmount: 1000000,
  currentAmount: 50000,
  monthlyContribution: 500,
  annualReturn: 8
});

// Variables pour les résultats de la simulation Monte Carlo
const monteCarloResults = ref<number[]>([]);
const monteCarloStats = ref({
  mean: 0,
  median: 0,
  percentile25: 0,
  percentile75: 0,
  min: 0,
  max: 0
});

// Variables pour les résultats de la simulation des intérêts composés
const compoundResults = ref({
  finalValue: 0,
  invested: 0,
  interest: 0,
  totalReturn: 0
});

// Variables pour les résultats du calcul d'objectifs
const goalResults = ref({
  years: 0,
  targetDate: '',
  totalContributions: 0,
  totalInterest: 0
});

// Initialisation des valeurs de simulation à partir des données existantes
onMounted(() => {
  // Initialiser les valeurs de simulation avec les données réelles du portefeuille
  nextTick(() => {
    if (totalPortfolioValue.value > 0) {
      monteCarloSimulation.value.initial = totalPortfolioValue.value;
      compoundSimulation.value.initial = totalPortfolioValue.value;
      goalCalculation.value.currentAmount = totalPortfolioValue.value;
      
      // Fixer les taux de rendement à 8% comme demandé
      monteCarloSimulation.value.expectedReturn = 8;
      compoundSimulation.value.rate = 8;
      goalCalculation.value.annualReturn = 8;
      
      // Définir les valeurs par défaut demandées
      monteCarloSimulation.value.monthlyContribution = 500; // 500€ par mois
      monteCarloSimulation.value.simulations = 10000; // 10000 simulations
      
      // Définir un montant mensuel par défaut pour les autres simulations
      compoundSimulation.value.monthly = 500;
      goalCalculation.value.monthlyContribution = 500;
      
      // Définir un objectif financier à 1 000 000 €
      goalCalculation.value.targetAmount = 1000000;
      
      // Définir une volatilité adaptée au type d'investissements
      const volatility = getRecommendedVolatility();
      monteCarloSimulation.value.volatility = volatility;
    } else {
      // Si pas de données de portefeuille, utiliser des valeurs par défaut
      monteCarloSimulation.value.initial = 10000;
      monteCarloSimulation.value.expectedReturn = 8;
      monteCarloSimulation.value.monthlyContribution = 500;
      monteCarloSimulation.value.simulations = 10000;
      compoundSimulation.value.initial = 10000;
      compoundSimulation.value.rate = 8;
      compoundSimulation.value.monthly = 500;
      goalCalculation.value.currentAmount = 10000;
      goalCalculation.value.monthlyContribution = 500;
      goalCalculation.value.annualReturn = 8;
    }
  });
});

// Fonction pour calculer la durée moyenne des investissements
function getAverageInvestmentTime() {
  if (!sortedInvestments.value.length) return 1;
  
  const now = new Date();
  const totalDays = sortedInvestments.value.reduce((sum, investment) => {
    const purchaseDate = new Date(investment.purchaseDate);
    const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);
  
  return totalDays / sortedInvestments.value.length / 365; // Convertir en années
}

// Variable pour les commentaires d'interprétation
const simulationInsights = ref({
  optimistic: '',
  neutral: '',
  pessimistic: '',
  recommendation: ''
});

// Fonction pour calculer la simulation Monte Carlo
function runMonteCarloSimulation() {
  monteCarloResults.value = [];
  
  // Préparer les tableaux pour suivre les trajectoires
  const trajectories: number[][] = [];
  const years = monteCarloSimulation.value.years;
  const initial = monteCarloSimulation.value.initial;
  const expectedReturn = monteCarloSimulation.value.expectedReturn / 100; // Convertir en décimal
  const volatility = monteCarloSimulation.value.volatility / 100; // Convertir en décimal
  const monthlyContribution = monteCarloSimulation.value.monthlyContribution;
  
  // Effectuer les simulations
  for (let i = 0; i < monteCarloSimulation.value.simulations; i++) {
    let value = initial;
    const trajectory = [value];
    
    // Simuler l'évolution mois par mois pour plus de précision
    for (let month = 1; month <= years * 12; month++) {
      // Simuler le rendement mensuel avec volatilité (distribution normale approximative)
      const randomReturn = Math.random() * 2 - 1; // Entre -1 et 1
      const monthlyReturn = (expectedReturn / 12) + (randomReturn * volatility / Math.sqrt(12));
      
      // Appliquer le rendement mensuel
      value = value * (1 + monthlyReturn);
      
      // Ajouter l'investissement mensuel
      value += monthlyContribution;
      
      // Enregistrer la valeur à la fin de chaque année
      if (month % 12 === 0) {
        trajectory.push(value);
      }
    }
    
    trajectories.push(trajectory);
    monteCarloResults.value.push(trajectory[trajectory.length - 1]);
  }
  
  // Calculer les statistiques
  calculateMonteCarloStats();
  
  // Mettre à jour les données du graphique des trajectoires
  monteCarloPathsData.value = {
    labels: Array.from({ length: years + 1 }, (_, i) => `Année ${i}`),
    datasets: [
      // Ajouter quelques trajectoires représentatives (10% des simulations)
      ...trajectories.filter((_, idx) => idx % Math.floor(trajectories.length / 10) === 0).map((trajectory, idx) => ({
        label: `Simulation ${idx + 1}`,
        data: trajectory,
        borderColor: getRandomColor(idx),
        borderWidth: 1,
        fill: false,
        pointRadius: 0
      })),
      // Ajouter la trajectoire médiane
      {
        label: 'Médiane',
        data: Array.from({ length: years + 1 }, (_, yearIdx) => {
          const valuesAtYear = trajectories.map(t => t[yearIdx]);
          return median(valuesAtYear);
        }),
        borderColor: '#F59E0B',
        borderWidth: 3,
        fill: false,
        pointRadius: 2
      }
    ]
  };
  
  // Générer des commentaires d'interprétation avec prise en compte des investissements mensuels
  generateInsights();
}

// Fonction pour générer des couleurs aléatoires pour les graphiques
function getRandomColor(idx: number): string {
  const colors = [
    'rgba(79, 70, 229, 0.5)', // Indigo
    'rgba(16, 185, 129, 0.5)', // Émeraude
    'rgba(245, 158, 11, 0.5)', // Ambre
    'rgba(239, 68, 68, 0.5)',  // Rouge
    'rgba(139, 92, 246, 0.5)', // Violet
    'rgba(236, 72, 153, 0.5)', // Rose
    'rgba(6, 182, 212, 0.5)',  // Cyan
    'rgba(20, 184, 166, 0.5)'  // Turquoise
  ];
  return colors[idx % colors.length];
}

// Fonction pour générer des commentaires d'interprétation
function generateInsights() {
  const initial = monteCarloSimulation.value.initial;
  const years = monteCarloSimulation.value.years;
  const expectedReturn = monteCarloSimulation.value.expectedReturn;
  const monthlyContribution = monteCarloSimulation.value.monthlyContribution;
  const totalContributions = monthlyContribution * years * 12;
  const totalInvested = initial + totalContributions;
  
  // Scénario optimiste
  simulationInsights.value.optimistic = 
    `Dans un scénario optimiste (top 10%), votre capital de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(initial)} 
    avec un investissement mensuel de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monthlyContribution)}
    pourrait atteindre ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.value.percentile90)} 
    après ${years} ans, soit ${(monteCarloStats.value.percentile90 / totalInvested * 100).toFixed(0)}% du capital investi.`;
  
  // Scénario neutre
  simulationInsights.value.neutral = 
    `Selon notre simulation, vous avez 50% de chances d'atteindre au moins ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.value.median)} 
    après ${years} ans, ce qui représente un gain de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.value.median - totalInvested)}
    sur un investissement total de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalInvested)}.`;
  
  // Scénario pessimiste
  simulationInsights.value.pessimistic = 
    `Dans un scénario pessimiste (10% les plus bas), votre capital pourrait n'atteindre que ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.value.percentile10)}, 
    ce qui souligne l'importance de la diversification et d'un horizon à long terme. 
    Cela représenterait ${(monteCarloStats.value.percentile10 >= totalInvested ? "un gain de " : "une perte de ")} 
    ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.abs(monteCarloStats.value.percentile10 - totalInvested))}.`;
  
  // Recommandation sur la volatilité
  let volatilityAdvice = "";
  if (monteCarloSimulation.value.volatility < 10) {
    volatilityAdvice = "La volatilité de votre portefeuille est actuellement faible. Cela limite le risque, mais pourrait aussi limiter le potentiel de gains. Envisagez d'inclure une petite portion d'actifs plus dynamiques pour améliorer le rendement potentiel.";
  } else if (monteCarloSimulation.value.volatility < 18) {
    volatilityAdvice = "La volatilité de votre portefeuille est équilibrée, offrant un bon compromis entre risque et rendement potentiel.";
  } else {
    volatilityAdvice = "La volatilité de votre portefeuille est élevée. Bien que cela puisse générer des rendements importants, considérez une diversification vers des actifs plus stables pour réduire le risque global.";
  }
  
  // Recommandation complète
  const timeHorizonComment = years < 5 ? 
    "Un horizon d'investissement plus long pourrait améliorer significativement vos résultats et réduire l'impact de la volatilité." :
    "Votre horizon d'investissement à long terme est adapté pour maximiser les chances de succès.";
  
  simulationInsights.value.recommendation = `${volatilityAdvice} ${timeHorizonComment} Avec un investissement mensuel de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monthlyContribution)}, vous pourriez accumuler un capital significatif grâce à l'effet combiné des intérêts composés et de vos contributions régulières.`;
}

// Données pour le graphique des trajectoires Monte Carlo
const monteCarloPathsData = ref({
  labels: [],
  datasets: []
});

// Options pour le graphique des trajectoires Monte Carlo
const monteCarloPathsOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: true,
      text: 'Trajectoires de la Simulation Monte Carlo'
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
          }
          return label;
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: 'Valeur (€)'
      }
    },
    x: {
      title: {
        display: true,
        text: 'Années'
      }
    }
  }
};

// Fonction pour calculer la médiane d'une liste
function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Fonction pour calculer la moyenne d'une liste
function average(arr: number[]): number {
  return arr.reduce((sum: number, value: number) => sum + value, 0) / arr.length;
}

// Fonction pour calculer le percentile d'une liste
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (p / 100) * (sorted.length - 1);
  return sorted[Math.round(pos)];
}

// Données pour le graphique de la simulation Monte Carlo
const monteCarloChartData = computed(() => {
  return {
    labels: Array.from({ length: monteCarloSimulation.value.years }, (_, i) => `Année ${i + 1}`),
    datasets: [
      {
        label: 'Valeur',
        data: monteCarloResults.value,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.1,
        fill: false
      }
    ]
  };
});

// Options pour le graphique de la simulation Monte Carlo
const monteCarloChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    },
    title: {
      display: true,
      text: 'Simulation Monte Carlo'
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
          }
          return label;
        },
        footer: function(tooltipItems: any[]) {
          const datasetIndex = tooltipItems[0].datasetIndex;
          const dataIndex = tooltipItems[0].dataIndex;
          
          // Si c'est la valeur du portfolio, calculer le profit/perte vs montant investi
          if (datasetIndex === 0 && tradingStore.longTerm.equityCurve[dataIndex]) {
            const point = tradingStore.longTerm.equityCurve[dataIndex];
            const invested = point.invested || 0;
            
            if (invested > 0) {
              const profitLoss = point.balance - invested;
              const percentage = (profitLoss / invested) * 100;
              return `Gain/Perte: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(profitLoss)} (${percentage.toFixed(2)}%)`;
            }
          }
          return '';
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: 'Valeur (€)'
      }
    }
  }
};

// Fonction pour calculer les statistiques de la simulation Monte Carlo
function calculateMonteCarloStats() {
  monteCarloStats.value.mean = average(monteCarloResults.value);
  monteCarloStats.value.median = median(monteCarloResults.value);
  monteCarloStats.value.percentile25 = percentile(monteCarloResults.value, 25);
  monteCarloStats.value.percentile75 = percentile(monteCarloResults.value, 75);
  monteCarloStats.value.min = Math.min(...monteCarloResults.value);
  monteCarloStats.value.max = Math.max(...monteCarloResults.value);
}

// Fonction pour calculer les intérêts composés
function calculateCompoundInterest() {
  const initial = compoundSimulation.value.initial;
  const rate = compoundSimulation.value.rate / 100 / 12;
  const monthly = compoundSimulation.value.monthly;
  const years = compoundSimulation.value.years;
  const months = years * 12;
  
  let value = initial;
  for (let i = 0; i < months; i++) {
    value += value * rate;
    value += monthly;
  }
  
  compoundResults.value.finalValue = value;
  compoundResults.value.invested = initial + monthly * months;
  compoundResults.value.interest = compoundResults.value.finalValue - compoundResults.value.invested;
  compoundResults.value.totalReturn = (compoundResults.value.interest / compoundResults.value.invested) * 100;
}

// Fonction pour calculer le temps nécessaire pour atteindre un objectif financier
function calculateTimeToGoal() {
  const targetAmount = goalCalculation.value.targetAmount;
  const currentAmount = goalCalculation.value.currentAmount;
  const monthlyContribution = goalCalculation.value.monthlyContribution;
  const annualReturn = goalCalculation.value.annualReturn / 100;
  
  let months = 0;
  let value = currentAmount;
  let contributions = 0;
  
  while (value < targetAmount && months < 1200) { // Maximum 100 ans
    value += value * annualReturn / 12;
    value += monthlyContribution;
    contributions += monthlyContribution;
    months++;
  }
  
  goalResults.value.years = months / 12;
  
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + months);
  goalResults.value.targetDate = targetDate.toLocaleDateString('fr-FR');
  
  goalResults.value.totalContributions = contributions;
  goalResults.value.totalInterest = value - currentAmount - contributions;
}

// Fonction pour recommander une volatilité en fonction du portefeuille
function getRecommendedVolatility() {
  if (!sortedInvestments.value.length) return 15; // Valeur par défaut
  
  // Analyser les types d'investissements
  const portfolioTypes = sortedInvestments.value.map(inv => inv.portfolioType || '');
  const hasStocks = portfolioTypes.some(type => type.includes('PEA') || type.includes('CTO'));
  const hasCrypto = portfolioTypes.some(type => type.includes('Crypto'));
  const hasSafeInvestments = portfolioTypes.some(type => 
    type.includes('Livret') || type.includes('LEP') || type.includes('LDDS'));
  
  // Suggestion de volatilité basée sur la composition
  if (hasCrypto) return 25; // Portefeuille avec cryptos = haute volatilité
  if (hasStocks && !hasSafeInvestments) return 18; // Actions uniquement = volatilité moyenne-haute
  if (hasStocks && hasSafeInvestments) return 15; // Mix actions et placements sécurisés = volatilité moyenne
  if (hasSafeInvestments && !hasStocks) return 5; // Uniquement placements sécurisés = faible volatilité
  
  return 15; // Valeur par défaut si impossible de déterminer
}

// Fonction pour mettre à jour toutes les données (prix + métriques)
async function updateAllData() {
  try {
    // Afficher une notification de démarrage
    const notification = document.createElement('div');
    notification.classList.add('fixed', 'bottom-4', 'right-4', 'bg-blue-100', 'text-blue-700', 'p-4', 'rounded-lg', 'shadow-lg', 'z-50');
    notification.id = 'update-data-notification';
    notification.innerHTML = `<div class="flex items-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Mise à jour des données en cours...</div>`;
    document.body.appendChild(notification);
    
    // D'abord mettre à jour les prix
    await updateAllPrices();
    
    // Mettre à jour la notification
    notification.innerHTML = `<div class="flex items-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Mise à jour de la courbe d'équité...</div>`;
    
    // Ensuite mettre à jour les métriques et la courbe d'équité
    tradingStore.updateLongTermMetrics();
    tradingStore.updateLongTermEquityCurve();
    tradingStore.saveToLocalStorage();
    
    // Supprimer la notification
    document.getElementById('update-data-notification')?.remove();
    
    // Créer une notification de succès
    const successNotification = document.createElement('div');
    successNotification.classList.add('fixed', 'bottom-4', 'right-4', 'bg-green-100', 'text-green-700', 'p-4', 'rounded-lg', 'shadow-lg', 'z-50');
    successNotification.innerHTML = `<div class="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>Données et courbe d'équité mises à jour avec succès!</div>`;
    document.body.appendChild(successNotification);
    
    // Supprimer la notification après 3 secondes
    setTimeout(() => {
      successNotification.remove();
    }, 3000);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des données:', error);
    
    // Supprimer la notification de chargement si elle existe
    document.getElementById('update-data-notification')?.remove();
    
    // Afficher une notification d'erreur
    const errorNotification = document.createElement('div');
    errorNotification.classList.add('fixed', 'bottom-4', 'right-4', 'bg-red-100', 'text-red-700', 'p-4', 'rounded-lg', 'shadow-lg', 'z-50');
    errorNotification.innerHTML = `<div class="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>Erreur lors de la mise à jour des données: ${error instanceof Error ? error.message : String(error)}</div>`;
    document.body.appendChild(errorNotification);
    
    // Supprimer la notification après 5 secondes
    setTimeout(() => {
      errorNotification.remove();
    }, 5000);
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">Investissements Long Terme</h1>
    
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

    <!-- Valeur et Performance -->
    <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Valorisation Portfolio
      </h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-amber-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Valeur Totale</h3>
              <p class="text-2xl font-bold text-gray-900">{{ totalPortfolioValue.toFixed(2) }}€</p>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md" :class="totalProfitLossPercentage >= 0 ? 'bg-green-100' : 'bg-red-100'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="totalProfitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path v-if="totalProfitLossPercentage >= 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Performance</h3>
              <p class="text-2xl font-bold" :class="totalProfitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ totalProfitLossPercentage >= 0 ? '+' : '' }}{{ totalProfitLossPercentage.toFixed(2) }}%
              </p>
              <span class="text-xs font-medium text-gray-500">
                Initial: {{ totalInitialCost.toFixed(2) }}€
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-blue-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Bêta du Portfolio</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ tradingStore.longTerm.metrics.beta }}
              </p>
              <span class="text-xs font-medium text-gray-500">
                vs marché
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-purple-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Tendance</h3>
              <p class="text-lg font-bold text-gray-900">
                {{ tradingStore.longTerm.metrics.trend.direction }}
              </p>
              <span class="text-xs font-medium" :class="tradingStore.longTerm.metrics.trend.value >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ tradingStore.longTerm.metrics.trend.value >= 0 ? '+' : '' }}{{ tradingStore.longTerm.metrics.trend.value }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Prix actuels des ETFs -->
    <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg mb-8">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Prix Actuels des ETFs
        </h2>
        <button 
          @click="fetchETFPrices" 
          class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
          :disabled="isLoadingETFPrices"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" :class="{'animate-spin': isLoadingETFPrices}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ isLoadingETFPrices ? 'Chargement...' : 'Actualiser les prix' }}
        </button>
      </div>
      
      <div v-if="etfPricesError" class="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
        {{ etfPricesError }}
      </div>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-blue-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">CW8.PA</h3>
              <p class="text-2xl font-bold text-gray-900">{{ currentETFPrices.cw8.toFixed(2) }}€</p>
              <span class="text-xs font-medium text-gray-500">
                Amundi MSCI World
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-indigo-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">CACC.PA</h3>
              <p class="text-2xl font-bold text-gray-900">{{ currentETFPrices.cacc.toFixed(2) }}€</p>
              <span class="text-xs font-medium text-gray-500">
                Amundi CAC 40
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-purple-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">PUST.PA</h3>
              <p class="text-2xl font-bold text-gray-900">{{ currentETFPrices.pust.toFixed(2) }}€</p>
              <span class="text-xs font-medium text-gray-500">
                Amundi PEA FTSE US
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-green-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">P500H.PA</h3>
              <p class="text-2xl font-bold text-gray-900">{{ currentETFPrices.p500h.toFixed(2) }}€</p>
              <span class="text-xs font-medium text-gray-500">
                Amundi PEA S&P 500
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Dernière mise à jour: {{ lastUpdateTime ? formatTime(lastUpdateTime) : 'Jamais' }}</span>
        </div>
        <p class="text-xs mt-1">
          Les prix sont récupérés via Yahoo Finance et peuvent être légèrement différés par rapport aux cours en temps réel.
        </p>
      </div>
    </div>

    <!-- Bot d'Analyse Financière -->
    <div class="mb-8">
      <FinancialAnalysisBot />
    </div>

    <!-- Graphiques d'analyse - Deux colonnes -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Colonne 1: Évolution du Portfolio -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Évolution du Portfolio
          </h2>
          <button 
            @click="updateAllData" 
            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors duration-150 mb-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Actualiser les Prix Manuellement
          </button>
          <div v-if="lastUpdateTime" class="text-xs text-gray-500 mt-1">
            Dernière mise à jour: {{ formatTime(lastUpdateTime) }}
          </div>
          <div v-if="dailyUpdateScheduled" class="text-xs text-amber-600 mt-1">
            Mise à jour quotidienne désactivée
          </div>
        </div>
        <div class="h-80 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Line :data="equityChartData" :options="lineChartOptions" />
        </div>
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="text-sm text-gray-600">
            <p class="text-xs">
              <span class="font-semibold">Note:</span> Pour un suivi optimal, nous vous recommandons d'ajouter vos nouvelles positions les jours 5 et 19 de chaque mois.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Colonne 2: Performance par Actif -->
      <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Performance par Actif
          </h2>
        </div>
        <div class="h-80 bg-gray-50 rounded-lg p-2 transition-all duration-300 hover:shadow-md">
          <Bar :data="assetPerformanceData" :options="assetBarChartOptions" />
        </div>
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="text-sm text-gray-600">
            <p class="text-xs">
              <span class="font-semibold">Analyse:</span> Ce graphique montre la performance individuelle de chaque actif dans votre portefeuille.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Statistiques par stratégie -->
    <div class="bg-white shadow rounded-lg p-6 mb-8 transition-all duration-300 hover:shadow-lg">
      <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Analyse par Stratégie d'Investissement
      </h2>
      <div class="overflow-x-auto bg-gray-50 rounded-lg">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-100">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stratégie</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nb. Positions</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valeur Totale</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocation</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="stat in portfolioTypeStats" :key="stat.type" class="hover:bg-gray-50 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="rounded-md w-8 h-8 flex items-center justify-center mr-3 bg-gray-100">
                    <span class="text-xs font-bold">{{ stat.type.charAt(0) }}</span>
                  </div>
                  <div class="text-sm font-medium text-gray-900">{{ stat.type }}</div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ stat.count }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{{ stat.currentValue.toFixed(2) }}€</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <span class="text-sm font-medium mr-2" :class="stat.performance >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ stat.performance >= 0 ? '+' : '' }}{{ stat.performance.toFixed(2) }}%
                  </span>
                  <svg v-if="stat.performance >= 0" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="w-24 bg-gray-200 rounded-full h-2 mr-2">
                    <div class="bg-blue-600 h-2 rounded-full" :style="{ width: `${Math.min(stat.allocation, 100)}%` }"></div>
                  </div>
                  <span class="text-sm text-gray-600">{{ stat.allocation.toFixed(1) }}%</span>
                </div>
              </td>
            </tr>
            <tr v-if="portfolioTypeStats.length === 0">
              <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                Aucune stratégie d'investissement n'est encore définie.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Positions Long Terme avec bouton de test -->
    <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Positions Long Terme
        </h2>
        <div class="flex space-x-2">
          <div class="flex flex-col">
            <button 
              @click="updateAllData" 
              class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors duration-150 mb-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Actualiser les Prix Manuellement
            </button>
            <div v-if="lastUpdateTime" class="text-xs text-gray-500 mt-1">
              Dernière mise à jour: {{ formatTime(lastUpdateTime) }}
            </div>
            <div v-if="dailyUpdateScheduled" class="text-xs text-amber-600 mt-1">
              Mise à jour quotidienne désactivée
            </div>
          </div>
          <button 
            @click="toggleAutoUpdate" 
            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md transition-colors duration-150"
            :class="autoUpdateEnabled ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-blue-700 bg-blue-100 hover:bg-blue-200'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="autoUpdateEnabled" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path v-if="!autoUpdateEnabled" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ autoUpdateEnabled ? 'Arrêter l\'auto-refresh' : 'Auto-refresh (15min)' }}
          </button>
          <button 
            @click="updateAllData" 
            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
          <button 
            v-if="sortedInvestments.length > 0" 
            @click="showDeleteModal = true" 
            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Tout Supprimer
          </button>
          <button 
            @click="showAddModal = true" 
            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Ajouter
          </button>
        </div>
      </div>

      <div class="overflow-x-auto bg-gray-50 rounded-lg">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-100">
            <tr>
              <th @click="sortBy = 'symbol'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150">
                <div class="flex items-center">
                  Symbole
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" :class="{'rotate-180': sortDirection === 'desc' && sortBy === 'symbol'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </th>
              <th @click="sortBy = 'quantity'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150">
                <div class="flex items-center">
                  Quantité
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" :class="{'rotate-180': sortDirection === 'desc' && sortBy === 'quantity'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </th>
              <th @click="sortBy = 'purchaseDate'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150">
                <div class="flex items-center">
                  Date d'Achat
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" :class="{'rotate-180': sortDirection === 'desc' && sortBy === 'purchaseDate'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </th>
              <th @click="sortBy = 'averageEntryPrice'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150">
                <div class="flex items-center">
                  Prix Achat
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" :class="{'rotate-180': sortDirection === 'desc' && sortBy === 'averageEntryPrice'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </th>
              <th @click="sortBy = 'currentPrice'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150">
                <div class="flex items-center">
                  Prix Actuel
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" :class="{'rotate-180': sortDirection === 'desc' && sortBy === 'currentPrice'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </th>
              <th @click="sortBy = 'strategy'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150">
                <div class="flex items-center">
                  Stratégie
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" :class="{'rotate-180': sortDirection === 'desc' && sortBy === 'strategy'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </th>
              <th @click="sortBy = 'profitLoss'; sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150">
                <div class="flex items-center">
                  Performance
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" :class="{'rotate-180': sortDirection === 'desc' && sortBy === 'profitLoss'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="investment in sortedInvestments" :key="investment.id" class="hover:bg-gray-50 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="rounded-full w-8 h-8 flex items-center justify-center mr-3" :style="{ backgroundColor: getColorForSymbol(investment.symbol) }">
                    <span class="text-xs font-bold text-white">{{ investment.symbol.slice(0, 2) }}</span>
                  </div>
                  <div class="text-sm font-medium text-gray-900">{{ investment.symbol }}</div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ investment.quantity }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(investment.purchaseDate) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ investment.averageEntryPrice.toFixed(2) }}€</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ investment.currentPrice.toFixed(2) }}€</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-medium" 
                  :class="{
                    'bg-blue-100 text-blue-800': investment.strategy === 'Dividendes',
                    'bg-green-100 text-green-800': investment.strategy === 'Croissance',
                    'bg-purple-100 text-purple-800': investment.strategy === 'Valeur',
                    'bg-yellow-100 text-yellow-800': investment.strategy === 'ETF',
                    'bg-indigo-100 text-indigo-800': !['Dividendes', 'Croissance', 'Valeur', 'ETF'].includes(investment.strategy)
                  }">
                  {{ investment.strategy }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <span class="text-sm font-medium mr-2" :class="investment.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ investment.profitLoss >= 0 ? '+' : '' }}{{ investment.profitLoss.toFixed(2) }}%
                  </span>
                  <svg v-if="investment.profitLoss >= 0" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button @click="editInvestment(investment)" class="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors duration-150">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="deleteInvestment(investment.id)" class="text-red-600 hover:text-red-900 transition-colors duration-150">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
            <tr v-if="sortedInvestments.length === 0">
              <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">
                Aucun investissement à long terme enregistré.
                <button @click="showAddModal = true" class="text-amber-600 hover:text-amber-900 ml-2 font-medium">
                  Ajouter un investissement
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Le reste du template avec les modals -->
    <!-- Modal d'Ajout d'Investissement -->
    <div v-if="showAddModal" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">{{ isEditing ? 'Modifier' : 'Ajouter' }} un Investissement</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Type de Portefeuille</label>
                <select v-model="newInvestment.portfolioType" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="PEA Boursorama">PEA Boursorama</option>
                  <option value="PEA PROFILE DYNAMIQUE">PEA PROFILE DYNAMIQUE</option>
                  <option value="PEA Autre">PEA Autre</option>
                  <option value="CTO Boursorama">CTO Boursorama</option>
                  <option value="Assurance Vie">Assurance Vie</option>
                  <option value="Livret A">Livret A</option>
                  <option value="LDDS">LDDS</option>
                  <option value="LEP">LEP</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Symbole</label>
                <select 
                  v-model="newInvestment.symbol" 
                  class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  :disabled="newInvestment.portfolioType === 'PEA PROFILE DYNAMIQUE'"
                >
                  <option v-for="symbol in predefinedSymbols" :key="symbol" :value="symbol">{{ symbol }}</option>
                </select>
                <p v-if="newInvestment.portfolioType === 'PEA PROFILE DYNAMIQUE'" class="mt-1 text-xs text-amber-600">
                  Le symbole est automatiquement défini sur "PANIER DYNAMIQUE" pour ce type de portefeuille.
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Quantité</label>
                <input type="number" v-model="newInvestment.quantity" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Prix Moyen d'Entrée</label>
                <input type="number" v-model="newInvestment.averageEntryPrice" step="0.01" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Prix Actuel</label>
                <input type="number" v-model="newInvestment.currentPrice" step="0.01" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Date d'Achat</label>
                <input type="date" v-model="newInvestment.purchaseDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Stratégie</label>
                <select v-model="newInvestment.strategy" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                  <option value="DCA">DCA</option>
                  <option value="Growth">Growth</option>
                  <option value="Dividend">Dividend</option>
                  <option value="Value">Value</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="button"
              @click="addInvestment"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
            >
              {{ isEditing ? 'Mettre à jour' : 'Ajouter' }}
            </button>
            <button
              type="button"
              @click="showAddModal = false; isEditing = false; currentEditingId = '';"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Ajouter un tableau des variations quotidiennes après la liste des positions -->
    <div v-if="Object.keys(dailyPerformance).length > 0" class="mt-6">
      <h3 class="text-lg font-medium text-gray-900 mb-3">Variations Quotidiennes</h3>
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symbole
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix Actuel
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variation
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variation %
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="(data, symbol) in dailyPerformance" :key="symbol">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ symbol }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.value) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span :class="data.change >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ data.change >= 0 ? '+' : '' }}{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.change) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span :class="data.changePercent >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ data.changePercent >= 0 ? '+' : '' }}{{ data.changePercent.toFixed(2) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Encart de Simulation Monte Carlo et Projections -->
    <div class="mt-8 bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
      <h3 class="text-xl font-semibold text-gray-900 mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Projections et Simulations
      </h3>
      
      <!-- Contrôles pour les simulations -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <!-- Simulation des intérêts composés -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="text-lg font-medium text-gray-900 mb-3">Intérêts Composés</h4>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">Capital initial (€)</label>
              <input type="number" v-model="compoundSimulation.initial" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Taux annuel (%)</label>
              <input type="number" v-model="compoundSimulation.rate" step="0.1" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Contribution mensuelle (€)</label>
              <input type="number" v-model="compoundSimulation.monthly" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Durée (années)</label>
              <input type="number" v-model="compoundSimulation.years" min="1" max="50" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <button @click="calculateCompoundInterest" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-300">
              Calculer
            </button>
          </div>
          <div v-if="compoundResults.finalValue > 0" class="mt-4 p-3 bg-amber-50 rounded-md">
            <p class="text-sm font-medium text-gray-700">Résultats après {{ compoundSimulation.years }} ans:</p>
            <p class="text-lg font-bold text-amber-700 mt-1">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(compoundResults.finalValue) }}</p>
            <div class="text-xs text-gray-600 mt-2">
              <p>Capital investi: {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(compoundResults.invested) }}</p>
              <p>Intérêts gagnés: {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(compoundResults.interest) }}</p>
              <p>Rendement total: {{ compoundResults.totalReturn.toFixed(2) }}%</p>
            </div>
          </div>
        </div>
        
        <!-- Simulation Monte Carlo -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="text-lg font-medium text-gray-900 mb-3">Simulation Monte Carlo</h4>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">Capital initial (€)</label>
              <input type="number" v-model="monteCarloSimulation.initial" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Rendement moyen annuel (%)</label>
              <input type="number" v-model="monteCarloSimulation.expectedReturn" step="0.1" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Volatilité annuelle (%)</label>
              <select v-model="monteCarloSimulation.volatility" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm">
                <option v-for="option in volatilityOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Investissement mensuel (€)</label>
              <input type="number" v-model="monteCarloSimulation.monthlyContribution" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Durée (années)</label>
              <input type="number" v-model="monteCarloSimulation.years" min="1" max="50" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Nombre de simulations</label>
              <input type="number" v-model="monteCarloSimulation.simulations" min="10" max="1000" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <button @click="runMonteCarloSimulation" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-300">
              Simuler
            </button>
          </div>
        </div>
        
        <!-- Objectifs financiers -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="text-lg font-medium text-gray-900 mb-3">Calcul d'Objectifs</h4>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">Objectif financier (€)</label>
              <input type="number" v-model="goalCalculation.targetAmount" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Capital actuel (€)</label>
              <input type="number" v-model="goalCalculation.currentAmount" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Contribution mensuelle (€)</label>
              <input type="number" v-model="goalCalculation.monthlyContribution" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Taux de rendement annuel (%)</label>
              <input type="number" v-model="goalCalculation.annualReturn" step="0.1" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <button @click="calculateTimeToGoal" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-300">
              Calculer
            </button>
          </div>
          <div v-if="goalResults.years > 0" class="mt-4 p-3 bg-amber-50 rounded-md">
            <p class="text-sm font-medium text-gray-700">Temps pour atteindre votre objectif:</p>
            <p class="text-lg font-bold text-amber-700 mt-1">{{ goalResults.years.toFixed(1) }} ans</p>
            <div class="text-xs text-gray-600 mt-2">
              <p>Date estimée: {{ goalResults.targetDate }}</p>
              <p>Contributions totales: {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(goalResults.totalContributions) }}</p>
              <p>Intérêts gagnés: {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(goalResults.totalInterest) }}</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Visualisation des résultats -->
      <div v-if="monteCarloResults.length > 0" class="mt-6">
        <h4 class="text-lg font-medium text-gray-900 mb-3">Résultats de la Simulation Monte Carlo</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Graphique de la simulation - SUPPRIMÉ -->
          
          <!-- Statistiques de la simulation - AJUSTÉ POUR PRENDRE TOUTE LA LARGEUR -->
          <div class="bg-gray-50 p-4 rounded-lg col-span-1 md:col-span-2">
            <h5 class="text-md font-medium text-gray-900 mb-4">Statistiques des résultats</h5>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Statistiques principales -->
              <div class="space-y-3">
                <h6 class="text-sm font-medium text-indigo-700 border-b border-indigo-200 pb-1">Valeurs finales après {{ monteCarloSimulation.years }} ans</h6>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-700">Médiane:</span>
                  <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.median) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-700">Moyenne:</span>
                  <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.mean) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-700">Minimum:</span>
                  <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.min) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-700">Maximum:</span>
                  <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.max) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-700">90% des résultats au-dessus de:</span>
                  <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.percentile25) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-700">10% des résultats au-dessus de:</span>
                  <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloStats.percentile90) }}</span>
                </div>
              </div>
              
              <!-- Analyses supplémentaires -->
              <div class="space-y-3">
                <h6 class="text-sm font-medium text-indigo-700 border-b border-indigo-200 pb-1">Analyses complémentaires</h6>
                
                <!-- Retour sur investissement -->
                <div>
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-700">Capital initial:</span>
                    <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloSimulation.initial) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-700">Total investi (avec contributions):</span>
                    <span class="text-sm font-semibold text-gray-900">{{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monteCarloSimulation.initial + monteCarloSimulation.monthlyContribution * monteCarloSimulation.years * 12) }}</span>
                  </div>
                  <div class="flex justify-between mt-2">
                    <span class="text-sm text-gray-700">ROI médian:</span>
                    <span class="text-sm font-semibold" :class="(monteCarloStats.median / (monteCarloSimulation.initial + monteCarloSimulation.monthlyContribution * monteCarloSimulation.years * 12) - 1) * 100 >= 0 ? 'text-green-600' : 'text-red-600'">
                      {{ ((monteCarloStats.median / (monteCarloSimulation.initial + monteCarloSimulation.monthlyContribution * monteCarloSimulation.years * 12) - 1) * 100).toFixed(1) }}%
                    </span>
                  </div>
                </div>
                
                <!-- Dispersion et risque -->
                <div class="mt-3">
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-700">Écart-type:</span>
                    <span class="text-sm font-semibold text-gray-900">
                      {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                        Math.sqrt(monteCarloResults.reduce((sum: number, x: number) => 
                          sum + Math.pow(x - monteCarloStats.mean, 2), 0) / monteCarloResults.length)
                      ) }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-700">Coefficient de variation:</span>
                    <span class="text-sm font-semibold text-gray-900">{{ (Math.sqrt(monteCarloResults.reduce((sum, x) => sum + Math.pow(x - monteCarloStats.mean, 2), 0) / monteCarloResults.length) / monteCarloStats.mean * 100).toFixed(1) }}%</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-700">Probabilité de doubler l'investissement:</span>
                    <span class="text-sm font-semibold text-gray-900">{{ (monteCarloResults.filter(result => result >= (monteCarloSimulation.initial + monteCarloSimulation.monthlyContribution * monteCarloSimulation.years * 12) * 2).length / monteCarloResults.length * 100).toFixed(1) }}%</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-700">Probabilité de perte en capital:</span>
                    <span class="text-sm font-semibold text-gray-900">{{ (monteCarloResults.filter(result => result < (monteCarloSimulation.initial + monteCarloSimulation.monthlyContribution * monteCarloSimulation.years * 12)).length / monteCarloResults.length * 100).toFixed(1) }}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Explications détaillées -->
            <div class="mt-6 bg-indigo-50 p-3 rounded-md text-sm">
              <h6 class="font-medium text-indigo-700 mb-2">Comment interpréter ces résultats ?</h6>
              <ul class="list-disc pl-5 space-y-1 text-gray-700 text-xs">
                <li><span class="font-medium">Médiane</span> : Valeur pour laquelle 50% des simulations donnent un résultat supérieur et 50% inférieur. Plus fiable que la moyenne pour les distributions asymétriques.</li>
                <li><span class="font-medium">Écart-type</span> : Mesure de la dispersion des résultats. Plus il est élevé, plus les résultats possibles sont dispersés, indiquant une plus grande incertitude.</li>
                <li><span class="font-medium">Coefficient de variation</span> : Normalise l'écart-type par rapport à la moyenne, permettant de comparer le risque relatif entre différentes simulations.</li>
                <li><span class="font-medium">Percentiles</span> : Les valeurs de 10% et 90% donnent une idée de la plage de résultats probables, excluant les cas extrêmes.</li>
                <li><span class="font-medium">Probabilités</span> : Les chances de doubler votre investissement ou de subir une perte sont calculées sur l'ensemble des {{ monteCarloSimulation.simulations }} simulations.</li>
              </ul>
              <p class="mt-2 text-xs text-gray-600 italic">Note : Ces statistiques sont basées sur des simulations utilisant un rendement annuel moyen de {{ monteCarloSimulation.expectedReturn }}% et une volatilité de {{ monteCarloSimulation.volatility }}%, et ne garantissent pas les performances futures.</p>
            </div>
          </div>
        </div>
        
        <!-- Graphique des trajectoires Monte Carlo -->
        <div class="mt-6 bg-gray-50 p-4 rounded-lg h-96">
          <h5 class="text-md font-medium text-gray-900 mb-2">Trajectoires d'évolution du capital</h5>
          <Line :data="monteCarloPathsData" :options="monteCarloPathsOptions" />
        </div>
        
        <!-- Commentaires d'interprétation -->
        <div class="mt-6 bg-white p-4 rounded-lg border border-amber-200">
          <h5 class="text-md font-medium text-gray-900 mb-3">Interprétation des résultats</h5>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="p-3 rounded-md bg-green-50 border border-green-200">
              <h6 class="text-sm font-medium text-green-800 mb-1">Scénario Optimiste</h6>
              <p class="text-xs text-gray-700">{{ simulationInsights.optimistic }}</p>
            </div>
            
            <div class="p-3 rounded-md bg-blue-50 border border-blue-200">
              <h6 class="text-sm font-medium text-blue-800 mb-1">Scénario Médian</h6>
              <p class="text-xs text-gray-700">{{ simulationInsights.neutral }}</p>
            </div>
            
            <div class="p-3 rounded-md bg-amber-50 border border-amber-200">
              <h6 class="text-sm font-medium text-amber-800 mb-1">Scénario Pessimiste</h6>
              <p class="text-xs text-gray-700">{{ simulationInsights.pessimistic }}</p>
            </div>
          </div>
          
          <div class="mt-4 p-4 bg-gray-50 rounded-md">
            <h6 class="text-sm font-medium text-gray-900 mb-2">Notre recommandation</h6>
            <p class="text-sm text-gray-700">{{ simulationInsights.recommendation }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template> 