import express from 'express';
import { 
  createTrade,
  getTrades,
  getTrade,
  updateTrade,
  deleteTrade
} from '../controllers/tradeController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

router.route('/')
  .post(createTrade)
  .get(getTrades);

router.route('/:id')
  .get(getTrade)
  .patch(updateTrade)
  .delete(deleteTrade);

export default router; 