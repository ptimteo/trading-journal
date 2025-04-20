import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec
const execAsync = promisify(exec);

// Charger les variables d'environnement
dotenv.config();

// URL de connexion MongoDB
const mongoURI = process.env.MONGO_URI;

async function checkMongoDBConnection() {
  try {
    console.log('Vérification de la connexion à MongoDB...');
    
    const client = new MongoClient(mongoURI);
    await client.connect();
    
    console.log('MongoDB est accessible!');
    console.log(`URL de connexion: ${mongoURI}`);
    
    // Fermer la connexion directe
    await client.close();
    
    // Essayer de se connecter avec Mongoose
    console.log('\nTentative de connexion avec Mongoose...');
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB connecté via Mongoose: ${conn.connection.host}`);
    console.log(`Base de données: ${conn.connection.name}`);
    await mongoose.connection.close();
    
    return true;
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error.message);
    return false;
  }
}

async function main() {
  console.log('====================================');
  console.log('Configuration de MongoDB pour Quantify');
  console.log('====================================\n');
  
  const isConnected = await checkMongoDBConnection();
  
  if (!isConnected) {
    console.log('\nLa connexion à MongoDB a échoué. Vérifiez que:');
    console.log('1. MongoDB est installé et en cours d\'exécution');
    console.log('2. L\'URL de connexion dans .env est correcte');
    console.log('3. Vous êtes bien connecté à Internet (si vous utilisez MongoDB Atlas)');
    console.log('\nVoici les étapes pour installer MongoDB:');
    console.log('1. Téléchargez MongoDB depuis https://www.mongodb.com/try/download/community');
    console.log('2. Installez MongoDB en suivant les instructions');
    console.log('3. Créez un compte MongoDB Atlas si vous préférez une version cloud');
    console.log('4. Mettez à jour l\'URL de connexion dans votre fichier .env');
    console.log('\nVous pouvez aussi utiliser MongoDB Atlas (cloud) pour éviter l\'installation locale.');
    process.exit(1);
  }
  
  console.log('\nLa connexion à MongoDB est réussie!');
  console.log('Votre application est prête à démarrer.\n');
}

main(); 