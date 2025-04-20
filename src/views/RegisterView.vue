<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);

const authStore = useAuthStore();
const router = useRouter();

const handleRegister = async () => {
  // Validation basique
  if (!name.value || !email.value || !password.value || !confirmPassword.value) {
    errorMessage.value = 'Veuillez remplir tous les champs';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Les mots de passe ne correspondent pas';
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Le mot de passe doit contenir au moins 6 caractères';
    return;
  }

  try {
    isSubmitting.value = true;
    await authStore.register(name.value, email.value, password.value);
    router.push('/');
  } catch (error: any) {
    errorMessage.value = error.message || 'Erreur lors de l\'inscription';
  } finally {
    isSubmitting.value = false;
  }
};

const goToLogin = () => {
  router.push('/login');
};
</script>

<template>
  <div class="flex justify-center items-center min-h-screen bg-gray-100">
    <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <h1 class="text-2xl font-bold text-center mb-6 text-gray-800">Créer un compte Quantify</h1>
      
      <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Nom</label>
          <input
            id="name"
            v-model="name"
            type="text"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Votre nom"
          />
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="votre@email.com"
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
          />
        </div>

        <div>
          <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? 'Inscription en cours...' : 'S\'inscrire' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-gray-600">
          Déjà un compte ?
          <button @click="goToLogin" class="text-blue-600 hover:underline focus:outline-none">
            Se connecter
          </button>
        </p>
      </div>
    </div>
  </div>
</template> 