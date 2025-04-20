import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

// Charger les variables d'environnement
dotenv.config();

// URL de connexion MongoDB
const mongoURI = process.env.MONGO_URI;

async function checkUsers() {
  try {
    console.log('Connexion à MongoDB...');
    const client = new MongoClient(mongoURI);
    await client.connect();
    
    console.log('Connexion établie!');
    
    // Récupérer le nom de la base de données depuis l'URL
    const dbName = mongoURI.split('/').pop().split('?')[0];
    console.log(`Base de données: ${dbName}`);
    
    const db = client.db(dbName);
    
    // Liste des collections
    const collections = await db.listCollections().toArray();
    console.log('Collections disponibles:');
    collections.forEach(coll => {
      console.log(`- ${coll.name}`);
    });
    
    // Vérifier la collection users
    const usersCollection = db.collection('users');
    const usersCount = await usersCollection.countDocuments();
    console.log(`\nNombre d'utilisateurs dans la base de données: ${usersCount}`);
    
    if (usersCount > 0) {
      console.log('\nListe des utilisateurs:');
      const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
      users.forEach((user, index) => {
        console.log(`\nUtilisateur ${index + 1}:`);
        console.log(`- ID: ${user._id}`);
        console.log(`- Nom: ${user.name}`);
        console.log(`- Email: ${user.email}`);
        console.log(`- Créé le: ${user.createdAt}`);
      });
    }
    
    await client.close();
    console.log('\nConnexion fermée');
    
  } catch (error) {
    console.error('Erreur lors de la vérification des utilisateurs:', error);
  }
}

// Exécuter la fonction
checkUsers(); 