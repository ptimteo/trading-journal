import Trade from '../models/Trade.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError } from '../errors/index.js';

// Créer un nouveau trade
const createTrade = async (req, res) => {
  // Ajouter l'ID de l'utilisateur au trade
  req.body.user = req.user.id;
  
  const trade = await Trade.create(req.body);
  res.status(StatusCodes.CREATED).json({ trade });
};

// Récupérer tous les trades d'un utilisateur
const getTrades = async (req, res) => {
  const { tradeType } = req.query;
  
  const queryObject = {
    user: req.user.id
  };
  
  // Si un type de trade est spécifié (trade, crypto, longTerm)
  if (tradeType) {
    queryObject.tradeType = tradeType;
  }
  
  const trades = await Trade.find(queryObject).sort('-createdAt');
  res.status(StatusCodes.OK).json({ trades, count: trades.length });
};

// Récupérer un trade spécifique
const getTrade = async (req, res) => {
  const { id: tradeId } = req.params;
  
  const trade = await Trade.findOne({
    _id: tradeId,
    user: req.user.id
  });
  
  if (!trade) {
    throw new NotFoundError(`Aucun trade trouvé avec l'id ${tradeId}`);
  }
  
  res.status(StatusCodes.OK).json({ trade });
};

// Mettre à jour un trade
const updateTrade = async (req, res) => {
  const { id: tradeId } = req.params;
  
  const trade = await Trade.findOneAndUpdate(
    { _id: tradeId, user: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!trade) {
    throw new NotFoundError(`Aucun trade trouvé avec l'id ${tradeId}`);
  }
  
  res.status(StatusCodes.OK).json({ trade });
};

// Supprimer un trade
const deleteTrade = async (req, res) => {
  const { id: tradeId } = req.params;
  
  const trade = await Trade.findOneAndDelete({
    _id: tradeId,
    user: req.user.id
  });
  
  if (!trade) {
    throw new NotFoundError(`Aucun trade trouvé avec l'id ${tradeId}`);
  }
  
  res.status(StatusCodes.OK).json({ message: 'Trade supprimé avec succès' });
};

export {
  createTrade,
  getTrades,
  getTrade,
  updateTrade,
  deleteTrade
}; 