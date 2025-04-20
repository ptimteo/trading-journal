import type { Trade } from '../types/trading';

export interface BootstrapResult {
  // Courbes d'équité simulées (au maximum 10 pour l'affichage)
  equityCurves: number[][];
  // Statistiques des simulations
  statistics: {
    // Percentiles des résultats finaux
    finalReturns: {
      min: number;
      p5: number;
      p25: number;
      p50: number; // médiane
      p75: number;
      p95: number;
      max: number;
    };
    // Percentiles des drawdowns max
    maxDrawdowns: {
      min: number;
      p25: number;
      p50: number;
      p75: number;
      max: number;
    };
    // Ratios de Sharpe simulés
    sharpeRatios: {
      min: number;
      p25: number;
      p50: number;
      p75: number;
      max: number;
    };
  };
  // Points du temps pour l'axe X (normalisés)
  timePoints: number[];
  // Percentiles pour chaque point dans le temps
  percentileCurves: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
}

/**
 * Effectue un bootstrap resampling sur les données de trades
 * @param trades Les trades historiques
 * @param numSimulations Nombre de simulations à exécuter
 * @param initialCapital Capital initial
 * @returns Résultats du bootstrap resampling
 */
export function runBootstrapResampling(
  trades: Trade[],
  numSimulations: number = 1000,
  initialCapital: number = 100
): BootstrapResult {
  // S'il n'y a pas assez de trades, retourner des valeurs par défaut
  if (trades.length < 5) {
    return getDefaultResult();
  }

  // Extraire les rendements des trades en pourcentage
  const returns = trades.map(trade => trade.profitLoss);
  
  // Stocker les courbes d'équité simulées
  const equityCurves: number[][] = [];
  
  // Stocker les statistiques finales
  const finalReturns: number[] = [];
  const maxDrawdowns: number[] = [];
  const sharpeRatios: number[] = [];
  
  // Préparer les points de temps normalisés (de 0 à 100%)
  const timePoints = Array.from({ length: trades.length }, (_, i) => 
    i / (trades.length - 1) * 100
  );
  
  // Exécuter les simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    // Générer un nouvel échantillon en tirant avec remise
    const resampledReturns = resampleWithReplacement(returns, returns.length);
    
    // Calculer la courbe d'équité pour cette simulation
    const equityCurve = calculateEquityCurve(resampledReturns, initialCapital);
    
    // Si c'est une des 10 premières simulations, stocker la courbe complète pour l'affichage
    if (sim < 10) {
      equityCurves.push(equityCurve);
    }
    
    // Calculer le rendement total de cette simulation
    const finalReturn = (equityCurve[equityCurve.length - 1] - initialCapital) / initialCapital * 100;
    finalReturns.push(finalReturn);
    
    // Calculer le drawdown maximum
    const maxDrawdown = calculateMaxDrawdown(equityCurve);
    maxDrawdowns.push(maxDrawdown);
    
    // Calculer le ratio de Sharpe approximatif
    const sharpeRatio = calculateSharpeRatio(resampledReturns);
    sharpeRatios.push(sharpeRatio);
  }
  
  // Calculer les percentiles pour chaque point dans le temps
  const allEquityCurves = Array(numSimulations);
  for (let sim = 0; sim < numSimulations; sim++) {
    // Regénérer la courbe pour toutes les simulations
    const resampledReturns = resampleWithReplacement(returns, returns.length);
    allEquityCurves[sim] = calculateEquityCurve(resampledReturns, initialCapital);
  }
  
  // Convertir en pourcentage par rapport au capital initial
  const allEquityCurvesPercent = allEquityCurves.map(curve => 
    curve.map(value => (value - initialCapital) / initialCapital * 100)
  );
  
  // Calculer les percentiles pour chaque point dans le temps
  const percentileCurves = calculatePercentileCurves(allEquityCurvesPercent);
  
  // Trier les résultats pour calculer les percentiles
  finalReturns.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);
  sharpeRatios.sort((a, b) => a - b);
  
  return {
    equityCurves: equityCurves.map(curve => 
      curve.map(value => (value - initialCapital) / initialCapital * 100)
    ),
    statistics: {
      finalReturns: {
        min: finalReturns[0],
        p5: getPercentile(finalReturns, 5),
        p25: getPercentile(finalReturns, 25),
        p50: getPercentile(finalReturns, 50),
        p75: getPercentile(finalReturns, 75),
        p95: getPercentile(finalReturns, 95),
        max: finalReturns[finalReturns.length - 1]
      },
      maxDrawdowns: {
        min: maxDrawdowns[0],
        p25: getPercentile(maxDrawdowns, 25),
        p50: getPercentile(maxDrawdowns, 50),
        p75: getPercentile(maxDrawdowns, 75),
        max: maxDrawdowns[maxDrawdowns.length - 1]
      },
      sharpeRatios: {
        min: sharpeRatios[0],
        p25: getPercentile(sharpeRatios, 25),
        p50: getPercentile(sharpeRatios, 50),
        p75: getPercentile(sharpeRatios, 75),
        max: sharpeRatios[sharpeRatios.length - 1]
      }
    },
    timePoints,
    percentileCurves
  };
}

/**
 * Calcule une courbe d'équité à partir d'une liste de rendements
 * @param returns Liste des rendements en pourcentage
 * @param initialCapital Capital initial
 * @returns Courbe d'équité
 */
function calculateEquityCurve(returns: number[], initialCapital: number): number[] {
  const equity = [initialCapital];
  let currentEquity = initialCapital;
  
  for (let i = 0; i < returns.length; i++) {
    // Ajouter le rendement au capital actuel
    currentEquity = currentEquity * (1 + returns[i] / 100);
    equity.push(currentEquity);
  }
  
  return equity;
}

/**
 * Effectue un tirage aléatoire avec remise
 * @param array Tableau source
 * @param size Taille de l'échantillon à générer
 * @returns Nouvel échantillon
 */
function resampleWithReplacement<T>(array: T[], size: number): T[] {
  const result: T[] = [];
  
  for (let i = 0; i < size; i++) {
    const randomIndex = Math.floor(Math.random() * array.length);
    result.push(array[randomIndex]);
  }
  
  return result;
}

/**
 * Calcule le drawdown maximum pour une courbe d'équité
 * @param equityCurve Courbe d'équité
 * @returns Drawdown maximum en pourcentage
 */
function calculateMaxDrawdown(equityCurve: number[]): number {
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  
  for (let i = 0; i < equityCurve.length; i++) {
    const value = equityCurve[i];
    if (value > peak) {
      peak = value;
    }
    
    const drawdown = (peak - value) / peak * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * Calcule un ratio de Sharpe approximatif
 * @param returns Liste des rendements
 * @returns Ratio de Sharpe
 */
function calculateSharpeRatio(returns: number[]): number {
  // Calculer le rendement moyen
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calculer l'écart-type des rendements
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Risque sans risque annualisé (approximation)
  const riskFreeRate = 0.05 / 12; // 5% annuel divisé par 12
  
  // Calculer le ratio de Sharpe (annualisé avec approximation)
  const annualizationFactor = Math.sqrt(12); // Approximation pour des rendements mensuels
  
  // Éviter division par zéro
  if (stdDev === 0) return 0;
  
  return ((meanReturn - riskFreeRate) / stdDev) * annualizationFactor;
}

/**
 * Calcule les percentiles pour chaque point de temps
 * @param curves Courbes d'équité
 * @returns Percentiles par point de temps
 */
function calculatePercentileCurves(curves: number[][]): {
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
} {
  const numTimePoints = curves[0].length;
  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];
  
  for (let t = 0; t < numTimePoints; t++) {
    // Extraire les valeurs à ce point temporel pour toutes les courbes
    const values = curves.map(curve => curve[t]).sort((a, b) => a - b);
    
    // Calculer les percentiles
    p5.push(getPercentile(values, 5));
    p25.push(getPercentile(values, 25));
    p50.push(getPercentile(values, 50));
    p75.push(getPercentile(values, 75));
    p95.push(getPercentile(values, 95));
  }
  
  return { p5, p25, p50, p75, p95 };
}

/**
 * Calcule un percentile spécifique
 * @param sortedArr Tableau trié
 * @param percentile Percentile à calculer
 * @returns Valeur du percentile
 */
function getPercentile(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0;
  
  const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(sortedArr.length - 1, index))];
}

/**
 * Retourne des résultats par défaut
 */
function getDefaultResult(): BootstrapResult {
  return {
    equityCurves: [],
    statistics: {
      finalReturns: {
        min: 0,
        p5: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p95: 0,
        max: 0
      },
      maxDrawdowns: {
        min: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        max: 0
      },
      sharpeRatios: {
        min: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        max: 0
      }
    },
    timePoints: [],
    percentileCurves: {
      p5: [],
      p25: [],
      p50: [],
      p75: [],
      p95: []
    }
  };
}

/**
 * Amélioration de la fonction de bootstrap resampling
 * - Augmentation du nombre d'itérations par défaut (2000 au lieu de 1000)
 * - Ajout d'interpolation pour les percentiles
 * - Calcul de statistiques plus robustes
 * 
 * Le bootstrap resampling est une technique statistique qui consiste à:
 * 1. Échantillonner avec remise les rendements de trades historiques
 * 2. Créer de multiples courbes d'équité simulées
 * 3. Calculer des statistiques sur ces courbes
 * 
 * Cette approche permet d'estimer la distribution des performances possibles
 * avec une stratégie donnée, même avec un nombre limité de trades historiques.
 * 
 * @param tradeReturns Tableau de rendements historiques des trades (en pourcentage)
 * @param numSamples Nombre d'échantillons à générer (défaut: 2000)
 * @returns Résultats du bootstrap avec statistiques
 */
export function bootstrapResampling(tradeReturns: number[], numSamples: number = 2000) {
  if (!tradeReturns.length) {
    return {
      equityCurves: [],
      statistics: {
        finalReturns: {
          min: 0, p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, max: 0,
          mean: 0, stdDev: 0
        },
        maxDrawdowns: {
          min: 0, p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, max: 0,
          mean: 0, stdDev: 0
        },
        sharpeRatios: {
          min: 0, p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, max: 0,
          mean: 0, stdDev: 0
        },
        sortinoRatios: {
          min: 0, p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, max: 0,
          mean: 0, stdDev: 0
        },
        winRates: {
          min: 0, p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, max: 0,
          mean: 0, stdDev: 0
        },
        profitFactors: {
          min: 0, p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, max: 0,
          mean: 0, stdDev: 0
        }
      }
    };
  }

  // Nombre de trades dans chaque échantillon (même nombre que les données historiques)
  const sampleSize = tradeReturns.length;
  
  // Matrices pour stocker les résultats
  const equityCurves: number[][] = [];
  const finalReturns: number[] = [];
  const maxDrawdowns: number[] = [];
  const sharpeRatios: number[] = [];
  const sortinoRatios: number[] = [];
  const winRates: number[] = [];
  const profitFactors: number[] = [];
  
  // Générer les échantillons
  for (let i = 0; i < numSamples; i++) {
    // Échantillonnage avec remise
    const sampledReturns: number[] = [];
    for (let j = 0; j < sampleSize; j++) {
      const randomIndex = Math.floor(Math.random() * sampleSize);
      sampledReturns.push(tradeReturns[randomIndex]);
    }
    
    // Construire la courbe d'équité et calculer les statistiques
    const equityCurve = [0]; // Commencer à 0
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let winCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    // Variables pour Sharpe et Sortino
    const periodicReturns: number[] = [];
    
    for (const returnValue of sampledReturns) {
      // Mettre à jour l'équité
      equity += returnValue;
      equityCurve.push(equity);
      
      // Ajouter le rendement pour les calculs de ratio
      periodicReturns.push(returnValue);
      
      // Calculer le drawdown
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = (peak > 0) ? ((peak - equity) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      
      // Compter les trades gagnants et les montants
      if (returnValue > 0) {
        winCount++;
        totalProfit += returnValue;
      } else if (returnValue < 0) {
        totalLoss += Math.abs(returnValue);
      }
    }
    
    // Stocker la courbe d'équité
    equityCurves.push(equityCurve);
    
    // Stocker le rendement final
    finalReturns.push(equity);
    
    // Stocker le drawdown maximal
    maxDrawdowns.push(maxDrawdown);
    
    // Calculer et stocker le taux de réussite
    const winRate = (winCount / sampleSize) * 100;
    winRates.push(winRate);
    
    // Calculer et stocker le profit factor
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 1;
    profitFactors.push(profitFactor === Infinity ? 100 : profitFactor); // Limiter pour l'analyse statistique
    
    // Calculer et stocker les ratios Sharpe et Sortino
    const meanReturn = periodicReturns.reduce((sum, r) => sum + r, 0) / periodicReturns.length;
    
    // Écart-type pour le ratio de Sharpe
    const variance = periodicReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / periodicReturns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : meanReturn > 0 ? 3 : -3; // Valeur arbitraire si stdDev = 0
    sharpeRatios.push(sharpeRatio);
    
    // Écart-type des rendements négatifs pour le ratio de Sortino
    const negativeReturns = periodicReturns.filter(r => r < 0);
    const downside = negativeReturns.length > 0 
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
      : 0.0001; // Éviter division par zéro
    const sortinoRatio = meanReturn / downside;
    sortinoRatios.push(sortinoRatio);
  }
  
  // Trier les résultats pour le calcul des percentiles
  finalReturns.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);
  sharpeRatios.sort((a, b) => a - b);
  sortinoRatios.sort((a, b) => a - b);
  winRates.sort((a, b) => a - b);
  profitFactors.sort((a, b) => a - b);
  
  // Fonction utilitaire pour calculer des statistiques
  const calculateStats = (sortedArr: number[]) => {
    const mean = sortedArr.reduce((sum: number, val: number) => sum + val, 0) / sortedArr.length;
    const variance = sortedArr.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / sortedArr.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      min: sortedArr[0],
      p5: getPercentileWithInterpolation(sortedArr, 5),
      p10: getPercentileWithInterpolation(sortedArr, 10),
      p25: getPercentileWithInterpolation(sortedArr, 25),
      p50: getPercentileWithInterpolation(sortedArr, 50),
      p75: getPercentileWithInterpolation(sortedArr, 75),
      p90: getPercentileWithInterpolation(sortedArr, 90),
      p95: getPercentileWithInterpolation(sortedArr, 95),
      max: sortedArr[sortedArr.length - 1],
      mean,
      stdDev
    };
  };
  
  // Retourner les résultats
  return {
    equityCurves: equityCurves.slice(0, 20), // Limiter le nombre de courbes pour l'affichage
    statistics: {
      finalReturns: calculateStats(finalReturns),
      maxDrawdowns: calculateStats(maxDrawdowns),
      sharpeRatios: calculateStats(sharpeRatios),
      sortinoRatios: calculateStats(sortinoRatios),
      winRates: calculateStats(winRates),
      profitFactors: calculateStats(profitFactors)
    }
  };
}

/**
 * Calcule un percentile avec interpolation linéaire
 * @param sortedArr Tableau de valeurs triées
 * @param percentile Percentile à calculer (entre 0 et 100)
 * @returns Valeur correspondant au percentile demandé
 */
function getPercentileWithInterpolation(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];
  
  const index = (percentile / 100) * (sortedArr.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  
  if (lowerIndex === upperIndex) return sortedArr[lowerIndex];
  
  // Interpolation linéaire
  const weight = index - lowerIndex;
  return sortedArr[lowerIndex] * (1 - weight) + sortedArr[upperIndex] * weight;
} 