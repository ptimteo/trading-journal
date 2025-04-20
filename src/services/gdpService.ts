import axios from 'axios';

export interface GDPData {
  dates: string[];
  values: number[];
  lastUpdated: string;
}

/**
 * Service pour récupérer les données du PIB depuis l'API locale
 */
class GDPService {
  private static instance: GDPService;
  private API_BASE_URL = 'http://localhost:3000';

  private constructor() {}

  public static getInstance(): GDPService {
    if (!GDPService.instance) {
      GDPService.instance = new GDPService();
    }
    return GDPService.instance;
  }

  /**
   * Récupère les données réelles du PIB depuis l'API locale
   * @returns Données du PIB (dates et valeurs)
   */
  public async getRealGDPData(): Promise<GDPData> {
    try {
      console.log('Tentative de récupération des données PIB depuis:', `${this.API_BASE_URL}/api/fred/GDP`);
      const response = await axios.get(`${this.API_BASE_URL}/api/fred/GDP`);
      
      // Log de débogage pour voir la structure de la réponse
      console.log('Réponse API PIB:', response.data);
      
      const formattedData: GDPData = {
        dates: [],
        values: [],
        lastUpdated: new Date().toISOString()
      };
      
      // Vérifier si nous avons des observations dans la réponse
      if (response.data && response.data.observations && Array.isArray(response.data.observations)) {
        // Filtrer pour n'inclure que les entrées avec des valeurs valides
        const validObservations = response.data.observations.filter((obs: any) => 
          obs.value !== '.' && !isNaN(parseFloat(obs.value))
        );
        
        // Trier par date (du plus ancien au plus récent)
        validObservations.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Transformer les données
        validObservations.forEach((item: any) => {
          // Formater la date selon le modèle du graphique
          const dateObj = new Date(item.date);
          const month = dateObj.getMonth() + 1; // getMonth() retourne 0-11
          const year = dateObj.getFullYear(); // Année complète
          
          // Déterminer le trimestre basé sur le mois
          const quarter = Math.ceil(month / 3);
          
          // Format qui correspond au graphique réel
          // Si c'est le premier trimestre de l'année, on affiche juste l'année
          // Si c'est le troisième trimestre, on affiche "Q3"
          // Les autres trimestres suivent le même modèle
          let formattedDate;
          if (quarter === 1) {
            formattedDate = `${year}`;
          } else {
            formattedDate = `Q${quarter}`;
          }
          
          // Ajouter à nos tableaux
          formattedData.dates.push(formattedDate);
          formattedData.values.push(parseFloat(item.value));
        });
        
        console.log('Données PIB formatées:', formattedData);
        return formattedData;
      } else if (response.data && Array.isArray(response.data)) {
        // Si la réponse est déjà un tableau, l'adapter directement
        const sortedData = [...response.data].sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        sortedData.forEach((item: any) => {
          if (item.date && item.value && item.value !== '.' && !isNaN(parseFloat(item.value))) {
            const dateObj = new Date(item.date);
            const month = dateObj.getMonth() + 1;
            const year = dateObj.getFullYear(); // Année complète
            
            // Déterminer le trimestre basé sur le mois
            const quarter = Math.ceil(month / 3);
            
            // Format qui correspond au graphique réel
            let formattedDate;
            if (quarter === 1) {
              formattedDate = `${year}`;
            } else {
              formattedDate = `Q${quarter}`;
            }
            
            formattedData.dates.push(formattedDate);
            formattedData.values.push(parseFloat(item.value));
          }
        });
        
        console.log('Données PIB formatées (format alternatif):', formattedData);
        return formattedData;
      }
      
      console.error('Format de réponse inattendu:', response.data);
      return this.getEmptyData();
    } catch (error) {
      console.error('Erreur lors de la récupération des données du PIB:', error);
      return this.getEmptyData();
    }
  }
  
  /**
   * Récupère le taux de croissance du PIB (variation d'un trimestre à l'autre)
   * @returns Taux de croissance du PIB sous forme de pourcentage
   */
  public async getGDPGrowthRate(): Promise<number> {
    try {
      const gdpData = await this.getRealGDPData();
      
      if (gdpData.values.length >= 2) {
        const latestValue = gdpData.values[gdpData.values.length - 1];
        const previousValue = gdpData.values[gdpData.values.length - 2];
        
        // Calculer le taux de croissance en pourcentage
        return parseFloat(((latestValue - previousValue) / previousValue * 100).toFixed(1));
      }
      
      return 0;
    } catch (error) {
      console.error('Erreur lors du calcul du taux de croissance du PIB:', error);
      return 0;
    }
  }
  
  /**
   * Retourne un objet de données vide en cas d'erreur
   */
  private getEmptyData(): GDPData {
    return {
      dates: [],
      values: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

export const gdpService = GDPService.getInstance(); 