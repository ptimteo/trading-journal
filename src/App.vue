<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue';
import CloseServerButton from './components/CloseServerButton.vue';
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import axios from 'axios';

// Configuration d'axios pour l'API backend
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Autoriser les cookies cross-origin
axios.defaults.withCredentials = true;

const authStore = useAuthStore();

onMounted(async () => {
  // Tentative de reconnexion si un token existe
  if (authStore.token) {
    try {
      await authStore.fetchCurrentUser();
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur', error);
    }
  }
});
</script>

<template>
  <div class="min-h-screen bg-gradient">
    <AppHeader />
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <RouterView />
    </main>
    <footer class="bg-white bg-opacity-90 shadow-sm border-t border-gray-200 mt-10">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <p class="text-sm text-center text-gray-500">
          Quantify © {{ new Date().getFullYear() }} - Développé avec Vue 3, Vite, et Tailwind CSS
        </p>
      </div>
    </footer>
    
    <!-- Bouton de fermeture de l'application -->
    <CloseServerButton />
  </div>
</template>

<style>
html {
  scroll-behavior: smooth;
}

body {
  background-attachment: fixed;
}

.bg-gradient {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* Styles scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-gray-100);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--color-gray-300);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-gray-400);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Chargement */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-gray-200);
  border-radius: 50%;
  border-top-color: var(--color-primary-600);
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style> 