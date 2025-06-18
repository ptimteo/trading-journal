<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { finnhubService } from '../services/finnhub';
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
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface MarketData {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  chartData: {
    labels: Date[];
    prices: number[];
  };
}

const props = defineProps<{
  symbols: string[];
}>();

const marketData = ref<Record<string, MarketData>>({});
const isLoading = ref(true);
const error = ref<string | null>(null);

// Mapper les symboles pour Finnhub
const finnhubSymbols = computed(() => {
  return props.symbols.map(symbol => {
    // Convertir les symboles d'indices en ETF correspondants
    switch (symbol) {
      case '^GSPC': return 'SPY';  // S&P 500
      case '^NDX': return 'QQQ';   // NASDAQ 100
      case '^DJI': return 'DIA';   // Dow Jones
      case '^FCHI': return 'EWQ';  // CAC 40
      default: return symbol;
    }
  });
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: 'time',
      time: {
        unit: 'day'
      },
      title: {
        display: true,
        text: 'Date'
      }
    },
    y: {
      title: {
        display: true,
        text: 'Prix ($)'
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          return `$${context.parsed.y.toFixed(2)}`;
        }
      }
    }
  }
};

async function fetchMarketData(symbol: string) {
  try {
    const finnhubSymbol = finnhubSymbols.value[props.symbols.indexOf(symbol)];
    console.log(`Récupération des données pour ${symbol} (Finnhub: ${finnhubSymbol})`);

    // Obtenir le prix actuel
    const quote = await finnhubService.getQuote(finnhubSymbol);
    console.log('Quote reçu:', quote);
    
    if (!quote || quote.c === 0) {
      throw new Error(`Données de prix non disponibles pour ${symbol}`);
    }

    // Obtenir les données historiques (30 derniers jours)
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    const candles = await finnhubService.getCandles(finnhubSymbol, 'D', thirtyDaysAgo, now);
    console.log('Candles reçus:', candles);

    if (candles.s !== 'ok' || !candles.c || candles.c.length === 0) {
      throw new Error(`Données historiques non disponibles pour ${symbol}`);
    }

    marketData.value[symbol] = {
      symbol,
      currentPrice: quote.c,
      change: quote.c - quote.pc,
      changePercent: ((quote.c - quote.pc) / quote.pc) * 100,
      high: quote.h,
      low: quote.l,
      volume: 0,
      chartData: {
        labels: candles.t.map(timestamp => new Date(timestamp * 1000)),
        prices: candles.c
      }
    };

    // S'abonner aux mises à jour en temps réel
    finnhubService.subscribe(finnhubSymbol, (trade) => {
      console.log('Mise à jour en temps réel reçue:', trade);
      if (marketData.value[symbol] && trade && trade.p) {
        const prevPrice = marketData.value[symbol].currentPrice;
        marketData.value[symbol].currentPrice = trade.p;
        marketData.value[symbol].change = trade.p - prevPrice;
        marketData.value[symbol].changePercent = (marketData.value[symbol].change / prevPrice) * 100;
      }
    });
  } catch (err) {
    console.error(`Erreur lors de la récupération des données pour ${symbol}:`, err);
    error.value = `Impossible de charger les données pour ${symbol}. Veuillez réessayer plus tard.`;
    // Ajouter une entrée vide pour maintenir la cohérence de l'interface
    marketData.value[symbol] = {
      symbol,
      currentPrice: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      volume: 0,
      chartData: {
        labels: [],
        prices: []
      }
    };
  }
}

onMounted(async () => {
  isLoading.value = true;
  try {
    await Promise.all(props.symbols.map(symbol => fetchMarketData(symbol)));
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  // Se désabonner de tous les symboles
  props.symbols.forEach(symbol => {
    finnhubService.unsubscribe(symbol);
  });
});
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-xl font-semibold mb-4">Données de Marché en Temps Réel</h2>
    
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
    
    <div v-else-if="error" class="text-red-600 text-center p-4">
      {{ error }}
    </div>
    
    <div v-else class="space-y-6">
      <div v-for="(data, symbol) in marketData" :key="symbol" class="border rounded-lg p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">{{ symbol }}</h3>
          <div :class="[
            'text-sm font-medium',
            data.change >= 0 ? 'text-green-600' : 'text-red-600'
          ]">
            {{ data.changePercent.toFixed(2) }}%
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div class="text-sm text-gray-500">Prix Actuel</div>
            <div class="text-lg font-medium">${{ data.currentPrice.toFixed(2) }}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Variation</div>
            <div :class="[
              'text-lg font-medium',
              data.change >= 0 ? 'text-green-600' : 'text-red-600'
            ]">
              ${{ data.change.toFixed(2) }}
            </div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Plus Haut</div>
            <div class="text-lg font-medium">${{ data.high.toFixed(2) }}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Plus Bas</div>
            <div class="text-lg font-medium">${{ data.low.toFixed(2) }}</div>
          </div>
        </div>
        
        <div class="h-64">
          <Line
            :data="{
              labels: data.chartData.labels,
              datasets: [{
                label: 'Prix',
                data: data.chartData.prices,
                borderColor: data.change >= 0 ? '#10B981' : '#EF4444',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.1,
                fill: false
              }]
            }"
            :options="chartOptions"
          />
        </div>
      </div>
    </div>
  </div>
</template> 