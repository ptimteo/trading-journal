import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: [true, 'Veuillez fournir un symbole'],
    trim: true,
    maxlength: [20, 'Le symbole ne peut pas dépasser 20 caractères']
  },
  direction: {
    type: String,
    enum: ['LONG', 'SHORT'],
    required: [true, 'Veuillez spécifier la direction du trade']
  },
  quantity: {
    type: Number,
    required: [true, 'Veuillez fournir une quantité']
  },
  entryPrice: {
    type: Number,
    required: [true, 'Veuillez fournir un prix d\'entrée']
  },
  exitPrice: {
    type: Number,
    required: [true, 'Veuillez fournir un prix de sortie']
  },
  entryDate: {
    type: Date,
    required: [true, 'Veuillez fournir une date d\'entrée']
  },
  exitDate: {
    type: Date,
    required: [true, 'Veuillez fournir une date de sortie']
  },
  strategy: {
    type: String,
    required: [true, 'Veuillez fournir une stratégie'],
    trim: true
  },
  profitLoss: {
    type: Number,
    required: [true, 'Veuillez fournir le profit ou la perte']
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Un utilisateur doit être associé au trade']
  },
  tradeType: {
    type: String,
    enum: ['trade', 'crypto', 'longTerm'],
    default: 'trade',
    required: [true, 'Le type de trade doit être spécifié']
  }
});

export default mongoose.model('Trade', TradeSchema); 