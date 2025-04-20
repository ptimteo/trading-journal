/**
 * Implémentation du Geometric Brownian Motion (GBM) pour simuler l'évolution des prix d'actifs financiers
 * 
 * Équation différentielle stochastique:
 * dS_t = μ S_t dt + σ S_t dW_t
 * 
 * Solution discrète:
 * S_{t+Δt} = S_t × e^{(μ - σ²/2)Δt + σ√Δt·Z_t}
 * 
 * Avec améliorations:
 * - Génération efficace des nombres aléatoires
 * - Option pour utiliser une distribution à queues épaisses (fat tails)
 * - Possibilité d'ajouter un facteur de retour à la moyenne (mean reversion)
 */

export interface GBMParameters {
  initialPrice: number;     // Prix initial S_0
  mu: number;               // Drift (rendement moyen annualisé en décimal)
  sigma: number;            // Volatilité (annualisée en décimal)
  deltaT: number;           // Pas de temps (ex: 1/252 pour données journalières)
  timeHorizon: number;      // Durée totale en unités de temps (ex: années)
  fatTailFactor?: number;   // Facteur d'épaisseur des queues (0 = normal, >0 = queues plus épaisses)
  meanReversionSpeed?: number; // Vitesse de retour à la moyenne (0 = pas de retour)
  meanReversionLevel?: number; // Niveau de prix vers lequel tend le retour à la moyenne
}

export interface GBMResult {
  timePoints: number[];    // Points temporels
  pricePath: number[];     // Trajectoire des prix
  returns: number[];       // Rendements associés (en pourcentage)
  stats: {
    finalPrice: number;    // Prix final
    totalReturn: number;   // Rendement total (en pourcentage)
    maxDrawdown: number;   // Drawdown maximal (en pourcentage)
    volatility: number;    // Volatilité réalisée (en pourcentage)
    sharpeRatio: number;   // Ratio de Sharpe
    sortinoRatio: number;  // Ratio de Sortino
    skewness: number;      // Asymétrie (skewness) des rendements
    kurtosis: number;      // Kurtosis des rendements
  };
}

// Cache pour la génération des nombres aléatoires normaux
// La méthode de Box-Muller génère 2 variables aléatoires à la fois,
// donc on peut en stocker une pour le prochain appel
let cachedNormal: number | null = null;

/**
 * Simule une trajectoire de prix selon le modèle de Geometric Brownian Motion (GBM)
 * @param params Paramètres de la simulation
 * @returns Résultat de la simulation contenant la trajectoire et les statistiques
 */
export function simulateGBM(params: GBMParameters): GBMResult {
  const { 
    initialPrice, 
    mu, 
    sigma, 
    deltaT, 
    timeHorizon,
    fatTailFactor = 0,         // Par défaut, distribution normale standard
    meanReversionSpeed = 0,    // Par défaut, pas de retour à la moyenne
    meanReversionLevel = initialPrice // Par défaut, niveau = prix initial
  } = params;
  
  // Nombre de pas de temps
  const numSteps = Math.round(timeHorizon / deltaT);
  
  // Initialiser les tableaux
  const timePoints = [0];
  const pricePath = [initialPrice];
  const returns: number[] = [];
  
  let currentPrice = initialPrice;
  let peak = initialPrice;
  let maxDrawdown = 0;
  
  // Simuler la trajectoire
  for (let i = 1; i <= numSteps; i++) {
    // Générer un nombre aléatoire suivant une loi normale standard N(0,1)
    let z = generateEfficientNormalRandom();
    
    // Appliquer le facteur de queues épaisses si nécessaire
    if (fatTailFactor > 0) {
      // Transformation pour obtenir une distribution Student-t avec un nombre de degrés de liberté équivalent
      // Plus fatTailFactor est grand, plus les queues sont épaisses
      const u = Math.random();
      const degreeOfFreedom = 10 / (fatTailFactor + 0.1); // Entre 2 et 100 degrés de liberté
      const t = generateStudentT(degreeOfFreedom);
      
      // Combiner la distribution normale et la distribution t
      // Plus fatTailFactor est proche de 1, plus on utilise la distribution t
      z = (1 - fatTailFactor) * z + fatTailFactor * t;
    }
    
    // Calculer le terme de drift standard
    let drift = (mu - 0.5 * sigma * sigma) * deltaT;
    
    // Ajouter le terme de retour à la moyenne si nécessaire
    if (meanReversionSpeed > 0 && meanReversionLevel > 0) {
      // Calculer l'écart entre le prix actuel et le niveau de retour à la moyenne
      const gap = Math.log(meanReversionLevel / currentPrice);
      
      // Plus meanReversionSpeed est grand, plus le retour vers meanReversionLevel est rapide
      drift += meanReversionSpeed * gap * deltaT;
    }
    
    // Calculer le terme de volatilité
    const randomShock = sigma * Math.sqrt(deltaT) * z;
    
    // Calculer le nouveau prix selon la formule du GBM modifiée
    const newPrice = currentPrice * Math.exp(drift + randomShock);
    
    // Calculer le rendement en pourcentage
    const periodReturn = ((newPrice - currentPrice) / currentPrice) * 100;
    
    // Mettre à jour les tableaux
    timePoints.push(i * deltaT);
    pricePath.push(newPrice);
    returns.push(periodReturn);
    
    // Mettre à jour le prix actuel
    currentPrice = newPrice;
    
    // Mettre à jour le pic et calculer le drawdown
    if (newPrice > peak) {
      peak = newPrice;
    } else {
      const drawdown = ((peak - newPrice) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  
  // Calculer les statistiques
  const finalPrice = pricePath[pricePath.length - 1];
  const totalReturn = ((finalPrice - initialPrice) / initialPrice) * 100;
  
  // Calculer la volatilité réalisée (annualisée)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const periodVolatility = Math.sqrt(variance);
  const annualizedVolatility = periodVolatility * Math.sqrt(1 / deltaT);
  
  // Calculer les moments d'ordre supérieur (skewness et kurtosis)
  const { skewness, kurtosis } = calculateHigherMoments(returns, avgReturn, periodVolatility);
  
  // Calculer le ratio de Sharpe (assumant un taux sans risque de 0% pour simplifier)
  const annualizedReturn = totalReturn / timeHorizon;
  const sharpeRatio = annualizedVolatility > 0 ? annualizedReturn / annualizedVolatility : 0;
  
  // Calculer le ratio de Sortino (ne prend en compte que la volatilité négative)
  const negativeReturns = returns.filter(r => r < 0);
  const downside = negativeReturns.length > 0 
    ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length) * Math.sqrt(1 / deltaT)
    : 0.001; // Éviter division par zéro
  const sortinoRatio = downside > 0 ? annualizedReturn / downside : 0;
  
  return {
    timePoints,
    pricePath,
    returns,
    stats: {
      finalPrice,
      totalReturn,
      maxDrawdown,
      volatility: annualizedVolatility,
      sharpeRatio,
      sortinoRatio,
      skewness,
      kurtosis
    }
  };
}

/**
 * Simule plusieurs trajectoires GBM et calcule les percentiles
 * @param params Paramètres de base de la simulation
 * @param numSimulations Nombre de simulations à exécuter
 * @returns Tableau des résultats de simulation et statistiques des percentiles
 */
export function simulateMultipleGBM(params: GBMParameters, numSimulations: number = 100): {
  simulations: GBMResult[],
  percentiles: {
    p1: number[],
    p5: number[],
    p10: number[],
    p25: number[],
    p50: number[],
    p75: number[],
    p90: number[],
    p95: number[],
    p99: number[]
  }
} {
  // Exécuter les simulations
  const simulations: GBMResult[] = [];
  for (let i = 0; i < numSimulations; i++) {
    simulations.push(simulateGBM(params));
  }
  
  // Nombre de pas de temps dans chaque simulation
  const numSteps = simulations[0].pricePath.length;
  
  // Calculer les percentiles à chaque pas de temps
  const p1: number[] = new Array(numSteps);
  const p5: number[] = new Array(numSteps);
  const p10: number[] = new Array(numSteps);
  const p25: number[] = new Array(numSteps);
  const p50: number[] = new Array(numSteps);
  const p75: number[] = new Array(numSteps);
  const p90: number[] = new Array(numSteps);
  const p95: number[] = new Array(numSteps);
  const p99: number[] = new Array(numSteps);
  
  for (let step = 0; step < numSteps; step++) {
    // Extraire les prix à ce pas de temps pour toutes les simulations
    const pricesAtStep = simulations.map(sim => sim.pricePath[step]);
    
    // Trier les prix pour calculer les percentiles
    pricesAtStep.sort((a, b) => a - b);
    
    // Calculer les indices des percentiles avec interpolation linéaire
    p1[step] = getPercentile(pricesAtStep, 0.01);
    p5[step] = getPercentile(pricesAtStep, 0.05);
    p10[step] = getPercentile(pricesAtStep, 0.10);
    p25[step] = getPercentile(pricesAtStep, 0.25);
    p50[step] = getPercentile(pricesAtStep, 0.50);
    p75[step] = getPercentile(pricesAtStep, 0.75);
    p90[step] = getPercentile(pricesAtStep, 0.90);
    p95[step] = getPercentile(pricesAtStep, 0.95);
    p99[step] = getPercentile(pricesAtStep, 0.99);
  }
  
  return {
    simulations,
    percentiles: {
      p1, p5, p10, p25, p50, p75, p90, p95, p99
    }
  };
}

/**
 * Calcule un percentile avec interpolation linéaire
 * @param sortedValues Tableau de valeurs triées
 * @param percentile Percentile à calculer (entre 0 et 1)
 * @returns Valeur correspondant au percentile demandé
 */
function getPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  
  const index = percentile * (sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  
  // Interpolation linéaire
  const weight = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

/**
 * Génère un nombre aléatoire suivant une loi normale standard N(0,1)
 * Utilise la méthode de Box-Muller avec cache pour efficacité
 */
function generateEfficientNormalRandom(): number {
  // Si nous avons un nombre dans le cache, l'utiliser et vider le cache
  if (cachedNormal !== null) {
    const result = cachedNormal;
    cachedNormal = null;
    return result;
  }
  
  // Sinon, générer deux nouveaux nombres
  const u1 = Math.random();
  const u2 = Math.random();
  
  // Éviter le cas où u1 est très proche de 0
  const safeU1 = Math.max(u1, 1e-10);
  
  // Transformation de Box-Muller
  const magnitude = Math.sqrt(-2 * Math.log(safeU1));
  const theta = 2 * Math.PI * u2;
  
  // Stocker le second nombre pour une utilisation future
  cachedNormal = magnitude * Math.sin(theta);
  
  // Retourner le premier nombre
  return magnitude * Math.cos(theta);
}

/**
 * Génère un nombre aléatoire suivant une loi de Student-t
 * @param degreeOfFreedom Nombre de degrés de liberté
 * @returns Nombre aléatoire suivant une loi de Student-t
 */
function generateStudentT(degreeOfFreedom: number): number {
  // Approche basée sur le fait qu'une variable t peut être générée en divisant une variable normale par la racine carrée d'une variable chi-2 divisée par ses degrés de liberté
  const z = generateEfficientNormalRandom();
  let chiSquare = 0;
  
  // Générer une chi-2 avec v degrés de liberté
  for (let i = 0; i < degreeOfFreedom; i++) {
    const zi = generateEfficientNormalRandom();
    chiSquare += zi * zi;
  }
  
  // Calculer la valeur de Student-t
  return z / Math.sqrt(chiSquare / degreeOfFreedom);
}

/**
 * Calcule les moments d'ordre supérieur (skewness et kurtosis) d'une série de rendements
 * @param returns Tableau des rendements
 * @param mean Moyenne des rendements
 * @param stdDev Écart-type des rendements
 * @returns Objet contenant le skewness et le kurtosis
 */
function calculateHigherMoments(returns: number[], mean: number, stdDev: number): { skewness: number, kurtosis: number } {
  if (returns.length < 3 || stdDev === 0) {
    return { skewness: 0, kurtosis: 3 }; // Valeurs pour une distribution normale
  }
  
  // Calcul du skewness (asymétrie)
  let sumCubes = 0;
  for (const r of returns) {
    sumCubes += Math.pow((r - mean) / stdDev, 3);
  }
  const skewness = sumCubes / returns.length;
  
  // Calcul du kurtosis (aplatissement)
  let sumQuarts = 0;
  for (const r of returns) {
    sumQuarts += Math.pow((r - mean) / stdDev, 4);
  }
  const kurtosis = sumQuarts / returns.length;
  
  return { skewness, kurtosis };
} 