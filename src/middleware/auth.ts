import { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../stores/auth';

export default async function authMiddleware(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore();
  
  // Si l'utilisateur est déjà authentifié
  if (authStore.isAuthenticated) {
    // Si l'utilisateur est authentifié et tente d'accéder à la page de login,
    // rediriger vers le dashboard
    if (to.name === 'login') {
      return next({ name: 'dashboard' });
    }
    
    // Sinon, laisse passer vers la page demandée
    return next();
  }
  
  // Même si l'utilisateur n'est pas authentifié, on le laisse accéder à toutes les pages
  // sans redirection vers la page de connexion
  return next();
} 