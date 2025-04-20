<script setup lang="ts">
import { ref } from 'vue';

const activeTab = ref('regles');
const copiedMessage = ref('');

const tabs = [
  { id: 'regles', label: 'Règles de Base' },
  { id: 'plan', label: 'Plan de Trading' },
  { id: 'statistiques', label: 'Statistiques' },
  { id: 'performance', label: 'Performance' },
  { id: 'indicateurs', label: 'Indicateurs' }
];

interface Indicator {
  name: string;
  description: string;
  code: string;
  showCode?: boolean;
}

const indicators = ref<Indicator[]>([
  {
    name: 'MTFI (Multi-Timeframe Trend Indicator)',
    description: 'Indicateur qui affiche la tendance sur plusieurs timeframes pour une vision globale du marché. Note: Le code affiché est tronqué pour des raisons techniques. Pour obtenir le code complet, utilisez le bouton Copier.',
    showCode: false,
    code: "//@version=6\n" +
          "// Indicator title and short title\n" +
          "// ________________________________________________________________________________________________________________________________           \n" +
          "indicator('Multi-Timeframe Trend Indicator', shorttitle = 'MTFTI', overlay = true)\n" +
          "\n" +
          "// Option to enable/disable candlestick colouring (default = false)\n" +
          "// ________________________________________________________________________________________________________________________________    \n" +
          "useCandleColoring = input.bool(false, title = 'Enable candlestick coloring?')\n" +
          "\n" +
          "// Added option to select moving average type\n" +
          "// ________________________________________________________________________________________________________________________________     \n" +
          "maType = input.string(title = 'Moving Average Type', defval = 'EMA', options = ['SMA', 'EMA', 'WMA', 'AMA'])\n" +
          "\n" +
          "// Table position input\n" +
          "// ________________________________________________________________________________________________________________________________     \n" +
          "tablePosition = input.string(title = 'Table Position', defval = 'bottom_right', options = ['top_left', 'top_right', 'middle_left', 'middle_right', 'bottom_left', 'bottom_right'])\n" +
          "\n" +
          "// Select the timeframes to be displayed in the table\n" +
          "// ________________________________________________________________________________________________________________________________    \n" +
          "showTf1 = input(false, title = 'Show 1min')\n" +
          "showTf2 = input(false, title = 'Show 2min')\n" +
          "showTf3 = input(false, title = 'Show 3min')\n" +
          "showTf4 = input(true, title = 'Show 5min')\n" +
          "showTf5 = input(false, title = 'Show 10min')\n" +
          "showTf6 = input(true, title = 'Show 15min')\n" +
          "showTf7 = input(true, title = 'Show 30min')\n" +
          "showTf8 = input(true, title = 'Show 1H')\n" +
          "showTf9 = input(true, title = 'Show 2H')\n" +
          "showTf10 = input(true, title = 'Show 4H')\n" +
          "showTf11 = input(true, title = 'Show 6H')\n" +
          "showTf12 = input(true, title = 'Show 12H')\n" +
          "showTf13 = input(true, title = 'Show 1 Day')\n" +
          "showTf14 = input(true, title = 'Show 1 week')\n" +
          "showTf15 = input(true, title = 'Show AVG')\n\n" +
          "// [...Code tronqué pour la présentation...]\n" +
          "// Pour obtenir le code complet, utilisez le bouton Copier ci-dessus."
  },
  {
    name: 'Points Pivots Stratégie Gap & Pivots NY',
    description: 'Indicateur personnalisé qui calcule les points pivots et détecte les signaux basés sur les gaps et les niveaux de support/résistance. Note: Le code affiché est tronqué pour des raisons techniques. Pour obtenir le code complet, utilisez le bouton Copier.',
    showCode: false,
    code: "//@version=6\n" +
          "indicator(\"Stratégie Gap & Pivots NY\", overlay=true, dynamic_requests=true)\n" +
          "\n" +
          "// Paramètres\n" +
          "show_pivots = input.bool(true, \"Afficher les points pivots\")\n" +
          "gap_threshold = input.float(0.05, \"Seuil de Gap (%)\", minval=0.01, step=0.01)\n" +
          "showMainTable = input.bool(true, \"Afficher tableau principal\", group=\"Affichage des tableaux\")\n" +
          "showBreakthroughTable = input.bool(true, \"Afficher statistiques de niveaux\", group=\"Affichage des tableaux\")\n" +
          "\n" +
          "// Variables globales\n" +
          "var float last_ny_close = na  // Déclaration de la variable pour le dernier prix de fermeture NY\n" +
          "var float gap_pct = 0.0  // Variable pour stocker le pourcentage de gap\n" +
          "var string gap_direction_text = \"Neutre\"\n" +
          "var color gap_color = color.gray\n" +
          "var bool signal_buy_in_current_session = false  // Signal d'achat dans la session actuelle\n" +
          "var bool signal_sell_in_current_session = false  // Signal de vente dans la session actuelle\n\n" +
          "// [...Code tronqué pour la présentation...]\n" +
          "// Pour obtenir le code complet, utilisez le bouton Copier ci-dessus."
  },
  {
    name: 'RSI + STOCH Combined',
    description: 'Indicateur personnalisé combinant RSI et Stochastique avec détection des divergences et multiples options de paramétrage.',
    showCode: false,
    code: "//@version=6\n" +
          "indicator(title=\"RSI + Stochastic Combined\", shorttitle=\"RSI+Stoch\", format=format.price, precision=2, timeframe=\"\", timeframe_gaps=true)\n" +
          "\n" +
          "// Groupe de paramètres RSI\n" +
          "group_rsi = \"Paramètres RSI\"\n" +
          "rsiLengthInput = input.int(14, minval=1, title=\"RSI Length\", group=group_rsi)\n" +
          "rsiSourceInput = input.source(close, \"Source\", group=group_rsi)\n" +
          "calculateDivergence = input.bool(false, title=\"Calculate Divergence\", group=group_rsi, display = display.data_window, tooltip = \"Calculating divergences is needed in order for divergence alerts to fire.\")\n" +
          "\n" +
          "// Groupe de paramètres Stochastique\n" +
          "group_stoch = \"Paramètres Stochastique\"\n" +
          "periodK = input.int(14, title=\"%K Length\", minval=1, group=group_stoch)\n" +
          "smoothK = input.int(1, title=\"%K Smoothing\", minval=1, group=group_stoch)\n" +
          "periodD = input.int(3, title=\"%D Smoothing\", minval=1, group=group_stoch)\n" +
          "\n" +
          "// Calcul du RSI\n" +
          "change = ta.change(rsiSourceInput)\n" +
          "up = ta.rma(math.max(change, 0), rsiLengthInput)\n" +
          "down = ta.rma(-math.min(change, 0), rsiLengthInput)\n" +
          "rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))\n" +
          "\n" +
          "// Calcul du Stochastique\n" +
          "k = ta.sma(ta.stoch(close, high, low, periodK), smoothK)\n" +
          "d = ta.sma(k, periodD)\n" +
          "\n" +
          "// [...Code tronqué pour la présentation...]\n" +
          "// Pour obtenir le code complet, utilisez le bouton Copier ci-dessus."
  }
]);

// Fonction pour copier le code dans le presse-papiers et afficher une notification
const copyCode = (code: string) => {
  navigator.clipboard.writeText(code.trim());
  copiedMessage.value = 'Code complet copié !';
  setTimeout(() => {
    copiedMessage.value = '';
  }, 2000);
};
</script>

<template>
  <div class="bg-white shadow-lg rounded-xl p-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Ma Stratégie de Trading</h2>
    
    <!-- Navigation par onglets -->
    <div class="flex border-b mb-6">
      <button 
        v-for="tab in tabs" 
        :key="tab.id" 
        @click="activeTab = tab.id"
        class="px-4 py-2 font-medium text-sm focus:outline-none"
        :class="activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'"
      >
        {{ tab.label }}
      </button>
    </div>
    
    <!-- Contenu des onglets -->
    <div v-if="activeTab === 'regles'" class="space-y-6">
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Points Pivots</h3>
        <ul class="space-y-2 list-disc pl-5 text-gray-700">
          <li>Entrée Breakout Points pivots Daily ou Weekly M5</li>
          <li>Entrée rejet / rebond sur un PP</li>
        </ul>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Arguments Supplémentaires</h3>
        <ul class="space-y-2 list-disc pl-5 text-gray-700">
          <li>Vague de Wolfe (retournement de tendance)</li>
          <li>Fibonacci 61,8% (pullback dessus puis TP 100%)</li>
          <li>EMA20 et EMA50 croisement clair</li>
        </ul>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Horaires de Trading</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-2">Marché Européen</h4>
            <p class="text-base font-medium text-gray-900">9H-16H</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-2">Marché Américain</h4>
            <p class="text-base font-medium text-gray-900">15H30-21H</p>
            <p class="text-xs text-gray-500 mt-1">Pas de prise de position avant ni après, BE à la clôture</p>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="activeTab === 'plan'" class="space-y-6">
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Critères d'Entrée</h3>
        
        <div class="space-y-4">
          <div class="bg-blue-50 border-l-4 border-blue-500 p-3">
            <h4 class="font-bold text-blue-800">OBLIGATOIRE <span class="text-yellow-500">★</span></h4>
            <ul class="list-disc pl-5 text-gray-700 space-y-1">
              <li>Position uniquement dans le sens du gap d'ouverture</li>
              <li>Pas de News</li>
              <li>1 SL max par session</li>
            </ul>
          </div>
          
          <div class="bg-indigo-50 border-l-4 border-indigo-500 p-3">
            <h4 class="font-bold text-indigo-800">IMPORTANT <span class="text-yellow-500">★★</span></h4>
            <ul class="list-disc pl-5 text-gray-700 space-y-1">
              <li>Cassage du PP Daily ou Weekly</li>
              <li>Sens de la tendance H1</li>
              <li>BE directement après cassage d'une R ou S</li>
              <li>Stochastique > 50</li>
            </ul>
          </div>
          
          <div class="bg-purple-50 border-l-4 border-purple-500 p-3">
            <h4 class="font-bold text-purple-800">NÉCESSAIRE <span class="text-yellow-500">★★★</span></h4>
            <ul class="list-disc pl-5 text-gray-700 space-y-1">
              <li>Signal sans équivoque</li>
              <li>Plus de position 1H avant la fermeture du marché</li>
              <li>Position confirmée avec 2 bougies dans le même sens</li>
            </ul>
          </div>
          
          <div class="bg-green-50 border-l-4 border-green-500 p-3">
            <h4 class="font-bold text-green-800">FAVORABLE <span class="text-yellow-500">★★★★</span></h4>
            <ul class="list-disc pl-5 text-gray-700 space-y-1">
              <li>2R sans obstacle</li>
              <li>Entrée sur rejet (avec autres conditions)</li>
            </ul>
          </div>
          
          <div class="bg-teal-50 border-l-4 border-teal-500 p-3">
            <h4 class="font-bold text-teal-800">OPTIMAL <span class="text-yellow-500">★★★★★</span></h4>
            <ul class="list-disc pl-5 text-gray-700 space-y-1">
              <li>Aucun PP en dessous du prix ou autres obstacles</li>
              <li>Laisser courir les gains</li>
              <li>Premier rebond de la journée sur le PP</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Critères de Sortie</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-blue-600 mb-2">Prises de Profit</h4>
            <ul class="list-disc pl-5 text-gray-700 space-y-1">
              <li>Objectif de Résistance ou Support atteint</li>
              <li>TP sur R5 ou S5</li>
              <li>TrailingStop agressif</li>
            </ul>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-red-600 mb-2">Gestion de Risque</h4>
            <ul class="list-disc pl-5 text-gray-700 space-y-1">
              <li>1 SL max par session</li>
              <li>BE après cassage R/S</li>
              <li>Trailing stop non agressif hors période de cotation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="activeTab === 'statistiques'" class="space-y-6">
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Caractéristiques Temporelles</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Durée Moyenne</h4>
            <p class="text-xl font-bold text-gray-900">20h</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Durée Médiane</h4>
            <p class="text-xl font-bold text-gray-900">17h</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Minimum</h4>
            <p class="text-xl font-bold text-gray-900">15min</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Maximum</h4>
            <p class="text-xl font-bold text-gray-900">140h</p>
          </div>
        </div>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Frais et Coûts</h3>
        <div class="space-y-3">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <div class="flex justify-between items-center">
              <h4 class="text-sm font-medium text-gray-700">Swap et spread (coûts totaux)</h4>
              <span class="text-sm font-medium text-red-600">-10% de performance</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div class="bg-red-500 h-2 rounded-full" style="width: 10%"></div>
            </div>
          </div>
          
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Répartition des swaps</h4>
            <p class="text-sm text-gray-600 mb-2">47% des trades gagnants ont des frais de swap</p>
            <div class="space-y-2">
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-xs text-gray-600">1 nuit</span>
                  <span class="text-xs text-gray-600">59%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                  <div class="bg-blue-400 h-1.5 rounded-full" style="width: 59%"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-xs text-gray-600">2 nuits</span>
                  <span class="text-xs text-gray-600">15%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                  <div class="bg-blue-400 h-1.5 rounded-full" style="width: 15%"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-xs text-gray-600">Weekend</span>
                  <span class="text-xs text-gray-600">25%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                  <div class="bg-blue-400 h-1.5 rounded-full" style="width: 25%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Ratios de Performance</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Win Rate Global</h4>
            <p class="text-xl font-bold text-green-600">83%</p>
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>Win: 57%</span>
              <span>BE: 26%</span>
              <span>Loss: 17%</span>
            </div>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Profit Factor</h4>
            <p class="text-xl font-bold text-green-600">12.2</p>
            <p class="text-xs text-gray-500 mt-1">Exceptionnel (>3 est excellent)</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Gain Moyen</h4>
            <p class="text-xl font-bold text-green-600">1.9R</p>
            <p class="text-xs text-gray-500 mt-1">1.65R net après frais</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Ratio Gain/Perte</h4>
            <p class="text-xl font-bold text-green-600">3.6</p>
            <p class="text-xs text-gray-500 mt-1">Excellent (>2 est bon)</p>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="activeTab === 'performance'" class="space-y-6">
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Performance Globale</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Total Trades</h4>
            <p class="text-xl font-bold text-gray-900">361</p>
            <p class="text-xs text-gray-500 mt-1">Sur 3 ans et 8 mois</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Gain Total</h4>
            <p class="text-xl font-bold text-green-600">600R</p>
            <p class="text-xs text-gray-500 mt-1">Incluant 90R de swap/spread</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Trades/Mois</h4>
            <p class="text-xl font-bold text-gray-900">8</p>
            <p class="text-xs text-gray-500 mt-1">En moyenne</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Drawdown Max</h4>
            <p class="text-xl font-bold text-red-600">4R</p>
            <p class="text-xs text-gray-500 mt-1">Extrêmement faible</p>
          </div>
        </div>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Ratios Avancés</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Ratio de Calmar</h4>
            <p class="text-xl font-bold text-green-600">~40</p>
            <p class="text-xs text-gray-500 mt-1">Exceptionnel (>3 est excellent)</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Ratio de Sharpe</h4>
            <p class="text-xl font-bold text-green-600">~8.1</p>
            <p class="text-xs text-gray-500 mt-1">Exceptionnel (>2 est bon)</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Rendement Annualisé</h4>
            <p class="text-xl font-bold text-green-600">~158R</p>
            <p class="text-xs text-gray-500 mt-1">Sur la base de 8 trades/mois</p>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-gray-500 mb-1">Risk of Ruin</h4>
            <p class="text-xl font-bold text-green-600">~0%</p>
            <p class="text-xs text-gray-500 mt-1">Virtuellement nul</p>
          </div>
        </div>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Points Forts & Axes d'Amélioration</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-green-50 p-3 rounded-lg shadow-sm border-l-4 border-green-500">
            <h4 class="text-sm font-medium text-green-800 mb-2">Points Forts</h4>
            <ul class="list-disc pl-4 text-sm text-gray-700 space-y-1">
              <li>Rentabilité très élevée (1.65R net/trade)</li>
              <li>Excellente gestion du risque (Drawdown 4R)</li>
              <li>Ratios de performance exceptionnels</li>
              <li>Frais bien maîtrisés</li>
              <li>1 trade sur 5 fait plus de 5R</li>
            </ul>
          </div>
          <div class="bg-amber-50 p-3 rounded-lg shadow-sm border-l-4 border-amber-500">
            <h4 class="text-sm font-medium text-amber-800 mb-2">Axes d'Amélioration</h4>
            <ul class="list-disc pl-4 text-sm text-gray-700 space-y-1">
              <li>Taux élevé de Break Even (26%)</li>
              <li>Optimiser l'exécution des setups</li>
              <li>Analyser les trades très performants (>5R)</li>
              <li>Réduire l'impact des swaps sur weekend</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Nouvel onglet Indicateurs -->
    <div v-if="activeTab === 'indicateurs'" class="space-y-6">
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Mes Indicateurs Techniques</h3>
        <p class="text-sm text-gray-600 mb-4">Liste des indicateurs utilisés dans ma stratégie avec leur code source. Cliquez sur un indicateur pour voir son code.</p>
        
        <!-- Note informative pour les codes complets -->
        <div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4">
          <h4 class="font-medium text-blue-800">Important</h4>
          <p class="text-sm text-gray-700">Seule une partie du code des indicateurs complexes (MTFI et Points Pivots) est affichée dans l'interface pour des raisons de lisibilité. Lorsque vous cliquez sur le bouton <span class="font-bold">Copier</span>, <span class="font-bold text-blue-800">l'intégralité du code de l'indicateur est copiée dans votre presse-papiers</span>, pas seulement la partie visible.</p>
        </div>
        
        <!-- Message de confirmation de copie -->
        <div v-if="copiedMessage" class="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-all duration-300">
          {{ copiedMessage }}
        </div>
        
        <div class="space-y-4">
          <div v-for="(indicator, index) in indicators" :key="index" class="bg-white rounded-lg shadow-sm overflow-hidden">
            <div class="p-4 cursor-pointer" @click="indicator.showCode = !indicator.showCode">
              <div class="flex justify-between items-center">
                <h4 class="text-md font-semibold text-blue-700">{{ indicator.name }}</h4>
                <button 
                  class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-2 rounded transition-colors"
                  @click.stop="copyCode(indicator.code)"
                >
                  Copier
                </button>
              </div>
              <p class="text-sm text-gray-600 mt-1">{{ indicator.description }}</p>
            </div>
            <div 
              v-show="indicator.showCode" 
              class="bg-gray-800 text-gray-200 p-4 overflow-x-auto"
            >
              <pre class="text-xs"><code>{{ indicator.code }}</code></pre>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-gray-50 rounded-lg shadow p-4">
        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Ressources et Documentation</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-blue-600 mb-2">TradingView Pine Script</h4>
            <p class="text-xs text-gray-600 mb-2">Documentation officielle pour les scripts personnalisés:</p>
            <a href="https://www.tradingview.com/pine-script-reference/" target="_blank" class="text-blue-500 hover:underline text-sm">Documentation Pine Script</a>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <h4 class="text-sm font-medium text-green-600 mb-2">Backtesting et Optimisation</h4>
            <p class="text-xs text-gray-600 mb-2">Outils pour tester et optimiser les indicateurs:</p>
            <a href="https://www.tradingview.com/chart/" target="_blank" class="text-blue-500 hover:underline text-sm">TradingView Charts</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shadow-sm {
  transition: all 0.2s ease;
}
.shadow-sm:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}
</style> 