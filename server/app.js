import dotenv from 'dotenv';
import 'express-async-errors';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import xss from 'xss-clean';
import rateLimiter from 'express-rate-limit';

import connectDB from './db/connect.js';
import authRouter from './routes/auth.js';
import tradeRouter from './routes/trades.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';

// Charger les variables d'environnement
dotenv.config();

const app = express();

// Sécurité
app.set('trust proxy', 1);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite chaque IP à 100 requêtes par fenêtre
  })
);
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(xss());

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/trades', tradeRouter);

// Middleware d'erreur
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5002;

const start = async () => {
  try {
    console.log('Démarrage du serveur...');
    console.log(`MongoDB URI: ${process.env.MONGO_URI}`);
    
    // Connexion à MongoDB
    await connectDB(process.env.MONGO_URI);
    
    // Démarrage du serveur Express
    app.listen(port, () =>
      console.log(`Serveur en écoute sur le port ${port}...`)
    );
  } catch (error) {
    console.error('Erreur de démarrage du serveur:', error);
  }
};

start(); 