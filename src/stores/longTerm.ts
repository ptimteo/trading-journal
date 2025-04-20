import { defineStore } from 'pinia';
import axios from 'axios';
import { useAuthStore } from './auth';
import type { Trade } from './trades';

export const useLongTermStore = defineStore('longTerm', {
  state: () => ({
    investments: [] as Trade[],
    isLoading: false,
    error: null as string | null
  }),

  actions: {
    async fetchInvestments() {
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
            tradeType: 'longTerm'
          }
        });
        
        this.investments = response.data.trades.map((investment: any) => ({
          id: investment._id,
          symbol: investment.symbol,
          direction: investment.direction,
          quantity: investment.quantity,
          entryPrice: investment.entryPrice,
          exitPrice: investment.exitPrice,
          entryDate: new Date(investment.entryDate),
          exitDate: new Date(investment.exitDate),
          strategy: investment.strategy,
          profitLoss: investment.profitLoss,
          notes: investment.notes
        }));
      } catch (error: any) {
        console.error('Erreur lors de la récupération des investissements long terme:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de la récupération des investissements long terme';
      } finally {
        this.isLoading = false;
      }
    },
    
    async addInvestment(investment: Omit<Trade, 'id'>) {
      const authStore = useAuthStore();
      
      if (!authStore.isAuthenticated) {
        console.error('Utilisateur non authentifié');
        return;
      }
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/v1/trades', {
          ...investment,
          tradeType: 'longTerm'
        }, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
        
        const newInvestment = response.data.trade;
        
        this.investments.push({
          id: newInvestment._id,
          symbol: newInvestment.symbol,
          direction: newInvestment.direction,
          quantity: newInvestment.quantity,
          entryPrice: newInvestment.entryPrice,
          exitPrice: newInvestment.exitPrice,
          entryDate: new Date(newInvestment.entryDate),
          exitDate: new Date(newInvestment.exitDate),
          strategy: newInvestment.strategy,
          profitLoss: newInvestment.profitLoss,
          notes: newInvestment.notes
        });
      } catch (error: any) {
        console.error('Erreur lors de l\'ajout de l\'investissement long terme:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de l\'ajout de l\'investissement long terme';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
    
    async removeInvestment(id: string) {
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
        
        this.investments = this.investments.filter(i => i.id !== id);
      } catch (error: any) {
        console.error('Erreur lors de la suppression de l\'investissement long terme:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de la suppression de l\'investissement long terme';
      } finally {
        this.isLoading = false;
      }
    },
    
    // Méthodes pour la compatibilité avec le code existant
    saveToLocalStorage() {
      // Ne fait plus rien - les données d'investissements long terme sont maintenant stockées dans MongoDB
      console.log('Les données d\'investissements long terme sont maintenant stockées dans MongoDB');
    },
    
    loadFromLocalStorage() {
      // Appelle fetchInvestments à la place
      this.fetchInvestments();
    }
  }
}); 