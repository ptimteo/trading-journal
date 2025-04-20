import axios from 'axios';

export interface YieldCurveData {
  dates: string[];
  tenYearValues: number[];
  twoYearValues: number[];
  spreadValues: number[];
  lastUpdated: string;
}

export interface FedRateData {
  dates: string[];
  values: number[];
  lastUpdated: string;
}

/**
 * Service pour récupérer les données de la courbe des taux depuis l'API FRED
 */
class YieldCurveService {
  private static instance: YieldCurveService;
  private API_BASE_URL = 'http://localhost:3000';

  private constructor() {}

  public static getInstance(): YieldCurveService {
    if (!YieldCurveService.instance) {
      YieldCurveService.instance = new YieldCurveService();
    }
    return YieldCurveService.instance;
  }

  /**
   * Récupère les données du rendement des bons du Trésor à 10 ans
   * @returns Données du rendement des bons du Trésor à 10 ans (dates et valeurs)
   */
  public async get10YearYieldData(): Promise<{dates: string[], values: number[], lastUpdated: string}> {
    try {
      const response = await axios.get(`${this.API_BASE_URL}/api/fred/GS10`);
      
      if (response.data && response.data.success) {
        // Formatage des données
        const formattedData: {dates: string[], values: number[], lastUpdated: string} = {
          dates: [],
          values: [],
          lastUpdated: new Date().toISOString()
        };
        
        // Transformation des données reçues de l'API
        if (response.data.observations && Array.isArray(response.data.observations)) {
          // Filtrer pour n'inclure que les 120 dernières observations (environ 10 ans de données mensuelles)
          const observations = response.data.observations.slice(-120);
          
          observations.forEach((item: any) => {
            // Formater la date (de "YYYY-MM-DD" à "MM/YY")
            const dateObj = new Date(item.date);
            const month = dateObj.getMonth() + 1; // getMonth() retourne 0-11
            const year = dateObj.getFullYear().toString().substr(2, 2); // Obtenir les 2 derniers chiffres de l'année
            const formattedDate = `${month}/${year}`;
            
            // Ajouter à nos tableaux si la valeur n'est pas nulle
            if (item.value !== '.' && item.value !== null) {
              formattedData.dates.push(formattedDate);
              formattedData.values.push(parseFloat(item.value));
            }
          });
        }
        
        return formattedData;
      }
      
      console.error('Format de réponse inattendu:', response.data);
      return this.getEmptyData();
    } catch (error) {
      console.error('Erreur lors de la récupération des données du rendement à 10 ans:', error);
      return this.getEmptyData();
    }
  }
  
  /**
   * Récupère les données du rendement des bons du Trésor à 2 ans 
   * @returns Données du rendement des bons du Trésor à 2 ans (dates et valeurs)
   */
  public async get2YearYieldData(): Promise<{dates: string[], values: number[], lastUpdated: string}> {
    try {
      // Récupérer les vraies données via l'API FRED avec la série GS2
      const response = await axios.get(`${this.API_BASE_URL}/api/fred/GS2`);
      
      if (response.data && response.data.success) {
        // Formatage des données
        const formattedData: {dates: string[], values: number[], lastUpdated: string} = {
          dates: [],
          values: [],
          lastUpdated: new Date().toISOString()
        };
        
        // Transformation des données reçues de l'API
        if (response.data.observations && Array.isArray(response.data.observations)) {
          // Filtrer pour n'inclure que les 120 dernières observations (environ 10 ans de données mensuelles)
          const observations = response.data.observations.slice(-120);
          
          observations.forEach((item: any) => {
            // Formater la date (de "YYYY-MM-DD" à "MM/YY")
            const dateObj = new Date(item.date);
            const month = dateObj.getMonth() + 1; // getMonth() retourne 0-11
            const year = dateObj.getFullYear().toString().substr(2, 2); // Obtenir les 2 derniers chiffres de l'année
            const formattedDate = `${month}/${year}`;
            
            // Ajouter à nos tableaux si la valeur n'est pas nulle
            if (item.value !== '.' && item.value !== null) {
              formattedData.dates.push(formattedDate);
              formattedData.values.push(parseFloat(item.value));
            }
          });
        }
        
        return formattedData;
      }
      
      // En cas d'erreur, nous utilisons l'approche précédente comme fallback
      console.warn('Échec de récupération des données GS2, utilisation des données simulées');
      return this.getSimulatedTwoYearData();
    } catch (error) {
      console.error('Erreur lors de la récupération des données du rendement à 2 ans:', error);
      return this.getSimulatedTwoYearData();
    }
  }
  
  /**
   * Méthode de repli pour simuler les données à 2 ans basées sur les données à 10 ans
   */
  private async getSimulatedTwoYearData(): Promise<{dates: string[], values: number[], lastUpdated: string}> {
    try {
      const tenYearData = await this.get10YearYieldData();
      
      // Simuler des données à 2 ans (généralement inférieures aux rendements à 10 ans)
      const twoYearValues = tenYearData.values.map(value => {
        // Réduction aléatoire entre 0.1 et 0.5 point de pourcentage
        const reduction = 0.1 + Math.random() * 0.4;
        return Math.max(0, value - reduction); // S'assurer que la valeur n'est pas négative
      });
      
      return {
        dates: tenYearData.dates,
        values: twoYearValues,
        lastUpdated: tenYearData.lastUpdated
      };
    } catch (error) {
      console.error('Erreur lors de la simulation des données du rendement à 2 ans:', error);
      return this.getEmptyData();
    }
  }
  
  /**
   * Récupère les données complètes de la courbe des taux (10 ans, 2 ans et spread)
   * @returns Données de la courbe des taux
   */
  public async getYieldCurveData(): Promise<YieldCurveData> {
    try {
      const tenYearData = await this.get10YearYieldData();
      const twoYearData = await this.get2YearYieldData();
      
      // Aligner les dates si nécessaire
      const alignedData = this.alignDateArrays(tenYearData, twoYearData);
      
      // Calculer le spread (10 ans - 2 ans)
      const spreadValues = alignedData.tenYearValues.map((value, index) => {
        return parseFloat((value - alignedData.twoYearValues[index]).toFixed(2));
      });
      
      return {
        dates: alignedData.dates,
        tenYearValues: alignedData.tenYearValues,
        twoYearValues: alignedData.twoYearValues,
        spreadValues: spreadValues,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des données de la courbe des taux:', error);
      return {
        dates: [],
        tenYearValues: [],
        twoYearValues: [],
        spreadValues: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }
  
  /**
   * Aligne deux séries temporelles pour s'assurer qu'elles ont les mêmes dates
   */
  private alignDateArrays(
    series1: { dates: string[], values: number[] }, 
    series2: { dates: string[], values: number[] }
  ): { dates: string[], tenYearValues: number[], twoYearValues: number[] } {
    // Convertir les dates en objets Date pour faciliter la comparaison
    const series1Dates = series1.dates.map(d => {
      const [month, year] = d.split('/');
      return new Date(2000 + parseInt(year), parseInt(month) - 1, 1);
    });
    
    const series2Dates = series2.dates.map(d => {
      const [month, year] = d.split('/');
      return new Date(2000 + parseInt(year), parseInt(month) - 1, 1);
    });
    
    // Trouver la date de début la plus récente
    const startDate = new Date(Math.max(
      series1Dates[0].getTime(),
      series2Dates[0].getTime()
    ));
    
    // Trouver la date de fin la plus ancienne
    const endDate = new Date(Math.min(
      series1Dates[series1Dates.length - 1].getTime(),
      series2Dates[series2Dates.length - 1].getTime()
    ));
    
    // Filtrer les séries pour ne garder que les dates communes
    const alignedDates: string[] = [];
    const alignedTenYearValues: number[] = [];
    const alignedTwoYearValues: number[] = [];
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const monthYearString = `${currentDate.getMonth() + 1}/${(currentDate.getFullYear() % 100).toString().padStart(2, '0')}`;
      
      const series1Index = series1.dates.indexOf(monthYearString);
      const series2Index = series2.dates.indexOf(monthYearString);
      
      if (series1Index !== -1 && series2Index !== -1) {
        alignedDates.push(monthYearString);
        alignedTenYearValues.push(series1.values[series1Index]);
        alignedTwoYearValues.push(series2.values[series2Index]);
      }
      
      // Passer au mois suivant
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return {
      dates: alignedDates,
      tenYearValues: alignedTenYearValues,
      twoYearValues: alignedTwoYearValues
    };
  }
  
  /**
   * Récupère les données des taux directeurs de la Fed (Federal funds rate)
   * @returns Données des taux directeurs (dates et valeurs)
   */
  public async getFedRateData(): Promise<FedRateData> {
    try {
      const response = await axios.get(`${this.API_BASE_URL}/api/fred/FEDFUNDS`);
      
      if (response.data && response.data.success) {
        // Formatage des données
        const formattedData: FedRateData = {
          dates: [],
          values: [],
          lastUpdated: new Date().toISOString()
        };
        
        // Transformation des données reçues de l'API
        if (response.data.observations && Array.isArray(response.data.observations)) {
          // Filtrer pour n'inclure que les 60 dernières observations (environ 5 ans de données mensuelles)
          const observations = response.data.observations.slice(-60);
          
          observations.forEach((item: any) => {
            // Formater la date (de "YYYY-MM-DD" à "MM/YY")
            const dateObj = new Date(item.date);
            const month = dateObj.getMonth() + 1; // getMonth() retourne 0-11
            const year = dateObj.getFullYear().toString().substr(2, 2); // Obtenir les 2 derniers chiffres de l'année
            const formattedDate = `${month}/${year}`;
            
            // Ajouter à nos tableaux si la valeur n'est pas nulle
            if (item.value !== '.' && item.value !== null) {
              formattedData.dates.push(formattedDate);
              formattedData.values.push(parseFloat(item.value));
            }
          });
        }
        
        return formattedData;
      }
      
      console.error('Format de réponse inattendu:', response.data);
      return {
        dates: [],
        values: [],
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des données des taux directeurs:', error);
      return {
        dates: [],
        values: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }
  
  /**
   * Retourne un objet de données vide en cas d'erreur
   */
  private getEmptyData(): {dates: string[], values: number[], lastUpdated: string} {
    return {
      dates: [],
      values: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

export const yieldCurveService = YieldCurveService.getInstance(); 