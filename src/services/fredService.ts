import axios from 'axios';

// Clé API FRED (à remplacer par votre clé API)
const FRED_API_KEY = '12cf82706082bfafe244490916dd87e9';
// Utiliser un proxy local au lieu d'appeler directement l'API FRED (pour éviter les erreurs CORS)
const API_BASE_URL = '/api/fred'; // Ce chemin sera géré par votre serveur Node.js

// Identifiants des séries FRED pour les indicateurs économiques les plus courants
const SERIES_IDS = {
  // Croissance du PIB
  GDP_GROWTH: 'A191RL1Q225SBEA', // Taux de croissance du PIB réel (%)
  
  // Inflation
  INFLATION_RATE: 'CPIAUCSL', // Indice des prix à la consommation
  
  // Taux de chômage
  UNEMPLOYMENT_RATE: 'UNRATE', // Taux de chômage
  
  // Taux d'intérêt
  FEDERAL_FUNDS_RATE: 'FEDFUNDS', // Taux directeur de la Fed
  TREASURY_10Y: 'DGS10', // Rendement des bons du Trésor à 10 ans
  TREASURY_2Y: 'DGS2', // Rendement des bons du Trésor à 2 ans
  
  // Indicateurs économiques
  PMI: 'NAPM', // Indice des directeurs d'achat manufacturier
  CONSUMER_CONFIDENCE: 'UMCSENT', // Indice de confiance des consommateurs
  HOUSING_STARTS: 'HOUST', // Mises en chantier de logements
  BUILDING_PERMITS: 'PERMIT', // Permis de construire
  INDUSTRIAL_PRODUCTION: 'INDPRO', // Production industrielle
  
  // Marchés mondiaux
  DOLLAR_INDEX: 'DTWEXBGS', // Indice du dollar US
  VIX: 'VIXCLS', // Indice de volatilité
  GOLD_PRICE: 'GOLDAMGBD228NLBM', // Prix de l'or
  OIL_PRICE: 'DCOILWTICO' // Prix du pétrole WTI
};

interface FredSeriesResponse {
  seriess: Array<{
    id: string;
    title: string;
    observation_start: string;
    observation_end: string;
    frequency: string;
    units: string;
    notes: string;
  }>;
}

interface FredObservationsResponse {
  observations: Array<{
    date: string;
    value: string;
    realtime_start: string;
    realtime_end: string;
  }>;
}

interface InterestRates {
  federal: number;
  treasury10Y: number;
  treasury2Y: number;
}

interface MarketIndicator {
  value: number;
  change: number;
}

interface MarketIndicators {
  dollarIndex: MarketIndicator;
  vix: MarketIndicator;
  gold: MarketIndicator;
  oil: MarketIndicator;
}

export interface MacroEconomicData {
  gdpGrowth: number;
  inflation: number;
  unemploymentRate: number;
  housingStarts: number;
  housingStartsChange: number;
  buildingPermits: number;
  buildingPermitsChange: number;
  industrialProduction: number;
  pmiManufacturing: number;
  pmiServices: number;
  interestRates: InterestRates;
  marketIndicators: MarketIndicators;
  lastUpdated: string;
}

export interface TimeSeriesData {
  dates: string[];
  values: number[];
  lastUpdated: string;
}

// Données mockées pour le développement sans API key
const MOCK_DATA: MacroEconomicData = {
  gdpGrowth: 2.4,
  inflation: 3.1,
  unemploymentRate: 3.8,
  housingStarts: 1.35, // Millions d'unités
  housingStartsChange: -2.5, // Pourcentage de variation mensuelle
  buildingPermits: 1.42, // Millions d'unités
  buildingPermitsChange: 1.3, // Pourcentage de variation mensuelle
  industrialProduction: 102.7,
  pmiManufacturing: 49.1,
  pmiServices: 54.5,
  interestRates: {
    federal: 5.25,
    treasury10Y: 4.45,
    treasury2Y: 4.78
  },
  marketIndicators: {
    dollarIndex: {
      value: 104.2,
      change: 0.42
    },
    vix: {
      value: 18.7,
      change: -0.28
    },
    gold: {
      value: 2380.8,
      change: 1.25
    },
    oil: {
      value: 78.9,
      change: -0.93
    }
  },
  lastUpdated: new Date().toISOString()
};

class FredService {
  private static instance: FredService;

  private constructor() {}

  public static getInstance(): FredService {
    if (!FredService.instance) {
      FredService.instance = new FredService();
    }
    return FredService.instance;
  }

  private async getLatestObservation(seriesId: string): Promise<number> {
    try {
      // Utilisez votre serveur proxy Node.js
      const response = await axios.get(`${API_BASE_URL}/observation`, { 
        params: {
          series_id: seriesId,
          api_key: FRED_API_KEY,
          limit: 1
        } 
      });
      
      if (response.data && response.data.value !== undefined) {
        return parseFloat(response.data.value);
      }

      return 0;
    } catch (error) {
      console.error(`Erreur lors de la récupération des données FRED pour ${seriesId}:`, error);
      return 0;
    }
  }

  /**
   * Calcule le taux de variation entre deux valeurs consécutives d'une série
   */
  private async getGrowthRate(seriesId: string): Promise<number> {
    try {
      // Utilisez votre serveur proxy Node.js
      const response = await axios.get(`${API_BASE_URL}/growth-rate`, { 
        params: {
          series_id: seriesId,
          api_key: FRED_API_KEY
        } 
      });
      
      if (response.data && response.data.growthRate !== undefined) {
        return response.data.growthRate;
      }

      return 0;
    } catch (error) {
      console.error(`Erreur lors du calcul du taux de croissance pour ${seriesId}:`, error);
      return 0;
    }
  }

  public async getHousingStartsData(): Promise<TimeSeriesData> {
    try {
      console.log('Récupération des données de mises en chantier depuis:', `${API_BASE_URL}/api/fred/HOUST`);
      const response = await axios.get(`${API_BASE_URL}/api/fred/HOUST`);
      
      console.log('Réponse API mises en chantier:', response.data);
      
      const formattedData: TimeSeriesData = {
        dates: [],
        values: [],
        lastUpdated: new Date().toISOString()
      };
      
      if (response.data && response.data.observations && Array.isArray(response.data.observations)) {
        // Filtrer pour n'inclure que les entrées avec des valeurs valides
        const validObservations = response.data.observations.filter((obs: any) => 
          obs.value !== '.' && !isNaN(parseFloat(obs.value))
        );
        
        // Trier par date (du plus ancien au plus récent)
        validObservations.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Ne garder que les 24 derniers mois pour l'affichage
        const recentObservations = validObservations.slice(-24);
        
        // Transformer les données
        recentObservations.forEach((item: any) => {
          const dateObj = new Date(item.date);
          const month = dateObj.getMonth() + 1;
          const year = dateObj.getFullYear();
          
          // Format de date "MM/YY"
          const formattedDate = `${month}/${year.toString().substr(2, 2)}`;
          
          formattedData.dates.push(formattedDate);
          formattedData.values.push(parseFloat(item.value));
        });
        
        console.log('Données mises en chantier formatées:', formattedData);
        return formattedData;
      } else if (response.data && Array.isArray(response.data)) {
        // Si la réponse est déjà un tableau
        const sortedData = [...response.data].sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Ne garder que les 24 derniers mois
        const recentData = sortedData.slice(-24);
        
        recentData.forEach((item: any) => {
          if (item.date && item.value && item.value !== '.' && !isNaN(parseFloat(item.value))) {
            const dateObj = new Date(item.date);
            const month = dateObj.getMonth() + 1;
            const year = dateObj.getFullYear();
            
            // Format de date "MM/YY"
            const formattedDate = `${month}/${year.toString().substr(2, 2)}`;
            
            formattedData.dates.push(formattedDate);
            formattedData.values.push(parseFloat(item.value));
          }
        });
        
        console.log('Données mises en chantier formatées (format alternatif):', formattedData);
        return formattedData;
      }
      
      console.error('Format de réponse inattendu pour les mises en chantier:', response.data);
      return this.getEmptyTimeSeriesData();
    } catch (error) {
      console.error('Erreur lors de la récupération des données de mises en chantier:', error);
      return this.getEmptyTimeSeriesData();
    }
  }

  public async getBuildingPermitsData(): Promise<TimeSeriesData> {
    try {
      console.log('Récupération des données de permis de construire depuis:', `${API_BASE_URL}/api/fred/PERMIT`);
      const response = await axios.get(`${API_BASE_URL}/api/fred/PERMIT`);
      
      console.log('Réponse API permis de construire:', response.data);
      
      const formattedData: TimeSeriesData = {
        dates: [],
        values: [],
        lastUpdated: new Date().toISOString()
      };
      
      if (response.data && response.data.observations && Array.isArray(response.data.observations)) {
        // Filtrer pour n'inclure que les entrées avec des valeurs valides
        const validObservations = response.data.observations.filter((obs: any) => 
          obs.value !== '.' && !isNaN(parseFloat(obs.value))
        );
        
        // Trier par date (du plus ancien au plus récent)
        validObservations.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Ne garder que les 24 derniers mois pour l'affichage
        const recentObservations = validObservations.slice(-24);
        
        // Transformer les données
        recentObservations.forEach((item: any) => {
          const dateObj = new Date(item.date);
          const month = dateObj.getMonth() + 1;
          const year = dateObj.getFullYear();
          
          // Format de date "MM/YY"
          const formattedDate = `${month}/${year.toString().substr(2, 2)}`;
          
          formattedData.dates.push(formattedDate);
          formattedData.values.push(parseFloat(item.value));
        });
        
        console.log('Données permis de construire formatées:', formattedData);
        return formattedData;
      } else if (response.data && Array.isArray(response.data)) {
        // Si la réponse est déjà un tableau
        const sortedData = [...response.data].sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Ne garder que les 24 derniers mois
        const recentData = sortedData.slice(-24);
        
        recentData.forEach((item: any) => {
          if (item.date && item.value && item.value !== '.' && !isNaN(parseFloat(item.value))) {
            const dateObj = new Date(item.date);
            const month = dateObj.getMonth() + 1;
            const year = dateObj.getFullYear();
            
            // Format de date "MM/YY"
            const formattedDate = `${month}/${year.toString().substr(2, 2)}`;
            
            formattedData.dates.push(formattedDate);
            formattedData.values.push(parseFloat(item.value));
          }
        });
        
        console.log('Données permis de construire formatées (format alternatif):', formattedData);
        return formattedData;
      }
      
      console.error('Format de réponse inattendu pour les permis de construire:', response.data);
      return this.getEmptyTimeSeriesData();
    } catch (error) {
      console.error('Erreur lors de la récupération des données de permis de construire:', error);
      return this.getEmptyTimeSeriesData();
    }
  }

  public async getRetailSalesData(): Promise<TimeSeriesData> {
    try {
      console.log('Récupération des données de ventes au détail depuis:', `${API_BASE_URL}/api/fred/RSXFS`);
      const response = await axios.get(`${API_BASE_URL}/api/fred/RSXFS`);
      
      console.log('Réponse API ventes au détail:', response.data);
      
      const formattedData: TimeSeriesData = {
        dates: [],
        values: [],
        lastUpdated: new Date().toISOString()
      };
      
      if (response.data && response.data.observations && Array.isArray(response.data.observations)) {
        // Filtrer pour n'inclure que les entrées avec des valeurs valides
        const validObservations = response.data.observations.filter((obs: any) => 
          obs.value !== '.' && !isNaN(parseFloat(obs.value))
        );
        
        // Trier par date (du plus ancien au plus récent)
        validObservations.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Ne garder que les 24 derniers mois pour l'affichage
        const recentObservations = validObservations.slice(-24);
        
        // Transformer les données
        recentObservations.forEach((item: any) => {
          const dateObj = new Date(item.date);
          const month = dateObj.getMonth() + 1;
          const year = dateObj.getFullYear();
          
          // Format de date "MM/YY"
          const formattedDate = `${month}/${year.toString().substr(2, 2)}`;
          
          formattedData.dates.push(formattedDate);
          formattedData.values.push(parseFloat(item.value));
        });
        
        console.log('Données ventes au détail formatées:', formattedData);
        return formattedData;
      } else if (response.data && Array.isArray(response.data)) {
        // Si la réponse est déjà un tableau
        const sortedData = [...response.data].sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Ne garder que les 24 derniers mois
        const recentData = sortedData.slice(-24);
        
        recentData.forEach((item: any) => {
          if (item.date && item.value && item.value !== '.' && !isNaN(parseFloat(item.value))) {
            const dateObj = new Date(item.date);
            const month = dateObj.getMonth() + 1;
            const year = dateObj.getFullYear();
            
            // Format de date "MM/YY"
            const formattedDate = `${month}/${year.toString().substr(2, 2)}`;
            
            formattedData.dates.push(formattedDate);
            formattedData.values.push(parseFloat(item.value));
          }
        });
        
        console.log('Données ventes au détail formatées (format alternatif):', formattedData);
        return formattedData;
      }
      
      console.error('Format de réponse inattendu pour les ventes au détail:', response.data);
      return this.getEmptyTimeSeriesData();
    } catch (error) {
      console.error('Erreur lors de la récupération des données de ventes au détail:', error);
      return this.getEmptyTimeSeriesData();
    }
  }

  public async getMacroEconomicData(): Promise<MacroEconomicData> {
    try {
      // Appel au serveur proxy pour récupérer toutes les données en une seule requête
      const response = await axios.get(`${API_BASE_URL}/macro-data`, {
        params: {
          api_key: FRED_API_KEY
        }
      });
      
      if (response.data && response.data.success) {
        return response.data.macroData;
      }
      
      // En cas d'erreur, retourner les données mockées
      console.error('Erreur lors de la récupération des données macroéconomiques, utilisation des données mockées');
      return MOCK_DATA;
      
    } catch (error) {
      console.error('Erreur lors de la récupération des données macroéconomiques:', error);
      
      // Retourner des valeurs par défaut en cas d'erreur
      return MOCK_DATA;
    }
  }

  private getEmptyTimeSeriesData(): TimeSeriesData {
    return {
      dates: [],
      values: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

export const fredService = FredService.getInstance(); 