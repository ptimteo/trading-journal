import { defineStore } from 'pinia';
import axios from 'axios';
import { useAuthStore } from './auth';

export interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryDate: Date;
  exitDate: Date;
  strategy: string;
  profitLoss: number;
  notes?: string;
}

export const useTradesStore = defineStore('trades', {
  state: () => ({
    trades: [] as Trade[],
    isLoading: false,
    error: null as string | null
  }),

  actions: {
    async fetchTrades() {
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
            tradeType: 'trade'
          }
        });
        
        this.trades = response.data.trades.map((trade: any) => ({
          id: trade._id,
          symbol: trade.symbol,
          direction: trade.direction,
          quantity: trade.quantity,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          entryDate: new Date(trade.entryDate),
          exitDate: new Date(trade.exitDate),
          strategy: trade.strategy,
          profitLoss: trade.profitLoss,
          notes: trade.notes
        }));
      } catch (error: any) {
        console.error('Erreur lors de la récupération des trades:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de la récupération des trades';
      } finally {
        this.isLoading = false;
      }
    },
    
    async addTrade(trade: Omit<Trade, 'id'>) {
      const authStore = useAuthStore();
      
      if (!authStore.isAuthenticated) {
        console.error('Utilisateur non authentifié');
        return;
      }
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/v1/trades', {
          ...trade,
          tradeType: 'trade'
        }, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
        
        const newTrade = response.data.trade;
        
        this.trades.push({
          id: newTrade._id,
          symbol: newTrade.symbol,
          direction: newTrade.direction,
          quantity: newTrade.quantity,
          entryPrice: newTrade.entryPrice,
          exitPrice: newTrade.exitPrice,
          entryDate: new Date(newTrade.entryDate),
          exitDate: new Date(newTrade.exitDate),
          strategy: newTrade.strategy,
          profitLoss: newTrade.profitLoss,
          notes: newTrade.notes
        });
      } catch (error: any) {
        console.error('Erreur lors de l\'ajout du trade:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de l\'ajout du trade';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
    
    async removeTrade(id: string) {
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
        
        this.trades = this.trades.filter(t => t.id !== id);
      } catch (error: any) {
        console.error('Erreur lors de la suppression du trade:', error);
        this.error = error.response?.data?.msg || 'Erreur lors de la suppression du trade';
      } finally {
        this.isLoading = false;
      }
    },
    
    // Méthodes pour la compatibilité avec le code existant
    saveToLocalStorage() {
      // Ne fait plus rien - les données sont stockées dans MongoDB
      console.log('Les données sont maintenant stockées dans MongoDB');
    },
    
    loadFromLocalStorage() {
      // Appelle fetchTrades à la place
      this.fetchTrades();
    }
  }
}); 