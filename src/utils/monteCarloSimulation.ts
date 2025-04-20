import type { Trade } from '../types/trading';

export interface MonteCarloResult {
  // Percentiles des résultats finaux (en pourcentage)
  percentiles: {
    min: number;
    p1: number;  // Ajout du 1er percentile
    p5: number;  // Ajout du 5ème percentile
    p10: number;
    p25: number;
    p50: number; // médiane
    p75: number;
    p90: number;
    p95: number; // Ajout du 95ème percentile
    p99: number; // Ajout du 99ème percentile
    max: number;
  };
  // Probabilité de profit (pourcentage de simulations positives)
  profitProbability: number;
  // Probabilité de drawdown >25% (pourcentage de simulations avec DD > 25%)
  drawdownRisk: number;
  // Données des simulations pour affichage graphique (un sous-ensemble)
  simulationPaths: number[][];
  // Percentiles pour chaque étape du chemin (pour affichage dans le graphique)
  pathPercentiles: {
    p5: number[];  // Ajout du 5ème percentile
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
    p95: number[]; // Ajout du 95ème percentile
  };
  // Statistiques additionnelles
  statistics: {
    meanFinalReturn: number;     // Rendement final moyen
    stdDevFinalReturn: number;   // Écart-type des rendements finaux
    skewness: number;            // Asymétrie des rendements finaux
    kurtosis: number;            // Aplatissement des rendements finaux
    maxDrawdownDistribution: {   // Distribution des drawdowns maximaux
      mean: number;              // Moyenne
      median: number;            // Médiane
      p95: number;               // 95ème percentile
    };
    recoveryRatePercentage: number; // Pourcentage de simulations qui récupèrent d'un drawdown >10%
  };
}

/**
 * Effectue une simulation Monte Carlo basée sur les performances historiques
 * @param trades Historique des trades
 * @param numSimulations Nombre de simulations à exécuter (défaut: 1000 pour plus de précision)
 * @param numTrades Nombre de trades à simuler (par défaut 500)
 * @param useBlockResampling Utiliser le resampling par blocs pour capturer les corrélations
 * @param blockSize Taille des blocs pour le resampling (si blockResampling est activé)
 * @returns Résultats de la simulation
 */
export function runMonteCarloSimulation(
  trades: Trade[],
  numSimulations: number = 1000,
  numTrades: number = 500,
  useBlockResampling: boolean = true,
  blockSize: number = 5
): MonteCarloResult {
  // S'il n'y a pas de trades ou pas assez pour le resampling par blocs, retourner des valeurs par défaut
  if (!trades.length || (useBlockResampling && trades.length < blockSize)) {
    return getDefaultResult();
  }

  // Extraire les profits/pertes en pourcentage (supposons que profitLoss est en %)
  const profitLossValues = trades.map(trade => trade.profitLoss);
  
  // Créer les blocs pour le resampling si demandé
  const blocks: number[][] = [];
  if (useBlockResampling) {
    for (let i = 0; i <= profitLossValues.length - blockSize; i++) {
      blocks.push(profitLossValues.slice(i, i + blockSize));
    }
  }

  // Initialiser les tableaux pour stocker les résultats
  const finalValues: number[] = [];
  const simulationPaths: number[][] = [];
  const maxDrawdowns: number[] = [];
  const recoveryRates: boolean[] = [];

  // Effectuer les simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    // Commencer chaque simulation à 0% (aucun gain/perte)
    let equity = 0;
    const equityCurve = [equity];
    let peak = 0;
    let maxDrawdown = 0;
    let hasExperiencedSignificantDrawdown = false;
    let hasRecoveredFromDrawdown = false;

    // Simuler les trades
    let tradeIndex = 0;
    while (tradeIndex < numTrades) {
      if (useBlockResampling) {
        // Sélectionner un bloc aléatoire
        const randomBlockIndex = Math.floor(Math.random() * blocks.length);
        const block = blocks[randomBlockIndex];
        
        // Appliquer tous les trades du bloc
        for (const tradeResult of block) {
          if (tradeIndex >= numTrades) break;
          
          // Mettre à jour l'équité
          equity += tradeResult;
          equityCurve.push(equity);
          
          // Vérifier les drawdowns
          if (equity > peak) {
            peak = equity;
          }
          
          const currentDrawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
          if (currentDrawdown > maxDrawdown) {
            maxDrawdown = currentDrawdown;
          }
          
          // Vérifier si nous avons un drawdown significatif (>10%)
          if (currentDrawdown > 10) {
            hasExperiencedSignificantDrawdown = true;
          }
          
          // Vérifier si nous avons récupéré après un drawdown (retour à 90% du peak précédent)
          if (hasExperiencedSignificantDrawdown && equity >= 0.9 * peak) {
            hasRecoveredFromDrawdown = true;
          }
          
          tradeIndex++;
        }
      } else {
        // Choisir aléatoirement un résultat historique individuel
        const randomIndex = Math.floor(Math.random() * profitLossValues.length);
        const tradeResult = profitLossValues[randomIndex];

        // Mettre à jour l'équité
        equity += tradeResult;
        equityCurve.push(equity);

        // Vérifier les drawdowns
        if (equity > peak) {
          peak = equity;
        }

        const currentDrawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
        
        // Vérifier si nous avons un drawdown significatif (>10%)
        if (currentDrawdown > 10) {
          hasExperiencedSignificantDrawdown = true;
        }
        
        // Vérifier si nous avons récupéré après un drawdown (retour à 90% du peak précédent)
        if (hasExperiencedSignificantDrawdown && equity >= 0.9 * peak) {
          hasRecoveredFromDrawdown = true;
        }
        
        tradeIndex++;
      }
    }

    // Stocker les résultats
    finalValues.push(equity);
    simulationPaths.push(equityCurve);
    maxDrawdowns.push(maxDrawdown);
    
    // Noter si cette simulation a récupéré d'un drawdown significatif
    if (hasExperiencedSignificantDrawdown) {
      recoveryRates.push(hasRecoveredFromDrawdown);
    }
  }

  // Trier les valeurs finales pour le calcul des percentiles
  finalValues.sort((a, b) => a - b);
  
  // Trier les drawdowns pour le calcul des percentiles
  maxDrawdowns.sort((a, b) => a - b);

  // Calculer les percentiles avec interpolation linéaire
  const percentiles = {
    min: finalValues[0],
    p1: getPercentileWithInterpolation(finalValues, 1),
    p5: getPercentileWithInterpolation(finalValues, 5),
    p10: getPercentileWithInterpolation(finalValues, 10),
    p25: getPercentileWithInterpolation(finalValues, 25),
    p50: getPercentileWithInterpolation(finalValues, 50),
    p75: getPercentileWithInterpolation(finalValues, 75),
    p90: getPercentileWithInterpolation(finalValues, 90),
    p95: getPercentileWithInterpolation(finalValues, 95),
    p99: getPercentileWithInterpolation(finalValues, 99),
    max: finalValues[finalValues.length - 1]
  };

  // Calculer la probabilité de profit
  const profitProbability = (finalValues.filter(val => val > 0).length / finalValues.length) * 100;

  // Calculer le risque de drawdown
  const drawdownRisk = (maxDrawdowns.filter(dd => dd > 25).length / maxDrawdowns.length) * 100;

  // Calculer les percentiles pour chaque point du chemin avec plus de détails
  const pathPercentiles = calculatePathPercentiles(simulationPaths);
  
  // Calculer les statistiques additionnelles
  const statistics = calculateAdditionalStats(finalValues, maxDrawdowns, recoveryRates);

  return {
    percentiles,
    profitProbability,
    drawdownRisk,
    simulationPaths: selectRepresentativePaths(simulationPaths, finalValues, 10),
    pathPercentiles,
    statistics
  };
}

/**
 * Sélectionne des chemins représentatifs pour l'affichage
 * @param paths Tous les chemins de simulation
 * @param finalValues Les valeurs finales correspondantes
 * @param numPathsToShow Nombre de chemins à afficher
 * @returns Chemins sélectionnés
 */
function selectRepresentativePaths(paths: number[][], finalValues: number[], numPathsToShow: number): number[][] {
  // Créer des paires [index, valeur] pour pouvoir trier tout en gardant les indices
  const indexedValues = finalValues.map((val, idx) => [idx, val]);
  
  // Trier par valeur finale
  indexedValues.sort((a, b) => (a[1] as number) - (b[1] as number));
  
  // Sélectionner un échantillon représentatif des chemins
  const selectedPaths: number[][] = [];
  
  // Prendre le pire chemin
  selectedPaths.push(paths[indexedValues[0][0] as number]);
  
  // Prendre le meilleur chemin
  selectedPaths.push(paths[indexedValues[indexedValues.length - 1][0] as number]);
  
  // Prendre des chemins à intervalles réguliers entre les extrêmes
  const step = (indexedValues.length - 2) / (numPathsToShow - 2);
  for (let i = 1; i < numPathsToShow - 1; i++) {
    const index = Math.floor(i * step);
    selectedPaths.push(paths[indexedValues[index][0] as number]);
  }
  
  return selectedPaths;
}

/**
 * Calcule des statistiques additionnelles sur les simulations
 * @param finalValues Valeurs finales des simulations
 * @param maxDrawdowns Drawdowns maximaux des simulations
 * @param recoveryRates Taux de récupération après drawdown
 * @returns Statistiques additionnelles
 */
function calculateAdditionalStats(
  finalValues: number[], 
  maxDrawdowns: number[],
  recoveryRates: boolean[]
): MonteCarloResult['statistics'] {
  // Calculer la moyenne des rendements finaux
  const meanFinalReturn = finalValues.reduce((sum, val) => sum + val, 0) / finalValues.length;
  
  // Calculer l'écart-type des rendements finaux
  const squaredDiffs = finalValues.map(val => Math.pow(val - meanFinalReturn, 2));
  const stdDevFinalReturn = Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / finalValues.length);
  
  // Calculer l'asymétrie (skewness)
  const cubedDiffs = finalValues.map(val => Math.pow((val - meanFinalReturn) / stdDevFinalReturn, 3));
  const skewness = cubedDiffs.reduce((sum, val) => sum + val, 0) / finalValues.length;
  
  // Calculer l'aplatissement (kurtosis)
  const fourthPowerDiffs = finalValues.map(val => Math.pow((val - meanFinalReturn) / stdDevFinalReturn, 4));
  const kurtosis = fourthPowerDiffs.reduce((sum, val) => sum + val, 0) / finalValues.length;
  
  // Calculer les statistiques sur les drawdowns maximaux
  const meanMaxDrawdown = maxDrawdowns.reduce((sum, val) => sum + val, 0) / maxDrawdowns.length;
  maxDrawdowns.sort((a, b) => a - b);
  const medianMaxDrawdown = getPercentileWithInterpolation(maxDrawdowns, 50);
  const p95MaxDrawdown = getPercentileWithInterpolation(maxDrawdowns, 95);
  
  // Calculer le taux de récupération
  const recoveryRatePercentage = recoveryRates.length > 0 
    ? (recoveryRates.filter(recovered => recovered).length / recoveryRates.length) * 100
    : 0;
  
  return {
    meanFinalReturn,
    stdDevFinalReturn,
    skewness,
    kurtosis,
    maxDrawdownDistribution: {
      mean: meanMaxDrawdown,
      median: medianMaxDrawdown,
      p95: p95MaxDrawdown
    },
    recoveryRatePercentage
  };
}

/**
 * Calcule les percentiles pour chaque étape du chemin
 * @param paths Chemins des simulations
 * @returns Percentiles pour chaque point
 */
function calculatePathPercentiles(paths: number[][]): {
  p5: number[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  p95: number[];
} {
  // S'assurer que tous les chemins ont la même longueur
  const pathLength = paths[0].length;
  
  // Initialiser les tableaux pour chaque percentile
  const p5: number[] = [];
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];
  const p95: number[] = [];

  // Pour chaque point du chemin
  for (let i = 0; i < pathLength; i++) {
    // Extraire les valeurs à ce point pour tous les chemins
    const values = paths.map(path => path[i]).sort((a, b) => a - b);
    
    // Calculer et stocker les percentiles avec interpolation
    p5.push(getPercentileWithInterpolation(values, 5));
    p10.push(getPercentileWithInterpolation(values, 10));
    p25.push(getPercentileWithInterpolation(values, 25));
    p50.push(getPercentileWithInterpolation(values, 50));
    p75.push(getPercentileWithInterpolation(values, 75));
    p90.push(getPercentileWithInterpolation(values, 90));
    p95.push(getPercentileWithInterpolation(values, 95));
  }

  return { p5, p10, p25, p50, p75, p90, p95 };
}

/**
 * Calcule un percentile spécifique à partir d'un tableau trié avec interpolation linéaire
 * @param sortedArr Tableau trié
 * @param percentile Percentile à calculer (0-100)
 * @returns Valeur du percentile
 */
function getPercentileWithInterpolation(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];
  
  const index = (percentile / 100) * (sortedArr.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  
  // Si les indices sont identiques, pas besoin d'interpolation
  if (lowerIndex === upperIndex) return sortedArr[lowerIndex];
  
  // Interpolation linéaire
  const weight = index - lowerIndex;
  return sortedArr[lowerIndex] * (1 - weight) + sortedArr[upperIndex] * weight;
}

/**
 * Méthode simple pour calculer un percentile (sans interpolation)
 * Conservée pour compatibilité avec le code existant
 * @param sortedArr Tableau trié
 * @param percentile Percentile à calculer (0-100)
 * @returns Valeur du percentile
 */
function getPercentile(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0;
  
  const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(sortedArr.length - 1, index))];
}

/**
 * Retourne des résultats par défaut quand il n'y a pas de données
 */
function getDefaultResult(): MonteCarloResult {
  return {
    percentiles: {
      min: 0,
      p1: 0,
      p5: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      max: 0
    },
    profitProbability: 0,
    drawdownRisk: 0,
    simulationPaths: [],
    pathPercentiles: {
      p5: [],
      p10: [],
      p25: [],
      p50: [],
      p75: [],
      p90: [],
      p95: []
    },
    statistics: {
      meanFinalReturn: 0,
      stdDevFinalReturn: 0,
      skewness: 0,
      kurtosis: 3,
      maxDrawdownDistribution: {
        mean: 0,
        median: 0,
        p95: 0
      },
      recoveryRatePercentage: 0
    }
  };
} 