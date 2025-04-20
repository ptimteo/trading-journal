import { defineStore } from 'pinia';
import axios from 'axios';
import { useAuthStore } from './auth';
import type { Trade } from './trades';

export const useCryptoStore = defineStore('crypto', {
  state: () => ({
    positions: [] as Trade[],
    isLoading: false,
    error: null as string | null
  }),

  actions: {
    async fetchPositions() {
      const authStore = useAuthStore();
      
      if (!authStore.isAuthenticated) {
        console.error('Utilisateur non authentifié');
        return;
      }
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.get('/api/v1/trades', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          params: {
            tradeType: 'crypto'
          }
        });
        
        this.positions = response.data.trades.map((position: any) => ({
          id: position._id,
          symbol: position.symbol,
          direction: position.direction,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          exitPrice: position.exitPrice,
          entryDate: new Date(position.entryDate),
          exitDate: new Date(position.exitDate),
          strategy: position.strategy,
          profitLoss: position.profitLoss,
          notes: position.notes
        }));
      } catch (error: any) {
        console.error('Erreur lors de la récupération des positions crypto:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de la récupération des positions crypto';
      } finally {
        this.isLoading = false;
      }
    },
    
    async addPosition(position: Omit<Trade, 'id'>) {
      const authStore = useAuthStore();
      
      if (!authStore.isAuthenticated) {
        console.error('Utilisateur non authentifié');
        return;
      }
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/v1/trades', {
          ...position,
          tradeType: 'crypto'
        }, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
        
        const newPosition = response.data.trade;
        
        this.positions.push({
          id: newPosition._id,
          symbol: newPosition.symbol,
          direction: newPosition.direction,
          quantity: newPosition.quantity,
          entryPrice: newPosition.entryPrice,
          exitPrice: newPosition.exitPrice,
          entryDate: new Date(newPosition.entryDate),
          exitDate: new Date(newPosition.exitDate),
          strategy: newPosition.strategy,
          profitLoss: newPosition.profitLoss,
          notes: newPosition.notes
        });
      } catch (error: any) {
        console.error('Erreur lors de l\'ajout de la position crypto:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de l\'ajout de la position crypto';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
    
    async removePosition(id: string) {
      const authStore = useAuthStore();
      
      if (!authStore.isAuthenticated) {
        console.error('Utilisateur non authentifié');
        return;
      }
      
      this.isLoading = true;
      this.error = null;
      
      try {
        await axios.delete(`/api/v1/trades/${id}`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
        
        this.positions = this.positions.filter(p => p.id !== id);
      } catch (error: any) {
        console.error('Erreur lors de la suppression de la position crypto:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de la suppression de la position crypto';
      } finally {
        this.isLoading = false;
      }
    },
    
    // Méthodes pour la compatibilité avec le code existant
    saveToLocalStorage() {
      // Ne fait plus rien - les données sont stockées dans MongoDB
      console.log('Les données crypto sont maintenant stockées dans MongoDB');
    },
    
    loadFromLocalStorage() {
      // Appelle fetchPositions à la place
      this.fetchPositions();
    }
  }
}); 