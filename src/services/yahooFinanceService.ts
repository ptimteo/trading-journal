import axios from 'axios';

// Base URL pour le serveur proxy qui fournit les données Yahoo Finance
const API_BASE_URL = 'http://localhost:3000';

export interface GoldSilverRatioData {
  dates: string[];
  values: number[];
}

export interface YahooFinanceHistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class YahooFinanceService {
  private static instance: YahooFinanceService;

  private constructor() {}

  public static getInstance(): YahooFinanceService {
    if (!YahooFinanceService.instance) {
      YahooFinanceService.instance = new YahooFinanceService();
    }
    return YahooFinanceService.instance;
  }
  
  /**
   * Récupère les données du ratio or/argent directement à partir des contrats futures
   * @param period - Période en jours ou 'since2020' pour récupérer depuis janvier 2020
   * @param startDate - Date de début au format YYYY-MM-DD (facultatif)
   */
  public async getGoldSilverRatioFromFutures(
    period: number | 'since2020' = 90, 
    startDate?: string
  ): Promise<GoldSilverRatioData> {
    try {
      let fromDate = '';
      
      // Si on veut les données depuis 2020
      if (period === 'since2020') {
        fromDate = '2020-01-01';
      } else if (startDate) {
        // Si une date de début spécifique est fournie
        fromDate = startDate;
      }
      
      // Construire les URLs avec la date de début si spécifiée
      const goldUrl = fromDate 
        ? `${API_BASE_URL}/api/yahoo/GC=F?startDate=${fromDate}` 
        : `${API_BASE_URL}/api/yahoo/GC=F`;
        
      const silverUrl = fromDate 
        ? `${API_BASE_URL}/api/yahoo/SI=F?startDate=${fromDate}` 
        : `${API_BASE_URL}/api/yahoo/SI=F`;
      
      // Récupérer les données de l'or (GC=F)
      const goldResponse = await fetch(goldUrl);
      if (!goldResponse.ok) {
        throw new Error(`Erreur HTTP: ${goldResponse.status}`);
      }
      const goldData = await goldResponse.json();
      
      // Récupérer les données de l'argent (SI=F)
      const silverResponse = await fetch(silverUrl);
      if (!silverResponse.ok) {
        throw new Error(`Erreur HTTP: ${silverResponse.status}`);
      }
      const silverData = await silverResponse.json();
      
      // S'assurer que les deux ensembles de données sont disponibles
      if (!goldData.length || !silverData.length) {
        throw new Error('Données incomplètes pour l\'or ou l\'argent');
      }
      
      // Créer un dictionnaire pour les prix de l'argent par date
      const silverPricesByDate: Record<string, number> = {};
      silverData.forEach((entry: any) => {
        // Utiliser uniquement la partie date de la datetime
        const date = entry.date.split('T')[0];
        silverPricesByDate[date] = entry.close;
      });
      
      // Calculer le ratio or/argent pour chaque date où les deux données sont disponibles
      const ratioData: GoldSilverRatioData = {
        dates: [],
        values: []
      };
      
      // Trier les données par date, du plus ancien au plus récent
      const sortedGoldData = [...goldData].sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      // Filtrer les données selon la période ou la date de début
      let filteredGoldData = sortedGoldData;
      if (typeof period === 'number' && !fromDate) {
        // Prendre les N derniers jours si aucune date de début n'est spécifiée
        filteredGoldData = sortedGoldData.slice(-period);
      }
      
      // Pour chaque entrée d'or, chercher la correspondance argent et calculer le ratio
      filteredGoldData.forEach((goldEntry: any) => {
        const date = goldEntry.date.split('T')[0];
        
        // Vérifier si nous avons des données d'argent pour cette date
        if (silverPricesByDate[date]) {
          const goldPrice = goldEntry.close;
          const silverPrice = silverPricesByDate[date];
          
          // Calculer le ratio (or / argent)
          const ratio = goldPrice / silverPrice;
          
          // Formater la date pour l'affichage
          const dateParts = date.split('-');
          const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}`;
          
          ratioData.dates.push(formattedDate);
          ratioData.values.push(parseFloat(ratio.toFixed(2)));
        }
      });
      
      return ratioData;
    } catch (error) {
      console.error('Erreur lors de la récupération ou du calcul du ratio or/argent:', error);
      // Retourner des données vides en cas d'erreur
      return { dates: [], values: [] };
    }
  }
  
  /**
   * Récupère les données du ratio or/argent depuis Yahoo Finance
   * @param period - Période en jours (par défaut 90 jours)
   */
  public async getGoldSilverRatio(period: number = 90): Promise<GoldSilverRatioData> {
    try {
      const response = await axios.get(`${API_BASE_URL}api/yahoo/gold-silver-ratio`, {
        params: { period }
      });
      
      if (response.data && response.data.success) {
        return response.data.data;
      }
      
      // En cas d'erreur, retourner des données vides
      console.error('Erreur lors de la récupération du ratio or/argent, données vides renvoyées');
      return { dates: [], values: [] };
      
    } catch (error) {
      console.error('Erreur lors de la récupération des données Yahoo Finance:', error);
      
      // Retourner des données vides en cas d'erreur
      return { dates: [], values: [] };
    }
  }
  public async getVIXData(period: number = 90): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/yahoo/^VIX`, {
        params: { period }
      });
      
      if (response.data && response.data.success) {
        return response.data.data;
      }
      
      // En cas d'erreur, retourner des données vides
      console.error('Erreur lors de la récupération des données VIX, données vides renvoyées');
      return { dates: [], values: [] };
      
    } catch (error) {
      console.error('Erreur lors de la récupération des données VIX:', error);
      
      // Retourner des données vides en cas d'erreur
      return { dates: [], values: [] };
    }
  }
}
export const yahooFinanceService = YahooFinanceService.getInstance(); 
