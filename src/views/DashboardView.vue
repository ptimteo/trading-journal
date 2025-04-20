<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useTradingStore } from '../stores/trading';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import type { EquityPoint, CryptoPosition } from '../types/trading';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const store = useTradingStore();

// Données pour le S&P 500
const sp500Data = ref<{ date: string; close: number }[]>([]);
const isLoadingSP500 = ref(false);
const sp500Error = ref('');

// Récupération des données du S&P 500
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

// États pour les portfolios crypto
const userPortfolio = ref<CryptoPosition[]>([]);
const ledgerPortfolio = ref<CryptoPosition[]>([]);
const isLoadingPortfolio = ref(false);
const hasPortfolioError = ref(false);
const totalPortfolioValueUSD = ref(0);
const totalLedgerPortfolioValueUSD = ref(0);

// Format des dates pour l'affichage
const formatDate = (date: Date) => {
  return date.toLocaleDateString('fr-FR');
};

// Type pour le mode d'interaction de Chart.js
type InteractionMode = 'index' | 'nearest' | 'x' | 'dataset' | 'point' | 'y';
type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter';

// Données réactives pour les graphiques
const tradingChartData = computed(() => ({
  labels: store.trading.equityCurve.map((point: EquityPoint) => formatDate(point.date)),
  datasets: [{
    label: 'Performance Stratégie de Trading',
    data: store.trading.equityCurve.map((point: EquityPoint) => point.balance),
    borderColor: '#4F46E5',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    tension: 0.4,
    fill: true
  }]
}));

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
  
  if (store.trading.trades.length > 0) {
    const sortedTrades = [...store.trading.trades].sort((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    
    const firstTradeDate = new Date(sortedTrades[0].entryDate);
    const lastTradeDate = new Date(sortedTrades[sortedTrades.length - 1].exitDate);
    
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

// Calcul de la performance du SP500 sur la période
const sp500Performance = computed(() => {
  if (sp500Data.value.length < 2) return 0;

  // Filtrer les données pour avoir la même période que les trades
  let filteredData = sp500Data.value;
  
  if (store.trading.trades.length > 0) {
    const sortedTrades = [...store.trading.trades].sort((a, b) => 
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

// Calcul de la performance de la stratégie
const strategyPerformance = computed(() => {
  if (store.trading.equityCurve.length < 2) return 0;
  
  const firstValue = store.trading.equityCurve[0].balance;
  const lastValue = store.trading.equityCurve[store.trading.equityCurve.length - 1].balance;
  
  return ((lastValue - firstValue) / firstValue) * 100;
});

// Données réactives pour les graphiques de crypto
const cryptoChartData = computed(() => {
  // Si nous avons des données des portfolios, afficher les deux courbes
  if (userPortfolio.value.length > 0 || ledgerPortfolio.value.length > 0) {
    return {
      labels: Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (30 - i - 1));
        return formatDate(date);
      }),
      datasets: [
        {
          label: 'Portfolio Binance',
          data: [totalPortfolioValueUSD.value], // Utilisera uniquement la valeur actuelle
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Portfolio Ledger',
          data: [totalLedgerPortfolioValueUSD.value], // Utilisera uniquement la valeur actuelle
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  }
  
  // Fallback aux données du store si aucun portfolio n'est chargé
  return {
    labels: store.crypto.equityCurve.map((point: EquityPoint) => formatDate(point.date)),
    datasets: [{
      label: 'Valeur du Portfolio Crypto',
      data: store.crypto.equityCurve.map((point: EquityPoint) => point.balance),
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };
});

const longTermChartData = computed(() => ({
  labels: store.longTerm.equityCurve.map((point: EquityPoint) => formatDate(point.date)),
  datasets: [{
    label: 'Valeur du Portfolio Long Terme',
    data: store.longTerm.equityCurve.map((point: EquityPoint) => point.balance),
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    tension: 0.4,
    fill: true
  }]
}));

// Configuration pour les graphiques
const chartOptions = {
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
    title: {
      display: true,
      text: 'Évolution du Portfolio',
      font: {
        size: 16,
        weight: 'bold' as FontWeight,
      }
    },
    tooltip: {
      mode: 'index' as InteractionMode,
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
          weight: 'bold' as FontWeight,
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
          weight: 'bold' as FontWeight,
        }
      }
    }
  },
  interaction: {
    mode: 'nearest' as InteractionMode,
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

// Configuration spécifique pour le graphique S&P 500
const sp500ChartOptions = {
  ...chartOptions,
  plugins: {
    ...chartOptions.plugins,
    title: {
      ...chartOptions.plugins.title,
      text: 'Évolution du S&P 500'
    }
  },
  scales: {
    ...chartOptions.scales,
    y: {
      ...chartOptions.scales.y,
      title: {
        ...chartOptions.scales.y.title,
        text: 'Valeur (Points)'
      }
    }
  }
};

// Récentes transactions pour l'affichage
const recentTrades = computed(() => {
  return [...store.trading.trades]
    .sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime())
    .slice(0, 5);
});

// Fonction pour créer des données de test
const createTestData = () => {
  console.log("Création de données de test pour les portfolios");
  
  // Données de test pour Binance
  userPortfolio.value = [
    {
      id: "binance-btc-1",
      symbol: "BTC",
      quantity: 0.5,
      averageEntryPrice: 30000,
      currentPrice: 60000,
      profitLoss: 100, // (60000 - 30000) / 30000 * 100 = 100%
      entryDate: new Date(2023, 0, 15)
    },
    {
      id: "binance-eth-1",
      symbol: "ETH",
      quantity: 5,
      averageEntryPrice: 1500,
      currentPrice: 3000,
      profitLoss: 100, // (3000 - 1500) / 1500 * 100 = 100%
      entryDate: new Date(2023, 1, 20)
    },
    {
      id: "binance-sol-1",
      symbol: "SOL",
      quantity: 50,
      averageEntryPrice: 20,
      currentPrice: 100,
      profitLoss: 400, // (100 - 20) / 20 * 100 = 400%
      entryDate: new Date(2023, 3, 10)
    }
  ];
  
  // Calculer la valeur totale de Binance
  totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, pos) => {
    return sum + (pos.quantity * pos.currentPrice);
  }, 0);
  
  // Données de test pour Ledger
  ledgerPortfolio.value = [
    {
      id: "ledger-btc-1",
      symbol: "BTC",
      quantity: 0.2,
      averageEntryPrice: 25000,
      currentPrice: 60000,
      profitLoss: 140, // (60000 - 25000) / 25000 * 100 = 140%
      entryDate: new Date(2022, 11, 10)
    },
    {
      id: "ledger-eth-1",
      symbol: "ETH",
      quantity: 3,
      averageEntryPrice: 1200,
      currentPrice: 3000,
      profitLoss: 150, // (3000 - 1200) / 1200 * 100 = 150%
      entryDate: new Date(2022, 10, 5)
    }
  ];
  
  // Calculer la valeur totale de Ledger
  totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, pos) => {
    return sum + (pos.quantity * pos.currentPrice);
  }, 0);
  
  console.log("Données de test créées avec succès");
  console.log("Total Binance:", totalPortfolioValueUSD.value);
  console.log("Total Ledger:", totalLedgerPortfolioValueUSD.value);
};

// Récupérer les portefeuilles Binance et Ledger depuis localStorage
const loadPortfoliosFromLocalStorage = () => {
  try {
    console.log("Chargement des portfolios depuis localStorage...");
    
    // Log de toutes les clés dans localStorage pour aider au débogage
    const keys = Object.keys(localStorage);
    console.log("Clés disponibles dans localStorage:", keys);
    
    // Essayons d'abord les clés standards
    let binancePortfolioData = localStorage.getItem('binance-portfolio');
    let ledgerPortfolioData = localStorage.getItem('ledger-portfolio');
    
    // Si les clés standards ne fonctionnent pas, essayons d'autres variations possibles
    if (!binancePortfolioData) {
      const possibleBinanceKeys = [
        'binancePortfolio', 
        'userPortfolio', 
        'cryptoPortfolio',
        'crypto-binance-portfolio'
      ];
      
      for (const key of possibleBinanceKeys) {
        if (localStorage.getItem(key)) {
          console.log(`Clé alternative trouvée pour Binance: ${key}`);
          binancePortfolioData = localStorage.getItem(key);
          break;
        }
      }
    }
    
    if (!ledgerPortfolioData) {
      const possibleLedgerKeys = [
        'ledgerPortfolio', 
        'hardwarePortfolio',
        'crypto-ledger-portfolio'
      ];
      
      for (const key of possibleLedgerKeys) {
        if (localStorage.getItem(key)) {
          console.log(`Clé alternative trouvée pour Ledger: ${key}`);
          ledgerPortfolioData = localStorage.getItem(key);
          break;
        }
      }
    }
    
    console.log("Données brutes Binance:", binancePortfolioData);
    console.log("Données brutes Ledger:", ledgerPortfolioData);
    
    // Si les données sont toujours nulles, tentons de voir si nous pouvons les récupérer du store
    if (!binancePortfolioData && store.crypto && store.crypto.positions) {
      console.log("Tentative de récupération des positions Binance depuis le store");
      userPortfolio.value = store.crypto.positions;
      totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, pos) => {
        return sum + (pos.quantity * pos.currentPrice);
      }, 0);
    } else if (binancePortfolioData) {
      try {
        const parsed = JSON.parse(binancePortfolioData);
        console.log("Données Binance parsées:", parsed);
        
        // Vérifier si les données sont un tableau ou un objet avec une propriété contenant le tableau
        const positionsArray = Array.isArray(parsed) ? parsed : 
                              (parsed.positions || parsed.items || parsed.cryptoPositions || []);
        
        console.log("Tableau de positions Binance:", positionsArray);
        
        userPortfolio.value = positionsArray.map((pos: any) => ({
          ...pos,
          id: pos.id || `binance-${pos.symbol}-${Date.now()}`,
          entryDate: pos.entryDate ? new Date(pos.entryDate) : new Date(),
          quantity: typeof pos.quantity === 'string' ? parseFloat(pos.quantity) : pos.quantity || 0,
          currentPrice: typeof pos.currentPrice === 'string' ? parseFloat(pos.currentPrice) : pos.currentPrice || 0
        }));
        
        // Calculer la valeur totale actuelle
        totalPortfolioValueUSD.value = userPortfolio.value.reduce((sum, pos) => {
          const value = pos.quantity * pos.currentPrice;
          console.log(`Binance - ${pos.symbol}: ${pos.quantity} x ${pos.currentPrice} = ${value}`);
          return sum + value;
        }, 0);
        
        console.log('Binance portfolio calculé:', totalPortfolioValueUSD.value);
      } catch (innerError) {
        console.error('Erreur lors du parsing des données Binance:', innerError);
      }
    } else {
      console.log("Aucune donnée Binance trouvée dans localStorage ni dans le store");
    }
    
    // Si les données sont toujours nulles, tentons de voir si nous pouvons les récupérer du store
    if (!ledgerPortfolioData && store.crypto && store.crypto.positions) {
      console.log("Tentative de récupération des positions depuis le store pour Ledger");
      // Comme nous n'avons pas accès direct aux positions Ledger dans le store,
      // nous pouvons vérifier si CryptoView.vue stocke ces données dans une clé différente
      
      // Continuons avec uniquement les données que nous avons pu trouver via localStorage
      console.log("Impossible d'accéder directement aux positions Ledger via le store");
    } else if (ledgerPortfolioData) {
      try {
        const parsed = JSON.parse(ledgerPortfolioData);
        console.log("Données Ledger parsées:", parsed);
        
        // Vérifier si les données sont un tableau ou un objet avec une propriété contenant le tableau
        const positionsArray = Array.isArray(parsed) ? parsed : 
                              (parsed.positions || parsed.items || parsed.ledgerPositions || []);
        
        console.log("Tableau de positions Ledger:", positionsArray);
        
        ledgerPortfolio.value = positionsArray.map((pos: any) => ({
          ...pos,
          id: pos.id || `ledger-${pos.symbol}-${Date.now()}`,
          entryDate: pos.entryDate ? new Date(pos.entryDate) : new Date(),
          quantity: typeof pos.quantity === 'string' ? parseFloat(pos.quantity) : pos.quantity || 0,
          currentPrice: typeof pos.currentPrice === 'string' ? parseFloat(pos.currentPrice) : pos.currentPrice || 0
        }));
        
        // Calculer la valeur totale actuelle
        totalLedgerPortfolioValueUSD.value = ledgerPortfolio.value.reduce((sum, pos) => {
          const value = pos.quantity * pos.currentPrice;
          console.log(`Ledger - ${pos.symbol}: ${pos.quantity} x ${pos.currentPrice} = ${value}`);
          return sum + value;
        }, 0);
        
        console.log('Ledger portfolio calculé:', totalLedgerPortfolioValueUSD.value);
      } catch (innerError) {
        console.error('Erreur lors du parsing des données Ledger:', innerError);
      }
    } else {
      console.log("Aucune donnée Ledger trouvée dans localStorage ni dans le store");
    }
    
    // Si toutes les méthodes de récupération ont échoué, créer des données de test
    if ((userPortfolio.value.length === 0 && ledgerPortfolio.value.length === 0) || 
        (totalPortfolioValueUSD.value === 0 && totalLedgerPortfolioValueUSD.value === 0)) {
      console.log("Aucune donnée valide trouvée. Création de données de test.");
      createTestData();
    }
    
    // Mettre à jour le compteur d'actualisations pour l'UI
    lastUpdateTime.value = new Date();
    
  } catch (error) {
    console.error('Erreur lors du chargement des portfolios:', error);
    hasPortfolioError.value = true;
    
    // En cas d'erreur critique, créer des données de test
    createTestData();
  }
};

// Variable pour suivre la dernière mise à jour
const lastUpdateTime = ref(new Date());

// Mettre à jour les données toutes les 5 minutes
const startAutoRefresh = () => {
  setInterval(() => {
    console.log("Actualisation automatique des portfolios");
    loadPortfoliosFromLocalStorage();
    lastUpdateTime.value = new Date(); // Mettre à jour l'horodatage
  }, 2 * 60 * 1000); // Toutes les 2 minutes
};

onMounted(async () => {
  // S'assurer que les données sont chargées
  store.loadFromLocalStorage();
  
  // Recalculer les métriques trading pour s'assurer qu'elles sont à jour
  store.updateTradingMetrics();
  
  // Vérifier si des métriques crypto sont disponibles dans localStorage
  const savedCryptoMetrics = localStorage.getItem('cryptoMetrics');
  if (savedCryptoMetrics) {
    try {
      const parsedMetrics = JSON.parse(savedCryptoMetrics);
      console.log('Métriques crypto trouvées dans localStorage:', parsedMetrics);
      
      // Mettre à jour le store avec les valeurs sauvegardées
      if (parsedMetrics.btcFearGreedIndex && store.crypto.metrics.btcFearGreedIndex === 0) {
        store.crypto.metrics.btcFearGreedIndex = parsedMetrics.btcFearGreedIndex;
      }
      
      if (parsedMetrics.btcDominance && store.crypto.metrics.btcDominance === 0) {
        store.crypto.metrics.btcDominance = parsedMetrics.btcDominance;
      }
    } catch (e) {
      console.error('Erreur lors du parsing des métriques crypto:', e);
    }
  }
  
  // Charger les portfolios depuis localStorage
  loadPortfoliosFromLocalStorage();
  
  // Démarrer l'actualisation automatique
  startAutoRefresh();

  try {
    // Mise à jour des données des métriques crypto
    await store.updateCryptoMetrics();
    console.log('Métriques crypto mises à jour');
  } catch (error) {
    console.error('Erreur lors de la mise à jour des métriques crypto:', error);
  }
  
  // Vérification du calcul de la performance depuis le capital initial
  console.log("--- Vérification du calcul de performance ---");
  console.log("Capital initial:", store.trading.initialCapital);
  console.log("Valeur portfolio crypto (Binance):", totalPortfolioValueUSD.value);
  console.log("Valeur portfolio crypto (Ledger):", totalLedgerPortfolioValueUSD.value); 
  console.log("Valeur long terme:", store.longTermMetrics.totalValue);
  console.log("Valeur totale:", (totalPortfolioValueUSD.value + totalLedgerPortfolioValueUSD.value) + store.longTermMetrics.totalValue);
  
  const performanceCalculation = ((((totalPortfolioValueUSD.value + totalLedgerPortfolioValueUSD.value) + store.longTermMetrics.totalValue) - store.trading.initialCapital) / store.trading.initialCapital * 100);
  console.log("Performance calculée:", performanceCalculation.toFixed(1) + "%");

  // Récupérer les données du S&P 500
  fetchSP500Data();
});

// Format pour les pourcentages
const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Tableau de Bord
      </h1>
      <div class="text-sm text-gray-500">
        Dernière mise à jour: {{ lastUpdateTime.toLocaleString('fr-FR') }}
      </div>
    </div>

    <!-- Trading Section -->
    <div class="bg-white shadow rounded-lg p-6 mb-6 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Trading
        </h2>
        <router-link to="/trades" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors duration-150">
          Voir détails
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </router-link>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-indigo-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Capital Initial</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.trading.initialCapital.toFixed(2) }}€</p>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-blue-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Capital Actuel</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.trading.currentCapital.toFixed(2) }}€</p>
              <span class="text-xs font-medium" :class="store.trading.currentCapital >= store.trading.initialCapital ? 'text-green-600' : 'text-red-600'">
                {{ store.trading.currentCapital >= store.trading.initialCapital ? '+' : '' }}{{ ((store.trading.currentCapital - store.trading.initialCapital) / store.trading.initialCapital * 100).toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-green-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Win Rate</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.tradingMetrics.winRateGlobal.toFixed(1) }}%</p>
              <div class="text-xs text-gray-500">incluant les BE</div>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div class="bg-green-600 h-1.5 rounded-full" :style="{ width: `${Math.min(store.tradingMetrics.winRateGlobal, 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-purple-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Profit Factor</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.tradingMetrics.profitFactor.toFixed(2) }}</p>
              <span class="text-xs font-medium" :class="store.tradingMetrics.profitFactor >= 1.5 ? 'text-green-600' : store.tradingMetrics.profitFactor >= 1 ? 'text-yellow-600' : 'text-red-600'">
                {{ store.tradingMetrics.profitFactor >= 1.5 ? 'excellent' : store.tradingMetrics.profitFactor >= 1 ? 'bon' : 'à améliorer' }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <div class="h-64 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-sm font-medium text-gray-700">Performance Stratégie</h3>
            <span class="text-sm font-medium" :class="strategyPerformance >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ formatPercent(strategyPerformance) }}
            </span>
          </div>
        <Line :data="tradingChartData" :options="chartOptions" />
        </div>
        <div class="h-64 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-sm font-medium text-gray-700">Performance S&P 500</h3>
            <span v-if="sp500Data.length > 0" class="text-sm font-medium" :class="sp500Performance >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ formatPercent(sp500Performance) }}
            </span>
            <span v-else class="text-sm text-gray-500">--</span>
          </div>
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
      </div>
      
      <!-- Transactions récentes -->
      <div class="mt-6">
        <h3 class="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Transactions Récentes
        </h3>
        <div class="overflow-x-auto bg-gray-50 rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-100">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbole</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date de sortie</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P/L</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="trade in recentTrades" :key="trade.id" class="transition-colors duration-150 hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ trade.symbol }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full py-1" :class="trade.direction === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                    {{ trade.direction }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(trade.exitDate) }}</td>
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
              </tr>
              <tr v-if="recentTrades.length === 0">
                <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">
                  Aucune transaction récente
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Portfolio Global Section -->
    <div class="bg-white shadow rounded-lg p-6 mb-6 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Portfolio Global
        </h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-purple-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Capital Total</h3>
              <p class="text-2xl font-bold text-gray-900">{{ ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue).toFixed(2) }}€</p>
              <div class="text-xs text-gray-500 flex items-center mt-1">
                <span class="inline-block px-2 py-1 rounded-full mr-1 bg-green-100 text-green-800">
                  Crypto: {{ (totalPortfolioValueUSD + totalLedgerPortfolioValueUSD).toFixed(0) }}€
                </span>
                <span class="inline-block px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                  Long Terme: {{ store.longTermMetrics.totalValue.toFixed(0) }}€
                </span>
              </div>
              <div class="text-xs font-medium mt-1" :class="((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) >= store.trading.initialCapital ? 'text-green-600' : 'text-red-600'">
                {{ ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) >= store.trading.initialCapital ? '+' : '' }}{{ ((((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) - store.trading.initialCapital) / store.trading.initialCapital * 100).toFixed(1) }}% depuis le capital initial
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-blue-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Performance Moyenne</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ ((((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) * (store.cryptoMetrics.profitLossPercentage || 0)) + 
                    (store.longTermMetrics.totalValue * store.longTermMetrics.profitLossPercentage)) / 
                    ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue)).toFixed(1) }}%
              </p>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-green-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Répartition des Actifs</h3>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div class="flex h-1.5">
                  <div class="bg-green-600 h-1.5" :style="{ width: `${(totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 100}%` }"></div>
                  <div class="bg-amber-600 h-1.5" :style="{ width: `${store.longTermMetrics.totalValue / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 100}%` }"></div>
                </div>
              </div>
              <div class="flex justify-between text-xs mt-1">
                <span class="text-green-600">Crypto {{ ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 100).toFixed(0) }}%</span>
                <span class="text-amber-600">Long Terme {{ (store.longTermMetrics.totalValue / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 100).toFixed(0) }}%</span>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-red-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Volatilité Estimée</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ (((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 15) + 
                    (store.longTermMetrics.totalValue / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * (store.longTermMetrics.beta || 1) * 5)).toFixed(1) }}%
              </p>
              <span class="text-xs font-medium" :class="((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 15 + 
                    (store.longTermMetrics.totalValue / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * (store.longTermMetrics.beta || 1) * 5)) > 12 ? 'text-red-600' : 
                   ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 15 + 
                    (store.longTermMetrics.totalValue / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * (store.longTermMetrics.beta || 1) * 5)) > 8 ? 'text-yellow-600' : 'text-green-600'">
                {{ ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 15 + 
                    (store.longTermMetrics.totalValue / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * (store.longTermMetrics.beta || 1) * 5)) > 12 ? 'élevée' : 
                   ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * 15 + 
                    (store.longTermMetrics.totalValue / ((totalPortfolioValueUSD + totalLedgerPortfolioValueUSD) + store.longTermMetrics.totalValue) * (store.longTermMetrics.beta || 1) * 5)) > 8 ? 'moyenne' : 'faible' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Crypto Section -->
    <div class="bg-white shadow rounded-lg p-6 mb-6 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Crypto
        </h2>
        <router-link to="/crypto" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors duration-150">
          Voir détails
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </router-link>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-green-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Valeur Totale</h3>
              <p class="text-2xl font-bold text-gray-900">{{ (totalPortfolioValueUSD + totalLedgerPortfolioValueUSD).toFixed(2) }}€</p>
              <div class="text-xs text-gray-500 flex items-center mt-1">
                <span class="inline-block px-2 py-1 rounded-full mr-1 bg-amber-100 text-amber-800">
                  Binance: {{ totalPortfolioValueUSD.toFixed(0) }}€
                </span>
                <span class="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                  Ledger: {{ totalLedgerPortfolioValueUSD.toFixed(0) }}€
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-yellow-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Fear & Greed Index</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.cryptoMetrics.btcFearGreedIndex }}</p>
              <span class="text-xs font-medium" :class="store.cryptoMetrics.btcFearGreedIndex > 60 ? 'text-red-600' : store.cryptoMetrics.btcFearGreedIndex < 40 ? 'text-green-600' : 'text-yellow-600'">
                {{ store.cryptoMetrics.btcFearGreedIndex > 60 ? 'Euphorie' : store.cryptoMetrics.btcFearGreedIndex < 40 ? 'Peur' : 'Neutre' }}
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-orange-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Dominance BTC</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.cryptoMetrics.btcDominance.toFixed(1) }}%</p>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div class="bg-orange-600 h-1.5 rounded-full" :style="{ width: `${Math.min(store.cryptoMetrics.btcDominance, 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-indigo-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Top Assets</h3>
              <div class="mt-1 flex flex-col gap-1 text-sm">
                <div v-if="userPortfolio.length > 0 || ledgerPortfolio.length > 0">
                  <div v-for="position in [...userPortfolio, ...ledgerPortfolio]
                    .sort((a, b) => (b.quantity * b.currentPrice) - (a.quantity * a.currentPrice))
                    .slice(0, 3)" :key="position.id" class="flex justify-between">
                    <span class="font-medium">{{ position.symbol }}</span>
                    <span>{{ (position.quantity * position.currentPrice).toFixed(0) }}€</span>
                  </div>
                </div>
                <div v-else class="text-gray-500 text-center">
                  Aucun actif
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Widget Top Cryptocurrencies -->
      <div class="h-[500px] bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md">
        <iframe src="https://fr.widgets.investing.com/top-cryptocurrencies?theme=lightTheme" width="100%" height="100%" frameborder="0" allowtransparency="true" marginwidth="0" marginheight="0"></iframe>
        <div class="poweredBy text-xs text-gray-500 mt-1" style="font-family: Arial, Helvetica, sans-serif;">
          Promu par <a href="https://fr.investing.com?utm_source=WMT&amp;utm_medium=referral&amp;utm_campaign=TOP_CRYPTOCURRENCIES&amp;utm_content=Footer%20Link" target="_blank" rel="nofollow" class="text-blue-600 hover:underline">Investing.com</a>
        </div>
      </div>
    </div>

    <!-- Long Term Section -->
    <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Investissements Long Terme
        </h2>
        <router-link to="/long-term" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors duration-150">
          Voir détails
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </router-link>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-amber-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Valeur Totale</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.longTermMetrics.totalValue.toFixed(2) }}€</p>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-blue-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Beta du Portfolio</h3>
              <p class="text-2xl font-bold text-gray-900">{{ store.longTermMetrics.beta || 1.0 }}</p>
              <span class="text-xs font-medium" :class="(store.longTermMetrics.beta || 1.0) < 0.8 ? 'text-green-600' : (store.longTermMetrics.beta || 1.0) > 1.2 ? 'text-red-600' : 'text-yellow-600'">
                {{ (store.longTermMetrics.beta || 1.0) < 0.8 ? 'défensif' : (store.longTermMetrics.beta || 1.0) > 1.2 ? 'agressif' : 'neutre' }}
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md bg-green-100 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Rendement Annuel</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ (store.longTermMetrics.trend && store.longTermMetrics.trend.value * 48) ? (store.longTermMetrics.trend.value * 48).toFixed(1) : '0.0' }}%
              </p>
              <span class="text-xs font-medium" 
                :class="(store.longTermMetrics.trend && store.longTermMetrics.trend.value * 48) >= 7 ? 'text-green-600' : 
                       (store.longTermMetrics.trend && store.longTermMetrics.trend.value * 48) >= 0 ? 'text-yellow-600' : 'text-red-600'">
                {{ (store.longTermMetrics.trend && store.longTermMetrics.trend.value * 48) >= 7 ? 'excellent' : 
                   (store.longTermMetrics.trend && store.longTermMetrics.trend.value * 48) >= 0 ? 'moyen' : 'à améliorer' }}
              </span>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105 hover:bg-gray-100">
          <div class="flex items-center">
            <div class="p-2 rounded-md" :class="store.longTermMetrics.profitLossPercentage >= 0 ? 'bg-green-100' : 'bg-red-100'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="store.longTermMetrics.profitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path v-if="store.longTermMetrics.profitLossPercentage >= 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-500">Gain/Perte</h3>
              <p class="text-2xl font-bold" :class="store.longTermMetrics.profitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ store.longTermMetrics.profitLossPercentage >= 0 ? '+' : '' }}{{ store.longTermMetrics.profitLossPercentage.toFixed(1) }}%
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="h-64 bg-gray-50 p-2 rounded-lg transition-all duration-300 hover:shadow-md">
        <Line :data="longTermChartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template> 