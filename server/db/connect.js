import mongoose from 'mongoose';

const connectDB = async (url) => {
  try {
    console.log('Tentative de connexion à MongoDB...');
    console.log(`URL: ${url}`);
    
    const conn = await mongoose.connect(url);
    
    console.log(`MongoDB connecté: ${conn.connection.host}`);
    console.log(`Base de données: ${conn.connection.name}`);
    
    return conn;
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB; 