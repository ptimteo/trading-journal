import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'close-server',
      configureServer(server) {
        // Middleware pour gérer la fermeture du serveur
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/_vite/close-server') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            
            // Fermer le serveur après un court délai pour permettre la réponse
            setTimeout(() => {
              console.log('Serveur Vite arrêté par demande du navigateur');
              server.close();
              process.exit(0);
            }, 500);
            return;
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
    host: true, // Permet l'accès depuis toutes les interfaces
    strictPort: true,
    // Permet de fermer le serveur quand le navigateur est fermé
    // et contrôler le comportement du serveur
    watch: {
      usePolling: true,
      // Améliore la réactivité du watcher
      interval: 100,
      // Ignore les fichiers temporaires pour éviter les rechargements inutiles
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.log', '**/*.bak', '**/*.backup']
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      clientPort: 3001,
      // Ajout des options pour le HMR
      overlay: false, // Désactive l'overlay d'erreur qui cause parfois un refresh complet
      timeout: 2000, // Augmente le timeout pour éviter les refreshs inutiles
      port: 24678 // Port dédié pour HMR
    },
    // Configuration pour éviter les rechargements complets
    middlewareMode: false,
    fs: {
      strict: false // Moins strict sur le système de fichiers
    },
    proxy: {
      '/finnhub': {
        target: 'https://finnhub.io/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/finnhub/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Yahoo proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Yahoo Request:', req.method, req.url);
            // Ajouter les en-têtes CORS nécessaires
            proxyReq.setHeader('Access-Control-Allow-Origin', '*');
            proxyReq.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            proxyReq.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Yahoo Response:', proxyRes.statusCode, req.url);
            // Ajouter les en-têtes CORS à la réponse
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
          });
        },
      }
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'chart': ['chart.js', 'vue-chartjs'],
        },
      },
    },
  },
  optimizeDeps: {
    // Optimisation des dépendances pour éviter les rechargements complets
    include: ['vue', 'vue-router', 'pinia', '@vueuse/core', 'chart.js', 'vue-chartjs'],
    exclude: [], // Exclure certaines dépendances si nécessaire
  },
  base: './',
  publicDir: 'public',
})
