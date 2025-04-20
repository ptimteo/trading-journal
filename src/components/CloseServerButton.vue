<template>
  <button @click="closeServer" class="fixed bottom-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
    </svg>
    Fermer l'application
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Fonction pour envoyer une demande de fermeture du serveur
const closeServer = () => {
  if (confirm("Êtes-vous sûr de vouloir fermer l'application ?")) {
    // Envoyer une requête pour fermer le serveur
    try {
      if (import.meta.env.DEV) {
        // En mode développement, utiliser les API du navigateur pour signaler la fermeture
        fetch('/_vite/close-server', { method: 'POST' })
          .then(() => {
            console.log('Demande de fermeture envoyée au serveur');
            // Attendre un peu puis fermer la fenêtre
            setTimeout(() => {
              window.close();
            }, 500);
          })
          .catch(err => {
            console.error('Erreur lors de la demande de fermeture:', err);
            // Tenter de fermer la fenêtre quand même
            window.close();
          });
      } else {
        // En mode production, simplement fermer la fenêtre
        window.close();
      }
    } catch (error) {
      console.error("Impossible d'envoyer la demande de fermeture:", error);
      // Tenter de fermer la fenêtre quand même
      window.close();
    }
  }
};
</script>

<style scoped>
/* Ajoutez des styles personnalisés ici si nécessaire */
</style> 