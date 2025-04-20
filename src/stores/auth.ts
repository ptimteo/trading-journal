import { defineStore } from 'pinia';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    isLoading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    currentUser: (state) => state.user
  },

  actions: {
    // Initialiser le store au chargement de l'application
    init() {
      // On ne récupère plus le token du localStorage pour forcer la connexion à chaque visite
      this.token = null;
      this.user = null;
      
      // Si un token était stocké, on nettoie les en-têtes d'autorisation
      delete axios.defaults.headers.common['Authorization'];
    },
    
    async register(name: string, email: string, password: string) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/v1/auth/register', {
          name,
          email,
          password
        }, {
          withCredentials: true
        });
        
        const { user, token } = response.data;
        this.setUser(user, token);
        return user;
      } catch (error: any) {
        if (error.message === 'Network Error') {
          this.error = 'Erreur de connexion au serveur. Vérifiez que le backend est bien démarré sur le port 5000.';
        } else {
          this.error = error.response?.data?.msg || 'Une erreur est survenue lors de l\'inscription';
        }
        console.error('Erreur d\'inscription:', error);
        throw new Error(this.error || 'Une erreur est survenue lors de l\'inscription');
      } finally {
        this.isLoading = false;
      }
    },

    async login(emailOrUsername: string, password: string) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/v1/auth/login', {
          email: emailOrUsername,
          password
        }, {
          withCredentials: true
        });
        
        const { user, token } = response.data;
        this.setUser(user, token);
        return user;
      } catch (error: any) {
        if (error.message === 'Network Error') {
          this.error = 'Erreur de connexion au serveur. Vérifiez que le backend est bien démarré sur le port 5000.';
        } else {
          this.error = error.response?.data?.msg || 'Identifiants invalides';
        }
        console.error('Erreur de connexion:', error);
        throw new Error(this.error || 'Identifiants invalides');
      } finally {
        this.isLoading = false;
      }
    },

    async fetchCurrentUser() {
      if (!this.token) return null;
      
      this.isLoading = true;
      
      try {
        const response = await axios.get('/api/v1/auth/me', {
          headers: {
            Authorization: `Bearer ${this.token}`
          },
          withCredentials: true
        });
        
        this.user = response.data.user;
        return this.user;
      } catch (error: any) {
        // En cas d'erreur d'authentification, on nettoie la session
        this.logout();
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        throw new Error('Session expirée ou invalide. Veuillez vous reconnecter.');
      } finally {
        this.isLoading = false;
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      
      // S'assurer que les en-têtes d'autorisation sont supprimés
      delete axios.defaults.headers.common['Authorization'];
    },

    setUser(user: User, token: string) {
      this.user = user;
      this.token = token;
      
      // Configuration des en-têtes d'autorisation pour toutes les futures requêtes
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }
}); 