<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const showUserMenu = ref(false);
const showMobileMenu = ref(false);

const isAuthenticated = computed(() => authStore.isAuthenticated);
const currentUser = computed(() => authStore.currentUser);

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value;
};

const closeUserMenu = () => {
  showUserMenu.value = false;
};

const closeMobileMenu = () => {
  showMobileMenu.value = false;
};

const logout = () => {
  authStore.logout();
  router.push('/');
  closeUserMenu();
};

const goToLogin = () => {
  router.push('/');
};

const goToRegister = () => {
  router.push('/register');
};

onMounted(async () => {
  if (authStore.token) {
    await authStore.fetchCurrentUser();
  }
});
</script>

<template>
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex">
          <div class="flex-shrink-0 flex items-center">
            <router-link to="/" class="text-xl font-bold text-blue-600 flex items-center">
              <img src="/quantify-logo.svg" alt="Quantify Logo" class="h-8 w-8 mr-2" />
              <span>Quantify</span>
            </router-link>
          </div>
          <!-- Navigation principale - visible seulement si connecté -->
          <nav v-if="isAuthenticated" class="hidden sm:ml-6 sm:flex sm:space-x-8">
            <router-link to="/dashboard" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
              Tableau de Bord
            </router-link>
            <router-link to="/trades" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
              Journal des Trades
            </router-link>
            <router-link to="/crypto" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
              Portfolio Crypto
            </router-link>
            <router-link to="/long-term" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
              Investissements Long Terme
            </router-link>
            <router-link to="/macro" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
              Macro
            </router-link>
            <router-link to="/resources" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
              Ressources
            </router-link>
          </nav>
        </div>
        <div class="flex items-center">
          <!-- Bouton menu mobile - visible seulement si connecté -->
          <div v-if="isAuthenticated" class="sm:hidden">
            <button 
              @click="toggleMobileMenu"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span class="sr-only">Ouvrir le menu principal</span>
              <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          <div v-if="isAuthenticated" class="ml-3 relative">
            <div>
              <button 
                @click="toggleUserMenu" 
                class="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <span class="sr-only">Open user menu</span>
                <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                  {{ currentUser?.name.charAt(0).toUpperCase() }}
                </div>
              </button>
            </div>
            
            <div v-if="showUserMenu" class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div class="px-4 py-2 text-sm text-gray-700 border-b">
                <p class="font-medium">{{ currentUser?.name }}</p>
                <p class="text-gray-500 text-xs">{{ currentUser?.email }}</p>
              </div>
              <router-link to="/admin" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Administration
              </router-link>
              <button @click="logout" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Se déconnecter
              </button>
            </div>
          </div>
          
          <div v-else class="flex space-x-4">
            <button @click="goToLogin" class="bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium transition-colors">
              Connexion
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Menu mobile - visible seulement si connecté -->
    <div v-if="isAuthenticated && showMobileMenu" class="sm:hidden">
      <div class="pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
        <router-link 
          @click="closeMobileMenu"
          to="/dashboard" 
          class="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        >
          Tableau de Bord
        </router-link>
        <router-link 
          @click="closeMobileMenu"
          to="/trades" 
          class="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        >
          Journal des Trades
        </router-link>
        <router-link 
          @click="closeMobileMenu"
          to="/crypto" 
          class="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        >
          Portfolio Crypto
        </router-link>
        <router-link 
          @click="closeMobileMenu"
          to="/long-term" 
          class="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        >
          Investissements Long Terme
        </router-link>
        <router-link 
          @click="closeMobileMenu"
          to="/macro" 
          class="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        >
          Macro
        </router-link>
        <router-link 
          @click="closeMobileMenu"
          to="/resources" 
          class="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        >
          Ressources
        </router-link>
      </div>
    </div>
  </header>
</template> 