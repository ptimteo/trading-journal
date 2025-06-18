<template>
  <div class="detailed-stock-info bg-white rounded-lg shadow-lg p-4">
    <!-- En-tête -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="col-span-2">
        <h2 class="text-2xl font-bold">{{ symbol }}</h2>
        <p class="text-gray-600">{{ formatMarketCap(detailedData.marketData.marketCap) }}</p>
      </div>
      <div class="col-span-2 text-right">
        <div class="text-2xl font-bold" :class="priceColor">{{ formatPrice(currentPrice) }}</div>
        <div class="text-sm" :class="changeColor">
          {{ formatChange(change) }} ({{ formatPercent(changePercent) }})
        </div>
      </div>
    </div>

    <!-- Grille principale -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Données de marché -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Données de marché</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">Volume</div>
          <div class="text-right">{{ formatNumber(detailedData.marketData.volume) }}</div>
          <div class="text-sm text-gray-600">Vol. Moyen</div>
          <div class="text-right">{{ formatNumber(detailedData.marketData.avgVolume) }}</div>
          <div class="text-sm text-gray-600">Vol. Relatif</div>
          <div class="text-right">{{ formatDecimal(detailedData.marketData.relVolume) }}</div>
          <div class="text-sm text-gray-600">Actions en circulation</div>
          <div class="text-right">{{ formatNumber(detailedData.marketData.sharesOutstanding) }}</div>
          <div class="text-sm text-gray-600">Flottant</div>
          <div class="text-right">{{ formatNumber(detailedData.marketData.sharesFloat) }}</div>
          <div class="text-sm text-gray-600">Short du flottant</div>
          <div class="text-right">{{ formatPercent(detailedData.marketData.shortFloat) }}</div>
          <div class="text-sm text-gray-600">Ratio de short</div>
          <div class="text-right">{{ formatDecimal(detailedData.marketData.shortRatio) }}</div>
          <div class="text-sm text-gray-600">Beta</div>
          <div class="text-right">{{ formatNumber(detailedData.marketData.beta) }}</div>
        </div>
      </div>

      <!-- Métriques de valorisation -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Valorisation</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">P/E</div>
          <div class="text-right">{{ formatNumber(detailedData.valuationMetrics.peRatio) }}</div>
          <div class="text-sm text-gray-600">Forward P/E</div>
          <div class="text-right">{{ formatNumber(detailedData.valuationMetrics.forwardPE) }}</div>
          <div class="text-sm text-gray-600">PEG</div>
          <div class="text-right">{{ formatNumber(detailedData.valuationMetrics.peg) }}</div>
          <div class="text-sm text-gray-600">P/S</div>
          <div class="text-right">{{ formatDecimal(detailedData.valuationMetrics.priceToSales) }}</div>
          <div class="text-sm text-gray-600">P/B</div>
          <div class="text-right">{{ formatDecimal(detailedData.valuationMetrics.priceToBook) }}</div>
          <div class="text-sm text-gray-600">P/FCF</div>
          <div class="text-right">{{ formatDecimal(detailedData.valuationMetrics.priceToFcf) }}</div>
        </div>
      </div>

      <!-- Performance -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Performance</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">Aujourd'hui</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.performanceMetrics.perfDay)">
            {{ formatPercent(detailedData.performanceMetrics.perfDay) }}
          </div>
          <div class="text-sm text-gray-600">1 semaine</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.performanceMetrics.perfWeek)">
            {{ formatPercent(detailedData.performanceMetrics.perfWeek) }}
          </div>
          <div class="text-sm text-gray-600">1 mois</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.performanceMetrics.perfMonth)">
            {{ formatPercent(detailedData.performanceMetrics.perfMonth) }}
          </div>
          <div class="text-sm text-gray-600">3 mois</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.performanceMetrics.perfQuarter)">
            {{ formatPercent(detailedData.performanceMetrics.perfQuarter) }}
          </div>
          <div class="text-sm text-gray-600">6 mois</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.performanceMetrics.perfHalfYear)">
            {{ formatPercent(detailedData.performanceMetrics.perfHalfYear) }}
          </div>
          <div class="text-sm text-gray-600">1 an</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.performanceMetrics.perfYear)">
            {{ formatPercent(detailedData.performanceMetrics.perfYear) }}
          </div>
          <div class="text-sm text-gray-600">YTD</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.performanceMetrics.perfYTD)">
            {{ formatPercent(detailedData.performanceMetrics.perfYTD) }}
          </div>
        </div>
      </div>

      <!-- Données sur les bénéfices -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Bénéfices</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">BPA</div>
          <div class="text-right">{{ formatDecimal(detailedData.earningsData.eps) }}</div>
          <div class="text-sm text-gray-600">BPA (TTM)</div>
          <div class="text-right">{{ formatDecimal(detailedData.earningsData.epsTTM) }}</div>
          <div class="text-sm text-gray-600">BPA prochain trim.</div>
          <div class="text-right">{{ formatDecimal(detailedData.earningsData.epsNextQ) }}</div>
          <div class="text-sm text-gray-600">Croissance BPA (trim.)</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.earningsData.epsGrowthNextQ)">
            {{ formatPercent(detailedData.earningsData.epsGrowthNextQ) }}
          </div>
          <div class="text-sm text-gray-600">Croissance BPA (5a)</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.earningsData.epsGrowth5Y)">
            {{ formatPercent(detailedData.earningsData.epsGrowth5Y) }}
          </div>
        </div>
      </div>

      <!-- Données sur les ventes -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Ventes</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">Croissance 5 ans</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.salesData.salesGrowthPast5Y)">
            {{ formatPercent(detailedData.salesData.salesGrowthPast5Y) }}
          </div>
          <div class="text-sm text-gray-600">Croissance trim.</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.salesData.salesGrowthQuarter)">
            {{ formatPercent(detailedData.salesData.salesGrowthQuarter) }}
          </div>
          <div class="text-sm text-gray-600">Croissance QoQ</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.salesData.salesQoQ)">
            {{ formatPercent(detailedData.salesData.salesQoQ) }}
          </div>
        </div>
      </div>

      <!-- Métriques de rentabilité -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Rentabilité</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">Marge brute</div>
          <div class="text-right">{{ formatPercent(detailedData.profitabilityMetrics.grossMargin) }}</div>
          <div class="text-sm text-gray-600">Marge opérationnelle</div>
          <div class="text-right">{{ formatPercent(detailedData.profitabilityMetrics.operatingMargin) }}</div>
          <div class="text-sm text-gray-600">Marge nette</div>
          <div class="text-right">{{ formatPercent(detailedData.profitabilityMetrics.profitMargin) }}</div>
          <div class="text-sm text-gray-600">ROE</div>
          <div class="text-right">{{ formatPercent(detailedData.profitabilityMetrics.roe) }}</div>
          <div class="text-sm text-gray-600">ROI</div>
          <div class="text-right">{{ formatPercent(detailedData.profitabilityMetrics.roi) }}</div>
          <div class="text-sm text-gray-600">ROA</div>
          <div class="text-right">{{ formatPercent(detailedData.profitabilityMetrics.roa) }}</div>
        </div>
      </div>

      <!-- Données techniques -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Technique</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">RSI (14)</div>
          <div class="text-right">{{ formatNumber(detailedData.technicalIndicators.rsi14) }}</div>
          <div class="text-sm text-gray-600">SMA 20</div>
          <div class="text-right">{{ formatPrice(detailedData.technicalIndicators.sma20) }}</div>
          <div class="text-sm text-gray-600">SMA 50</div>
          <div class="text-right">{{ formatPrice(detailedData.technicalIndicators.sma50) }}</div>
          <div class="text-sm text-gray-600">SMA 200</div>
          <div class="text-right">{{ formatPrice(detailedData.technicalIndicators.sma200) }}</div>
          <div class="text-sm text-gray-600">Volatilité</div>
          <div class="text-right">{{ formatPercent(detailedData.technicalIndicators.volatility) }}</div>
          <div class="text-sm text-gray-600">ATR</div>
          <div class="text-right">{{ formatDecimal(detailedData.technicalIndicators.atr) }}</div>
          <div class="text-sm text-gray-600">52 Semaines</div>
          <div class="text-right">
            {{ formatPrice(detailedData.technicalIndicators.range52W.low) }} - 
            {{ formatPrice(detailedData.technicalIndicators.range52W.high) }}
          </div>
          <div class="text-sm text-gray-600">Objectif</div>
          <div class="text-right">{{ formatPrice(detailedData.technicalIndicators.targetPrice) }}</div>
        </div>
      </div>

      <!-- Données d'actionnariat -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Actionnariat</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="text-sm text-gray-600">Initiés</div>
          <div class="text-right">{{ formatPercent(detailedData.ownershipData.insiderOwn) }}</div>
          <div class="text-sm text-gray-600">Trans. Initiés</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.ownershipData.insiderTrans)">
            {{ formatNumber(detailedData.ownershipData.insiderTrans) }}
          </div>
          <div class="text-sm text-gray-600">Institutions</div>
          <div class="text-right">{{ formatPercent(detailedData.ownershipData.instOwn) }}</div>
          <div class="text-sm text-gray-600">Trans. Institutions</div>
          <div class="text-right" :class="getPerformanceColor(detailedData.ownershipData.instTrans)">
            {{ formatNumber(detailedData.ownershipData.instTrans) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DetailedStockData } from '../services/financialAnalysis';

interface Props {
  symbol: string;
  detailedData: DetailedStockData;
  currentPrice: number;
  previousClose: number;
}

const props = defineProps<Props>();

const change = computed(() => Number(props.currentPrice) - Number(props.previousClose));
const changePercent = computed(() => ((Number(props.currentPrice) - Number(props.previousClose)) / Number(props.previousClose)) * 100);

const priceColor = computed(() => getPerformanceColor(changePercent.value));
const changeColor = computed(() => getPerformanceColor(changePercent.value));

function getPerformanceColor(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
}

function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPrice(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `${formatNumber(value / 1e12)}T`;
  if (value >= 1e9) return `${formatNumber(value / 1e9)}B`;
  if (value >= 1e6) return `${formatNumber(value / 1e6)}M`;
  return formatNumber(value);
}

function formatChange(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatPrice(value)}`;
}
</script>

<style scoped>
.detailed-stock-info {
  font-family: 'Inter', sans-serif;
}
</style> 