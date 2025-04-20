import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Charger les variables d'environnement
dotenv.config();

// URL de connexion MongoDB
const mongoURI = process.env.MONGO_URI;

async function testDBConnection() {
  try {
    console.log('Tentative de connexion à MongoDB via Mongoose...');
    console.log(`URI: ${mongoURI}`);
    
    const conn = await mongoose.connect(mongoURI);
    
    console.log(`MongoDB connecté: ${conn.connection.host}`);
    console.log(`Base de données: ${conn.connection.name}`);
    console.log(`État de la connexion: ${mongoose.connection.readyState === 1 ? 'Connecté' : 'Déconnecté'}`);
    
    // Créer un modèle de test
    const TestSchema = new mongoose.Schema({
      name: String,
      status: String,
      date: { type: Date, default: Date.now }
    });
    
    // Créer le modèle
    const Test = mongoose.model('Test', TestSchema);
    
    // Créer un document
    const testDoc = new Test({
      name: 'test_connection',
      status: 'Test de connexion Mongoose'
    });
    
    // Sauvegarder le document
    const savedDoc = await testDoc.save();
    console.log('Document sauvegardé avec succès:', savedDoc);
    
    // Lister les collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('Collections disponibles:');
    collections.forEach(coll => {
      console.log(`- ${coll.name}`);
    });
    
    // Fermer la connexion
    await mongoose.connection.close();
    console.log('Connexion fermée');
    
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error);
  }
}

// Exécuter le test
testDBConnection(); 