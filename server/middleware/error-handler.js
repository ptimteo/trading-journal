import { StatusCodes } from 'http-status-codes';
import { CustomAPIError } from '../errors/index.js';

const errorHandlerMiddleware = (err, req, res, next) => {
  let customError = {
    // définir des valeurs par défaut
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || 'Une erreur est survenue, veuillez réessayer plus tard'
  };

  // Erreur personnalisée
  if (err instanceof CustomAPIError) {
    return res.status(err.statusCode).json({ msg: err.message });
  }

  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    customError.msg = Object.values(err.errors)
      .map((item) => item.message)
      .join(', ');
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  // Erreur de duplication (email déjà utilisé)
  if (err.code && err.code === 11000) {
    customError.msg = `La valeur ${Object.keys(err.keyValue)} existe déjà, veuillez en choisir une autre`;
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  // Erreur de conversion d'ID
  if (err.name === 'CastError') {
    customError.msg = `Aucun élément trouvé avec l'id : ${err.value}`;
    customError.statusCode = StatusCodes.NOT_FOUND;
  }

  return res.status(customError.statusCode).json({ msg: customError.msg });
};

export default errorHandlerMiddleware; 