import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

// Charger les variables d'environnement
dotenv.config();

// Utiliser l'URL de connexion depuis le fichier .env
const url = process.env.MONGO_URI;

// Fonction pour tester la connexion
async function testConnection() {
  try {
    console.log('Tentative de connexion à MongoDB...');
    const client = new MongoClient(url);
    await client.connect();
    
    console.log('Connecté avec succès à MongoDB!');
    
    // Récupérer le nom de la base de données depuis l'URL
    const dbName = url.split('/').pop().split('?')[0];
    console.log(`Base de données: ${dbName}`);
    
    const db = client.db(dbName);
    
    // Exemple d'insertion d'un document
    const collection = db.collection('test_connection');
    const result = await collection.insertOne({
      name: "test_user",
      status: "connexion test",
      date: new Date()
    });
    
    console.log('Document inséré avec succès:', result);
    
    // Liste des collections
    const collections = await db.listCollections().toArray();
    console.log('Collections disponibles:');
    collections.forEach(coll => {
      console.log(`- ${coll.name}`);
    });
    
    await client.close();
    console.log('Connexion fermée');
    
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error);
  }
}

// Exécuter le test
testConnection(); 