<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTradingStore } from '../stores/trading';
import type { Trade } from '../types/trading';

const tradingStore = useTradingStore();

// État du calendrier
const currentDate = ref(new Date());
const selectedMonth = ref(currentDate.value.getMonth());
const selectedYear = ref(currentDate.value.getFullYear());

// Navigation dans le calendrier
function previousMonth() {
  if (selectedMonth.value === 0) {
    selectedMonth.value = 11;
    selectedYear.value--;
  } else {
    selectedMonth.value--;
  }
}

function nextMonth() {
  if (selectedMonth.value === 11) {
    selectedMonth.value = 0;
    selectedYear.value++;
  } else {
    selectedMonth.value++;
  }
}

function goToCurrentMonth() {
  const now = new Date();
  selectedMonth.value = now.getMonth();
  selectedYear.value = now.getFullYear();
}

// Génération des jours du mois
const daysInMonth = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value + 1, 0).getDate();
});

const firstDayOfMonth = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value, 1).getDay();
});

const monthName = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value, 1).toLocaleString('fr-FR', { month: 'long' });
});

// S'assurer que les dates sont bien des objets Date
function ensureDateFormat(trade: Trade): Trade {
  return {
    ...trade,
    entryDate: trade.entryDate instanceof Date ? trade.entryDate : new Date(trade.entryDate),
    exitDate: trade.exitDate instanceof Date ? trade.exitDate : new Date(trade.exitDate)
  };
}

// Traitement des trades pour le calendrier
const tradesByDay = computed(() => {
  const tradesMap = new Map();
  
  if (!tradingStore.trading || !tradingStore.trading.trades) {
    return tradesMap;
  }
  
  tradingStore.trading.trades.forEach(rawTrade => {
    const trade = ensureDateFormat(rawTrade);
    const exitDate = trade.exitDate;
    const day = exitDate.getDate();
    const month = exitDate.getMonth();
    const year = exitDate.getFullYear();
    
    if (month === selectedMonth.value && year === selectedYear.value) {
      if (!tradesMap.has(day)) {
        tradesMap.set(day, {
          wins: 0,
          losses: 0,
          breakEven: 0,
          total: 0,
          netProfitLoss: 0
        });
      }
      
      const dayData = tradesMap.get(day);
      dayData.total += 1;
      dayData.netProfitLoss += trade.profitLoss;
      
      if (trade.profitLoss > 0) {
        dayData.wins += 1;
      } else if (trade.profitLoss < 0) {
        dayData.losses += 1;
      } else {
        dayData.breakEven += 1;
      }
    }
  });
  
  return tradesMap;
});

// Statistiques mensuelles
const monthlyStats = computed(() => {
  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  let netProfitLoss = 0;
  let tradingDays = 0;
  let bestDay = { day: 0, profit: 0 };
  let worstDay = { day: 0, loss: 0 };
  
  tradesByDay.value.forEach((dayData, day) => {
    wins += dayData.wins;
    losses += dayData.losses;
    breakEven += dayData.breakEven;
    netProfitLoss += dayData.netProfitLoss;
    tradingDays += 1;
    
    // Trouver le meilleur et le pire jour
    if (dayData.netProfitLoss > bestDay.profit) {
      bestDay = { day, profit: dayData.netProfitLoss };
    }
    if (dayData.netProfitLoss < worstDay.loss) {
      worstDay = { day, loss: dayData.netProfitLoss };
    }
  });
  
  return {
    wins,
    losses,
    breakEven,
    total: wins + losses + breakEven,
    netProfitLoss,
    tradingDays,
    winRate: wins > 0 && (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
    bestDay,
    worstDay,
    averageTradesPerDay: tradingDays > 0 ? (wins + losses + breakEven) / tradingDays : 0
  };
});

function getDayClass(day: number) {
  if (!tradesByDay.value.has(day)) {
    return 'bg-gray-50 text-gray-400';
  }
  
  const dayData = tradesByDay.value.get(day);
  
  // Accentuer davantage les couleurs en fonction de la performance
  if (dayData.netProfitLoss > 0) {
    // Performance positive - dégradé de vert plus contrasté
    if (dayData.netProfitLoss > 5) {
      return 'bg-green-700 text-white font-bold';
    } else if (dayData.netProfitLoss > 2) {
      return 'bg-green-600 text-white font-medium';
    } else {
      return 'bg-green-500 text-white font-medium';
    }
  } else if (dayData.netProfitLoss < 0) {
    // Performance négative - dégradé de rouge plus contrasté
    if (dayData.netProfitLoss < -5) {
      return 'bg-red-700 text-white font-bold';
    } else if (dayData.netProfitLoss < -2) {
      return 'bg-red-600 text-white font-medium';
    } else {
      return 'bg-red-500 text-white font-medium';
    }
  } else {
    return 'bg-blue-300 text-blue-900 font-medium';
  }
}

function getDaySummary(day: number) {
  if (!tradesByDay.value.has(day)) {
    return '';
  }
  
  const dayData = tradesByDay.value.get(day);
  
  return `${dayData.wins}W ${dayData.losses}L ${dayData.breakEven}BE`;
}

// Génération du calendrier
const calendarDays = computed(() => {
  const days = [];
  const prevMonthDays = new Date(selectedYear.value, selectedMonth.value, 0).getDate();
  
  // Jours du mois précédent
  for (let i = 1; i <= firstDayOfMonth.value; i++) {
    const prevDay = prevMonthDays - firstDayOfMonth.value + i;
    days.push({
      day: prevDay,
      isCurrentMonth: false,
      isToday: false
    });
  }
  
  // Jours du mois actuel
  const today = new Date();
  const isCurrentMonth = today.getMonth() === selectedMonth.value && today.getFullYear() === selectedYear.value;
  
  for (let i = 1; i <= daysInMonth.value; i++) {
    days.push({
      day: i,
      isCurrentMonth: true,
      isToday: isCurrentMonth && i === today.getDate()
    });
  }
  
  // Calculer combien de jours nous devons ajouter pour compléter la grille (multiple de 7)
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isToday: false
      });
    }
  }
  
  return days;
});

onMounted(() => {
  // S'assurer que le store est correctement initialisé
  if (!tradingStore.trading || !tradingStore.trading.trades) {
    console.warn('Trading store not initialized correctly');
  }
});
</script>

<template>
  <div class="bg-white shadow-lg rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-3 flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      Calendrier de Trading
    </h2>
    
    <!-- Navigation du calendrier -->
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-3 space-y-3 md:space-y-0">
      <div class="flex items-center space-x-2">
        <button @click="previousMonth" class="p-1 rounded-full hover:bg-gray-200 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 class="text-md font-medium text-gray-900 capitalize">{{ monthName }} {{ selectedYear }}</h3>
        <button @click="nextMonth" class="p-1 rounded-full hover:bg-gray-200 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button @click="goToCurrentMonth" class="ml-4 px-3 py-1 text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors">
          Aujourd'hui
        </button>
      </div>
      
      <!-- Légende améliorée et compacte -->
      <div class="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        <div class="flex items-center">
          <div class="w-3 h-3 bg-green-700 border border-green-800 rounded-full mr-1"></div>
          <span class="text-gray-600">Gain fort (>5%)</span>
        </div>
        <div class="flex items-center">
          <div class="w-3 h-3 bg-green-600 border border-green-700 rounded-full mr-1"></div>
          <span class="text-gray-600">Gain moyen (2-5%)</span>
        </div>
        <div class="flex items-center">
          <div class="w-3 h-3 bg-green-500 border border-green-600 rounded-full mr-1"></div>
          <span class="text-gray-600">Gain faible (<2%)</span>
        </div>
        <div class="flex items-center">
          <div class="w-3 h-3 bg-red-700 border border-red-800 rounded-full mr-1"></div>
          <span class="text-gray-600">Perte forte (>5%)</span>
        </div>
        <div class="flex items-center">
          <div class="w-3 h-3 bg-red-600 border border-red-700 rounded-full mr-1"></div>
          <span class="text-gray-600">Perte moyenne (2-5%)</span>
        </div>
        <div class="flex items-center">
          <div class="w-3 h-3 bg-red-500 border border-red-600 rounded-full mr-1"></div>
          <span class="text-gray-600">Perte faible (<2%)</span>
        </div>
        <div class="flex items-center col-span-3 mt-1 justify-center">
          <div class="w-3 h-3 bg-blue-300 border border-blue-400 rounded-full mr-1"></div>
          <span class="text-gray-600">Break Even (0%)</span>
        </div>
      </div>
    </div>
    
    <!-- Grille du calendrier -->
    <div class="border border-gray-200 rounded-lg overflow-hidden">
      <!-- Jours de la semaine -->
      <div class="grid grid-cols-7 bg-gray-100">
        <div v-for="day in ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']" :key="day" class="py-1 text-center text-xs font-medium text-gray-700">
          {{ day }}
        </div>
      </div>
      
      <!-- Jours du mois -->
      <div class="grid grid-cols-7">
        <div 
          v-for="(dayInfo, index) in calendarDays" 
          :key="index" 
          class="h-16 border border-gray-200 p-1 relative transition-all hover:bg-gray-50"
          :class="[
            dayInfo.isCurrentMonth ? (dayInfo.isToday ? 'ring-2 ring-indigo-500 ring-inset' : '') : 'text-gray-400 bg-gray-50'
          ]"
        >
          <div class="flex flex-col h-full">
            <div class="text-xs font-medium ml-1">{{ dayInfo.day }}</div>
            
            <div v-if="dayInfo.isCurrentMonth && tradesByDay.has(dayInfo.day)" class="flex-1 mt-1">
              <div 
                class="w-full h-full rounded p-1 text-xs flex flex-col justify-between"
                :class="getDayClass(dayInfo.day)"
              >
                <div class="font-medium">{{ getDaySummary(dayInfo.day) }}</div>
                <div class="text-right">
                  <span v-if="tradesByDay.get(dayInfo.day).netProfitLoss !== 0" class="font-bold" 
                    :class="{ 
                      'text-white': (tradesByDay.get(dayInfo.day).netProfitLoss > 5 || tradesByDay.get(dayInfo.day).netProfitLoss < -5) || 
                                    (tradesByDay.get(dayInfo.day).netProfitLoss > 2 || tradesByDay.get(dayInfo.day).netProfitLoss < -2),
                      'text-green-900': tradesByDay.get(dayInfo.day).netProfitLoss > 0 && tradesByDay.get(dayInfo.day).netProfitLoss <= 2,
                      'text-red-900': tradesByDay.get(dayInfo.day).netProfitLoss < 0 && tradesByDay.get(dayInfo.day).netProfitLoss >= -2
                    }">
                    {{ tradesByDay.get(dayInfo.day).netProfitLoss > 0 ? '+' : '' }}{{ tradesByDay.get(dayInfo.day).netProfitLoss.toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Statistiques mensuelles -->
    <div class="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div class="bg-gray-50 rounded-lg p-2 flex flex-col items-center justify-center">
        <span class="text-xs text-gray-500">Jours de Trading</span>
        <span class="text-lg font-bold text-gray-900">{{ monthlyStats.tradingDays }}</span>
        <span class="text-xs text-gray-500">{{ monthlyStats.averageTradesPerDay.toFixed(1) }} trades/jour</span>
      </div>
      <div class="bg-gray-50 rounded-lg p-2 flex flex-col items-center justify-center">
        <span class="text-xs text-gray-500">Total Trades</span>
        <span class="text-lg font-bold text-gray-900">{{ monthlyStats.total }}</span>
        <span class="text-xs text-gray-500">Ce mois</span>
      </div>
      <div class="bg-green-50 rounded-lg p-2 flex flex-col items-center justify-center">
        <div class="flex items-center justify-center">
          <span class="text-xs text-gray-500 mr-1">Trades Gagnants</span>
          <span class="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">{{ Math.round((monthlyStats.wins / monthlyStats.total) * 100) || 0 }}%</span>
        </div>
        <span class="text-lg font-bold text-green-600">{{ monthlyStats.wins }}</span>
        <span class="text-xs text-gray-500">Win Rate: {{ monthlyStats.winRate.toFixed(1) }}%</span>
      </div>
      <div class="bg-red-50 rounded-lg p-2 flex flex-col items-center justify-center">
        <div class="flex items-center justify-center">
          <span class="text-xs text-gray-500 mr-1">Trades Perdants</span>
          <span class="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">{{ Math.round((monthlyStats.losses / monthlyStats.total) * 100) || 0 }}%</span>
        </div>
        <span class="text-lg font-bold text-red-600">{{ monthlyStats.losses }}</span>
        <span class="text-xs text-gray-500">BE: {{ monthlyStats.breakEven }} ({{ Math.round((monthlyStats.breakEven / monthlyStats.total) * 100) || 0 }}%)</span>
      </div>
      <div class="bg-indigo-50 rounded-lg p-2 flex flex-col items-center justify-center">
        <span class="text-xs text-gray-500">Performance</span>
        <span class="text-lg font-bold" :class="monthlyStats.netProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'">
          {{ monthlyStats.netProfitLoss > 0 ? '+' : '' }}{{ monthlyStats.netProfitLoss.toFixed(1) }}%
        </span>
        <div class="grid grid-cols-2 gap-2 w-full">
          <div v-if="monthlyStats.bestDay.day > 0" class="text-xs text-center">
            <span class="text-green-700">+{{ monthlyStats.bestDay.profit.toFixed(1) }}%</span>
            <span class="text-gray-500 block">J{{ monthlyStats.bestDay.day }}</span>
          </div>
          <div v-if="monthlyStats.worstDay.day > 0" class="text-xs text-center">
            <span class="text-red-700">{{ monthlyStats.worstDay.loss.toFixed(1) }}%</span>
            <span class="text-gray-500 block">J{{ monthlyStats.worstDay.day }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-day-trades {
  @apply absolute bottom-1 right-1 flex items-center justify-center;
}
</style> 