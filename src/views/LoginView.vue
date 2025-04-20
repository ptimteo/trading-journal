<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);
const authInitialized = ref(false);

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

// Initialiser le store d'authentification au montage du composant
onMounted(() => {
  // Réinitialiser le store d'authentification pour éviter les problèmes de session
  authStore.init();
  authInitialized.value = true;
  
  // Effacer les erreurs précédentes
  errorMessage.value = '';
  
  // Récupérer le message d'erreur de l'URL si présent
  if (route.query.error) {
    errorMessage.value = route.query.error as string;
  }
  
  // Si l'utilisateur est déjà authentifié, rediriger vers le dashboard
  if (authStore.isAuthenticated) {
    router.push('/dashboard');
  }
});

const handleLogin = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'Veuillez remplir tous les champs';
    return;
  }

  try {
    isSubmitting.value = true;
    errorMessage.value = '';
    
    // Vérifier que le store est initialisé
    if (!authInitialized.value) {
      authStore.init();
      authInitialized.value = true;
    }
    
    // Tentative de connexion
    await authStore.login(email.value, password.value);
    
    // Rediriger vers le dashboard après connexion réussie
    router.push('/dashboard');
  } catch (error: any) {
    // Gestion améliorée des erreurs pour capturer les problèmes d'intrinsics
    if (error.message?.includes('intrinsics')) {
      errorMessage.value = 'Problème d\'authentification. Veuillez rafraîchir la page et réessayer.';
      console.error('Erreur d\'intrinsics détectée:', error);
      // Réinitialiser le store en cas d'erreur d'intrinsics
      authStore.init();
    } else {
      errorMessage.value = error.message || 'Erreur de connexion';
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="flex justify-center items-center min-h-screen bg-gray-100">
    <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <h1 class="text-2xl font-bold text-center mb-6 text-gray-800">Connexion à Quantify</h1>
      
      <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email ou Nom d'utilisateur</label>
          <input
            id="email"
            v-model="email"
            type="text"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="votre@email.com ou votre nom"
            autocomplete="username"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? 'Connexion en cours...' : 'Se connecter' }}
        </button>
      </form>
      
      <div class="mt-6 text-center">
        <p class="text-sm text-gray-600">
          Vous pouvez vous connecter avec votre adresse email ou votre nom d'utilisateur
        </p>
        <p class="text-gray-600 mt-2">
          Plateforme réservée aux utilisateurs autorisés
        </p>
      </div>
    </div>
  </div>
</template> 