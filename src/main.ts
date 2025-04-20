import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import './style.css';
import { useTradingStore } from './stores/trading';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus);

// Initialiser le store d'authentification
const authStore = useAuthStore();
authStore.init();

// Initialiser le store de trading
const tradingStore = useTradingStore();
tradingStore.initializeData();

app.mount('#app'); 