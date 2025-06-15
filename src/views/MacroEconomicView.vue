<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, reactive, watch, nextTick } from 'vue';
import { fredService, MacroEconomicData } from '../services/fredService';
import { yahooFinanceService, GoldSilverRatioData } from '../services/yahooFinanceService';
import { Line, Bar } from 'vue-chartjs';
import { Chart as ChartJS } from 'chart.js/auto';
import { useRoute } from 'vue-router';
import IndicatorInterpretation from '../components/IndicatorInterpretation.vue';
import { gdpService } from '../services/gdpService';
import { yieldCurveService } from '../services/yieldCurveService';

// Type pour les indicateurs économiques
type IndicatorKey =
  | "overview"
  | "top-setups"
  | "gdp"
  | "retail-sales"
  | "industrial-production"
  | "manufacturing-pmi"
  | "services-pmi"
  | "unemployment"
  | "nonfarm-payrolls"
  | "adp-employment"
  | "jobless-claims"
  | "wage-growth"
  | "cpi"
  | "ppi"
  | "pce"
  | "federal"
  | "treasury"
  | "yield-curve"
  | "vix"
  | "dollar-index"
  | "risk-gauge"
  | "fear-greed"
  | "cot"
  | "consumer-confidence"
  | "business-confidence"
  | "gold-silver-ratio"
  | "housing-starts"
  | "building-permits"
  | "oil"
  | "adp-usa"
  | "job-openings"
  | "treasuries"
  | "unemployment-claims"
  | "carry-trade";

// Récupérer l'objet route
const route = useRoute();
// Ajouter ces variables réactives après vos autres variables
const vixData = ref<{ date: string; close: number }[]>([]);
const isLoadingVIX = ref(false);
const vixError = ref('');

// Données pour l'indice Dollar (DXY)
const dxyData = ref<{ date: string; close: number }[]>([]);
const isLoadingDXY = ref(false);
const dxyError = ref('');

// Fonction pour récupérer les données VIX
const fetchVIXData = async () => {
  isLoadingVIX.value = true;
  vixError.value = '';
  
  try {
    const res = await fetch('http://localhost:3000/api/yahoo/^VIX');
    if (!res.ok) {
      throw new Error(`Erreur HTTP: ${res.status}`);
    }
    
    const json = await res.json();
    
    // Formatage simplifié : on garde seulement la date et la clôture
    vixData.value = json.map((point: any) => ({
      date: point.date.split('T')[0],
      close: point.close
    }));
    
    // Mise à jour des données VIX dans economicIndicators
    if (vixData.value.length > 0) {
      const currentVIXValue = vixData.value[vixData.value.length - 1].close;
      const previousVIXValue = vixData.value[vixData.value.length - 2]?.close || currentVIXValue;
      
      economicIndicators.value.vix = {
        ...economicIndicators.value.vix,
        value: Math.round(currentVIXValue),
        previousValue: Math.round(previousVIXValue),
        trend: currentVIXValue > previousVIXValue ? 'up' : 'down',
        chart: {
          labels: vixData.value.map(point => {
            const dateParts = point.date.split('-');
            return `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}`;
          }),
          values: vixData.value.map(point => point.close)
        }
      };
    }
    
  } catch (err: unknown) {
    console.error('Erreur de récupération du VIX:', err);
    if (err instanceof Error) {
      vixError.value = `Erreur de récupération: ${err.message}`;
    } else {
      vixError.value = 'Erreur de récupération inconnue';
    }
  } finally {
    isLoadingVIX.value = false;
  }
};

// Fonction pour récupérer les données DXY
const fetchDXYData = async () => {
  isLoadingDXY.value = true;
  dxyError.value = '';
  
  try {
    const res = await fetch('http://localhost:3000/api/yahoo/DX-Y.NYB');
    if (!res.ok) {
      throw new Error(`Erreur HTTP: ${res.status}`);
    }
    
    const json = await res.json();
    
    // Formatage simplifié : on garde seulement la date et la clôture
    dxyData.value = json.map((point: any) => ({
      date: point.date.split('T')[0],
      close: point.close
    }));
    
    // Mise à jour des données DXY dans economicIndicators
    if (dxyData.value.length > 0) {
      const currentDXYValue = dxyData.value[dxyData.value.length - 1].close;
      const previousDXYValue = dxyData.value[dxyData.value.length - 2]?.close || currentDXYValue;
      
      economicIndicators.value['dollar-index'] = {
        ...economicIndicators.value['dollar-index'],
        value: Math.round(currentDXYValue * 10) / 10, // Arrondi à 1 décimale
        previousValue: Math.round(previousDXYValue * 10) / 10,
        trend: currentDXYValue > previousDXYValue ? 'up' : 'down',
        chart: {
          labels: dxyData.value.map(point => {
            const dateParts = point.date.split('-');
            return `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}`;
          }),
          values: dxyData.value.map(point => point.close)
        }
      };
    }
    
  } catch (err: unknown) {
    console.error('Erreur de récupération du DXY:', err);
    if (err instanceof Error) {
      dxyError.value = `Erreur de récupération: ${err.message}`;
    } else {
      dxyError.value = 'Erreur de récupération inconnue';
    }
  } finally {
    isLoadingDXY.value = false;
  }
};

// Fonction pour mettre à jour l'indicateur de pétrole
function updateOilIndicator() {
  // Si nous avons des données macro et l'indicateur de pétrole
  if (macroData.value?.marketIndicators?.oil) {
    const oilValue = macroData.value.marketIndicators.oil.value;
    const oilChange = macroData.value.marketIndicators.oil.change;
    
    // Mettre à jour l'indicateur dans l'objet economicIndicators
    economicIndicators.value['oil'] = {
      ...economicIndicators.value['oil'],
      value: oilValue,
      previousValue: oilValue - oilChange, // Calculer la valeur précédente
      trend: oilChange > 0 ? 'up' : (oilChange < 0 ? 'down' : 'stable'),
      // Nous gardons les labels/values par défaut car nous n'avons pas de données historiques
    };
  }
}

// Pays disponibles
const countries = [
  { id: 'us', name: 'États-Unis', flag: '🇺🇸' },
  { id: 'eu', name: 'Zone Euro', flag: '🇪🇺' },
];

// Définir un type pour les pays sélectionnables
type SelectedCountry = 'us' | 'eu' | 'cn';

// Pays sélectionné
const selectedCountry = ref<SelectedCountry>('us');

// Catégories
const categories = [
  { id: 'overview', name: 'Vue d\'ensemble', icon: 'dashboard' },
  { id: 'growth', name: 'Croissance', icon: 'chart-line' },
  { id: 'inflation', name: 'Inflation', icon: 'fire' },
  { id: 'employment', name: 'Emploi', icon: 'users' },
  { id: 'monetary', name: 'Politique monétaire', icon: 'currency-dollar' },
  { id: 'markets', name: 'Marchés financiers', icon: 'chart-bar' }
];

// État des données macroéconomiques
const macroData = ref<MacroEconomicData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

// Mise à jour des variables pour le ratio or/argent
const goldSilverRatio = ref<GoldSilverRatioData>({ dates: [], values: [] });
const isLoadingGoldSilver = ref(false);
const goldSilverError = ref<string | null>(null);

// Dates pour le contexte temporel
const lastUpdated = ref(new Date());
const periodStart = ref(new Date());
const periodEnd = ref(new Date());

// Score de risque économique (0-100)
const economicRiskScore = ref(48);

// Période de comparaison pour les tendances
periodStart.value.setMonth(periodStart.value.getMonth() - 3); // 3 mois en arrière

// États visuels
const selectedSection = ref<'overview' | 'growth' | 'inflation' | 'employment' | 'monetary' | 'markets'>('overview');

// États
const activeSection = ref('overview');
const selectedIndicator = ref<IndicatorKey>('overview');

// Données PIB par pays
const gdpData = ref({
  us: {
    dates: ['2020-Q1', '2020-Q2', '2020-Q3', '2020-Q4', '2021-Q1', '2021-Q2', '2021-Q3', '2021-Q4', '2022-Q1', '2022-Q2', '2022-Q3', '2022-Q4', '2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1'],
    values: [-1.3, -31.2, 33.8, 4.5, 6.3, 6.7, 2.7, 7.0, -1.6, -0.6, 3.2, 2.6, 2.2, 2.1, 4.9, 3.4, 1.6],
    forecast: [1.8, 2.1, 2.3, 2.5]
  },
  eu: {
    dates: ['2020-Q1', '2020-Q2', '2020-Q3', '2020-Q4', '2021-Q1', '2021-Q2', '2021-Q3', '2021-Q4', '2022-Q1', '2022-Q2', '2022-Q3', '2022-Q4', '2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1'],
    values: [-3.0, -14.6, 12.6, -0.4, -0.1, 2.0, 2.2, 0.4, 0.6, 0.8, 0.5, 0.0, 0.1, 0.2, 0.0, 0.1, 0.3],
    forecast: [0.5, 0.8, 1.0, 1.2]
  },
  cn: {
    dates: ['2020-Q1', '2020-Q2', '2020-Q3', '2020-Q4', '2021-Q1', '2021-Q2', '2021-Q3', '2021-Q4', '2022-Q1', '2022-Q2', '2022-Q3', '2022-Q4', '2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1'],
    values: [-6.9, 3.2, 4.9, 6.5, 18.3, 7.9, 4.9, 4.0, 4.8, 0.4, 3.9, 2.9, 4.5, 6.3, 4.9, 5.2, 5.3],
    forecast: [4.8, 5.0, 5.1, 5.0]
  }
});

// Données d'inflation par pays
const inflationData = ref({
  us: {
    dates: ['Jan 2020', 'Avr 2020', 'Juil 2020', 'Oct 2020', 'Jan 2021', 'Avr 2021', 'Juil 2021', 'Oct 2021', 'Jan 2022', 'Avr 2022', 'Juil 2022', 'Oct 2022', 'Jan 2023', 'Avr 2023', 'Juil 2023', 'Oct 2023', 'Jan 2024', 'Avr 2024'],
    values: [2.3, 0.4, 1.0, 1.2, 1.4, 4.2, 5.4, 6.2, 7.5, 8.5, 8.5, 7.7, 6.4, 4.9, 3.2, 3.7, 3.1, 3.4]
  },
  eu: {
    dates: ['Jan 2020', 'Avr 2020', 'Juil 2020', 'Oct 2020', 'Jan 2021', 'Avr 2021', 'Juil 2021', 'Oct 2021', 'Jan 2022', 'Avr 2022', 'Juil 2022', 'Oct 2022', 'Jan 2023', 'Avr 2023', 'Juil 2023', 'Oct 2023', 'Jan 2024', 'Avr 2024'],
    values: [1.4, 0.3, 0.4, -0.3, 0.9, 1.6, 2.2, 4.1, 5.1, 7.4, 8.9, 10.6, 8.6, 7.0, 5.3, 2.9, 2.8, 2.4]
  },
  cn: {
    dates: ['Jan 2020', 'Avr 2020', 'Juil 2020', 'Oct 2020', 'Jan 2021', 'Avr 2021', 'Juil 2021', 'Oct 2021', 'Jan 2022', 'Avr 2022', 'Juil 2022', 'Oct 2022', 'Jan 2023', 'Avr 2023', 'Juil 2023', 'Oct 2023', 'Jan 2024', 'Avr 2024'],
    values: [5.4, 3.3, 2.7, 0.5, -0.3, 0.9, 1.0, 1.5, 0.9, 2.1, 2.7, 2.1, 2.1, 0.1, -0.3, 0.2, 0.1, 0.3]
  }
});

// Données fictives pour les indicateurs économiques
const pmiData = ref({
  dates: [
    'Juil. 2023', 'Août 2023', 'Sept. 2023', 'Oct. 2023', 'Nov. 2023', 'Déc. 2023',
    'Janv. 2024', 'Févr. 2024', 'Mars 2024', 'Avr. 2024', 'Mai 2024', 'Juin 2024'
  ],
  values: [46.0, 46.4, 47.6, 49.0, 46.7, 46.7, 47.4, 49.1, 50.3, 49.2, 48.7, 48.5],
  forecasts: [46.2, 46.4, 47.8, 49.2, 47.0, 46.8, 47.6, 49.5, 50.2, 49.0, 48.5, 49.2]
});

// Données de taux de chômage par pays
const unemploymentData = ref({
  us: {
    dates: ['Janv. 2020', 'Avr. 2020', 'Juil. 2020', 'Oct. 2020', 'Janv. 2021', 'Avr. 2021', 'Juil. 2021', 'Oct. 2021', 'Janv. 2022', 'Avr. 2022', 'Juil. 2022', 'Oct. 2022', 'Janv. 2023', 'Avr. 2023', 'Juil. 2023', 'Oct. 2023', 'Janv. 2024', 'Avr. 2024'],
    values: [3.6, 14.7, 10.2, 6.9, 6.3, 6.1, 5.4, 4.5, 4.0, 3.6, 3.5, 3.7, 3.4, 3.4, 3.5, 3.8, 3.7, 3.9]
  },
  eu: {
    dates: ['Janv. 2020', 'Avr. 2020', 'Juil. 2020', 'Oct. 2020', 'Janv. 2021', 'Avr. 2021', 'Juil. 2021', 'Oct. 2021', 'Janv. 2022', 'Avr. 2022', 'Juil. 2022', 'Oct. 2022', 'Janv. 2023', 'Avr. 2023', 'Juil. 2023', 'Oct. 2023', 'Janv. 2024', 'Avr. 2024'],
    values: [7.4, 7.9, 8.5, 8.5, 8.3, 8.1, 7.6, 7.1, 6.8, 6.7, 6.6, 6.6, 6.7, 6.5, 6.4, 6.4, 6.5, 6.4]
  },
  cn: {
    dates: ['Janv. 2020', 'Avr. 2020', 'Juil. 2020', 'Oct. 2020', 'Janv. 2021', 'Avr. 2021', 'Juil. 2021', 'Oct. 2021', 'Janv. 2022', 'Avr. 2022', 'Juil. 2022', 'Oct. 2022', 'Janv. 2023', 'Avr. 2023', 'Juil. 2023', 'Oct. 2023', 'Janv. 2024', 'Avr. 2024'],
    values: [5.3, 6.0, 5.7, 5.3, 5.4, 5.1, 5.1, 5.1, 5.3, 6.1, 5.4, 5.5, 5.5, 5.2, 5.3, 5.0, 5.3, 5.0]
  }
});

// Données des taux directeurs par pays/région
const policyRatesData = ref({
  us: {
    dates: ['Janv. 2020', 'Mars 2020', 'Avr. 2020', 'Mai 2020', 'Déc. 2020', 'Mars 2022', 'Mai 2022', 'Juin 2022', 'Juil. 2022', 'Sept. 2022', 'Nov. 2022', 'Déc. 2022', 'Févr. 2023', 'Mars 2023', 'Mai 2023', 'Juil. 2023', 'Nov. 2023', 'Janv. 2024', 'Mars 2024'],
    values: [1.75, 0.25, 0.25, 0.25, 0.25, 0.50, 1.00, 1.75, 2.50, 3.25, 4.00, 4.50, 4.75, 5.00, 5.25, 5.50, 5.50, 5.50, 5.50]
  },
  eu: {
    dates: ['Janv. 2020', 'Mars 2020', 'Juil. 2022', 'Sept. 2022', 'Oct. 2022', 'Déc. 2022', 'Févr. 2023', 'Mars 2023', 'Mai 2023', 'Juin 2023', 'Juil. 2023', 'Sept. 2023', 'Oct. 2023', 'Déc. 2023', 'Janv. 2024', 'Mars 2024', 'Avr. 2024', 'Juin 2024'],
    values: [0.00, 0.00, 0.50, 1.25, 2.00, 2.50, 3.00, 3.50, 3.75, 4.00, 4.25, 4.50, 4.50, 4.50, 4.50, 4.50, 4.25, 4.00]
  },
  cn: {
    dates: ['Janv. 2020', 'Févr. 2020', 'Mars 2020', 'Avr. 2020', 'Mai 2020', 'Janv. 2022', 'Août 2022', 'Juil. 2023', 'Oct. 2023', 'Févr. 2024', 'Mai 2024'],
    values: [4.15, 4.05, 3.85, 3.85, 3.85, 3.70, 3.65, 3.55, 3.45, 3.45, 3.35]
  }
});

// Données fictives pour Wage Growth
const wageGrowthData = ref({
  dates: [
    'Jan 2023', 'Feb 2023', 'Mar 2023', 'Apr 2023', 'May 2023', 'Jun 2023',
    'Jul 2023', 'Aug 2023', 'Sep 2023', 'Oct 2023', 'Nov 2023', 'Dec 2023'
  ],
  values: [4.6, 4.9, 4.7, 4.6, 4.4, 4.3, 4.5, 4.3, 4.1, 4.4, 4.3, 4.0]
});

// État pour les données des ventes au détail
const retailSalesData = ref<{
  dates: string[];
  values: number[];
  lastUpdated: string;
}>({
  dates: ['Jan 2023', 'Fév 2023', 'Mar 2023', 'Avr 2023', 'Mai 2023', 'Juin 2023', 'Juil 2023', 'Août 2023', 'Sep 2023', 'Oct 2023', 'Nov 2023', 'Déc 2023', 'Jan 2024', 'Fév 2024', 'Mar 2024', 'Avr 2024'],
  values: [0.3, -0.2, 0.8, 0.5, -0.1, 0.2, 0.6, 0.4, 0.1, -0.3, 0.8, 0.3, -0.2, 0.4, 0.3, 0.7],
  lastUpdated: '2024-04-15'
});

// État de chargement spécifique pour les données des ventes au détail
const isLoadingRetailSales = ref(false);
const retailSalesError = ref<string | null>(null);

// État pour les données des mises en chantier
const housingStartsData = ref<{
  dates: string[];
  values: number[];
  lastUpdated: string;
}>({
  dates: [],
  values: [],
  lastUpdated: ''
});

// État de chargement spécifique pour les données des mises en chantier
const isLoadingHousingStarts = ref(false);
const housingStartsError = ref<string | null>(null);

// État pour les données des permis de construire
const buildingPermitsData = ref<{
  dates: string[];
  values: number[];
  lastUpdated: string;
}>({
  dates: [],
  values: [],
  lastUpdated: ''
});

// État de chargement spécifique pour les données des permis de construire
const isLoadingBuildingPermits = ref(false);
const buildingPermitsError = ref<string | null>(null);

// Fonction pour récupérer les données réelles des ventes au détail
async function fetchRetailSalesData() {
  isLoadingRetailSales.value = true;
  retailSalesError.value = null;
  
  try {
    console.log('Récupération des données de ventes au détail réelles...');
    const data = await fredService.getRetailSalesData();
    console.log('Données ventes au détail reçues:', data);
    
    retailSalesData.value = data;
    
    // Si on a des données, on met à jour l'indicateur des ventes au détail
    if (data.values.length > 0) {
      const latestValue = data.values[data.values.length - 1];
      const previousValue = data.values.length > 1 ? data.values[data.values.length - 2] : latestValue;
      const previousValueForRate = data.values.length > 2 ? data.values[data.values.length - 3] : previousValue;
      
      // Calculer le taux de croissance en pourcentage
      const growthRate = data.values.length > 1 
        ? parseFloat(((latestValue - previousValue) / previousValue * 100).toFixed(1))
        : 0;
      
      const previousGrowthRate = data.values.length > 2 
        ? parseFloat(((previousValue - previousValueForRate) / previousValueForRate * 100).toFixed(1))
        : 0;
      
      console.log(`Valeur actuelle: ${latestValue}, Précédente: ${previousValue}, Taux: ${growthRate}%`);
      
      // Mise à jour de l'indicateur des ventes au détail avec les données réelles
      economicIndicators.value['retail-sales'] = {
        ...economicIndicators.value['retail-sales'],
        chart: {
          labels: data.dates,
          values: data.values
        },
        value: parseFloat(latestValue.toFixed(1)), // Arrondir à 1 décimale
        previousValue: parseFloat(previousValue.toFixed(1)),
        percentChange: growthRate, // Ajouter le pourcentage de changement comme propriété distincte
        previousPercentChange: previousGrowthRate,
        trend: growthRate > 0 ? 'up' : (growthRate < 0 ? 'down' : 'stable'),
        period: 'données réelles (milliards $)',
        lastUpdated: data.lastUpdated
      };
      
      // Forcer la mise à jour des graphiques
      nextTick(() => {
        drawIndicatorChart();
      });
    } else {
      console.warn('Aucune donnée de vente au détail reçue de l\'API');
      retailSalesError.value = 'Aucune donnée de vente au détail disponible';
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données réelles des ventes au détail:', error);
    retailSalesError.value = 'Erreur lors de la récupération des données de vente au détail';
  } finally {
    isLoadingRetailSales.value = false;
  }
}

// Fonction pour récupérer les données réelles des mises en chantier
async function fetchHousingStartsData() {
  isLoadingHousingStarts.value = true;
  housingStartsError.value = null;
  
  try {
    console.log('Récupération des données de mises en chantier réelles...');
    const data = await fredService.getHousingStartsData();
    console.log('Données mises en chantier reçues:', data);
    
    housingStartsData.value = data;
    
    // Si on a des données, on met à jour l'indicateur des mises en chantier
    if (data.values.length > 0) {
      const latestValue = data.values[data.values.length - 1];
      const previousValue = data.values.length > 1 ? data.values[data.values.length - 2] : latestValue;
      const previousValueForRate = data.values.length > 2 ? data.values[data.values.length - 3] : previousValue;
      
      // Calculer le taux de croissance en pourcentage
      const growthRate = data.values.length > 1 
        ? parseFloat(((latestValue - previousValue) / previousValue * 100).toFixed(1))
        : 0;
      
      const previousGrowthRate = data.values.length > 2 
        ? parseFloat(((previousValue - previousValueForRate) / previousValueForRate * 100).toFixed(1))
        : 0;
      
      console.log(`Valeur actuelle: ${latestValue}, Précédente: ${previousValue}, Taux: ${growthRate}%`);
      
      // Mise à jour de l'indicateur des mises en chantier avec les données réelles
      economicIndicators.value['housing-starts'] = {
        ...economicIndicators.value['housing-starts'],
        chart: {
          labels: data.dates,
          values: data.values
        },
        value: parseFloat(latestValue.toFixed(1)), // Arrondir à 1 décimale
        previousValue: parseFloat(previousValue.toFixed(1)),
        percentChange: growthRate, // Ajouter le pourcentage de changement comme propriété distincte
        previousPercentChange: previousGrowthRate,
        trend: growthRate > 0 ? 'up' : (growthRate < 0 ? 'down' : 'stable'),
        period: 'données réelles (milliers)',
        lastUpdated: data.lastUpdated
      };
      
      // Forcer la mise à jour des graphiques
      nextTick(() => {
        drawIndicatorChart();
      });
    } else {
      console.warn('Aucune donnée de mises en chantier reçue de l\'API');
      housingStartsError.value = 'Aucune donnée de mises en chantier disponible';
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données réelles des mises en chantier:', error);
    housingStartsError.value = 'Erreur lors de la récupération des données de mises en chantier';
  } finally {
    isLoadingHousingStarts.value = false;
  }
}

// Fonction pour récupérer les données réelles des permis de construire
async function fetchBuildingPermitsData() {
  isLoadingBuildingPermits.value = true;
  buildingPermitsError.value = null;
  
  try {
    console.log('Récupération des données de permis de construire réelles...');
    const data = await fredService.getBuildingPermitsData();
    console.log('Données permis de construire reçues:', data);
    
    buildingPermitsData.value = data;
    
    // Si on a des données, on met à jour l'indicateur des permis de construire
    if (data.values.length > 0) {
      const latestValue = data.values[data.values.length - 1];
      const previousValue = data.values.length > 1 ? data.values[data.values.length - 2] : latestValue;
      const previousValueForRate = data.values.length > 2 ? data.values[data.values.length - 3] : previousValue;
      
      // Calculer le taux de croissance en pourcentage
      const growthRate = data.values.length > 1 
        ? parseFloat(((latestValue - previousValue) / previousValue * 100).toFixed(1))
        : 0;
      
      const previousGrowthRate = data.values.length > 2 
        ? parseFloat(((previousValue - previousValueForRate) / previousValueForRate * 100).toFixed(1))
        : 0;
      
      console.log(`Valeur actuelle: ${latestValue}, Précédente: ${previousValue}, Taux: ${growthRate}%`);
      
      // Mise à jour de l'indicateur des permis de construire avec les données réelles
      economicIndicators.value['building-permits'] = {
        ...economicIndicators.value['building-permits'],
        chart: {
          labels: data.dates,
          values: data.values
        },
        value: parseFloat(latestValue.toFixed(1)), // Arrondir à 1 décimale
        previousValue: parseFloat(previousValue.toFixed(1)),
        percentChange: growthRate, // Ajouter le pourcentage de changement comme propriété distincte
        previousPercentChange: previousGrowthRate,
        trend: growthRate > 0 ? 'up' : (growthRate < 0 ? 'down' : 'stable'),
        period: 'données réelles (milliers)',
        lastUpdated: data.lastUpdated
      };
      
      // Forcer la mise à jour des graphiques
      nextTick(() => {
        drawIndicatorChart();
      });
    } else {
      console.warn('Aucune donnée de permis de construire reçue de l\'API');
      buildingPermitsError.value = 'Aucune donnée de permis de construire disponible';
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données réelles des permis de construire:', error);
    buildingPermitsError.value = 'Erreur lors de la récupération des données de permis de construire';
  } finally {
    isLoadingBuildingPermits.value = false;
  }
}

// Production industrielle sur différentes périodes
const industrialProduction = computed(() => macroData.value?.industrialProduction || 0);
const industrialProduction3m = computed(() => macroData.value?.industrialProduction3m || 0);
const industrialProduction6m = computed(() => macroData.value?.industrialProduction6m || 0);
const industrialProduction12m = computed(() => macroData.value?.industrialProduction12m || 0);

// Variable réactive pour les données réelles du PIB
const realGDPData = ref<{
  dates: string[];
  values: number[];
  lastUpdated: string;
}>({
  dates: [],
  values: [],
  lastUpdated: ''
});

// État de chargement spécifique pour les données PIB
const isLoadingGDP = ref(false);
const gdpError = ref<string | null>(null);

// Fonction pour récupérer les données réelles du PIB
async function fetchRealGDPData() {
  isLoadingGDP.value = true;
  gdpError.value = null;
  
  try {
    console.log('Récupération des données PIB réelles...');
    const data = await gdpService.getRealGDPData();
    console.log('Données PIB reçues:', data);
    
    realGDPData.value = data;
    
    // Si on a des données, on met à jour l'indicateur PIB
    if (data.values.length > 0) {
      const latestValue = data.values[data.values.length - 1];
      const previousValue = data.values.length > 1 ? data.values[data.values.length - 2] : latestValue;
      const previousValueForRate = data.values.length > 2 ? data.values[data.values.length - 3] : previousValue;
      
      // Calculer le taux de croissance en pourcentage
      const growthRate = data.values.length > 1 
        ? parseFloat(((latestValue - previousValue) / previousValue * 100).toFixed(1))
        : 0;
      
      const previousGrowthRate = data.values.length > 2 
        ? parseFloat(((previousValue - previousValueForRate) / previousValueForRate * 100).toFixed(1))
        : 0;
      
      console.log(`Valeur actuelle: ${latestValue}, Précédente: ${previousValue}, Taux: ${growthRate}%`);
      
      // Mise à jour de l'indicateur PIB avec les données réelles
      economicIndicators.value.gdp = {
        ...economicIndicators.value.gdp,
        chart: {
          labels: data.dates,
          values: data.values
        },
        value: latestValue, // Afficher la valeur brute du PIB
        previousValue: previousValue,
        percentChange: growthRate, // Ajouter le pourcentage de changement comme propriété distincte
        previousPercentChange: previousGrowthRate,
        trend: growthRate > 0 ? 'up' : (growthRate < 0 ? 'down' : 'stable'),
        period: 'données réelles',
        lastUpdated: data.lastUpdated
      };
      
      // Forcer la mise à jour des graphiques
      nextTick(() => {
        drawIndicatorChart();
      });
    } else {
      console.warn('Aucune donnée PIB reçue de l\'API');
      gdpError.value = 'Aucune donnée PIB disponible';
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données réelles du PIB:', error);
    gdpError.value = 'Erreur lors de la récupération des données PIB';
  } finally {
    isLoadingGDP.value = false;
  }
}

// Fonction pour récupérer les données macroéconomiques
async function fetchMacroData() {
  loading.value = true;
  error.value = null;
  
  try {
    macroData.value = await fredService.getMacroEconomicData();
    lastUpdated.value = new Date();
    
    // Mettre à jour l'indicateur de pétrole
    updateOilIndicator();
    
    // Réinitialiser les graphiques après avoir reçu les nouvelles données
    nextTick(() => {
      initializeCharts();
    });
  } catch (err) {
    error.value = "Impossible de récupérer les données économiques. Veuillez réessayer plus tard.";
    console.error('Erreur lors de la récupération des données macroéconomiques:', err);
  } finally {
    loading.value = false;
  }
}

// Fonction pour récupérer le ratio or/argent directement à partir des prix des contrats à terme
async function fetchGoldSilverRatio() {
  isLoadingGoldSilver.value = true;
  goldSilverError.value = null;
  
  try {
    // Utiliser la nouvelle méthode qui récupère et calcule le ratio à partir des contrats à terme depuis 2020
    goldSilverRatio.value = await yahooFinanceService.getGoldSilverRatioFromFutures('since2020');
    
    // Vérifier que nous avons des données
    if (goldSilverRatio.value.dates.length === 0) {
      throw new Error('Aucune donnée disponible pour le ratio or/argent');
    }
    
    // Mise à jour des indicateurs économiques avec les dernières valeurs
    if (goldSilverRatio.value.values.length > 0) {
      const currentRatio = goldSilverRatio.value.values[goldSilverRatio.value.values.length - 1];
      const previousRatio = goldSilverRatio.value.values[goldSilverRatio.value.values.length - 2] || currentRatio;
      
      // Ajouter ou mettre à jour l'indicateur du ratio or/argent
      economicIndicators.value['gold-silver-ratio'] = {
        title: 'Ratio Or/Argent',
        description: 'Rapport entre le prix de l\'or et celui de l\'argent, indicateur clé des marchés des métaux précieux',
        value: currentRatio,
        unit: '',
        period: 'actuel (données depuis 2020)',
        previousValue: previousRatio,
        trend: currentRatio > previousRatio ? 'up' : (currentRatio < previousRatio ? 'down' : 'stable'),
        chart: {
          labels: goldSilverRatio.value.dates,
          values: goldSilverRatio.value.values
        },
        impact: 'Indicateur de la perception de risque sur les marchés et du sentiment des investisseurs envers les métaux précieux'
      };
    }
  } catch (err) {
    console.error('Erreur lors de la récupération du ratio or/argent:', err);
    if (err instanceof Error) {
      goldSilverError.value = err.message;
    } else {
      goldSilverError.value = 'Erreur inconnue lors de la récupération des données';
    }
  } finally {
    isLoadingGoldSilver.value = false;
  }
}

// Classification des indicateurs pour l'affichage visuel
const indicatorStatus = computed(() => {
  if (!macroData.value) return {};
  
  return {
    gdpGrowth: classifyGDPGrowth(macroData.value?.gdpGrowth || 0),
    inflation: classifyInflation(macroData.value?.inflation || 0),
    unemployment: classifyUnemployment(macroData.value?.unemploymentRate || 0),
    federal: classifyFederalRate(macroData.value?.interestRates?.federal || 0),
    treasury10Y: classifyTreasuryYield(macroData.value?.interestRates?.treasury10Y || 0),
    treasury2Y: classifyTreasuryYield(macroData.value?.interestRates?.treasury2Y || 0),
    yieldCurve: classifyYieldCurve(
      macroData.value?.interestRates?.treasury10Y || 0, 
      macroData.value?.interestRates?.treasury2Y || 0
    ),
    // Ajout des indicateurs de marché
    dollarIndex: classifyMarketIndicator(macroData.value?.marketIndicators?.dollarIndex?.change || 0),
    vix: classifyVIX(macroData.value?.marketIndicators?.vix?.value || 0),
    gold: classifyMarketIndicator(macroData.value?.marketIndicators?.gold?.change || 0),
    oil: classifyMarketIndicator(macroData.value?.marketIndicators?.oil?.change || 0),
    // Autres indicateurs
    pmi: classifyPMI(macroData.value?.pmiManufacturing || 0),
    industrialProduction: classifyIndustrialProduction(macroData.value?.industrialProduction || 0)
  };
});

// Getters sécurisés pour éviter les erreurs "possibly undefined"
const gdpGrowth = computed(() => {
  // Utiliser les données par pays si disponibles, sinon utiliser les données globales
  if (selectedCountry.value && gdpData.value[selectedCountry.value]) {
    const countryData = gdpData.value[selectedCountry.value];
    const lastIndex = countryData.values.length - 1;
    return countryData.values[lastIndex];
  }
  return macroData.value?.gdpGrowth || 0;
});

const inflation = computed(() => {
  // Utiliser les données par pays si disponibles, sinon utiliser les données globales
  if (selectedCountry.value && inflationData.value[selectedCountry.value]) {
    const countryData = inflationData.value[selectedCountry.value];
    const lastIndex = countryData.values.length - 1;
    return countryData.values[lastIndex];
  }
  return macroData.value?.inflation || 0;
});

const unemploymentRate = computed(() => {
  // Utiliser les données par pays si disponibles, sinon utiliser les données globales
  if (selectedCountry.value && unemploymentData.value[selectedCountry.value]) {
    const countryData = unemploymentData.value[selectedCountry.value];
    const lastIndex = countryData.values.length - 1;
    return countryData.values[lastIndex];
  }
  return macroData.value?.unemploymentRate || 0;
});

const interestRates = computed(() => ({
  federal: macroData.value?.interestRates?.federal || 0,
  treasury10Y: macroData.value?.interestRates?.treasury10Y || 0,
  treasury2Y: macroData.value?.interestRates?.treasury2Y || 0
}));

const marketIndicators = computed(() => ({
  dollarIndex: {
    value: macroData.value?.marketIndicators?.dollarIndex?.value || 0,
    change: macroData.value?.marketIndicators?.dollarIndex?.change || 0
  },
  vix: {
    value: macroData.value?.marketIndicators?.vix?.value || 0,
    change: macroData.value?.marketIndicators?.vix?.change || 0
  },
  gold: {
    value: macroData.value?.marketIndicators?.gold?.value || 0,
    change: macroData.value?.marketIndicators?.gold?.change || 0
  },
  oil: {
    value: macroData.value?.marketIndicators?.oil?.value || 0,
    change: macroData.value?.marketIndicators?.oil?.change || 0
  }
}));

const pmiManufacturing = computed(() => macroData.value?.pmiManufacturing || 0);
const pmiManufacturingTrend = computed(() => macroData.value?.pmiManufacturingTrend || 0);

// Calculs de valeurs dérivées
const yieldCurveSpread = computed(() => interestRates.value.treasury10Y - interestRates.value.treasury2Y);

// Fonctions de classification des indicateurs
function classifyGDPGrowth(value: number) {
  if (value >= 3) return { status: 'strong-positive', label: 'Forte croissance' };
  if (value >= 2) return { status: 'positive', label: 'Croissance modérée' };
  if (value >= 0) return { status: 'neutral', label: 'Croissance faible' };
  if (value >= -1) return { status: 'negative', label: 'Contraction légère' };
  return { status: 'strong-negative', label: 'Récession' };
}

function classifyInflation(value: number) {
  if (value >= 5) return { status: 'strong-negative', label: 'Inflation élevée' };
  if (value >= 3) return { status: 'negative', label: 'Inflation modérée' };
  if (value >= 1.5) return { status: 'neutral', label: 'Inflation normale' };
  if (value >= 0) return { status: 'positive', label: 'Inflation basse' };
  return { status: 'negative', label: 'Déflation' };
}

function classifyUnemployment(value: number) {
  if (value >= 7) return { status: 'strong-negative', label: 'Chômage élevé' };
  if (value >= 5) return { status: 'negative', label: 'Chômage modéré' };
  if (value >= 4) return { status: 'neutral', label: 'Chômage normal' };
  return { status: 'positive', label: 'Plein emploi' };
}

function classifyFederalRate(value: number) {
  if (value >= 5) return { status: 'strong-negative', label: 'Restrictif' };
  if (value >= 3) return { status: 'negative', label: 'Modérément restrictif' };
  if (value >= 1.5) return { status: 'neutral', label: 'Neutre' };
  if (value >= 0.5) return { status: 'positive', label: 'Accommodant' };
  return { status: 'strong-positive', label: 'Très accommodant' };
}

function classifyTreasuryYield(value: number) {
  if (value >= 5) return { status: 'negative', label: 'Élevé' };
  if (value >= 3) return { status: 'neutral', label: 'Modéré' };
  if (value >= 1) return { status: 'positive', label: 'Bas' };
  return { status: 'strong-positive', label: 'Très bas' };
}

function classifyYieldCurve(long: number, short: number) {
  const spread = long - short;
  if (spread <= -0.5) return { status: 'strong-negative', label: 'Inversion prononcée' };
  if (spread < 0) return { status: 'negative', label: 'Inversion légère' };
  if (spread < 0.5) return { status: 'neutral', label: 'Plate' };
  if (spread < 1.5) return { status: 'positive', label: 'Normale' };
  return { status: 'strong-positive', label: 'Pentue' };
}

// Nouvelles fonctions de classification
function classifyMarketIndicator(change: number) {
  if (change > 2) return { status: 'strong-positive', label: 'Forte hausse' };
  if (change > 0) return { status: 'positive', label: 'Hausse' };
  if (change === 0) return { status: 'neutral', label: 'Stable' };
  if (change > -2) return { status: 'negative', label: 'Baisse' };
  return { status: 'strong-negative', label: 'Forte baisse' };
}

function classifyVIX(value: number) {
  if (value >= 40) return { status: 'strong-negative', label: 'Peur extrême' };
  if (value >= 30) return { status: 'negative', label: 'Peur' };
  if (value >= 23) return { status: 'caution', label: 'Anxiété' };
  if (value >= 15) return { status: 'neutral', label: 'Vigilance' };
  return { status: 'positive', label: 'Confiance' };
}

function classifyPMI(value: number) {
  if (value > 55) return { status: 'strong-positive', label: 'Forte expansion' };
  if (value > 50) return { status: 'positive', label: 'Expansion' };
  if (value === 50) return { status: 'neutral', label: 'Neutre' };
  if (value > 45) return { status: 'negative', label: 'Contraction légère' };
  return { status: 'strong-negative', label: 'Forte contraction' };
}

function classifyIndustrialProduction(value: number) {
  if (value > 3) return { status: 'strong-positive', label: 'Forte hausse' };
  if (value > 1) return { status: 'positive', label: 'Hausse modérée' };
  if (value >= 0) return { status: 'neutral', label: 'Légère hausse' };
  if (value > -2) return { status: 'negative', label: 'Légère baisse' };
  return { status: 'strong-negative', label: 'Forte baisse' };
}

// Formatage des dates et nombres
function formatDate(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

// Configuration du graphique pour le ratio or/argent
const goldSilverChartData = computed(() => {
  return {
    labels: goldSilverRatio.value.dates,
    datasets: [
      {
        label: 'Ratio Or/Argent',
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 2,
        data: goldSilverRatio.value.values,
        tension: 0.4
      }
    ]
  };
});

// Options du graphique
const goldSilverChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Évolution du Ratio Or/Argent (90 jours)',
      font: {
        size: 16
      }
    },
    legend: {
      position: 'bottom' as const
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          return `Ratio: ${context.parsed.y.toFixed(2)}`;
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: 'Ratio'
      }
    },
    x: {
      title: {
        display: true,
        text: 'Date'
      }
    }
  }
};

// Fonction de rafraîchissement des données
function refresh() {
  loading.value = true;
  
  // Simulation de chargement des données
  setTimeout(() => {
    loading.value = false;
  }, 1000);
}

// Réinitialiser à la vue d'ensemble
function resetToOverview() {
  activeSection.value = 'overview';
  selectedIndicator.value = 'overview';
  nextTick(() => {
    initializeCharts();
  });
}

// Fonction pour afficher les sections
function showSection(section: string) {
  activeSection.value = section;
  refresh();
}

// Initialisation des données au chargement du composant
onMounted(() => {
  fetchMacroData();
  fetchGoldSilverRatio();
  fetchVIXData();
  fetchDXYData(); // Ajouter l'appel pour récupérer les données DXY
  fetchRealGDPData(); // Ajouter cet appel
  fetchYieldCurveData(); // Ajouter cet appel
  fetchRetailSalesData(); // Ajouter cet appel
  fetchHousingStartsData(); // Ajouter cet appel
  fetchBuildingPermitsData(); // Ajouter cet appel
  refresh();
  
  // S'assurer que la vue d'ensemble est toujours la vue par défaut au chargement
  activeSection.value = 'overview';
  selectedIndicator.value = 'overview';
  
  // Initialisation des graphiques après le montage du composant
  nextTick(() => {
    initializeCharts();
  });
});

// Fonction pour initialiser tous les graphiques
function initializeCharts() {
  // Supprimer les graphiques existants avant d'en créer de nouveaux
  destroyCharts();
  
  // Si un indicateur spécifique est sélectionné, on dessine son graphique
  if (selectedIndicator.value !== 'overview') {
    drawIndicatorChart();
    return;
  }
  
  // Graphique d'inflation
  const inflationChartEl = document.getElementById('inflationChart') as HTMLCanvasElement;
  if (inflationChartEl && inflationData.value && 
      selectedCountry.value in inflationData.value && 
      inflationData.value[selectedCountry.value as keyof typeof inflationData.value]) {
    
    const countryData = inflationData.value[selectedCountry.value as keyof typeof inflationData.value];
    
    new ChartJS(inflationChartEl, {
      type: 'line',
      data: {
        labels: countryData.dates,
        datasets: [{
          label: 'Inflation CPI YoY (%)',
          data: countryData.values,
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 2,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
  
  // Graphique mises en chantier
  const housingStartsChartEl = document.getElementById('housingStartsChart') as HTMLCanvasElement;
  if (housingStartsChartEl && housingStartsData.value) {
    new ChartJS(housingStartsChartEl, {
      type: 'bar',
      data: {
        labels: housingStartsData.value?.dates || [],
        datasets: [{
          label: 'Mises en chantier (milliers)',
          data: housingStartsData.value?.values || [],
          backgroundColor: (housingStartsData.value?.values || []).map(val => 
            val > 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          ),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
  
  // Graphique permis de construire
  const buildingPermitsChartEl = document.getElementById('buildingPermitsChart') as HTMLCanvasElement;
  if (buildingPermitsChartEl && buildingPermitsData.value) {
    new ChartJS(buildingPermitsChartEl, {
      type: 'bar',
      data: {
        labels: buildingPermitsData.value?.dates || [],
        datasets: [{
          label: 'Permis de construire (milliers)',
          data: buildingPermitsData.value?.values || [],
          backgroundColor: (buildingPermitsData.value?.values || []).map(val => 
            val > 0 ? 'rgba(59, 130, 246, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          ),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
  
  // Graphique courbe des taux
  const yieldCurveChartEl = document.getElementById('yieldCurveChart') as HTMLCanvasElement;
  if (yieldCurveChartEl && yieldCurveData.value) {
    // Détruire l'ancien graphique s'il existe
    const existingChart = ChartJS.getChart(yieldCurveChartEl);
    if (existingChart) {
      existingChart.destroy();
    }
    
    new ChartJS(yieldCurveChartEl, {
      type: 'line',
      data: {
        labels: yieldCurveData.value.dates,
        datasets: [{
          label: 'Taux à 10 ans',
          data: yieldCurveData.value.tenYearValues,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: false
        }, {
          label: 'Taux à 2 ans',
          data: yieldCurveData.value.twoYearValues,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: false
        }, {
          label: 'Spread (10Y-2Y)',
          data: yieldCurveData.value.spreadValues,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Rendement (%)'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  }
  
  // Graphique PMI Manufacturing
  const pmiChartEl = document.getElementById('pmiChart') as HTMLCanvasElement;
  if (pmiChartEl && pmiData.value) {
    new ChartJS(pmiChartEl, {
      type: 'line',
      data: {
        labels: pmiData.value.dates || [],
        datasets: [{
          label: 'PMI Manufacturing',
          data: pmiData.value.values || [],
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }, {
          label: 'Seuil d\'expansion/contraction',
          data: Array(pmiData.value.dates?.length || 0).fill(50),
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
  
  // Graphique Production Industrielle
  const industrialProductionChartEl = document.getElementById('industrialProductionChart') as HTMLCanvasElement;
  if (industrialProductionChartEl) {
    // Utiliser les données de production industrielle disponibles dans macroData
    const industrialProductionValue = macroData.value?.industrialProduction || 0;
    
    // Créer des données fictives pour la production industrielle en attendant une source de données réelle
    const industrialProductionChartData = {
      labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
      datasets: [{
        label: 'Production Industrielle YoY (%)',
        // Utiliser la valeur réelle de l'API pour le premier point, et des valeurs fictives pour le reste
        data: [industrialProductionValue, industrialProductionValue * 0.9, industrialProductionValue * 0.8, industrialProductionValue * 0.7, 2.1, 1.8, 1.3, 0.8, 0.2, -0.3, -0.8, -1.2],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    };
    
    new ChartJS(industrialProductionChartEl, {
      type: 'line',
      data: industrialProductionChartData,
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}

// Fonction pour détruire les graphiques existants
function destroyCharts() {
  const charts = ['inflationChart', 'retailSalesChart', 'yieldCurveChart', 'pmiChart', 'industrialProductionChart', 'indicatorChart'];
  
  charts.forEach(chartId => {
    const chartInstance = ChartJS.getChart(document.getElementById(chartId) as HTMLCanvasElement);
    if (chartInstance) {
      chartInstance.destroy();
    }
  });
}

// Calcul du score de risque économique global (0-100)
const riskScore = computed(() => {
  let score = 0;
  
  // Facteurs basés sur le PIB
  if (gdpGrowth.value <= -1) score += 25;
  else if (gdpGrowth.value < 0) score += 20;
  else if (gdpGrowth.value < 1) score += 10;
  
  // Facteurs basés sur l'inflation
  if (inflation.value > 6) score += 20;
  else if (inflation.value > 4) score += 15;
  else if (inflation.value > 2.5) score += 5;
  else if (inflation.value < 0) score += 10; // La déflation est aussi un risque
  
  // Facteurs basés sur la courbe des taux
  if (yieldCurveSpread.value < -0.5) score += 25;
  else if (yieldCurveSpread.value < 0) score += 15;
  else if (yieldCurveSpread.value < 0.5) score += 5;
  
  // Facteurs basés sur le PMI
  if (pmiManufacturing.value < 45) score += 15;
  else if (pmiManufacturing.value < 48) score += 10;
  else if (pmiManufacturing.value < 50) score += 5;
  
  // Facteurs basés sur le chômage
  if (unemploymentRate.value > 6.5) score += 15;
  else if (unemploymentRate.value > 5) score += 10;
  
  // Facteur basé sur la volatilité du marché
  if (marketIndicators.value.vix.value > 30) score += 10;
  else if (marketIndicators.value.vix.value > 25) score += 5;
  
  // Limiter le score entre 0 et 100
  return Math.min(Math.max(score, 0), 100);
});

// Fonction pour mettre à jour les graphiques et données en fonction du pays sélectionné
function updateDataByCountry() {
  // Mettre à jour les graphiques
  nextTick(() => {
    initializeCharts();
  });
}

// Observer le changement de pays
watch(selectedCountry, () => {
  updateDataByCountry();
});

// Mapping des codes de pays vers les noms complets
const countryNames = {
  us: 'États-Unis',
  eu: 'Zone Euro',
  cn: 'Chine'
};

// Nom du pays sélectionné
const selectedCountryName = computed(() => 
  countryNames[selectedCountry.value as keyof typeof countryNames]
);

// Données NFP (création d'emplois non-agricoles) par pays
const jobCreationData = ref({
  us: { value: 175, date: '2023-04-30' },
  eu: { value: 62, date: '2023-04-30' },
  cn: { value: 85, date: '2023-04-30' }
});

// Tendance des créations d'emploi (3 derniers mois)
const jobCreationTrendData = ref({
  us: [120, 165, 175],
  eu: [45, 58, 62],
  cn: [75, 80, 85]
});

// Créations d'emploi pour le pays sélectionné
const jobCreation = computed(() => {
  return jobCreationData.value?.[selectedCountry.value]?.value || 0;
});

// Tendance des créations d'emploi (moyenne sur 3 mois)
const jobCreationTrend = computed(() => {
  const trend = jobCreationTrendData.value?.[selectedCountry.value] || [];
  if (trend.length === 0) return 0;
  return trend.reduce((sum, val) => sum + val, 0) / trend.length;
});

// Nom complet du pays sélectionné
const countryFullName = computed(() => {
  return countryNames[selectedCountry.value as keyof typeof countryNames];
});

// Fonction pour défiler la page jusqu'à une section spécifique
function scrollToSection(section: IndicatorKey) {
  console.log(`Navigation vers la section: ${section}`);
  
  // Mettre à jour l'indicateur sélectionné
  selectedIndicator.value = section;
  
  // Définir la catégorie active en fonction de la section
  if (['gdp', 'retail-sales', 'manufacturing-pmi', 'services-pmi'].includes(section)) {
    activeSection.value = 'growth';
  } else if (['cpi', 'ppi', 'pce'].includes(section)) {
    activeSection.value = 'inflation';
  } else if (['unemployment', 'nonfarm-payrolls', 'wage-growth', 'job-openings'].includes(section)) {
    activeSection.value = 'employment';
  } else if (['federal', 'yield-curve'].includes(section)) {
    activeSection.value = 'monetary';
  } else if (['vix', 'dollar-index', 'cot', 'carry-trade'].includes(section)) {
    activeSection.value = 'markets';
  } else if (section === 'top-setups') {
    activeSection.value = 'trading';
  } else if (section === 'overview') {
    activeSection.value = 'overview';
  }
  
  // Chercher l'élément dans le DOM
  const element = document.getElementById(section);
  if (element) {
    // Faire défiler vers l'élément trouvé
    element.scrollIntoView({ behavior: 'smooth' });
  } else {
    console.warn(`Élément non trouvé avec ID: ${section}`);
  }
  
  // Initialiser le graphique de l'indicateur sélectionné après le rendu
  nextTick(() => {
    if (section !== 'overview') {
      drawIndicatorChart();
    }
  });
}

// Détecter les changements de route pour réinitialiser à la vue d'ensemble
watch(() => route.path, (newPath) => {
  if (newPath === '/macro') {
    resetToOverview();
  }
}, { immediate: true });

// Données fictives pour les indicateurs économiques
const economicIndicators = ref<Record<IndicatorKey, any>>({
  // Vue d'ensemble
  'overview': {
    title: "Vue d'ensemble macroéconomique",
    description: "Tableau de bord des principaux indicateurs économiques",
    value: "N/A",
    unit: "",
    period: "actuel",
    previousValue: "N/A",
    trend: "stable",
    impact: "Interface principale pour naviguer entre les différents indicateurs économiques"
  },
  // Pour le top-setups
  'top-setups': {
    title: "Top Setups de Trading",
    description: "Meilleures configurations de trading basées sur les données macroéconomiques",
    value: "N/A",
    unit: "",
    period: "actuel",
    previousValue: "N/A",
    trend: "stable",
    impact: "Suggestions de stratégies de trading basées sur les tendances macroéconomiques actuelles"
  },
  // Croissance
  'gdp': {
    title: 'Produit Intérieur Brut (PIB)',
    description: 'Mesure de la production économique totale d\'un pays',
    value: 2.4,
    unit: '%',
    period: 'variation annuelle',
    previousValue: 2.1,
    trend: 'up',
    chart: {
      labels: ['Q1 2022', 'Q2 2022', 'Q3 2022', 'Q4 2022', 'Q1 2023', 'Q2 2023', 'Q3 2023', 'Q4 2023', 'Q1 2024'],
      values: [1.4, 1.7, 2.0, 1.9, 1.6, 2.1, 2.9, 3.1, 2.4]
    },
    forecast: {
      labels: ['Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025'],
      values: [2.2, 2.0, 1.8, 1.7]
    },
    impact: 'L\'indicateur le plus complet de l\'activité économique, utile pour évaluer la santé globale de l\'économie'
  },
  'retail-sales': {
    title: 'Ventes au détail',
    description: 'Mesure des dépenses des consommateurs dans les magasins de détail',
    value: 0.7,
    unit: '%',
    period: 'variation mensuelle',
    previousValue: 0.3,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [-0.2, 0.1, 0.8, 0.5, -0.1, 0.2, 0.6, 0.4, 0.1, -0.3, 0.8, 0.3, -0.2, 0.4, 0.3, 0.7]
    },
    impact: 'Indicateur clé de la confiance des consommateurs et de la santé économique'
  },
  'industrial-production': {
    title: 'Production industrielle',
    description: 'Mesure de la production du secteur industriel, y compris les usines et les mines',
    value: 0.9,
    unit: '%',
    period: 'variation mensuelle',
    previousValue: -0.3,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [0.1, -0.2, 0.3, 0.6, 0.2, -0.5, -0.7, 0.2, 0.5, 0.1, -0.3, -0.1, 0.4, 0.7, 0.5, 0.9]
    },
    impact: 'Indicateur important de l\'activité manufacturière et de la production économique'
  },
  'manufacturing-pmi': {
    title: 'PMI Manufacturier',
    description: 'Indice des directeurs d\'achats du secteur manufacturier',
    value: 50.8,
    unit: 'indice',
    period: 'mensuel',
    previousValue: 49.7,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [52.4, 51.8, 51.1, 50.2, 49.5, 48.9, 48.4, 47.9, 48.0, 48.2, 48.8, 49.1, 49.5, 49.7, 50.3, 50.8]
    },
    impact: 'Indicateur avancé de l\'activité économique dans le secteur manufacturier'
  },
  'services-pmi': {
    title: 'PMI Services',
    description: 'Indice des directeurs d\'achats du secteur des services',
    value: 53.5,
    unit: 'indice',
    period: 'mensuel',
    previousValue: 52.7,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [51.2, 51.5, 51.8, 52.0, 52.3, 52.1, 51.8, 51.6, 51.9, 52.2, 52.4, 52.6, 52.7, 53.0, 53.2, 53.5]
    },
    impact: 'Indicateur avancé de l\'activité économique dans le secteur des services'
  },
  
  // Emploi
  'unemployment': {
    title: 'Taux de chômage',
    description: 'Pourcentage de la population active sans emploi',
    value: 3.8,
    unit: '%',
    period: 'mensuel',
    previousValue: 3.9,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [4.0, 4.0, 3.9, 3.9, 3.8, 3.7, 3.7, 3.7, 3.8, 3.8, 3.8, 3.9, 3.9, 3.9, 3.9, 3.8]
    },
    impact: 'Indicateur clé de la santé du marché du travail'
  },
  'nonfarm-payrolls': {
    title: 'Créations d\'emplois non-agricoles',
    description: 'Nombre d\'emplois créés dans le secteur non-agricole',
    value: 175,
    unit: 'milliers',
    period: 'mensuel',
    previousValue: 165,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [138, 142, 155, 187, 210, 198, 165, 150, 177, 165, 152, 145, 155, 160, 165, 175]
    },
    impact: 'Indicateur majeur de la création d\'emplois et de la croissance économique'
  },
  'wage-growth': {
    title: 'Croissance des salaires',
    description: 'Augmentation moyenne des salaires',
    value: 3.4,
    unit: '%',
    period: 'variation annuelle',
    previousValue: 3.6,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [5.2, 5.0, 4.8, 4.6, 4.4, 4.2, 4.1, 4.0, 3.9, 3.8, 3.7, 3.7, 3.6, 3.5, 3.5, 3.4]
    },
    impact: 'Indicateur de la pression inflationniste et du pouvoir d\'achat des ménages'
  },
  'adp-usa': {
    title: 'Rapport ADP sur l\'emploi',
    description: 'Estimation des créations d\'emplois dans le secteur privé',
    value: 183,
    unit: 'milliers',
    period: 'mensuel',
    previousValue: 155,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [145, 148, 160, 170, 185, 175, 155, 140, 150, 165, 158, 145, 148, 152, 155, 183]
    },
    impact: 'Indicateur préliminaire des tendances du marché du travail'
  },
  'unemployment-claims': {
    title: 'Demandes d\'allocations chômage',
    description: 'Nombre de nouvelles demandes d\'allocations chômage',
    value: 231,
    unit: 'milliers',
    period: 'hebdomadaire',
    previousValue: 242,
    trend: 'down',
    chart: {
      labels: ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8', 'Sem9', 'Sem10', 'Sem11', 'Sem12', 'Sem13', 'Sem14', 'Sem15', 'Sem16'],
      values: [280, 275, 268, 262, 255, 250, 245, 248, 252, 250, 245, 242, 240, 238, 242, 231]
    },
    impact: 'Indicateur très réactif des tendances du marché du travail'
  },
  'job-openings': {
    title: 'Offres d\'emploi',
    description: 'Nombre d\'offres d\'emploi ouvertes',
    value: 8.5,
    unit: 'millions',
    period: 'mensuel',
    previousValue: 8.7,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [10.8, 10.6, 10.3, 10.0, 9.8, 9.6, 9.4, 9.2, 9.0, 8.9, 8.8, 8.7, 8.7, 8.6, 8.6, 8.5]
    },
    impact: 'Indicateur de la demande de main-d\'œuvre et de la tension sur le marché du travail'
  },
  
  // Inflation
  'cpi': {
    title: 'Indice des prix à la consommation (IPC)',
    description: 'Mesure de l\'évolution du niveau général des prix des biens et services achetés par les ménages',
    value: 3.2,
    unit: '%',
    period: 'variation annuelle',
    previousValue: 3.4,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [6.5, 6.2, 5.9, 5.5, 5.0, 4.8, 4.5, 4.2, 4.0, 3.8, 3.7, 3.5, 3.4, 3.3, 3.3, 3.2]
    },
    impact: 'Indicateur clé de l\'inflation et facteur déterminant de la politique monétaire'
  },
  'ppi': {
    title: 'Indice des prix à la production (IPP)',
    description: 'Mesure de l\'évolution des prix des biens et services à la sortie des usines',
    value: 2.8,
    unit: '%',
    period: 'variation annuelle',
    previousValue: 3.0,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [6.0, 5.7, 5.3, 5.0, 4.8, 4.5, 4.2, 4.0, 3.7, 3.5, 3.3, 3.2, 3.1, 3.0, 2.9, 2.8]
    },
    impact: 'Indicateur avancé de l\'inflation à la consommation'
  },
  'pce': {
    title: 'Indice des dépenses de consommation personnelles (PCE)',
    description: 'Mesure de l\'inflation basée sur les dépenses réelles des consommateurs',
    value: 2.7,
    unit: '%',
    period: 'variation annuelle',
    previousValue: 2.8,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [5.2, 5.0, 4.8, 4.6, 4.4, 4.2, 4.0, 3.8, 3.6, 3.4, 3.2, 3.0, 2.9, 2.8, 2.8, 2.7]
    },
    impact: 'Indicateur d\'inflation préféré de la Réserve fédérale américaine'
  },
  
  // Taux d'intérêt
  'federal': {
    title: 'Taux des fonds fédéraux',
    description: 'Taux d\'intérêt directeur de la Réserve fédérale américaine',
    value: 5.25,
    unit: '%',
    period: 'actuel',
    previousValue: 5.25,
    trend: 'stable',
    chart: {
      labels: ['Jan 2022', 'Avr 2022', 'Juil 2022', 'Oct 2022', 'Jan 2023', 'Avr 2023', 'Juil 2023', 'Oct 2023', 'Jan 2024', 'Avr 2024'],
      values: [0.25, 0.50, 2.50, 3.75, 4.50, 5.00, 5.25, 5.25, 5.25, 5.25]
    },
    forecast: {
      labels: ['Juin 2024', 'Sept 2024', 'Déc 2024', 'Mars 2025'],
      values: [5.00, 4.75, 4.50, 4.25]
    },
    impact: 'Taux d\'intérêt de référence qui influence tous les autres taux d\'intérêt dans l\'économie'
  },
  'treasuries': {
    title: 'Rendements des bons du Trésor',
    description: 'Taux d\'intérêt des obligations d\'État américaines',
    value: { '2y': 4.55, '5y': 4.32, '10y': 4.21, '30y': 4.35 },
    unit: '%',
    period: 'actuel',
    previousValue: { '2y': 4.60, '5y': 4.35, '10y': 4.25, '30y': 4.38 },
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: {
        '2y': [4.20, 4.30, 4.35, 4.40, 4.45, 4.50, 4.55, 4.60, 4.65, 4.70, 4.65, 4.62, 4.60, 4.58, 4.57, 4.55],
        '10y': [3.80, 3.90, 3.95, 4.00, 4.05, 4.10, 4.15, 4.20, 4.25, 4.30, 4.28, 4.27, 4.25, 4.23, 4.22, 4.21]
      }
    },
    impact: 'Indicateur clé des anticipations du marché concernant l\'inflation et la croissance économique'
  },
  'yield-curve': {
    title: 'Courbe des taux',
    description: 'Différence entre les rendements des obligations à long terme et à court terme',
    value: -0.34,
    unit: 'points de pourcentage',
    period: 'actuel (10y - 2y)',
    previousValue: -0.35,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [0.20, 0.10, 0.00, -0.05, -0.10, -0.15, -0.20, -0.25, -0.30, -0.35, -0.40, -0.38, -0.37, -0.36, -0.35, -0.34]
    },
    impact: 'Indicateur précurseur des récessions économiques lorsqu\'elle s\'inverse (devient négative)'
  },
  
  // Marchés
  'vix': {
    title: 'Indice VIX',
    description: 'Indice de volatilité du marché, souvent appelé "indice de la peur"',
    value: 15.8,
    unit: 'indice',
    period: 'actuel',
    previousValue: 18.2,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [18.5, 20.2, 22.5, 19.8, 17.5, 16.2, 15.8, 16.5, 18.8, 21.5, 19.8, 18.5, 17.2, 19.5, 18.2, 15.8]
    },
    impact: 'Indicateur de la perception du risque et de l\'incertitude sur les marchés financiers'
  },
  'dollar-index': {
    title: 'Indice du dollar américain',
    description: 'Mesure de la valeur du dollar américain par rapport à un panier d\'autres devises',
    value: 0, // Sera mis à jour par fetchDXYData
    unit: 'indice',
    period: 'actuel',
    previousValue: 0, // Sera mis à jour par fetchDXYData
    trend: 'stable', // Sera mis à jour par fetchDXYData
    chart: {
      labels: [], // Sera mis à jour par fetchDXYData
      values: [] // Sera mis à jour par fetchDXYData
    },
    impact: 'Indicateur de la force relative du dollar américain, qui influence les prix des matières premières et le commerce international'
  },
  'cot': {
    title: 'Rapport COT (Commitment of Traders)',
    description: 'Positions des différents acteurs du marché sur les contrats à terme',
    value: {
      'speculateurs': 65,
      'commerciaux': -45,
      'petits investisseurs': -20
    },
    unit: '%',
    period: 'hebdomadaire',
    previousValue: {
      'speculateurs': 62,
      'commerciaux': -42,
      'petits investisseurs': -20
    },
    trend: 'mixed',
    chart: {
      labels: ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8', 'Sem9', 'Sem10', 'Sem11', 'Sem12'],
      values: {
        'speculateurs': [45, 48, 50, 52, 55, 58, 60, 61, 62, 64, 62, 65],
        'commerciaux': [-30, -32, -35, -38, -40, -42, -43, -44, -42, -43, -42, -45]
      }
    },
    impact: 'Indicateur des positions et du sentiment des différents acteurs du marché des contrats à terme'
  },
  'carry-trade': {
    title: 'Carry Trade',
    description: 'Stratégie d\'investissement qui consiste à emprunter dans une devise à faible taux pour investir dans une devise à taux élevé',
    value: {
      'JPY-USD': 5.10,
      'EUR-USD': 1.75,
      'CHF-USD': 3.15
    },
    unit: '%',
    period: 'actuel (différentiel de taux)',
    previousValue: {
      'JPY-USD': 5.05,
      'EUR-USD': 1.80,
      'CHF-USD': 3.10
    },
    trend: 'mixed',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: {
        'JPY-USD': [4.80, 4.85, 4.90, 4.92, 4.95, 4.98, 5.00, 5.02, 5.03, 5.04, 5.05, 5.06, 5.08, 5.09, 5.08, 5.10],
        'EUR-USD': [1.90, 1.88, 1.86, 1.85, 1.84, 1.83, 1.82, 1.81, 1.80, 1.80, 1.79, 1.78, 1.77, 1.76, 1.76, 1.75],
        'CHF-USD': [3.20, 3.18, 3.16, 3.15, 3.14, 3.13, 3.12, 3.11, 3.10, 3.10, 3.09, 3.08, 3.07, 3.06, 3.06, 3.05]
      }
    },
    impact: 'Indicateur des flux de capitaux internationaux et des opportunités d\'arbitrage entre les marchés financiers'
  },
  'risk-gauge': {
    title: 'Jauge de risque',
    description: 'Indicateur composite de l\'appétit pour le risque sur les marchés financiers',
    value: 65,
    unit: 'indice (0-100)',
    period: 'actuel',
    previousValue: 60,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [45, 48, 52, 55, 58, 60, 62, 65, 58, 52, 55, 58, 55, 58, 60, 65]
    },
    impact: 'Indicateur du sentiment général du marché et de la propension des investisseurs à prendre des risques'
  },
  'gold-silver-ratio': {
    title: 'Ratio Or/Argent',
    description: 'Rapport entre le prix de l\'or et celui de l\'argent, indicateur clé des marchés des métaux précieux',
    value: 0, // Sera mis à jour par fetchGoldSilverRatio
    unit: '',
    period: 'actuel (données depuis 2020)',
    previousValue: 0, // Sera mis à jour par fetchGoldSilverRatio
    trend: 'stable', // Sera mis à jour par fetchGoldSilverRatio
    chart: {
      labels: [], // Sera mis à jour par fetchGoldSilverRatio
      values: [] // Sera mis à jour par fetchGoldSilverRatio
    },
    impact: 'Indicateur de la perception de risque sur les marchés et du sentiment des investisseurs envers les métaux précieux'
  },
  'oil': {
    title: 'Pétrole WTI',
    description: 'Prix du pétrole brut West Texas Intermediate, référence pour le marché pétrolier américain',
    value: 78.9, // Sera mis à jour par fetchMacroData
    unit: '$',
    period: 'actuel',
    previousValue: 80.2, // Valeur arbitraire pour l'exemple
    trend: 'down', // Sera mis à jour en fonction des données réelles
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [72, 74, 76, 75, 77, 79, 82, 80, 78, 76, 79, 82, 85, 83, 80, 78.9]
    },
    impact: 'Indicateur clé de l\'inflation et des coûts énergétiques, influençant divers secteurs économiques et la consommation'
  },
  'housing-starts': {
    title: 'Mises en chantier',
    description: 'Nombre de nouvelles constructions de logements commencées',
    value: 1.35,
    unit: 'M',
    period: 'mensuel',
    previousValue: 1.38,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [1.28, 1.30, 1.38, 1.42, 1.35, 1.33, 1.40, 1.45, 1.39, 1.41, 1.37, 1.34, 1.36, 1.38, 1.40, 1.35]
    },
    impact: 'Indicateur avancé de l\'activité dans le secteur immobilier et de la construction'
  },
  'building-permits': {
    title: 'Permis de construire',
    description: 'Autorisations accordées pour de nouvelles constructions résidentielles',
    value: 1.42,
    unit: 'M',
    period: 'mensuel',
    previousValue: 1.40,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [1.30, 1.32, 1.35, 1.38, 1.36, 1.37, 1.41, 1.44, 1.39, 1.42, 1.38, 1.36, 1.37, 1.39, 1.40, 1.42]
    },
    impact: 'Indicateur avancé de la construction résidentielle future'
  },
  'adp-usa': {
    title: 'Rapport ADP sur l\'emploi',
    description: 'Estimation des créations d\'emplois dans le secteur privé',
    value: 183,
    unit: 'milliers',
    period: 'mensuel',
    previousValue: 155,
    trend: 'up',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [145, 148, 160, 170, 185, 175, 155, 140, 150, 165, 158, 145, 148, 152, 155, 183]
    },
    impact: 'Indicateur préliminaire des tendances du marché du travail'
  },
  'job-openings': {
    title: 'Offres d\'emploi',
    description: 'Nombre d\'offres d\'emploi ouvertes',
    value: 8.5,
    unit: 'millions',
    period: 'mensuel',
    previousValue: 8.7,
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: [10.8, 10.6, 10.3, 10.0, 9.8, 9.6, 9.4, 9.2, 9.0, 8.9, 8.8, 8.7, 8.7, 8.6, 8.6, 8.5]
    },
    impact: 'Indicateur de la demande de main-d\'œuvre et de la tension sur le marché du travail'
  },
  'treasuries': {
    title: 'Rendements des bons du Trésor',
    description: 'Taux d\'intérêt des obligations d\'État américaines',
    value: { '2y': 4.55, '5y': 4.32, '10y': 4.21, '30y': 4.35 },
    unit: '%',
    period: 'actuel',
    previousValue: { '2y': 4.60, '5y': 4.35, '10y': 4.25, '30y': 4.38 },
    trend: 'down',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: {
        '2y': [4.20, 4.30, 4.35, 4.40, 4.45, 4.50, 4.55, 4.60, 4.65, 4.70, 4.65, 4.62, 4.60, 4.58, 4.57, 4.55],
        '5y': [3.90, 4.00, 4.05, 4.10, 4.15, 4.20, 4.25, 4.30, 4.35, 4.40, 4.38, 4.37, 4.35, 4.33, 4.32, 4.30],
        '10y': [3.80, 3.90, 3.95, 4.00, 4.05, 4.10, 4.15, 4.20, 4.25, 4.30, 4.28, 4.27, 4.25, 4.23, 4.22, 4.21],
        '30y': [3.70, 3.80, 3.85, 3.90, 3.95, 4.00, 4.05, 4.10, 4.15, 4.20, 4.18, 4.17, 4.15, 4.13, 4.12, 4.10]
      }
    },
    impact: 'Indicateur clé des anticipations du marché concernant l\'inflation et la croissance économique'
  },
  'unemployment-claims': {
    title: 'Demandes d\'allocations chômage',
    description: 'Nombre de nouvelles demandes d\'allocations chômage',
    value: 231,
    unit: 'milliers',
    period: 'hebdomadaire',
    previousValue: 242,
    trend: 'down',
    chart: {
      labels: ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8', 'Sem9', 'Sem10', 'Sem11', 'Sem12', 'Sem13', 'Sem14', 'Sem15', 'Sem16'],
      values: [280, 275, 268, 262, 255, 250, 245, 248, 252, 250, 245, 242, 240, 238, 242, 231]
    },
    impact: 'Indicateur très réactif des tendances du marché du travail'
  }
});

// Ajouter cette fonction à votre script
function drawIndicatorChart() {
  if (selectedIndicator.value === 'overview') return;
  
  // Vérifier si l'indicateur existe
  if (!economicIndicators.value[selectedIndicator.value]) return;
  
  const indicator = economicIndicators.value[selectedIndicator.value];
  if (!indicator || !indicator.chart) return;
  
  // Récupérer l'élément canvas pour le graphique
  const chartEl = document.getElementById('indicatorChart') as HTMLCanvasElement;
  if (!chartEl) return;
  
  // Vérifier si un graphique existe déjà et le détruire
  const existingChart = ChartJS.getChart(chartEl);
  if (existingChart) {
    existingChart.destroy();
  }
  
  let chartData: any = {
    labels: indicator.chart.labels,
    datasets: []
  };
  
  // Gérer différents types de données (simple ou complexe)
  if (typeof indicator.chart.values === 'object' && !Array.isArray(indicator.chart.values)) {
    // Pour les valeurs complexes (objets)
    Object.keys(indicator.chart.values).forEach((key, index) => {
      const colors = ['rgb(59, 130, 246)', 'rgb(16, 185, 129)', 'rgb(249, 115, 22)', 'rgb(220, 38, 38)'];
      chartData.datasets.push({
        label: key,
        data: (indicator.chart.values as any)[key],
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 2,
        tension: 0.4
      });
    });
  } else {
    // Pour les valeurs simples (tableaux)
    chartData.datasets.push({
      label: indicator.title,
      data: indicator.chart.values,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true
    });
  }
  
  // Créer le graphique
  new ChartJS(chartEl, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context: any) {
              return context.dataset.label + ': ' + context.parsed.y + indicator.unit;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

// Ajouter un watcher pour le selectedIndicator
watch(selectedIndicator, (newVal) => {
  if (newVal && newVal !== 'overview') {
    nextTick(() => {
      drawIndicatorChart();
    });
  }
});

// Ajouter cette fonction pour mettre à jour les données en fonction du pays sélectionné
watch(selectedCountry, (country) => {
  console.log(`Pays sélectionné: ${country}`);
  
  // Mise à jour des données de PIB en fonction du pays
  if (gdpData.value[country]) {
    const gdpValues = gdpData.value[country].values;
    const lastValue = gdpValues[gdpValues.length - 1];
    const previousValue = gdpValues[gdpValues.length - 2];
    
    economicIndicators.value.gdp.value = lastValue;
    economicIndicators.value.gdp.previousValue = previousValue;
    economicIndicators.value.gdp.trend = lastValue > previousValue ? 'up' : (lastValue < previousValue ? 'down' : 'stable');
    
    // Mettre à jour les données du graphique
    economicIndicators.value.gdp.chart.values = gdpData.value[country].values;
    
    // Mettre à jour les prévisions si disponibles
    if (gdpData.value[country].forecast) {
      economicIndicators.value.gdp.forecast.values = gdpData.value[country].forecast;
    }
  }
  
  // Mise à jour des données d'inflation
  if (inflationData.value[country]) {
    const inflationValues = inflationData.value[country].values;
    const lastValue = inflationValues[inflationValues.length - 1];
    const previousValue = inflationValues[inflationValues.length - 2];
    
    economicIndicators.value.cpi.value = lastValue;
    economicIndicators.value.cpi.previousValue = previousValue;
    economicIndicators.value.cpi.trend = lastValue < previousValue ? 'down' : (lastValue > previousValue ? 'up' : 'stable');
    
    // Mettre à jour les données du graphique
    economicIndicators.value.cpi.chart.values = inflationData.value[country].values;
  }
  
  // Mise à jour des données de chômage
  if (unemploymentData.value[country]) {
    const unemploymentValues = unemploymentData.value[country].values;
    const lastValue = unemploymentValues[unemploymentValues.length - 1];
    const previousValue = unemploymentValues[unemploymentValues.length - 2];
    
    economicIndicators.value.unemployment.value = lastValue;
    economicIndicators.value.unemployment.previousValue = previousValue;
    economicIndicators.value.unemployment.trend = lastValue < previousValue ? 'down' : (lastValue > previousValue ? 'up' : 'stable');
    
    // Mettre à jour les données du graphique
    economicIndicators.value.unemployment.chart.values = unemploymentData.value[country].values;
  }
  
  // Mise à jour des créations d'emploi
  if (jobCreationData.value[country]) {
    economicIndicators.value['nonfarm-payrolls'].value = jobCreationData.value[country].value;
    
    // Mettre à jour la tendance
    const trend = jobCreationTrendData.value[country];
    if (trend && trend.length > 1) {
      const lastValue = trend[trend.length - 1];
      const previousValue = trend[trend.length - 2];
      economicIndicators.value['nonfarm-payrolls'].previousValue = previousValue;
      economicIndicators.value['nonfarm-payrolls'].trend = lastValue > previousValue ? 'up' : (lastValue < previousValue ? 'down' : 'stable');
    }
  }
  
  // Si on change de pays, forcer la mise à jour des graphiques si un indicateur est sélectionné
  if (selectedIndicator.value !== 'overview' && selectedIndicator.value !== 'top-setups') {
    nextTick(() => {
      drawIndicatorChart();
    });
  }
});

// Initialiser les données lors du chargement en fonction du pays par défaut
onMounted(() => {
  // Simuler la sélection initiale du pays pour mettre à jour les données
  const initialCountry = selectedCountry.value;
  if (initialCountry) {
    // Mise à jour directe des données plutôt que d'utiliser le watcher incorrectement
    console.log(`Initialisation des données pour ${initialCountry}`);
    
    // Si des données PIB existent pour ce pays, mettre à jour les données
    if (gdpData.value[initialCountry]) {
      const gdpValues = gdpData.value[initialCountry].values;
      const lastValue = gdpValues[gdpValues.length - 1];
      const previousValue = gdpValues[gdpValues.length - 2];
      
      // Mise à jour du PIB selon le pays
      if (economicIndicators.value.gdp) {
        economicIndicators.value.gdp.value = lastValue;
        economicIndicators.value.gdp.previousValue = previousValue;
        economicIndicators.value.gdp.trend = lastValue > previousValue ? 'up' : (lastValue < previousValue ? 'down' : 'stable');
      }
    }
  }
  
  // Initialiser les graphiques pour la vue d'ensemble
  initializeCharts();
});

// Données de consensus de marché par pays
const marketConsensus = ref({
  us: {
    indices: [
      { 
        name: 'S&P 500', 
        ticker: 'SPX', 
        current: 5123.1, 
        previous: 4988.6, 
        change: 2.7, 
        target: 5350, 
        outlook: 'bullish',
        analysts: {
          buy: 65,
          hold: 28,
          sell: 7
        },
        forecast: [5180, 5250, 5320, 5400, 5480]
      },
      { 
        name: 'Nasdaq 100', 
        ticker: 'NDX', 
        current: 17873.5, 
        previous: 17432.1, 
        change: 2.5, 
        target: 18500, 
        outlook: 'bullish',
        analysts: {
          buy: 72,
          hold: 23,
          sell: 5
        },
        forecast: [18000, 18200, 18350, 18500, 18700]
      },
      { 
        name: 'Dow Jones', 
        ticker: 'DJI', 
        current: 39127.8, 
        previous: 38627.9, 
        change: 1.3, 
        target: 40000, 
        outlook: 'neutral',
        analysts: {
          buy: 58,
          hold: 35,
          sell: 7
        },
        forecast: [39300, 39600, 39800, 40100, 40300]
      }
    ]
  },
  eu: {
    indices: [
      { 
        name: 'Euro Stoxx 50', 
        ticker: 'SX5E', 
        current: 4912.7, 
        previous: 4847.2, 
        change: 1.4, 
        target: 5100, 
        outlook: 'neutral',
        analysts: {
          buy: 60,
          hold: 32,
          sell: 8
        },
        forecast: [4950, 5000, 5050, 5100, 5150]
      }
    ]
  },
  cn: {
    indices: [
      { 
        name: 'Shanghai Composite', 
        ticker: 'SHCOMP', 
        current: 3172.5, 
        previous: 3047.9, 
        change: 4.1, 
        target: 3350, 
        outlook: 'bullish',
        analysts: {
          buy: 65,
          hold: 30,
          sell: 5
        },
        forecast: [3210, 3250, 3300, 3350, 3400]
      },
      { 
        name: 'Hang Seng', 
        ticker: 'HSI', 
        current: 18451.3, 
        previous: 17778.4, 
        change: 3.8, 
        target: 19200, 
        outlook: 'bullish',
        analysts: {
          buy: 68,
          hold: 27,
          sell: 5
        },
        forecast: [18600, 18800, 19000, 19200, 19400]
      }
    ]
  }
});

// Obtenir le consensus pour le pays sélectionné
const currentConsensus = computed(() => {
  return marketConsensus.value[selectedCountry.value] || marketConsensus.value.us;
});

// Interface pour les données COT
interface CotCountryData {
  dates: string[];
  speculators: number[];
  commercials: number[];
  small_traders: number[];
  net_position: number[];
}
// Interface pour les données de risque des facteurs historiques
interface HistoricalRiskFactor {
  risk: number;
  trend: 'up' | 'down' | 'stable';
}

// Interface pour l'entrée de consensus historique
interface ConsensusHistoryEntry {
  week: string;
  date: string;
  positiveFactors: number;
  negativeFactors: number;
  neutralFactors: number;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  riskScore: number;
  keyEvents: string;
  riskFactors: {
    [key: string]: HistoricalRiskFactor;
  };
}

// Obtenir l'historique du consensus pour le pays sélectionné
const selectedHistoricalConsensus = computed(() => {
  return historicalConsensusData.value[selectedCountry.value as keyof typeof historicalConsensusData.value] || historicalConsensusData.value.us;
});

// Données historiques COT (Commitment of Traders) par pays
const cotHistoricalData = ref<Record<string, CotCountryData>>({
  us: {
    dates: ['Sem1-2023', 'Sem2-2023', 'Sem3-2023', 'Sem4-2023', 'Sem1-2024', 'Sem2-2024', 'Sem3-2024', 'Sem4-2024', 'Sem5-2024', 'Sem6-2024', 'Sem7-2024', 'Sem8-2024', 'Sem9-2024', 'Sem10-2024', 'Sem11-2024', 'Sem12-2024'],
    speculators: [40, 42, 45, 48, 50, 53, 55, 58, 60, 63, 65, 62, 60, 63, 65, 68],
    commercials: [-35, -38, -40, -42, -43, -45, -48, -50, -53, -55, -57, -55, -53, -55, -58, -60],
    small_traders: [-5, -4, -5, -6, -7, -8, -7, -8, -7, -8, -8, -7, -7, -8, -7, -8],
    net_position: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  eu: {
    dates: ['Sem1-2023', 'Sem2-2023', 'Sem3-2023', 'Sem4-2023', 'Sem1-2024', 'Sem2-2024', 'Sem3-2024', 'Sem4-2024', 'Sem5-2024', 'Sem6-2024', 'Sem7-2024', 'Sem8-2024', 'Sem9-2024', 'Sem10-2024', 'Sem11-2024', 'Sem12-2024'],
    speculators: [30, 33, 35, 38, 40, 42, 45, 47, 45, 47, 50, 53, 55, 58, 60, 62],
    commercials: [-25, -28, -30, -33, -35, -37, -40, -42, -40, -42, -45, -48, -50, -53, -55, -57],
    small_traders: [-5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5],
    net_position: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
});

// Calcul des positions nettes pour chaque pays
Object.keys(cotHistoricalData.value).forEach(country => {
  const data = cotHistoricalData.value[country];
  data.net_position = data.dates.map((_, i) => {
    return data.speculators[i] + data.commercials[i] + data.small_traders[i];
  });
});

// Obtenir les données COT pour le pays sélectionné
const selectedCotData = computed(() => {
  return cotHistoricalData.value[selectedCountry.value as keyof typeof cotHistoricalData.value] || cotHistoricalData.value.us;
});

// Détails supplémentaires sur l'évaluation du risque économique
const riskAssessmentDetails = ref({
  us: {
    gdp: { risk: 25, comment: "Croissance solide mais des signes de ralentissement apparaissent" },
    inflation: { risk: 65, comment: "L'inflation reste supérieure à la cible de la Fed" },
    employment: { risk: 15, comment: "Le marché du travail est robuste avec un faible taux de chômage" },
    monetary_policy: { risk: 70, comment: "La politique monétaire restrictive pourrait peser sur la croissance" },
    yield_curve: { risk: 75, comment: "L'inversion de la courbe des taux signale un risque de récession" },
    market_sentiment: { risk: 45, comment: "Sentiment des investisseurs mitigé" },
    geopolitical: { risk: 60, comment: "Tensions géopolitiques persistantes affectant le commerce" },
    fiscal_policy: { risk: 55, comment: "Le déficit budgétaire croissant pourrait poser des problèmes à moyen terme" },
    housing_market: { risk: 60, comment: "Le marché immobilier montre des signes de fragilité" },
    financial_conditions: { risk: 50, comment: "Les conditions financières sont neutres" }
  },
  eu: {
    gdp: { risk: 45, comment: "Croissance faible et perspectives mitigées" },
    inflation: { risk: 50, comment: "L'inflation se normalise progressivement" },
    employment: { risk: 35, comment: "Le marché du travail est résilient malgré la faible croissance" },
    monetary_policy: { risk: 60, comment: "La BCE a maintenu des taux élevés plus longtemps que prévu" },
    yield_curve: { risk: 50, comment: "La courbe des taux s'aplatit mais reste positive" },
    market_sentiment: { risk: 40, comment: "Sentiment des investisseurs prudent" },
    geopolitical: { risk: 65, comment: "Tensions géopolitiques en Europe de l'Est" },
    fiscal_policy: { risk: 65, comment: "Les règles budgétaires limitent les options de relance" },
    housing_market: { risk: 55, comment: "Ralentissement du marché immobilier" },
    financial_conditions: { risk: 50, comment: "Les conditions financières sont neutres" }
  },
  // Données similaires pour d'autres pays
});

// Obtenir l'évaluation du risque pour le pays sélectionné
const selectedRiskAssessment = computed(() => {
  return riskAssessmentDetails.value[selectedCountry.value as keyof typeof riskAssessmentDetails.value] || riskAssessmentDetails.value.us;
});

// Calcul du score de risque économique global pour le pays sélectionné
const countryRiskScore = computed(() => {
  const assessment = selectedRiskAssessment.value;
  if (!assessment) return 50;
  
  const riskFactors = Object.values(assessment);
  const totalRisk = riskFactors.reduce((sum: number, factor: any) => sum + factor.risk, 0);
  return Math.round(totalRisk / riskFactors.length);
});

// Fonction pour dessiner le graphique COT
function drawCotChart() {
  const chartEl = document.getElementById('cotChart') as HTMLCanvasElement;
  if (!chartEl) return;
  
  // Vérifier si un graphique existe déjà et le détruire
  const existingChart = ChartJS.getChart(chartEl);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const data = selectedCotData.value;
  
  new ChartJS(chartEl, {
    type: 'line',
    data: {
      labels: data.dates,
      datasets: [
        {
          label: 'Spéculateurs',
          data: data.speculators,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4
        },
        {
          label: 'Commerciaux',
          data: data.commercials,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4
        },
        {
          label: 'Petits investisseurs',
          data: data.small_traders,
          borderColor: 'rgb(255, 205, 86)',
          backgroundColor: 'rgba(255, 205, 86, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Évolution des positions COT',
          font: {
            size: 16
          }
        },
        legend: {
          position: 'bottom' as const
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false
        }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: '% des contrats ouverts'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Période'
          }
        }
      }
    }
  });
}

// Initialiser le graphique COT après le montage du composant
onMounted(() => {
  nextTick(() => {
    if (document.getElementById('cotChart')) {
      drawCotChart();
    }
  });
});

// Observer les changements de pays pour mettre à jour le graphique COT
watch(selectedCountry, () => {
  nextTick(() => {
    if (document.getElementById('cotChart')) {
      drawCotChart();
    }
  });
});

// Fonction améliorée pour générer des données de consensus
const generateMarketConsensus = computed(() => {
  const baseConsensus = {
    economic_outlook: {
      bullish: 45,
      neutral: 35,
      bearish: 20
    },
    monetary_policy: {
      hawkish: 30,
      neutral: 40, 
      dovish: 30
    },
    inflation_expectations: {
      increasing: 25,
      stable: 55,
      decreasing: 20
    },
    growth_expectations: {
      accelerating: 30,
      stable: 45,
      slowing: 25
    },
    risk_sentiment: {
      risk_on: 55,
      neutral: 30,
      risk_off: 15
    }
  };
  
  // Ajuster les données en fonction du pays
  switch (selectedCountry.value) {
    case 'us':
      return {
        ...baseConsensus,
        economic_outlook: { bullish: 55, neutral: 30, bearish: 15 },
        monetary_policy: { hawkish: 35, neutral: 40, dovish: 25 }
      };
    case 'eu':
      return {
        ...baseConsensus,
        economic_outlook: { bullish: 35, neutral: 40, bearish: 25 },
        growth_expectations: { accelerating: 20, stable: 40, slowing: 40 }
      };
    case 'cn':
      return {
        ...baseConsensus,
        monetary_policy: { hawkish: 45, neutral: 35, dovish: 20 },
        inflation_expectations: { increasing: 40, stable: 40, decreasing: 20 }
      };
    default:
      return baseConsensus;
  }
});

// Interface pour les données de risque des facteurs historiques
interface HistoricalRiskFactor {
  risk: number;
  trend: 'up' | 'down' | 'stable';
}

// Interface pour l'entrée de consensus historique
interface ConsensusHistoryEntry {
  week: string;
  date: string;
  positiveFactors: number;
  negativeFactors: number;
  neutralFactors: number;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  riskScore: number;
  keyEvents: string;
  riskFactors: {
    [key: string]: HistoricalRiskFactor;
  };
}

// Données historiques du consensus et des facteurs de risque
const historicalConsensusData = ref<Record<string, ConsensusHistoryEntry[]>>({
  us: [
    {
      week: 'Semaine 4-2024',
      date: '22 - 26 Jan 2024',
      positiveFactors: 3,
      negativeFactors: 5,
      neutralFactors: 2,
      signal: 'sell',
      riskScore: 58,
      keyEvents: "Minutes de la Fed, inquiétudes sur l'inflation persistante",
      riskFactors: {
        gdp: { risk: 30, trend: 'stable' },
        inflation: { risk: 70, trend: 'up' },
        employment: { risk: 20, trend: 'stable' },
        monetary_policy: { risk: 75, trend: 'up' },
        yield_curve: { risk: 78, trend: 'up' },
        market_sentiment: { risk: 60, trend: 'up' },
        geopolitical: { risk: 65, trend: 'up' },
        fiscal_policy: { risk: 55, trend: 'stable' },
        housing_market: { risk: 65, trend: 'up' },
        financial_conditions: { risk: 55, trend: 'up' }
      }
    },
    {
      week: 'Semaine 5-2024',
      date: '29 Jan - 2 Fév 2024',
      positiveFactors: 4,
      negativeFactors: 4,
      neutralFactors: 2,
      signal: 'neutral',
      riskScore: 53,
      keyEvents: "Rapport sur l'emploi meilleur que prévu, discours de Powell",
      riskFactors: {
        gdp: { risk: 28, trend: 'down' },
        inflation: { risk: 68, trend: 'down' },
        employment: { risk: 18, trend: 'down' },
        monetary_policy: { risk: 72, trend: 'down' },
        yield_curve: { risk: 76, trend: 'down' },
        market_sentiment: { risk: 50, trend: 'down' },
        geopolitical: { risk: 62, trend: 'down' },
        fiscal_policy: { risk: 55, trend: 'stable' },
        housing_market: { risk: 62, trend: 'down' },
        financial_conditions: { risk: 52, trend: 'down' }
      }
    },
    {
      week: 'Semaine 6-2024',
      date: '5 - 9 Fév 2024',
      positiveFactors: 5,
      negativeFactors: 3,
      neutralFactors: 2,
      signal: 'buy',
      riskScore: 48,
      keyEvents: "Données d'inflation plus faibles que prévu, chiffres du PIB révisés à la hausse",
      riskFactors: {
        gdp: { risk: 25, trend: 'down' },
        inflation: { risk: 65, trend: 'down' },
        employment: { risk: 15, trend: 'down' },
        monetary_policy: { risk: 70, trend: 'stable' },
        yield_curve: { risk: 75, trend: 'down' },
        market_sentiment: { risk: 45, trend: 'down' },
        geopolitical: { risk: 60, trend: 'down' },
        fiscal_policy: { risk: 55, trend: 'stable' },
        housing_market: { risk: 60, trend: 'down' },
        financial_conditions: { risk: 50, trend: 'down' }
      }
    },
    {
      week: 'Semaine 7-2024',
      date: '12 - 16 Fév 2024',
      positiveFactors: 6,
      negativeFactors: 2,
      neutralFactors: 2,
      signal: 'strong_buy',
      riskScore: 42,
      keyEvents: "Ventes au détail solides, amélioration du sentiment des consommateurs",
      riskFactors: {
        gdp: { risk: 22, trend: 'down' },
        inflation: { risk: 60, trend: 'down' },
        employment: { risk: 12, trend: 'down' },
        monetary_policy: { risk: 65, trend: 'down' },
        yield_curve: { risk: 70, trend: 'down' },
        market_sentiment: { risk: 40, trend: 'down' },
        geopolitical: { risk: 55, trend: 'down' },
        fiscal_policy: { risk: 50, trend: 'down' },
        housing_market: { risk: 55, trend: 'down' },
        financial_conditions: { risk: 45, trend: 'down' }
      }
    },
    {
      week: 'Semaine 8-2024',
      date: '19 - 23 Fév 2024',
      positiveFactors: 4,
      negativeFactors: 3,
      neutralFactors: 3,
      signal: 'neutral',
      riskScore: 47,
      keyEvents: "Minutes du FOMC, données manufacturières mitigées",
      riskFactors: {
        gdp: { risk: 25, trend: 'up' },
        inflation: { risk: 62, trend: 'up' },
        employment: { risk: 14, trend: 'up' },
        monetary_policy: { risk: 68, trend: 'up' },
        yield_curve: { risk: 72, trend: 'up' },
        market_sentiment: { risk: 42, trend: 'up' },
        geopolitical: { risk: 58, trend: 'up' },
        fiscal_policy: { risk: 52, trend: 'up' },
        housing_market: { risk: 58, trend: 'up' },
        financial_conditions: { risk: 48, trend: 'up' }
      }
    }
  ],
  eu: [
    {
      week: 'Semaine 4-2024',
      date: '22 - 26 Jan 2024',
      positiveFactors: 2,
      negativeFactors: 6,
      neutralFactors: 2,
      signal: 'strong_sell',
      riskScore: 64,
      keyEvents: "Réunion de la BCE, données manufacturières faibles",
      riskFactors: {
        gdp: { risk: 50, trend: 'up' },
        inflation: { risk: 55, trend: 'up' },
        employment: { risk: 40, trend: 'up' },
        monetary_policy: { risk: 65, trend: 'up' },
        yield_curve: { risk: 55, trend: 'up' },
        market_sentiment: { risk: 45, trend: 'up' },
        geopolitical: { risk: 70, trend: 'up' },
        fiscal_policy: { risk: 70, trend: 'up' },
        housing_market: { risk: 60, trend: 'up' },
        financial_conditions: { risk: 55, trend: 'up' }
      }
    },
    {
      week: 'Semaine 5-2024',
      date: '29 Jan - 2 Fév 2024',
      positiveFactors: 3,
      negativeFactors: 5,
      neutralFactors: 2,
      signal: 'sell',
      riskScore: 60,
      keyEvents: "PIB de la zone euro plus faible que prévu, inflation en baisse",
      riskFactors: {
        gdp: { risk: 48, trend: 'down' },
        inflation: { risk: 52, trend: 'down' },
        employment: { risk: 38, trend: 'down' },
        monetary_policy: { risk: 62, trend: 'down' },
        yield_curve: { risk: 52, trend: 'down' },
        market_sentiment: { risk: 42, trend: 'down' },
        geopolitical: { risk: 68, trend: 'down' },
        fiscal_policy: { risk: 68, trend: 'down' },
        housing_market: { risk: 58, trend: 'down' },
        financial_conditions: { risk: 52, trend: 'down' }
      }
    },
    {
      week: 'Semaine 6-2024',
      date: '5 - 9 Fév 2024',
      positiveFactors: 4,
      negativeFactors: 4,
      neutralFactors: 2,
      signal: 'neutral',
      riskScore: 55,
      keyEvents: "PMI services en amélioration, ventes au détail stables",
      riskFactors: {
        gdp: { risk: 46, trend: 'down' },
        inflation: { risk: 50, trend: 'down' },
        employment: { risk: 36, trend: 'down' },
        monetary_policy: { risk: 60, trend: 'down' },
        yield_curve: { risk: 50, trend: 'down' },
        market_sentiment: { risk: 40, trend: 'down' },
        geopolitical: { risk: 65, trend: 'down' },
        fiscal_policy: { risk: 65, trend: 'down' },
        housing_market: { risk: 56, trend: 'down' },
        financial_conditions: { risk: 50, trend: 'down' }
      }
    },
    {
      week: 'Semaine 7-2024',
      date: '12 - 16 Fév 2024',
      positiveFactors: 5,
      negativeFactors: 3,
      neutralFactors: 2,
      signal: 'buy',
      riskScore: 50,
      keyEvents: "Déclarations accommodantes des responsables de la BCE, amélioration des indicateurs avancés",
      riskFactors: {
        gdp: { risk: 44, trend: 'down' },
        inflation: { risk: 48, trend: 'down' },
        employment: { risk: 34, trend: 'down' },
        monetary_policy: { risk: 58, trend: 'down' },
        yield_curve: { risk: 48, trend: 'down' },
        market_sentiment: { risk: 38, trend: 'down' },
        geopolitical: { risk: 62, trend: 'down' },
        fiscal_policy: { risk: 62, trend: 'down' },
        housing_market: { risk: 54, trend: 'down' },
        financial_conditions: { risk: 48, trend: 'down' }
      }
    },
    {
      week: 'Semaine 8-2024',
      date: '19 - 23 Fév 2024',
      positiveFactors: 4,
      negativeFactors: 4,
      neutralFactors: 2,
      signal: 'neutral',
      riskScore: 52,
      keyEvents: "Chiffres de l'inflation mitigés, données de croissance décevantes en Allemagne",
      riskFactors: {
        gdp: { risk: 45, trend: 'up' },
        inflation: { risk: 50, trend: 'up' },
        employment: { risk: 35, trend: 'up' },
        monetary_policy: { risk: 60, trend: 'up' },
        yield_curve: { risk: 50, trend: 'up' },
        market_sentiment: { risk: 40, trend: 'up' },
        geopolitical: { risk: 65, trend: 'up' },
        fiscal_policy: { risk: 65, trend: 'up' },
        housing_market: { risk: 55, trend: 'up' },
        financial_conditions: { risk: 50, trend: 'up' }
      }
    }
  ]
});

// Correction de la validation de type dans le switch case
const marketConsensusByCountry = computed(() => {
  const baseConsensus = {
    economic_outlook: { bullish: 45, neutral: 35, bearish: 20 },
    monetary_policy: { hawkish: 40, neutral: 40, dovish: 20 },
    inflation_expectations: { increasing: 30, stable: 45, decreasing: 25 },
    growth_expectations: { accelerating: 30, stable: 45, slowing: 25 }
  };
  
  // Utiliser une approche sans switch pour éviter les problèmes de type
  const consensusByCountry: Record<string, any> = {
    'us': {
      ...baseConsensus,
      economic_outlook: { bullish: 55, neutral: 35, bearish: 10 },
      monetary_policy: { hawkish: 60, neutral: 30, dovish: 10 }
    },
    'eu': {
      ...baseConsensus,
      economic_outlook: { bullish: 35, neutral: 40, bearish: 25 },
      growth_expectations: { accelerating: 20, stable: 40, slowing: 40 }
    },
    'cn': {
      ...baseConsensus,
      monetary_policy: { hawkish: 35, neutral: 40, dovish: 25 }
    }
  };
  
  // Retourner le consensus pour le pays sélectionné ou le consensus de base
  return consensusByCountry[selectedCountry.value] || {
    ...baseConsensus,
    monetary_policy: { hawkish: 45, neutral: 35, dovish: 20 },
    inflation_expectations: { increasing: 40, stable: 40, decreasing: 20 }
  };
});

// Variable réactive pour les données de la courbe des taux
const yieldCurveData = ref<{
  dates: string[];
  tenYearValues: number[];
  twoYearValues: number[];
  spreadValues: number[];
  lastUpdated: string;
}>({
  dates: [],
  tenYearValues: [],
  twoYearValues: [],
  spreadValues: [],
  lastUpdated: ''
});

// Fonction pour récupérer les données de la courbe des taux
async function fetchYieldCurveData() {
  try {
    const data = await yieldCurveService.getYieldCurveData();
    yieldCurveData.value = data;
    
    // Si on a des données, on met à jour les indicateurs de taux
    if (data.tenYearValues.length > 0) {
      // Mettre à jour le rendement à 10 ans
      const latest10YValue = data.tenYearValues[data.tenYearValues.length - 1];
      const previous10YValue = data.tenYearValues.length > 1 ? data.tenYearValues[data.tenYearValues.length - 2] : latest10YValue;
      
      // Mettre à jour le rendement à 2 ans
      const latest2YValue = data.twoYearValues[data.twoYearValues.length - 1];
      const previous2YValue = data.twoYearValues.length > 1 ? data.twoYearValues[data.twoYearValues.length - 2] : latest2YValue;
      
      // Mettre à jour l'écart de rendement (spread)
      const latestSpread = data.spreadValues[data.spreadValues.length - 1];
      const previousSpread = data.spreadValues.length > 1 ? data.spreadValues[data.spreadValues.length - 2] : latestSpread;
      
      // Mise à jour des rendements des bons du Trésor
      if (economicIndicators.value.treasuries) {
        economicIndicators.value.treasuries = {
          ...economicIndicators.value.treasuries,
          value: { 
            ...economicIndicators.value.treasuries.value,
            '10y': latest10YValue,
            '2y': latest2YValue
          },
          previousValue: { 
            ...economicIndicators.value.treasuries.previousValue,
            '10y': previous10YValue,
            '2y': previous2YValue
          },
          trend: latest10YValue > previous10YValue ? 'up' : (latest10YValue < previous10YValue ? 'down' : 'stable'),
          chart: {
            labels: data.dates,
            values: {
              '10y': data.tenYearValues,
              '2y': data.twoYearValues
            }
          },
          period: 'actuel (données réelles)'
        };
      }
      
      // Mise à jour de l'indicateur de la courbe des taux
      economicIndicators.value['yield-curve'] = {
        ...economicIndicators.value['yield-curve'],
        value: latestSpread,
        previousValue: previousSpread,
        trend: latestSpread > previousSpread ? 'up' : (latestSpread < previousSpread ? 'down' : 'stable'),
        chart: {
          labels: data.dates,
          values: data.spreadValues
        },
        period: 'actuel (10Y - 2Y, données réelles)'
      };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données de la courbe des taux:', error);
  }
}

// Ajouter fetchYieldCurveData à la fonction initialize
const initialize = async () => {
  await fetchMacroData();
  await fetchVIXData();
  await fetchGoldSilverRatio();
  await fetchDXYData();
  await fetchRealGDPData();
  await fetchYieldCurveData(); // Ajouter cet appel
};

// Données fictives pour les rendements des bons du Trésor
const treasuryData = ref<{
  dates: string[];
  values: {
    '2y': number[];
    '5y': number[];
    '10y': number[];
    '30y': number[];
  };
  lastUpdated: string;
}>({
  dates: ['Jan 2023', 'Fév 2023', 'Mar 2023', 'Avr 2023', 'Mai 2023', 'Juin 2023', 'Juil 2023', 'Août 2023', 'Sep 2023', 'Oct 2023', 'Nov 2023', 'Déc 2023', 'Jan 2024', 'Fév 2024', 'Mar 2024', 'Avr 2024'],
  values: {
    '2y': [4.20, 4.30, 4.35, 4.40, 4.45, 4.50, 4.55, 4.60, 4.65, 4.70, 4.65, 4.62, 4.60, 4.58, 4.57, 4.55],
    '5y': [3.90, 4.00, 4.05, 4.10, 4.15, 4.20, 4.25, 4.30, 4.35, 4.40, 4.38, 4.37, 4.35, 4.33, 4.32, 4.30],
    '10y': [3.80, 3.90, 3.95, 4.00, 4.05, 4.10, 4.15, 4.20, 4.25, 4.30, 4.28, 4.27, 4.25, 4.23, 4.22, 4.21],
    '30y': [3.70, 3.80, 3.85, 3.90, 3.95, 4.00, 4.05, 4.10, 4.15, 4.20, 4.18, 4.17, 4.15, 4.13, 4.12, 4.10]
  },
  lastUpdated: '2024-04-15'
});

// Mise à jour des données dans economicIndicators
economicIndicators.value = {
  ...economicIndicators.value,
  'treasury': {
    ...economicIndicators.value['treasury'],
    value: treasuryData.value.values['10y'][treasuryData.value.values['10y'].length - 1],
    previousValue: treasuryData.value.values['10y'][treasuryData.value.values['10y'].length - 2],
    trend: treasuryData.value.values['10y'][treasuryData.value.values['10y'].length - 1] > treasuryData.value.values['10y'][treasuryData.value.values['10y'].length - 2] ? 'up' : 'down',
    chart: {
      labels: treasuryData.value.dates,
      values: treasuryData.value.values
    }
  },
  'unemployment-claims': {
    title: 'Demandes d\'allocations chômage',
    description: 'Nombre de nouvelles demandes d\'allocations chômage',
    value: 231,
    unit: 'milliers',
    period: 'hebdomadaire',
    previousValue: 242,
    trend: 'down',
    chart: {
      labels: ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8', 'Sem9', 'Sem10', 'Sem11', 'Sem12', 'Sem13', 'Sem14', 'Sem15', 'Sem16'],
      values: [280, 275, 268, 262, 255, 250, 245, 248, 252, 250, 245, 242, 240, 238, 242, 231]
    },
    impact: 'Indicateur très réactif des tendances du marché du travail'
  },
  'carry-trade': {
    title: 'Carry Trade',
    description: 'Stratégie d\'investissement qui consiste à emprunter dans une devise à faible taux pour investir dans une devise à taux élevé',
    value: {
      'JPY-USD': 5.10,
      'EUR-USD': 1.75,
      'CHF-USD': 3.15
    },
    unit: '%',
    period: 'actuel (différentiel de taux)',
    previousValue: {
      'JPY-USD': 5.05,
      'EUR-USD': 1.80,
      'CHF-USD': 3.10
    },
    trend: 'mixed',
    chart: {
      labels: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mars', 'Avr'],
      values: {
        'JPY-USD': [4.80, 4.85, 4.90, 4.92, 4.95, 4.98, 5.00, 5.02, 5.03, 5.04, 5.05, 5.06, 5.08, 5.09, 5.08, 5.10],
        'EUR-USD': [1.90, 1.88, 1.86, 1.85, 1.84, 1.83, 1.82, 1.81, 1.80, 1.80, 1.79, 1.78, 1.77, 1.76, 1.76, 1.75],
        'CHF-USD': [3.20, 3.18, 3.16, 3.15, 3.14, 3.13, 3.12, 3.11, 3.10, 3.10, 3.09, 3.08, 3.07, 3.06, 3.06, 3.05]
      }
    },
    impact: 'Indicateur des flux de capitaux internationaux et des opportunités d\'arbitrage entre les marchés financiers'
  }
};
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-100">
    <!-- Barre latérale de navigation -->
    <nav class="w-64 h-screen sticky top-0 bg-white text-gray-800 overflow-y-auto shadow-md">
      <div class="p-4">
        <h2 class="text-xl font-semibold mb-6 text-gray-900">Indicateurs macro</h2>
        
        <!-- Barre latérale de navigation -->
        <div class="bg-white rounded-lg shadow-lg p-4 flex flex-col h-full">
          <!-- Sélecteur de pays -->
          <div class="mb-6">
            <h3 class="text-gray-700 font-medium mb-2">Sélectionner un pays</h3>
            <div class="relative">
              <select
                v-model="selectedCountry"
                class="w-full px-4 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none"
              >
                <option value="us">🇺🇸 États-Unis</option>
                <option value="eu">🇪🇺 Zone Euro</option>
                <option value="cn">🇨🇳 Chine</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
            <div class="text-center mt-2 text-sm font-medium text-blue-700">
              {{ countryFullName }}
            </div>
          </div>

          <!-- Catégories de données -->
          <div class="space-y-1 text-sm">
            <h4 class="font-medium text-gray-500 uppercase tracking-wider text-xs mb-3">Vue d'ensemble</h4>
            <a href="#overview" @click.prevent="resetToOverview" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
              </svg>
              <span>Vue d'ensemble <span class="text-xs text-gray-500 ml-1">(Dashboard)</span></span>
            </a>
            
            <h4 class="font-medium text-gray-500 uppercase tracking-wider text-xs mt-6 mb-3">Trading</h4>
            <a href="#top-setups" @click="scrollToSection('top-setups')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
              </svg>
              <span>Top Setups <span class="text-xs text-gray-500 ml-1">(Best)</span></span>
            </a>

            <h4 class="font-medium text-gray-500 uppercase tracking-wider text-xs mt-6 mb-3">Croissance</h4>
            <a href="#gdp" @click="scrollToSection('gdp')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <span>PIB <span class="text-xs text-gray-500 ml-1">(GDP)</span></span>
            </a>
            <a href="#housing-starts" @click="scrollToSection('housing-starts')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
              </svg>
              <span>Mises en chantier <span class="text-xs text-gray-500 ml-1">(Housing)</span></span>
            </a>
            <a href="#building-permits" @click="scrollToSection('building-permits')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>Permis de construire <span class="text-xs text-gray-500 ml-1">(Permits)</span></span>
            </a>
            
            <a href="#manufacturing-pmi" @click="scrollToSection('manufacturing-pmi')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z"></path>
              </svg>
              <span>PMI Manufacturier <span class="text-xs text-gray-500 ml-1">(Mfg PMI)</span></span>
            </a>
            <a href="#services-pmi" @click="scrollToSection('services-pmi')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z"></path>
              </svg>
              <span>PMI Services <span class="text-xs text-gray-500 ml-1">(Svc PMI)</span></span>
            </a>

            <h4 class="font-medium text-gray-500 uppercase tracking-wider text-xs mt-6 mb-3">Emploi</h4>
            <a href="#unemployment" @click="scrollToSection('unemployment')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              <span>Taux de chômage <span class="text-xs text-gray-500 ml-1">(U-Rate)</span></span>
            </a>
            <a href="#nonfarm-payrolls" @click="scrollToSection('nonfarm-payrolls')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <span>Créations d'emploi <span class="text-xs text-gray-500 ml-1">(NFP)</span></span>
            </a>
            
            <a href="#wage-growth" @click="scrollToSection('wage-growth')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Croissance des salaires <span class="text-xs text-gray-500 ml-1">(Wages)</span></span>
            </a>

            <a href="#consumer-confidence" @click="scrollToSection('consumer-confidence')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
              </svg>
              <span>Indice de confiance des consommateurs <span class="text-xs text-gray-500 ml-1">(CCI)</span></span>
            </a>

            <a href="#business-confidence" @click="scrollToSection('business-confidence')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
              <span>Indice de confiance des entreprises <span class="text-xs text-gray-500 ml-1">(BCI)</span></span>
            </a>

            <h4 class="font-medium text-gray-500 uppercase tracking-wider text-xs mt-6 mb-3">Inflation</h4>
            <a href="#cpi" @click="scrollToSection('cpi')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Prix à la consommation <span class="text-xs text-gray-500 ml-1">(CPI)</span></span>
            </a>
            <a href="#ppi" @click="scrollToSection('ppi')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
              </svg>
              <span>Prix à la production <span class="text-xs text-gray-500 ml-1">(PPI)</span></span>
            </a>

            <h4 class="font-medium text-gray-500 uppercase tracking-wider text-xs mt-6 mb-3">Taux d'intérêt</h4>
            <a href="#federal" @click="scrollToSection('federal')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
              </svg>
              <span>Taux directeur <span class="text-xs text-gray-500 ml-1">(FFR)</span></span>
            </a>
            
            <a href="#yield-curve" @click="scrollToSection('yield-curve')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path>
              </svg>
              <span>Courbe des taux <span class="text-xs text-gray-500 ml-1">(10Y-2Y)</span></span>
            </a>

            <h4 class="font-medium text-gray-500 uppercase tracking-wider text-xs mt-6 mb-3">Marchés</h4>
            
            <a href="#vix" @click="scrollToSection('vix')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span>Indice de volatilité <span class="text-xs text-gray-500 ml-1">(VIX)</span></span>
            </a>
            <a href="#dollar-index" @click="scrollToSection('dollar-index')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Indice dollar <span class="text-xs text-gray-500 ml-1">(DXY)</span></span>
            </a>
            <a href="#cot" @click="scrollToSection('cot')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
              </svg>
              <span>Commitment of Traders <span class="text-xs text-gray-500 ml-1">(CoT)</span></span>
            </a>
            
            <a href="#gold-silver-ratio" @click="scrollToSection('gold-silver-ratio')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Ratio Or/Argent <span class="text-xs text-gray-500 ml-1">(Gold/Silver)</span></span>
            </a>
            
            <a href="#oil" @click="scrollToSection('oil')" class="flex items-center p-2 text-gray-700 hover:bg-blue-50 rounded-md">
              <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
              </svg>
              <span>Pétrole <span class="text-xs text-gray-500 ml-1">(WTI)</span></span>
            </a>
            
            
            
          </div>
        </div>
      </div>
    </nav>
    
    <!-- Contenu principal -->
    <div class="flex-1 overflow-y-auto p-6">
      <!-- En-tête avec titre et bouton de rafraîchissement -->
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">
          Tableau de bord macroéconomique <span class="text-blue-600">{{ selectedCountryName }}</span>
        </h1>
        <button
          @click="fetchMacroData"
          class="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          :disabled="loading"
        >
          <svg
            v-if="loading"
            class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            ></path>
          </svg>
          Rafraîchir
        </button>
      </div>

      <!-- Alerte d'erreur -->
      <div v-if="error" class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md">
        <p class="font-medium">Erreur</p>
        <p>{{ error }}</p>
      </div>

      <!-- Date de dernière mise à jour -->
      <p v-if="lastUpdated" class="text-sm text-gray-500 mb-6">
        Dernière mise à jour: {{ formatDate(lastUpdated) }}
      </p>

      <!-- Vue détaillée d'un indicateur spécifique -->
      <div v-if="selectedIndicator && selectedIndicator !== 'overview' && economicIndicators[selectedIndicator]" class="space-y-6">
        <!-- Contenu détaillé de l'indicateur sélectionné -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">{{ economicIndicators[selectedIndicator].title }}</h2>
              <p class="text-gray-500">{{ economicIndicators[selectedIndicator].description }}</p>
            </div>
            <div class="flex flex-col items-end">
              <div class="flex items-center space-x-3">
                <span class="text-3xl font-bold" :class="{
                  'text-green-600': economicIndicators[selectedIndicator].trend === 'up', 
                  'text-red-600': economicIndicators[selectedIndicator].trend === 'down',
                  'text-gray-600': economicIndicators[selectedIndicator].trend === 'stable',
                  'text-amber-600': economicIndicators[selectedIndicator].trend === 'mixed'
                }">
                  <template v-if="typeof economicIndicators[selectedIndicator].value === 'object'">
                    <span v-for="(val, key) in economicIndicators[selectedIndicator].value" :key="key" class="block text-right">
                      {{ key }}: {{ val }}{{ economicIndicators[selectedIndicator].unit }}
                    </span>
                  </template>
                  <template v-else>
                    {{ economicIndicators[selectedIndicator].value }}{{ economicIndicators[selectedIndicator].unit }}
                  </template>
                    </span>
                <span v-if="economicIndicators[selectedIndicator].trend === 'up'" class="text-green-500">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                  </svg>
                    </span>
                <span v-else-if="economicIndicators[selectedIndicator].trend === 'down'" class="text-red-500">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path>
                  </svg>
                    </span>
                <span v-else-if="economicIndicators[selectedIndicator].trend === 'stable'" class="text-gray-500">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14"></path>
                  </svg>
              </span>
            </div>
              <div class="mt-2 text-sm text-gray-500">
                {{ economicIndicators[selectedIndicator].period }}
            </div>
            </div>
          </div>
          
          <!-- Données principales dans une grille -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <!-- Valeur actuelle -->
            <div class="bg-blue-50 rounded-lg p-5 border border-blue-100">
              <h3 class="text-sm font-medium text-blue-900 uppercase tracking-wider mb-3">Valeur actuelle</h3>
              <div v-if="typeof economicIndicators[selectedIndicator].value === 'object'" class="space-y-2">
                <div v-for="(val, key) in economicIndicators[selectedIndicator].value" :key="key" class="flex justify-between">
                  <span class="text-gray-700">{{ key }}</span>
                  <span class="font-semibold text-blue-700">{{ val }}{{ economicIndicators[selectedIndicator].unit }}</span>
                </div>
              </div>
              <div v-else class="text-center">
                <div class="text-3xl font-bold text-blue-700">{{ economicIndicators[selectedIndicator].value }}{{ economicIndicators[selectedIndicator].unit }}</div>
                <div class="text-sm text-gray-500 mt-2">{{ economicIndicators[selectedIndicator].period }}</div>
                </div>
              </div>
            
            <!-- Valeur précédente -->
            <div class="bg-gray-50 rounded-lg p-5 border border-gray-200">
              <h3 class="text-sm font-medium text-gray-700 uppercase tracking-wider mb-3">Valeur précédente</h3>
              <div v-if="typeof economicIndicators[selectedIndicator].previousValue === 'object'" class="space-y-2">
                <div v-for="(val, key) in economicIndicators[selectedIndicator].previousValue" :key="key" class="flex justify-between">
                  <span class="text-gray-700">{{ key }}</span>
                  <span class="font-semibold text-gray-700">{{ val }}{{ economicIndicators[selectedIndicator].unit }}</span>
                </div>
              </div>
              <div v-else class="text-center">
                <div class="text-2xl font-semibold text-gray-700">{{ economicIndicators[selectedIndicator].previousValue }}{{ economicIndicators[selectedIndicator].unit }}</div>
                <div v-if="typeof economicIndicators[selectedIndicator].value !== 'object'" class="mt-3">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium" 
                  :class="{
                      'bg-green-100 text-green-800': economicIndicators[selectedIndicator].value > economicIndicators[selectedIndicator].previousValue,
                      'bg-red-100 text-red-800': economicIndicators[selectedIndicator].value < economicIndicators[selectedIndicator].previousValue,
                      'bg-gray-100 text-gray-800': economicIndicators[selectedIndicator].value === economicIndicators[selectedIndicator].previousValue,
                    }">
                    <svg v-if="economicIndicators[selectedIndicator].value > economicIndicators[selectedIndicator].previousValue" class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                </svg>
                    <svg v-else-if="economicIndicators[selectedIndicator].value < economicIndicators[selectedIndicator].previousValue" class="-ml-0.5 mr-1.5 h-2 w-2 text-red-400" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
              </svg>
                    <svg v-else class="-ml-0.5 mr-1.5 h-2 w-2 text-gray-400" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
              </svg>
                    {{ economicIndicators[selectedIndicator].value > economicIndicators[selectedIndicator].previousValue ? '+' : '' }}{{ ((economicIndicators[selectedIndicator].value - economicIndicators[selectedIndicator].previousValue) / Math.abs(economicIndicators[selectedIndicator].previousValue) * 100).toFixed(1) }}%
                  </span>
                </div>
              </div>
                </div>

            <!-- Impact économique -->
            <div class="bg-indigo-50 rounded-lg p-5 border border-indigo-100">
              <h3 class="text-sm font-medium text-indigo-900 uppercase tracking-wider mb-3">Impact économique</h3>
              <p class="text-gray-700">{{ economicIndicators[selectedIndicator].impact }}</p>
              </div>
                </div>
              
          <!-- Graphique de l'évolution historique -->
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Évolution historique</h3>
            <div class="h-80 bg-white rounded-lg border border-gray-200 p-4">
              <canvas id="indicatorChart"></canvas>
              </div>
            </div>
            
          <!-- Prévisions si disponibles -->
          <div v-if="economicIndicators[selectedIndicator].forecast" class="mt-8">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Prévisions</h3>
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-100">
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr>
                      <th v-for="(label, index) in economicIndicators[selectedIndicator].forecast.labels" :key="index" 
                        class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {{ label }}
                      </th>
                </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td v-for="(value, index) in economicIndicators[selectedIndicator].forecast.values" :key="index"
                        class="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium">
                        {{ value }}{{ economicIndicators[selectedIndicator].unit }}
                  </td>
                </tr>
              </tbody>
            </table>
                </div>
              </div>
                </div>
              
          <!-- Nouvelle section d'interprétation (visible dans l'interface) -->
          <IndicatorInterpretation 
            v-if="typeof economicIndicators[selectedIndicator].value !== 'object'"
            :indicatorKey="selectedIndicator"
            :value="economicIndicators[selectedIndicator].value"
            :trend="economicIndicators[selectedIndicator].trend"
          />
            </div>
          </div>

      <!-- Vue d'ensemble -->
      <div v-if="selectedIndicator === 'overview'" id="overview" class="space-y-6">
        <!-- Tableaux de bord des principaux indicateurs -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <!-- Croissance -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Croissance
              <button 
                @click.stop="fetchRealGDPData" 
                class="ml-auto flex items-center text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-2 rounded transition-colors"
                :disabled="isLoadingGDP"
              >
                <svg 
                  v-if="isLoadingGDP" 
                  class="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-800" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg 
                  v-else 
                  class="w-3 h-3 mr-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                API PIB
              </button>
            </h3>
            
            <div class="space-y-4">
              <div v-if="gdpError" class="text-red-600 text-sm mb-2">{{ gdpError }}</div>
              
              <div @click="scrollToSection('gdp')" class="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-800">PIB (Réel)</span>
                  <div class="flex flex-col items-end">
                    <span class="font-bold text-blue-700">{{ economicIndicators.gdp.value }}</span>
                    <span v-if="economicIndicators.gdp.percentChange !== undefined" class="text-xs" :class="{
                      'text-green-600': economicIndicators.gdp.percentChange > 0,
                      'text-red-600': economicIndicators.gdp.percentChange < 0,
                      'text-gray-600': economicIndicators.gdp.percentChange === 0
                    }">
                      ({{ economicIndicators.gdp.percentChange > 0 ? '+' : '' }}{{ economicIndicators.gdp.percentChange }}%)
                    </span>
                  </div>
                    </div>
                <div class="flex justify-between items-center mt-1 text-sm">
                  <span class="text-gray-500">
                    {{ economicIndicators.gdp.previousValue }}
                    <span v-if="economicIndicators.gdp.previousPercentChange !== undefined" class="text-xs" :class="{
                      'text-green-600': economicIndicators.gdp.previousPercentChange > 0,
                      'text-red-600': economicIndicators.gdp.previousPercentChange < 0,
                      'text-gray-600': economicIndicators.gdp.previousPercentChange === 0
                    }">
                      ({{ economicIndicators.gdp.previousPercentChange > 0 ? '+' : '' }}{{ economicIndicators.gdp.previousPercentChange }}%)
                    </span>
                  </span>
                  <span :class="{
                    'text-green-600': economicIndicators.gdp.trend === 'up',
                    'text-red-600': economicIndicators.gdp.trend === 'down',
                    'text-gray-600': economicIndicators.gdp.trend === 'stable'
                  }">
                    <template v-if="economicIndicators.gdp.trend === 'up'">↗</template>
                    <template v-else-if="economicIndicators.gdp.trend === 'down'">↘</template>
                    <template v-else>→</template>
                    </span>
            </div>
                <div class="mt-1 text-xs text-gray-500">Données via API - {{ economicIndicators.gdp.period }}</div>
          </div>
          
              <div @click="scrollToSection('manufacturing-pmi')" class="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-800">PMI Manufacturier</span>
                  <span class="font-bold" :class="{
                    'text-green-700': economicIndicators['manufacturing-pmi'].value > 50,
                    'text-red-700': economicIndicators['manufacturing-pmi'].value < 50,
                    'text-yellow-700': economicIndicators['manufacturing-pmi'].value === 50
                  }">{{ economicIndicators['manufacturing-pmi'].value }}</span>
                    </div>
                <div class="flex justify-between items-center mt-1 text-sm">
                  <span class="text-gray-500">Seuil: 50.0</span>
                  <span :class="{
                    'text-green-600': economicIndicators['manufacturing-pmi'].trend === 'up',
                    'text-red-600': economicIndicators['manufacturing-pmi'].trend === 'down',
                    'text-gray-600': economicIndicators['manufacturing-pmi'].trend === 'stable'
                  }">
                    <template v-if="economicIndicators['manufacturing-pmi'].trend === 'up'">↗</template>
                    <template v-else-if="economicIndicators['manufacturing-pmi'].trend === 'down'">↘</template>
                    <template v-else>→</template>
                    </span>
            </div>
              </div>
            </div>
          </div>
          
          <!-- Emploi -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              Emploi
            </h3>
            
            <div class="space-y-4">
              <div @click="scrollToSection('unemployment')" class="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-800">Taux de chômage</span>
                  <span class="font-bold text-blue-700">{{ economicIndicators.unemployment.value }}{{ economicIndicators.unemployment.unit }}</span>
                    </div>
                <div class="flex justify-between items-center mt-1 text-sm">
                  <span class="text-gray-500">Précédent: {{ economicIndicators.unemployment.previousValue }}{{ economicIndicators.unemployment.unit }}</span>
                  <span :class="{
                    'text-green-600': economicIndicators.unemployment.trend === 'down',
                    'text-red-600': economicIndicators.unemployment.trend === 'up',
                    'text-gray-600': economicIndicators.unemployment.trend === 'stable'
                  }">
                    <template v-if="economicIndicators.unemployment.trend === 'down'">↘</template>
                    <template v-else-if="economicIndicators.unemployment.trend === 'up'">↗</template>
                    <template v-else>→</template>
                    </span>
              </div>
            </div>
            
              <div @click="scrollToSection('nonfarm-payrolls')" class="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-800">Créations d'emploi (NFP)</span>
                  <span class="font-bold text-blue-700">{{ economicIndicators['nonfarm-payrolls'].value }}{{ economicIndicators['nonfarm-payrolls'].unit }}</span>
                    </div>
                <div class="flex justify-between items-center mt-1 text-sm">
                  <span class="text-gray-500">Précédent: {{ economicIndicators['nonfarm-payrolls'].previousValue }}{{ economicIndicators['nonfarm-payrolls'].unit }}</span>
                  <span :class="{
                    'text-green-600': economicIndicators['nonfarm-payrolls'].trend === 'up',
                    'text-red-600': economicIndicators['nonfarm-payrolls'].trend === 'down',
                    'text-gray-600': economicIndicators['nonfarm-payrolls'].trend === 'stable'
                  }">
                    <template v-if="economicIndicators['nonfarm-payrolls'].trend === 'up'">↗</template>
                    <template v-else-if="economicIndicators['nonfarm-payrolls'].trend === 'down'">↘</template>
                    <template v-else>→</template>
                    </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Inflation -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Inflation
            </h3>
            
            <div class="space-y-4">
              <div @click="scrollToSection('cpi')" class="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-800">IPC (CPI)</span>
                  <span class="font-bold text-blue-700">{{ economicIndicators.cpi.value }}{{ economicIndicators.cpi.unit }}</span>
                    </div>
                <div class="flex justify-between items-center mt-1 text-sm">
                  <span class="text-gray-500">Précédent: {{ economicIndicators.cpi.previousValue }}{{ economicIndicators.cpi.unit }}</span>
                  <span :class="{
                    'text-green-600': economicIndicators.cpi.trend === 'down',
                    'text-red-600': economicIndicators.cpi.trend === 'up',
                    'text-gray-600': economicIndicators.cpi.trend === 'stable'
                  }">
                    <template v-if="economicIndicators.cpi.trend === 'down'">↘</template>
                    <template v-else-if="economicIndicators.cpi.trend === 'up'">↗</template>
                    <template v-else>→</template>
                    </span>
              </div>
              </div>
              
              <div @click="scrollToSection('ppi')" class="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-800">IPP (PPI)</span>
                  <span class="font-bold text-blue-700">{{ economicIndicators.ppi.value }}{{ economicIndicators.ppi.unit }}</span>
                    </div>
                <div class="flex justify-between items-center mt-1 text-sm">
                  <span class="text-gray-500">Précédent: {{ economicIndicators.ppi.previousValue }}{{ economicIndicators.ppi.unit }}</span>
                  <span :class="{
                    'text-green-600': economicIndicators.ppi.trend === 'down',
                    'text-red-600': economicIndicators.ppi.trend === 'up',
                    'text-gray-600': economicIndicators.ppi.trend === 'stable'
                  }">
                    <template v-if="economicIndicators.ppi.trend === 'down'">↘</template>
                    <template v-else-if="economicIndicators.ppi.trend === 'up'">↗</template>
                    <template v-else>→</template>
                    </span>
          </div>
              </div>
              </div>
              </div>
              </div>
              
        <!-- Graphiques principaux -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Graphique d'inflation -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Inflation (CPI YoY)</h3>
            <div class="h-60 bg-white rounded-lg">
              <canvas id="inflationChart"></canvas>
              </div>
            </div>
              
          <!-- Graphique mises en chantier -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
              Mises en chantier
              <button 
                @click.stop="fetchHousingStartsData" 
                class="ml-auto flex items-center text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-2 rounded transition-colors"
                :disabled="isLoadingHousingStarts"
              >
                <svg 
                  v-if="isLoadingHousingStarts" 
                  class="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-800" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg 
                  v-else 
                  class="w-3 h-3 mr-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Actualiser
              </button>
            </h3>
            <div v-if="housingStartsError" class="text-red-600 text-sm mb-2">{{ housingStartsError }}</div>
            <div class="h-60 bg-white rounded-lg">
              <canvas id="housingStartsChart"></canvas>
            </div>
          </div>
          
          <!-- Graphique permis de construire -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
              Permis de construire
              <button 
                @click.stop="fetchBuildingPermitsData" 
                class="ml-auto flex items-center text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-2 rounded transition-colors"
                :disabled="isLoadingBuildingPermits"
              >
                <svg 
                  v-if="isLoadingBuildingPermits" 
                  class="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-800" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg 
                  v-else 
                  class="w-3 h-3 mr-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Actualiser
              </button>
            </h3>
            <div v-if="buildingPermitsError" class="text-red-600 text-sm mb-2">{{ buildingPermitsError }}</div>
            <div class="h-60 bg-white rounded-lg">
              <canvas id="buildingPermitsChart"></canvas>
          </div>
        </div>
        
          <!-- Graphique PMI -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Indice PMI Manufacturier</h3>
            <div class="h-60 bg-white rounded-lg">
              <canvas id="pmiChart"></canvas>
              </div>
              </div>
              
          <!-- Graphique courbe des taux -->
          <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Courbe des taux (10Y - 2Y)</h3>
            <div class="h-60 bg-white rounded-lg">
              <canvas id="yieldCurveChart"></canvas>
              </div>
            </div>
          </div>
          
          <!-- Évolution du consensus dans le temps -->
<div class="bg-white rounded-xl shadow-lg p-6 mb-6">
  <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
    <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
    Évolution du consensus ({{ countryFullName }})
            </h3>
            
  <div class="space-y-4">
    <!-- Historique des signaux -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="font-medium text-gray-700">Signaux récents:</div>
      <div v-for="(item, index) in selectedHistoricalConsensus" :key="index" 
           class="flex items-center rounded-full px-3 py-1 text-xs font-medium"
           :class="{
             'bg-green-500 text-white': item.signal === 'strong_buy',
             'bg-green-200 text-green-800': item.signal === 'buy',
             'bg-yellow-200 text-yellow-800': item.signal === 'neutral',
             'bg-red-200 text-red-800': item.signal === 'sell',
             'bg-red-500 text-white': item.signal === 'strong_sell'
           }">
        {{ item.week }}
        <span class="ml-1">
          <svg v-if="item.signal === 'strong_buy'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
          </svg>
          <svg v-else-if="item.signal === 'buy'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
          <svg v-else-if="item.signal === 'neutral'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14"></path>
          </svg>
          <svg v-else-if="item.signal === 'sell'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg v-else-if="item.signal === 'strong_sell'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </span>
              </div>
            </div>
            
    <!-- Recommandation basée sur le consensus actuel -->
    <div class="mt-6 bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg shadow-inner">
      <h4 class="text-lg font-bold text-gray-800 mb-2">Recommandation actuelle</h4>
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between">
        <div class="flex-1">
          <div class="text-2xl font-bold mb-2" :class="{
            'text-green-600': selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'strong_buy' || selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'buy',
            'text-yellow-600': selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'neutral',
            'text-red-600': selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'sell' || selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'strong_sell'
          }">
            {{ selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'strong_buy' ? 'ACHAT FORT' : 
               selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'buy' ? 'ACHAT' : 
               selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'neutral' ? 'NEUTRE' : 
               selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].signal === 'sell' ? 'VENTE' : 'VENTE FORTE' }}
          </div>
          <p class="text-gray-700">
            Basé sur l'analyse de 10 facteurs économiques, avec 
            <span class="text-green-600 font-medium">{{ selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].positiveFactors }} positifs</span>, 
            <span class="text-red-600 font-medium">{{ selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].negativeFactors }} négatifs</span> et 
            <span class="text-gray-600 font-medium">{{ selectedHistoricalConsensus[selectedHistoricalConsensus.length - 1].neutralFactors }} neutres</span>.
          </p>
        </div>
        <div class="mt-4 md:mt-0 bg-white p-4 rounded-lg shadow-md">
          <div class="text-sm text-gray-600 mb-1">Évolution du signal sur 5 semaines</div>
          <div class="flex space-x-1">
            <div v-for="(item, index) in selectedHistoricalConsensus" :key="index" 
                 class="w-8 h-8 rounded-full flex items-center justify-center"
                  :class="{
                   'bg-green-500 text-white': item.signal === 'strong_buy',
                   'bg-green-200 text-green-800': item.signal === 'buy',
                   'bg-yellow-200 text-yellow-800': item.signal === 'neutral',
                   'bg-red-200 text-red-800': item.signal === 'sell',
                   'bg-red-500 text-white': item.signal === 'strong_sell'
                 }">
              <svg v-if="item.signal === 'strong_buy'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
              </svg>
              <svg v-else-if="item.signal === 'buy'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
              </svg>
              <svg v-else-if="item.signal === 'neutral'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14"></path>
              </svg>
              <svg v-else-if="item.signal === 'sell'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
              <svg v-else-if="item.signal === 'strong_sell'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
              </div>
          </div>
        </div>
      </div>
              </div>
            </div>
          </div>
          
        <!-- Jauge de risque économique -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            Évaluation du risque économique
            </h3>
            
          <div class="flex items-center justify-center pb-4">
            <div class="w-full max-w-3xl">
              <div class="relative pt-1">
                <div class="overflow-hidden h-4 text-xs flex rounded-full bg-gray-200">
                  <div
                    :style="{ width: `${countryRiskScore}%` }"
                    :class="{
                      'bg-green-500': countryRiskScore < 30,
                      'bg-yellow-500': countryRiskScore >= 30 && countryRiskScore < 70,
                      'bg-red-500': countryRiskScore >= 70
                    }"
                    class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500"
                  ></div>
                </div>
                <div class="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Faible risque</span>
                  <span>Risque modéré</span>
                  <span>Risque élevé</span>
              </div>
              </div>

              <div class="text-center mt-4">
                <span class="text-lg font-bold" :class="{
                  'text-green-600': countryRiskScore < 30,
                  'text-yellow-600': countryRiskScore >= 30 && countryRiskScore < 70,
                  'text-red-600': countryRiskScore >= 70
                }">
                  {{ countryRiskScore }}% - 
                  <span v-if="countryRiskScore < 30">Faible risque</span>
                  <span v-else-if="countryRiskScore >= 30 && countryRiskScore < 70">Risque modéré</span>
                  <span v-else>Risque élevé</span>
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Détails des facteurs de risque -->
            <div class="mt-4">
              <h4 class="font-bold text-gray-700 mb-3">Détails des facteurs de risque</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="(factor, key) in selectedRiskAssessment" :key="key" class="bg-gray-50 rounded-lg p-3">
                  <div class="flex justify-between items-center">
                    <span class="font-medium text-gray-800 capitalize">{{ key.replace('_', ' ') }}</span>
                    <div class="flex items-center">
                      <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                        <div 
                  :class="{
                            'bg-green-500': factor.risk < 30,
                            'bg-yellow-500': factor.risk >= 30 && factor.risk < 70,
                            'bg-red-500': factor.risk >= 70
                          }"
                          :style="{ width: `${factor.risk}%` }"
                          class="h-full"
                        ></div>
              </div>
                      <span class="text-xs font-semibold" :class="{
                        'text-green-600': factor.risk < 30,
                        'text-yellow-600': factor.risk >= 30 && factor.risk < 70,
                        'text-red-600': factor.risk >= 70
                      }">{{ factor.risk }}%</span>
                    </div>
                  </div>
                  <p class="text-sm text-gray-600 mt-1">{{ factor.comment }}</p>
                </div>
              </div>
            </div>
          </div>
          
        <!-- Consensus de tendances macro -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            Consensus Macro ({{ countryFullName }})
            </h3>
            
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Perspectives économiques -->
            <div class="bg-blue-50 rounded-lg p-4">
              <h4 class="font-bold text-gray-800 mb-2">Perspectives économiques</h4>
              <div class="space-y-2">
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Haussières</span>
                    <span class="font-medium">{{ generateMarketConsensus.economic_outlook.bullish }}%</span>
              </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-green-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.economic_outlook.bullish}%`}"></div>
              </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Neutres</span>
                    <span class="font-medium">{{ generateMarketConsensus.economic_outlook.neutral }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-yellow-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.economic_outlook.neutral}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Baissières</span>
                    <span class="font-medium">{{ generateMarketConsensus.economic_outlook.bearish }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-red-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.economic_outlook.bearish}%`}"></div>
                  </div>
                </div>
              </div>
              </div>
              
            <!-- Politique monétaire -->
            <div class="bg-blue-50 rounded-lg p-4">
              <h4 class="font-bold text-gray-800 mb-2">Politique monétaire</h4>
              <div class="space-y-2">
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Restrictive</span>
                    <span class="font-medium">{{ generateMarketConsensus.monetary_policy.hawkish }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-blue-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.monetary_policy.hawkish}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Neutre</span>
                    <span class="font-medium">{{ generateMarketConsensus.monetary_policy.neutral }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-yellow-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.monetary_policy.neutral}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Accommodante</span>
                    <span class="font-medium">{{ generateMarketConsensus.monetary_policy.dovish }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-green-400 h-2 rounded-full" :style="{width: `${generateMarketConsensus.monetary_policy.dovish}%`}"></div>
                  </div>
              </div>
            </div>
          </div>
          
            <!-- Attentes d'inflation -->
            <div class="bg-blue-50 rounded-lg p-4">
              <h4 class="font-bold text-gray-800 mb-2">Attentes d'inflation</h4>
              <div class="space-y-2">
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>En hausse</span>
                    <span class="font-medium">{{ generateMarketConsensus.inflation_expectations.increasing }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-red-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.inflation_expectations.increasing}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Stable</span>
                    <span class="font-medium">{{ generateMarketConsensus.inflation_expectations.stable }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-yellow-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.inflation_expectations.stable}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>En baisse</span>
                    <span class="font-medium">{{ generateMarketConsensus.inflation_expectations.decreasing }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-green-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.inflation_expectations.decreasing}%`}"></div>
                  </div>
                </div>
                </div>
              </div>
              
            <!-- Attentes de croissance -->
            <div class="bg-blue-50 rounded-lg p-4">
              <h4 class="font-bold text-gray-800 mb-2">Attentes de croissance</h4>
              <div class="space-y-2">
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Accélération</span>
                    <span class="font-medium">{{ generateMarketConsensus.growth_expectations.accelerating }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-green-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.growth_expectations.accelerating}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Stable</span>
                    <span class="font-medium">{{ generateMarketConsensus.growth_expectations.stable }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-yellow-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.growth_expectations.stable}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Ralentissement</span>
                    <span class="font-medium">{{ generateMarketConsensus.growth_expectations.slowing }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-red-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.growth_expectations.slowing}%`}"></div>
                  </div>
                </div>
                </div>
              </div>
              
            <!-- Sentiment de risque -->
            <div class="bg-blue-50 rounded-lg p-4">
              <h4 class="font-bold text-gray-800 mb-2">Sentiment de risque</h4>
              <div class="space-y-2">
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Appétit pour le risque</span>
                    <span class="font-medium">{{ generateMarketConsensus.risk_sentiment.risk_on }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-green-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.risk_sentiment.risk_on}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Neutre</span>
                    <span class="font-medium">{{ generateMarketConsensus.risk_sentiment.neutral }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-yellow-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.risk_sentiment.neutral}%`}"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>Aversion au risque</span>
                    <span class="font-medium">{{ generateMarketConsensus.risk_sentiment.risk_off }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-red-500 h-2 rounded-full" :style="{width: `${generateMarketConsensus.risk_sentiment.risk_off}%`}"></div>
                  </div>
                </div>
                </div>
              </div>
              
            <!-- Évolution du COT -->
            <div class="bg-blue-50 rounded-lg p-4">
              <h4 class="font-bold text-gray-800 mb-2">Évolution du COT</h4>
              <div class="h-40">
                <canvas id="cotChart"></canvas>
                </div>
              </div>
            </div>
          </div>
          
        <!-- Consensus de marché pour les indices principaux -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
              </svg>
            Consensus de marché ({{ countryFullName }})
            </h3>
            
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-for="(index, idx) in currentConsensus.indices" :key="idx" class="bg-blue-50 rounded-lg p-4">
              <div class="flex justify-between items-center mb-2">
                <div>
                  <h4 class="font-bold text-gray-800">{{ index.name }} <span class="text-gray-500 text-sm">({{ index.ticker }})</span></h4>
                  <div class="flex items-center mt-1">
                    <span class="text-lg font-bold">{{ index.current }}</span>
                    <span :class="{
                      'text-green-600': index.change > 0,
                      'text-red-600': index.change < 0,
                      'text-gray-600': index.change === 0
                    }" class="flex items-center text-sm ml-2">
                      {{ index.change > 0 ? '+' : '' }}{{ index.change }}%
                  </span>
                </div>
                </div>
                <div class="text-right">
                  <div class="text-sm text-gray-500">Objectif</div>
                  <div class="text-lg font-bold" :class="{
                    'text-green-600': index.target > index.current,
                    'text-red-600': index.target < index.current,
                    'text-gray-600': index.target === index.current
                  }">
                    {{ index.target }}
                </div>
              </div>
            </div>
            
              <!-- Répartition des recommandations d'analystes -->
              <div class="mb-2">
                <div class="flex h-4 rounded-full overflow-hidden bg-gray-200">
                  <div 
                    class="bg-green-500 h-full" 
                    :style="{ width: `${index.analysts.buy}%` }"
                  ></div>
                  <div 
                    class="bg-yellow-500 h-full" 
                    :style="{ width: `${index.analysts.hold}%` }"
                  ></div>
                  <div 
                    class="bg-red-500 h-full" 
                    :style="{ width: `${index.analysts.sell}%` }"
                  ></div>
              </div>
                <div class="flex justify-between text-xs mt-1">
                  <span class="text-green-600 font-medium">Achat: {{ index.analysts.buy }}%</span>
                  <span class="text-yellow-600 font-medium">Neutre: {{ index.analysts.hold }}%</span>
                  <span class="text-red-600 font-medium">Vente: {{ index.analysts.sell }}%</span>
              </div>
              </div>
              
              <!-- Sentiment -->
              <div class="text-sm font-medium">
                Sentiment: 
                <span :class="{
                  'text-green-600': index.outlook === 'bullish',
                  'text-yellow-600': index.outlook === 'neutral',
                  'text-red-600': index.outlook === 'bearish'
                }">
                  {{ index.outlook === 'bullish' ? 'Haussier' : index.outlook === 'bearish' ? 'Baissier' : 'Neutre' }}
                </span>
              </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Styles pour la navigation latérale */
.bg-blue-600 {
  background-color: #2563eb;
}

/* Styles pour les éléments du graphique */
.border-dashed {
  border-style: dashed;
}

/* Styles pour les indicateurs économiques */
.indicator-card {
  @apply bg-white rounded-lg shadow-md overflow-hidden transition-all;
}
.indicator-card:hover {
  @apply shadow-lg transform scale-[1.02];
}

.status-positive {
  @apply bg-green-100 text-green-800 border-green-300;
}
.status-neutral {
  @apply bg-yellow-100 text-yellow-800 border-yellow-300;
}
.status-caution {
  @apply bg-orange-100 text-orange-800 border-orange-300;
}
.status-negative {
  @apply bg-red-100 text-red-800 border-red-300;
}
.status-strong-negative {
  @apply bg-purple-100 text-purple-800 border-purple-300;
}

.chart-container {
  @apply h-64 lg:h-80 w-full rounded-lg;
}

.trend-up {
  @apply text-green-600;
}
.trend-down {
  @apply text-red-600;
}
.trend-stable {
  @apply text-gray-600;
}

/* Animation pour le chargement */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style> 
