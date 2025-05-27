<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useSettingsStore } from '../stores/settings';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const mobileMenuOpen = ref(false);
const showSettingsModal = ref(false);
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const showExternalLinks = ref(false);

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Trades', href: '/trades' },
  { name: 'Crypto', href: '/crypto' },
  { name: 'Long Term', href: '/long-term' },
  { name: 'Ressources', href: '/resources' },
  { name: 'Macro', href: '/macro' },
];

const externalLinks = [
  { name: 'CoinMarketCap', href: 'https://coinmarketcap.com', icon: 'M12.29 10.18c-.5.28-1.07.5-1.29.5-.21 0-.77-.22-1.28-.5-.86-.47-1.73-.94-2.75-.94s-1.89.47-2.75.94c-.5.28-1.07.5-1.28.5s-.78-.22-1.29-.5c-.86-.47-1.73-.94-2.75-.94v1.5c.21 0 .77.22 1.28.5.86.47 1.73.94 2.75.94s1.89-.47 2.75-.94c.5-.28 1.07-.5 1.28-.5.22 0 .78.22 1.29.5.86.47 1.73.94 2.75.94s1.89-.47 2.75-.94c.5-.28 1.07-.5 1.28-.5s.78.22 1.29.5c.86.47 1.73.94 2.75.94v-1.5c-.21 0-.77-.22-1.28-.5-.86-.47-1.73-.94-2.75-.94s-1.89.47-2.75.94z' },
  { name: 'Investing.com', href: 'https://investing.com', icon: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm4 7a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0-1-1zm5-3a1 1 0 0 0-1 1v7a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1zm5 2a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1z' },
  { name: 'FundedNext', href: 'https://fundednext.com', icon: 'M10.02 3.28C9.36 3.1 8.7 3 8 3 4.69 3 2 5.69 2 9c0 1.47.7 2.83 1.83 3.76L6 15V9H4V5h4v4H6l2.25 3H11l6-7.5V3h-4v2h1.1l-4.1 5.14V3.28z' },
  { name: 'Bloomberg', href: 'https://bloomberg.com', icon: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5H5zm8 2h1a5 5 0 0 1 1 9.88V18H8V6h1v10h4v-1.12A5 5 0 0 1 13 7zm1 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  { name: 'BoursoBank', href: 'https://www.boursobank.com', icon: 'M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm12 4v4h4V7h-4zm0 6v4h4v-4h-4zM5 7v4h4V7H5zm0 6v4h4v-4H5z' },
  { name: 'Binance', href: 'https://www.binance.com', icon: 'M12 22l-2.5-2.5 7-7 2.5 2.5-7 7zm-8.5-8.5l2.5-2.5 7 7-2.5 2.5-7-7zm7-7l7 7-2.5 2.5-7-7L10.5 6.5zM12 1L9.5 3.5l2.5 2.5 2.5-2.5L12 1z' }
];

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value;
}

function toggleExternalLinks() {
  showExternalLinks.value = !showExternalLinks.value;
}

function isActiveRoute(path: string): boolean {
  if (path === '/' && route.path === '/') {
    return true;
  }
  if (path !== '/' && route.path.startsWith(path)) {
    return true;
  }
  return false;
}

function handleLogout() {
  authStore.logout();
}
</script>

<template>
  <nav class="bg-white bg-opacity-95 shadow-lg border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex">
          <div class="flex-shrink-0 flex items-center">
            <RouterLink to="/" class="flex items-center">
              <div class="w-10 h-10 mr-2">
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="45" fill="#2EB8AC"/>
                  <path d="M28 65H35V75H28V65Z" fill="white"/>
                  <path d="M40 55H47V75H40V55Z" fill="white"/>
                  <path d="M52 45H59V75H52V45Z" fill="white"/>
                  <path d="M64 35H71V75H64V35Z" fill="white"/>
                  <path d="M27 50L48 30L72 50" stroke="white" stroke-width="4" stroke-linecap="round"/>
                  <circle cx="72" cy="30" r="5" fill="white"/>
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-gray-900">Quantify</h1>
            </RouterLink>
          </div>
          <div class="hidden sm:ml-6 sm:flex sm:space-x-6">
            <!-- Bouton de connexion/déconnexion -->
            <RouterLink v-if="!authStore.isAuthenticated"
                  to="/"
                  class="text-gray-600 hover:text-indigo-700 hover:border-b-2 hover:border-indigo-300 inline-flex items-center px-1 pt-1 text-sm font-medium h-16">
              <svg class="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Connexion
            </RouterLink>
            <button v-else
                  @click="handleLogout"
                  class="text-gray-600 hover:text-indigo-700 hover:border-b-2 hover:border-indigo-300 inline-flex items-center px-1 pt-1 text-sm font-medium h-16">
              <svg class="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
            
            <!-- Navigation principale - visible seulement si connecté -->
            <RouterLink 
              v-if="authStore.isAuthenticated"
              v-for="item in navigation" 
              :key="item.name" 
              :to="item.href" 
              :class="[
                isActiveRoute(item.href)
                  ? 'border-b-2 border-indigo-500 text-indigo-700' 
                  : 'text-gray-600 hover:text-indigo-700 hover:border-b-2 hover:border-indigo-300',
                'inline-flex items-center px-1 pt-1 text-sm font-medium h-16'
              ]"
            >
              {{ item.name }}
            </RouterLink>
          </div>
        </div>
        <!-- Liens externes - visible seulement si connecté -->
        <div v-if="authStore.isAuthenticated" class="flex items-center">
          <div class="relative">
            <button 
              @click="toggleExternalLinks"
              class="p-2 rounded-full text-gray-600 hover:text-indigo-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <span class="sr-only">Liens Externes</span>
              <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            
            <!-- Dropdown menu for external links -->
            <div v-if="showExternalLinks" class="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-10">
              <div class="py-1" role="none">
                <a 
                  v-for="link in externalLinks" 
                  :key="link.name" 
                  :href="link.href" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <svg class="mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="link.icon" />
                  </svg>
                  {{ link.name }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="sm:hidden"
      id="mobile-menu"
      v-show="mobileMenuOpen"
    >
      <div class="pt-2 pb-3 space-y-1">
        <!-- Bouton de connexion/déconnexion mobile -->
        <RouterLink
          v-if="!authStore.isAuthenticated"
          to="/"
          class="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 text-base font-medium"
        >
          <div class="flex items-center">
            <svg class="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Connexion
          </div>
        </RouterLink>
        <button
          v-else
          @click="handleLogout"
          class="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 text-base font-medium"
        >
          <div class="flex items-center">
            <svg class="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Déconnexion
          </div>
        </button>

        <!-- Navigation mobile - visible seulement si connecté -->
        <template v-if="authStore.isAuthenticated">
          <router-link
            to="/dashboard"
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            :class="[route.path === '/dashboard' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700']"
          >
            Tableau de Bord
          </router-link>
          <router-link
            to="/trades"
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            :class="[route.path === '/trades' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700']"
          >
            Trades
          </router-link>
          <router-link
            to="/crypto"
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            :class="[route.path === '/crypto' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700']"
          >
            Crypto
          </router-link>
          <router-link
            to="/long-term"
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            :class="[route.path === '/long-term' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700']"
          >
            Long Terme
          </router-link>
          <router-link
            to="/resources"
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            :class="[route.path === '/resources' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700']"
          >
            Ressources
          </router-link>
          <router-link
            to="/macro"
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            :class="[route.path === '/macro' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700']"
          >
            Macro
          </router-link>
        </template>
      </div>
    </div>

    <!-- Modal des paramètres -->
    <div v-if="showSettingsModal" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Paramètres</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Thème</label>
                <select 
                  v-model="settingsStore.theme"
                  class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="light">Clair</option>
                  <option value="dark">Sombre</option>
                  <option value="system">Système</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Devise</label>
                <select 
                  v-model="settingsStore.currency"
                  class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Format des dates</label>
                <select 
                  v-model="settingsStore.dateFormat"
                  class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="fr-FR">Français (JJ/MM/AAAA)</option>
                  <option value="en-US">Anglais (MM/JJ/AAAA)</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Affichage</label>
                <div class="mt-2">
                  <label class="inline-flex items-center">
                    <input 
                      type="checkbox" 
                      v-model="settingsStore.showPercentages"
                      class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    >
                    <span class="ml-2 text-sm text-gray-700">Afficher les valeurs en pourcentage</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Notifications</label>
                <div class="mt-2 space-y-2">
                  <div class="flex items-center">
                    <input 
                      type="checkbox" 
                      v-model="settingsStore.notifications.priceAlerts"
                      class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    >
                    <label class="ml-2 block text-sm text-gray-900">Alertes de prix</label>
                  </div>
                  <div class="flex items-center">
                    <input 
                      type="checkbox" 
                      v-model="settingsStore.notifications.dailyReports"
                      class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    >
                    <label class="ml-2 block text-sm text-gray-900">Rapports quotidiens</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="button"
              @click="settingsStore.saveSettings(); showSettingsModal = false"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
            >
              Enregistrer
            </button>
            <button
              type="button"
              @click="showSettingsModal = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.router-link-active {
  font-weight: 600;
}
</style> 