<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';

const authStore = useAuthStore();
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const users = ref([]);

// Formulaire de création d'utilisateur
const newUser = ref({
  name: '',
  email: '',
  password: ''
});

// Charger la liste des utilisateurs
const loadUsers = async () => {
  try {
    isLoading.value = true;
    const response = await axios.get('/api/v1/users', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    users.value = response.data.users;
  } catch (error: any) {
    errorMessage.value = error.response?.data?.msg || 'Erreur lors du chargement des utilisateurs';
    console.error('Erreur:', error);
  } finally {
    isLoading.value = false;
  }
};

// Créer un nouvel utilisateur
const createUser = async () => {
  try {
    // Validation
    if (!newUser.value.name || !newUser.value.email || !newUser.value.password) {
      errorMessage.value = 'Veuillez remplir tous les champs';
      return;
    }
    
    isLoading.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    
    const response = await axios.post('/api/v1/auth/register', newUser.value, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    successMessage.value = `Utilisateur ${response.data.user.name} créé avec succès!`;
    
    // Réinitialiser le formulaire
    newUser.value = {
      name: '',
      email: '',
      password: ''
    };
    
    // Recharger la liste des utilisateurs
    loadUsers();
    
  } catch (error: any) {
    errorMessage.value = error.response?.data?.msg || 'Erreur lors de la création de l\'utilisateur';
    console.error('Erreur:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  // loadUsers();
});
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Administration des utilisateurs</h1>
    
    <!-- Formulaire de création d'utilisateur -->
    <div class="bg-white p-6 rounded-lg shadow-md mb-8">
      <h2 class="text-xl font-semibold mb-4">Créer un nouvel utilisateur</h2>
      
      <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
        {{ errorMessage }}
      </div>
      
      <div v-if="successMessage" class="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
        {{ successMessage }}
      </div>
      
      <form @submit.prevent="createUser" class="space-y-4">
        <div>
          <label class="block text-gray-700 text-sm font-medium mb-1">Nom</label>
          <input 
            v-model="newUser.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nom de l'utilisateur"
            required
          />
        </div>
        
        <div>
          <label class="block text-gray-700 text-sm font-medium mb-1">Email</label>
          <input 
            v-model="newUser.email"
            type="email"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@exemple.com"
            required
          />
        </div>
        
        <div>
          <label class="block text-gray-700 text-sm font-medium mb-1">Mot de passe</label>
          <input 
            v-model="newUser.password"
            type="password"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Mot de passe"
            required
          />
        </div>
        
        <div>
          <button 
            type="submit" 
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Création en cours...' : 'Créer l\'utilisateur' }}
          </button>
        </div>
      </form>
    </div>
    
    <!-- Liste des utilisateurs (à implémenter si nécessaire) -->
    <!--
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4">Liste des utilisateurs</h2>
      
      <div v-if="isLoading" class="text-center py-4">
        <div class="spinner mx-auto"></div>
        <p class="mt-2 text-gray-600">Chargement des utilisateurs...</p>
      </div>
      
      <div v-else-if="users.length === 0" class="py-4 text-gray-500 text-center">
        Aucun utilisateur trouvé
      </div>
      
      <ul v-else class="divide-y divide-gray-200">
        <li v-for="user in users" :key="user.id" class="py-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{{ user.name }}</p>
              <p class="text-sm text-gray-500">{{ user.email }}</p>
            </div>
          </div>
        </li>
      </ul>
    </div>
    -->
  </div>
</template> 