<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useTradingStore } from '../stores/trading';
import { financialAnalysisService, type StockAnalysis } from '../services/financialAnalysis';

const tradingStore = useTradingStore();
const isLoading = ref(false);
const error = ref<string | null>(null);
const marketOpportunities = ref<StockAnalysis[]>([]);
const opportunity = ref<StockAnalysis | null>(null);
const selectedIndex = ref<string>('^GSPC');
const analysis = computed(() => opportunity.value?.analysis || '');
const totalRecommendations = computed(() => {
  if (!opportunity.value) return 0
  const distribution = opportunity.value.consensus.marketConsensus.analystConsensus.distribution
  return distribution.strongBuy + distribution.buy + distribution.hold + distribution.sell + distribution.strongSell
})

// Liste des indices disponibles avec leurs détails
const availableIndices = [
  { symbol: '^GSPC', name: 'S&P 500', description: 'Indice américain des 500 plus grandes entreprises' },
  { symbol: '^NDX', name: 'NASDAQ 100', description: 'Indice des 100 plus grandes entreprises technologiques' },
  { symbol: '^FCHI', name: 'CAC 40', description: 'Indice français des 40 plus grandes capitalisations' },
  { symbol: '^STOXX50E', name: 'EURO STOXX 50', description: 'Indice européen des 50 plus grandes entreprises' },
  { symbol: '^N225', name: 'Nikkei 225', description: 'Indice japonais des 225 plus grandes entreprises' },
  { symbol: '^HSI', name: 'Hang Seng', description: 'Indice principal de Hong Kong' },
  { symbol: '^FTSE', name: 'FTSE 100', description: 'Indice britannique des 100 plus grandes entreprises' },
  { symbol: '^DAX', name: 'DAX', description: 'Indice allemand des 40 plus grandes entreprises' }
];

const sectors = [
  'XLK', // Technology
  'XLV', // Healthcare
  'XLF', // Financial
  'XLE', // Energy
  'XLI', // Industrial
  'XLP', // Consumer Staples
  'XLY'  // Consumer Discretionary
];

// Fonction pour calculer un score d'opportunité
function calculateOpportunityScore(stock: StockAnalysis): number {
  let score = 0;

  // Indicateurs techniques
  if (stock.technicalIndicators.rsi < 30) score += 10;
  if (stock.technicalIndicators.rsi > 70) score -= 10;
  if (stock.technicalIndicators.macd.histogram > 0) score += 5;
  if (stock.technicalIndicators.macd.histogram < 0) score -= 5;

  // Moyennes mobiles
  const { sma20, sma50, sma200 } = stock.technicalIndicators.movingAverages;
  if (sma20 > sma50 && sma50 > sma200) score += 15;
  if (sma20 < sma50 && sma50 < sma200) score -= 15;

  // Fondamentaux
  if (stock.fundamentalData.peRatio < 15) score += 10;
  if (stock.fundamentalData.peRatio > 30) score -= 10;
  if (stock.fundamentalData.roe > 15) score += 5;
  if (stock.fundamentalData.profitMargin > 10) score += 5;

  // Risque
  if (stock.riskAnalysis.volatility < 20) score += 5;
  if (stock.riskAnalysis.sharpeRatio > 1) score += 5;
  if (stock.riskAnalysis.maxDrawdown < 15) score += 5;

  // Sentiment
  if (stock.marketSentiment.sentimentScore > 0.7) score += 10;
  if (stock.marketSentiment.sentimentScore < 0.3) score -= 10;
  if (stock.marketSentiment.shortInterest > 20) score -= 5;
  if (stock.marketSentiment.institutionalOwnership > 70) score += 5;

  return score;
}

async function analyzeMarket() {
  try {
    isLoading.value = true;
    error.value = null;
    
    // Récupérer l'analyse pour l'indice sélectionné
    const analysis = await financialAnalysisService.getStockAnalysis(selectedIndex.value);
    opportunity.value = analysis;
    
    // Récupérer les analyses pour les autres indices en arrière-plan
    const otherIndices = availableIndices
      .filter(index => index.symbol !== selectedIndex.value)
      .map(index => index.symbol);
    
    const otherAnalyses = await Promise.all(
      otherIndices.map(symbol => financialAnalysisService.getStockAnalysis(symbol))
    );
    
    marketOpportunities.value = [analysis, ...otherAnalyses];
    
  } catch (e) {
    error.value = "Erreur lors de l'analyse du marché: " + (e as Error).message;
  } finally {
    isLoading.value = false;
  }
}

// Fonction pour changer l'indice sélectionné
async function changeIndex(symbol: string) {
  selectedIndex.value = symbol;
  await analyzeMarket();
}

// Analyser le marché au montage du composant
onMounted(() => {
  analyzeMarket();
});
</script>

<template>
  <div class="bg-white shadow rounded-lg p-6 transition-all duration-300 hover:shadow-lg">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-900 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Bot d'Analyse Financière
      </h2>
      <div class="flex items-center space-x-2">
        <span class="text-sm text-gray-500">Powered by AI</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
    </div>

    <!-- Sélecteur d'indices -->
    <div class="mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          v-for="index in availableIndices"
          :key="index.symbol"
          @click="changeIndex(index.symbol)"
          class="p-3 rounded-lg text-left transition-all duration-200"
          :class="{
            'bg-blue-50 border-blue-200 border-2': selectedIndex === index.symbol,
            'bg-gray-50 border border-gray-200 hover:bg-gray-100': selectedIndex !== index.symbol
          }"
        >
          <h3 class="text-sm font-semibold text-gray-900">{{ index.name }}</h3>
          <p class="text-xs text-gray-500 mt-1">{{ index.description }}</p>
        </button>
      </div>
    </div>

    <!-- Bouton de rafraîchissement -->
    <div class="flex justify-end mb-6">
      <button
        @click="analyzeMarket"
        :disabled="isLoading"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Rafraîchir l'analyse
      </button>
    </div>

    <!-- Analyse Macro-économique -->
    <div v-if="opportunity" class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h4 class="text-sm font-medium text-gray-700 mb-4">Environnement Macro-économique</h4>
      
      <!-- Indicateurs Principaux -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p class="text-xs text-gray-500">Croissance PIB</p>
          <p class="text-lg font-semibold" :class="{
            'text-green-600': opportunity.macroEnvironment.gdpGrowth > 2,
            'text-red-600': opportunity.macroEnvironment.gdpGrowth < 0,
            'text-gray-600': opportunity.macroEnvironment.gdpGrowth >= 0 && opportunity.macroEnvironment.gdpGrowth <= 2
          }">
            {{ opportunity.macroEnvironment.gdpGrowth.toFixed(1) }}%
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500">Inflation</p>
          <p class="text-lg font-semibold" :class="{
            'text-red-600': opportunity.macroEnvironment.inflation > 3,
            'text-green-600': opportunity.macroEnvironment.inflation < 2,
            'text-gray-600': opportunity.macroEnvironment.inflation >= 2 && opportunity.macroEnvironment.inflation <= 3
          }">
            {{ opportunity.macroEnvironment.inflation.toFixed(1) }}%
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500">Chômage</p>
          <p class="text-lg font-semibold" :class="{
            'text-red-600': opportunity.macroEnvironment.unemploymentRate > 5,
            'text-green-600': opportunity.macroEnvironment.unemploymentRate < 4,
            'text-gray-600': opportunity.macroEnvironment.unemploymentRate >= 4 && opportunity.macroEnvironment.unemploymentRate <= 5
          }">
            {{ opportunity.macroEnvironment.unemploymentRate.toFixed(1) }}%
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500">VIX</p>
          <p class="text-lg font-semibold" :class="{
            'text-red-600': opportunity.macroEnvironment.globalMarkets.vix > 25,
            'text-green-600': opportunity.macroEnvironment.globalMarkets.vix < 15,
            'text-gray-600': opportunity.macroEnvironment.globalMarkets.vix >= 15 && opportunity.macroEnvironment.globalMarkets.vix <= 25
          }">
            {{ opportunity.macroEnvironment.globalMarkets.vix.toFixed(1) }}
          </p>
        </div>
      </div>

      <!-- Taux d'intérêt -->
      <div class="mb-4">
        <p class="text-xs text-gray-500 mb-2">Taux d'intérêt</p>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-gray-500">Fed</p>
            <p class="text-sm font-medium">{{ opportunity.macroEnvironment.interestRates.federal.toFixed(2) }}%</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">10Y</p>
            <p class="text-sm font-medium">{{ opportunity.macroEnvironment.interestRates.treasury10Y.toFixed(2) }}%</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">2Y</p>
            <p class="text-sm font-medium">{{ opportunity.macroEnvironment.interestRates.treasury2Y.toFixed(2) }}%</p>
          </div>
        </div>
      </div>

      <!-- Indicateurs économiques -->
      <div class="mb-4">
        <p class="text-xs text-gray-500 mb-2">Indicateurs économiques</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-gray-500">PMI</p>
            <p class="text-sm font-medium" :class="{
              'text-green-600': opportunity.macroEnvironment.economicIndicators.pmi > 50,
              'text-red-600': opportunity.macroEnvironment.economicIndicators.pmi < 50
            }">
              {{ opportunity.macroEnvironment.economicIndicators.pmi.toFixed(1) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Confiance Conso.</p>
            <p class="text-sm font-medium">{{ opportunity.macroEnvironment.economicIndicators.consumerConfidence.toFixed(1) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Ventes Détail</p>
            <p class="text-sm font-medium">{{ opportunity.macroEnvironment.economicIndicators.retailSales.toFixed(1) }}%</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Prod. Industrielle</p>
            <p class="text-sm font-medium">{{ opportunity.macroEnvironment.economicIndicators.industrialProduction.toFixed(1) }}%</p>
          </div>
        </div>
      </div>

      <!-- Marchés globaux -->
      <div>
        <p class="text-xs text-gray-500 mb-2">Marchés globaux</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-gray-500">USD Index</p>
            <p class="text-sm font-medium">{{ opportunity.macroEnvironment.globalMarkets.usDollarIndex.toFixed(1) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Or</p>
            <p class="text-sm font-medium">${{ opportunity.macroEnvironment.globalMarkets.goldPrice.toFixed(0) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Pétrole</p>
            <p class="text-sm font-medium">${{ opportunity.macroEnvironment.globalMarkets.oilPrice.toFixed(2) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Analyse globale -->
    <div v-if="opportunity && analysis" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 class="text-sm font-medium text-blue-700 mb-2">Analyse Globale du Marché</h4>
      <p class="text-lg text-blue-900">{{ analysis }}</p>
    </div>

    <!-- Consensus des Indicateurs -->
    <div v-if="opportunity" class="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
      <h4 class="text-sm font-medium text-gray-700 mb-4">Consensus des Indicateurs</h4>

      <!-- Consensus Technique -->
      <div class="mb-6">
        <p class="text-sm font-medium text-gray-600 mb-2">Analyse Technique</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <p class="text-xs text-gray-500">Court Terme</p>
            <p class="text-sm font-medium" :class="{
              'text-green-600': opportunity.consensus.technicalConsensus.shortTerm.includes('Haussier'),
              'text-red-600': opportunity.consensus.technicalConsensus.shortTerm.includes('Baissier'),
              'text-gray-600': opportunity.consensus.technicalConsensus.shortTerm === 'Neutre'
            }">
              {{ opportunity.consensus.technicalConsensus.shortTerm }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Moyen Terme</p>
            <p class="text-sm font-medium" :class="{
              'text-green-600': opportunity.consensus.technicalConsensus.mediumTerm.includes('Haussier'),
              'text-red-600': opportunity.consensus.technicalConsensus.mediumTerm.includes('Baissier'),
              'text-gray-600': opportunity.consensus.technicalConsensus.mediumTerm === 'Neutre'
            }">
              {{ opportunity.consensus.technicalConsensus.mediumTerm }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Long Terme</p>
            <p class="text-sm font-medium" :class="{
              'text-green-600': opportunity.consensus.technicalConsensus.longTerm.includes('Haussier'),
              'text-red-600': opportunity.consensus.technicalConsensus.longTerm.includes('Baissier'),
              'text-gray-600': opportunity.consensus.technicalConsensus.longTerm === 'Neutre'
            }">
              {{ opportunity.consensus.technicalConsensus.longTerm }}
            </p>
          </div>
        </div>

        <!-- Force et Fiabilité -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-xs text-gray-500">Force du Signal</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: opportunity.consensus.technicalConsensus.strength + '%' }"></div>
            </div>
            <p class="text-xs text-gray-600 mt-1">{{ opportunity.consensus.technicalConsensus.strength }}%</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Fiabilité</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div class="bg-green-600 h-2.5 rounded-full" :style="{ width: opportunity.consensus.technicalConsensus.reliability + '%' }"></div>
            </div>
            <p class="text-xs text-gray-600 mt-1">{{ opportunity.consensus.technicalConsensus.reliability }}%</p>
          </div>
        </div>

        <!-- Signaux -->
        <div class="space-y-2">
          <p class="text-xs text-gray-500">Signaux</p>
          <div v-for="signal in opportunity.consensus.technicalConsensus.signals" :key="signal.indicator" 
               class="flex items-center justify-between">
            <span class="text-sm text-gray-600">{{ signal.indicator }}</span>
            <span class="text-sm font-medium" :class="{
              'text-green-600': signal.signal === 'Achat',
              'text-red-600': signal.signal === 'Vente',
              'text-gray-600': signal.signal === 'Neutre'
            }">
              {{ signal.signal }} ({{ (signal.weight * 100).toFixed(0) }}%)
            </span>
          </div>
        </div>
      </div>

      <!-- Consensus Fondamental -->
      <div class="mb-6">
        <p class="text-sm font-medium text-gray-600 mb-2">Analyse Fondamentale</p>
        
        <!-- Valorisation -->
        <div class="mb-4">
          <p class="text-xs text-gray-500 mb-2">Valorisation</p>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">{{ opportunity.consensus.fundamentalConsensus.valueMetrics.status }}</span>
            <div class="w-1/2">
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="bg-blue-600 h-2.5 rounded-full" 
                     :style="{ width: opportunity.consensus.fundamentalConsensus.valueMetrics.score + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <div v-for="metric in opportunity.consensus.fundamentalConsensus.valueMetrics.metrics" 
                 :key="metric.name" class="flex items-center justify-between">
              <span class="text-xs text-gray-500">{{ metric.name }}</span>
              <span class="text-sm font-medium" :class="{
                'text-green-600': metric.evaluation === 'Positif',
                'text-red-600': metric.evaluation === 'Négatif',
                'text-gray-600': metric.evaluation === 'Neutre'
              }">
                {{ metric.value.toFixed(2) }} vs {{ metric.benchmark.toFixed(2) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Croissance -->
        <div class="mb-4">
          <p class="text-xs text-gray-500 mb-2">Croissance</p>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">{{ opportunity.consensus.fundamentalConsensus.growthMetrics.status }}</span>
            <div class="w-1/2">
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="bg-green-600 h-2.5 rounded-full" 
                     :style="{ width: opportunity.consensus.fundamentalConsensus.growthMetrics.score + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <div v-for="metric in opportunity.consensus.fundamentalConsensus.growthMetrics.metrics" 
                 :key="metric.name" class="flex items-center justify-between">
              <span class="text-xs text-gray-500">{{ metric.name }}</span>
              <span class="text-sm font-medium" :class="{
                'text-green-600': metric.evaluation === 'Positif',
                'text-red-600': metric.evaluation === 'Négatif',
                'text-gray-600': metric.evaluation === 'Neutre'
              }">
                {{ metric.value.toFixed(2) }}% vs {{ metric.industryAvg.toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Qualité -->
        <div>
          <p class="text-xs text-gray-500 mb-2">Qualité</p>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">{{ opportunity.consensus.fundamentalConsensus.qualityMetrics.status }}</span>
            <div class="w-1/2">
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="bg-purple-600 h-2.5 rounded-full" 
                     :style="{ width: opportunity.consensus.fundamentalConsensus.qualityMetrics.score + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <div v-for="metric in opportunity.consensus.fundamentalConsensus.qualityMetrics.metrics" 
                 :key="metric.name" class="flex items-center justify-between">
              <span class="text-xs text-gray-500">{{ metric.name }}</span>
              <span class="text-sm font-medium" :class="{
                'text-green-600': metric.evaluation === 'Positif',
                'text-red-600': metric.evaluation === 'Négatif',
                'text-gray-600': metric.evaluation === 'Neutre'
              }">
                {{ metric.value.toFixed(2) }} vs {{ metric.threshold.toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Consensus de Marché -->
      <div>
        <p class="text-sm font-medium text-gray-600 mb-2">Sentiment de Marché</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-xs text-gray-500">Consensus Global</p>
            <p class="text-sm font-medium" :class="{
              'text-green-600': opportunity.consensus.marketConsensus.overall.includes('Favorable'),
              'text-red-600': opportunity.consensus.marketConsensus.overall.includes('Défavorable'),
              'text-gray-600': opportunity.consensus.marketConsensus.overall === 'Neutre'
            }">
              {{ opportunity.consensus.marketConsensus.overall }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Objectif de Prix</p>
            <p class="text-sm font-medium">
              ${{ opportunity.consensus.marketConsensus.analystConsensus.targetPrice.toFixed(2) }}
              ({{ opportunity.consensus.marketConsensus.analystConsensus.numberOfAnalysts }} analystes)
            </p>
          </div>
        </div>

        <!-- Distribution des recommandations -->
        <div class="mb-4">
          <p class="text-xs text-gray-500 mb-2">Distribution des Recommandations</p>
          <div class="flex h-4 rounded-full overflow-hidden">
            <div class="bg-green-500" 
                 :style="{ width: (opportunity.consensus.marketConsensus.analystConsensus.distribution.strongBuy / totalRecommendations * 100) + '%' }"
                 :title="`Achat Fort: ${opportunity.consensus.marketConsensus.analystConsensus.distribution.strongBuy}`"></div>
            <div class="bg-green-300" 
                 :style="{ width: (opportunity.consensus.marketConsensus.analystConsensus.distribution.buy / totalRecommendations * 100) + '%' }"
                 :title="`Achat: ${opportunity.consensus.marketConsensus.analystConsensus.distribution.buy}`"></div>
            <div class="bg-gray-300" 
                 :style="{ width: (opportunity.consensus.marketConsensus.analystConsensus.distribution.hold / totalRecommendations * 100) + '%' }"
                 :title="`Conserver: ${opportunity.consensus.marketConsensus.analystConsensus.distribution.hold}`"></div>
            <div class="bg-red-300" 
                 :style="{ width: (opportunity.consensus.marketConsensus.analystConsensus.distribution.sell / totalRecommendations * 100) + '%' }"
                 :title="`Vente: ${opportunity.consensus.marketConsensus.analystConsensus.distribution.sell}`"></div>
            <div class="bg-red-500" 
                 :style="{ width: (opportunity.consensus.marketConsensus.analystConsensus.distribution.strongSell / totalRecommendations * 100) + '%' }"
                 :title="`Vente Forte: ${opportunity.consensus.marketConsensus.analystConsensus.distribution.strongSell}`"></div>
          </div>
        </div>

        <!-- Sentiment détaillé -->
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-gray-500">Institutionnel</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div class="bg-blue-600 h-2.5 rounded-full" 
                   :style="{ width: ((opportunity.consensus.marketConsensus.institutionalSentiment + 100) / 2) + '%' }"></div>
            </div>
            <p class="text-xs text-gray-600 mt-1">{{ opportunity.consensus.marketConsensus.institutionalSentiment }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Particuliers</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div class="bg-green-600 h-2.5 rounded-full" 
                   :style="{ width: ((opportunity.consensus.marketConsensus.retailSentiment + 100) / 2) + '%' }"></div>
            </div>
            <p class="text-xs text-gray-600 mt-1">{{ opportunity.consensus.marketConsensus.retailSentiment }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">Impact News</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div class="bg-purple-600 h-2.5 rounded-full" 
                   :style="{ width: ((opportunity.consensus.marketConsensus.newsImpact + 100) / 2) + '%' }"></div>
            </div>
            <p class="text-xs text-gray-600 mt-1">{{ opportunity.consensus.marketConsensus.newsImpact }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Opportunités d'investissement -->
    <div v-if="marketOpportunities.length > 0" class="space-y-6">
      <h3 class="text-lg font-medium text-gray-900">Opportunités d'Investissement</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="opportunity in marketOpportunities" :key="opportunity.symbol" 
             class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-medium text-gray-900">{{ opportunity.symbol }}</h4>
            <div class="flex items-center">
              <span class="text-sm font-medium" :class="{
                'text-green-600': calculateOpportunityScore(opportunity) > 0,
                'text-red-600': calculateOpportunityScore(opportunity) < 0,
                'text-gray-600': calculateOpportunityScore(opportunity) === 0
              }">
                Score: {{ calculateOpportunityScore(opportunity) }}
              </span>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Indicateurs techniques -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">RSI</p>
                <p class="text-lg font-semibold" :class="{
                  'text-red-600': opportunity.technicalIndicators.rsi > 70,
                  'text-green-600': opportunity.technicalIndicators.rsi < 30,
                  'text-gray-600': opportunity.technicalIndicators.rsi >= 30 && opportunity.technicalIndicators.rsi <= 70
                }">
                  {{ opportunity.technicalIndicators.rsi.toFixed(2) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">MACD</p>
                <p class="text-lg font-semibold" :class="{
                  'text-green-600': opportunity.technicalIndicators.macd.histogram > 0,
                  'text-red-600': opportunity.technicalIndicators.macd.histogram < 0,
                  'text-gray-600': opportunity.technicalIndicators.macd.histogram === 0
                }">
                  {{ opportunity.technicalIndicators.macd.histogram.toFixed(2) }}
                </p>
              </div>
            </div>

            <!-- Moyennes mobiles -->
            <div>
              <p class="text-sm text-gray-500 mb-2">Moyennes Mobiles</p>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <p class="text-xs text-gray-500">SMA20</p>
                  <p class="text-sm font-medium">{{ opportunity.technicalIndicators.movingAverages.sma20.toFixed(2) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">SMA50</p>
                  <p class="text-sm font-medium">{{ opportunity.technicalIndicators.movingAverages.sma50.toFixed(2) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">SMA200</p>
                  <p class="text-sm font-medium">{{ opportunity.technicalIndicators.movingAverages.sma200.toFixed(2) }}</p>
                </div>
              </div>
            </div>

            <!-- Bandes de Bollinger -->
            <div>
              <p class="text-sm text-gray-500 mb-2">Bandes de Bollinger</p>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <p class="text-xs text-gray-500">Supérieure</p>
                  <p class="text-sm font-medium">{{ opportunity.technicalIndicators.bollingerBands.upper.toFixed(2) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Moyenne</p>
                  <p class="text-sm font-medium">{{ opportunity.technicalIndicators.bollingerBands.middle.toFixed(2) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Inférieure</p>
                  <p class="text-sm font-medium">{{ opportunity.technicalIndicators.bollingerBands.lower.toFixed(2) }}</p>
                </div>
              </div>
            </div>

            <!-- Volume -->
            <div>
              <p class="text-sm text-gray-500 mb-2">Volume</p>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-500">Tendance</p>
                  <p class="text-sm font-medium" :class="{
                    'text-green-600': opportunity.technicalIndicators.volume.trend === 'increasing',
                    'text-red-600': opportunity.technicalIndicators.volume.trend === 'decreasing',
                    'text-gray-600': opportunity.technicalIndicators.volume.trend === 'stable'
                  }">
                    {{ opportunity.technicalIndicators.volume.trend }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Ratio Volume</p>
                  <p class="text-sm font-medium">
                    {{ (opportunity.technicalIndicators.volume.current / opportunity.technicalIndicators.volume.average).toFixed(2) }}x
                  </p>
                </div>
              </div>
            </div>

            <!-- Données fondamentales -->
            <div>
              <p class="text-sm text-gray-500 mb-2">Données Fondamentales</p>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-500">P/E Ratio</p>
                  <p class="text-sm font-medium" :class="{
                    'text-green-600': opportunity.fundamentalData.peRatio < 15,
                    'text-red-600': opportunity.fundamentalData.peRatio > 30,
                    'text-gray-600': opportunity.fundamentalData.peRatio >= 15 && opportunity.fundamentalData.peRatio <= 30
                  }">
                    {{ opportunity.fundamentalData.peRatio.toFixed(2) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">ROE</p>
                  <p class="text-sm font-medium">{{ opportunity.fundamentalData.roe.toFixed(2) }}%</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Croissance Revenus</p>
                  <p class="text-sm font-medium">{{ opportunity.fundamentalData.revenueGrowth.toFixed(2) }}%</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Marge Bénéficiaire</p>
                  <p class="text-sm font-medium">{{ opportunity.fundamentalData.profitMargin.toFixed(2) }}%</p>
                </div>
              </div>
            </div>

            <!-- Analyse des risques -->
            <div>
              <p class="text-sm text-gray-500 mb-2">Analyse des Risques</p>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-500">Volatilité</p>
                  <p class="text-sm font-medium">{{ opportunity.riskAnalysis.volatility.toFixed(2) }}%</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Ratio de Sharpe</p>
                  <p class="text-sm font-medium">{{ opportunity.riskAnalysis.sharpeRatio.toFixed(2) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Drawdown Max</p>
                  <p class="text-sm font-medium">{{ opportunity.riskAnalysis.maxDrawdown.toFixed(2) }}%</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">VaR 95%</p>
                  <p class="text-sm font-medium">{{ opportunity.riskAnalysis.var95.toFixed(2) }}%</p>
                </div>
              </div>
            </div>

            <!-- Sentiment du marché -->
            <div>
              <p class="text-sm text-gray-500 mb-2">Sentiment du Marché</p>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-500">Score Sentiment</p>
                  <p class="text-sm font-medium" :class="{
                    'text-green-600': opportunity.marketSentiment.sentimentScore > 0.7,
                    'text-red-600': opportunity.marketSentiment.sentimentScore < 0.3,
                    'text-gray-600': opportunity.marketSentiment.sentimentScore >= 0.3 && opportunity.marketSentiment.sentimentScore <= 0.7
                  }">
                    {{ (opportunity.marketSentiment.sentimentScore * 100).toFixed(1) }}%
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Intérêt Short</p>
                  <p class="text-sm font-medium">{{ opportunity.marketSentiment.shortInterest.toFixed(2) }}%</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Propriété Inst.</p>
                  <p class="text-sm font-medium">{{ opportunity.marketSentiment.institutionalOwnership.toFixed(1) }}%</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Sentiment News</p>
                  <p class="text-sm font-medium" :class="{
                    'text-green-600': opportunity.marketSentiment.newsSentiment === 'positive',
                    'text-red-600': opportunity.marketSentiment.newsSentiment === 'negative',
                    'text-gray-600': opportunity.marketSentiment.newsSentiment === 'neutral'
                  }">
                    {{ opportunity.marketSentiment.newsSentiment }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Recommandation -->
            <div class="mt-4">
              <p class="text-sm text-gray-500">Recommandation</p>
              <p class="text-sm font-medium" :class="{
                'text-green-600': opportunity.marketSentiment.analystRating.includes('Buy'),
                'text-red-600': opportunity.marketSentiment.analystRating.includes('Sell'),
                'text-gray-600': opportunity.marketSentiment.analystRating === 'Neutral'
              }">
                {{ opportunity.marketSentiment.analystRating }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Message d'erreur -->
    <div v-if="error" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-sm text-red-700">{{ error }}</p>
    </div>
  </div>
</template> 