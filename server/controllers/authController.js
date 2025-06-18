import User from '../models/User.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, UnauthenticatedError } from '../errors/index.js';

// Inscription d'un nouvel utilisateur
const register = async (req, res) => {
  const user = await User.create({ ...req.body });
  const token = user.createJWT();
  res.status(StatusCodes.CREATED).json({ 
    user: { 
      id: user._id,
      name: user.name,
      email: user.email 
    }, 
    token 
  });
};

// Connexion d'un utilisateur
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Veuillez fournir un identifiant et un mot de passe');
  }

  // Recherche par email ou nom d'utilisateur
  const user = await User.findOne({ 
    $or: [
      { email },
      { name: email }  // Le champ "email" du formulaire peut contenir soit l'email soit le nom
    ]
  }).select('+password');
  
  if (!user) {
    throw new UnauthenticatedError('Identifiants invalides');
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Identifiants invalides');
  }

  const token = user.createJWT();
  res.status(StatusCodes.OK).json({ 
    user: { 
      id: user._id,
      name: user.name,
      email: user.email 
    }, 
    token 
  });
};

// Vérification du token et récupération de l'utilisateur courant
const getCurrentUser = async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new UnauthenticatedError('Utilisateur non trouvé');
  }
  
  res.status(StatusCodes.OK).json({ 
    user: { 
      id: user._id,
      name: user.name,
      email: user.email 
    }
  });
};

export { register, login, getCurrentUser }; 