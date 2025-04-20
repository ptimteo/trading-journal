import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../errors/index.js';

const authMiddleware = async (req, res, next) => {
  // Vérifier le header d'autorisation
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Authentification invalide');
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Vérifier le token
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Attacher l'utilisateur à la requête
    req.user = { id: payload.id, name: payload.name };
    next();
  } catch (error) {
    throw new UnauthenticatedError('Authentification invalide');
  }
};

export default authMiddleware; 