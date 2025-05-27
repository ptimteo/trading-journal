import { createRouter, createWebHistory } from 'vue-router';
import { defineAsyncComponent } from 'vue';
import authMiddleware from '../middleware/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/dashboard',
      name: 'dashboard',
      component: defineAsyncComponent(() => import('../views/DashboardView.vue')),
      meta: {
        title: 'Tableau de Bord',
        requiresAuth: true
      }
    },
    {
      path: '/trades',
      name: 'trades',
      component: defineAsyncComponent(() => import('../views/TradesView.vue')),
      meta: {
        title: 'Journal des Trades',
        requiresAuth: true
      }
    },
    {
      path: '/crypto',
      name: 'crypto',
      component: defineAsyncComponent(() => import('../views/CryptoView.vue')),
      meta: {
        title: 'Portfolio Crypto',
        requiresAuth: true
      }
    },
    {
      path: '/long-term',
      name: 'long-term',
      component: defineAsyncComponent(() => import('../views/LongTermView.vue')),
      meta: {
        title: 'Investissements Long Terme',
        requiresAuth: true
      }
    },
    {
      path: '/resources',
      name: 'resources',
      component: defineAsyncComponent(() => import('../views/ResourcesView.vue')),
      meta: {
        title: 'Ressources Utiles',
        requiresAuth: true
      }
    },
    {
      path: '/macro',
      name: 'macro',
      component: defineAsyncComponent(() => import('../views/MacroEconomicView.vue')),
      meta: {
        title: 'Indicateurs Macroéconomiques',
        requiresAuth: true
      },
      beforeEnter: (to, from, next) => {
        to.params.section = 'overview';
        next();
      }
    },
    {
      path: '/',
      name: 'login',
      component: defineAsyncComponent(() => import('../views/LoginView.vue')),
      meta: {
        title: 'Connexion'
      }
    },
    {
      path: '/register',
      name: 'register',
      component: defineAsyncComponent(() => import('../views/RegisterView.vue')),
      meta: {
        title: 'Inscription',
        requiresAuth: false
      }
    },
    {
      path: '/admin',
      name: 'admin',
      component: defineAsyncComponent(() => import('../views/AdminView.vue')),
      meta: {
        title: 'Administration',
        requiresAuth: true
      }
    }
  ]
});

router.beforeEach(async (to, from, next) => {
  document.title = `${to.meta.title || 'Quantify'} | Quantify`;
  
  await authMiddleware(to, from, next);
});

export default router; 