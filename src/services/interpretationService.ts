/**
 * Service d'interprétation des indicateurs macroéconomiques
 * Ce service fournit des analyses détaillées pour chaque indicateur économique
 */

interface InterpretationDetail {
  positive: string;
  negative: string;
  neutral: string;
  context: string;
  tradingImplications: {
    bullish: string;
    bearish: string;
  };
}

interface InterpretationRange {
  low: number;
  high: number;
  status: 'positive' | 'negative' | 'neutral' | 'caution';
  description: string;
}

type InterpretationCollection = Record<string, InterpretationDetail>;

class InterpretationService {
  private static instance: InterpretationService;
  private interpretations: InterpretationCollection;
  private ranges: Record<string, InterpretationRange[]>;

  private constructor() {
    this.interpretations = this.initializeInterpretations();
    this.ranges = this.initializeRanges();
  }

  public static getInstance(): InterpretationService {
    if (!InterpretationService.instance) {
      InterpretationService.instance = new InterpretationService();
    }
    return InterpretationService.instance;
  }

  /**
   * Obtient l'interprétation complète pour un indicateur spécifique
   * @param indicatorKey - Clé de l'indicateur (ex: 'gdp', 'cpi', etc.)
   * @returns Détails d'interprétation pour l'indicateur
   */
  public getInterpretation(indicatorKey: string): InterpretationDetail | undefined {
    return this.interpretations[indicatorKey];
  }

  /**
   * Obtient l'interprétation contextuelle basée sur la valeur actuelle de l'indicateur
   * @param indicatorKey - Clé de l'indicateur (ex: 'gdp', 'cpi', etc.)
   * @param value - Valeur actuelle de l'indicateur
   * @returns Interprétation contextuelle adaptée à la valeur actuelle
   */
  public getContextualInterpretation(indicatorKey: string, value: number): string {
    const ranges = this.ranges[indicatorKey];
    if (!ranges) return "Aucune interprétation disponible pour cet indicateur.";

    // Trouver la plage applicable pour la valeur actuelle
    const range = ranges.find(r => value >= r.low && value <= r.high);
    if (!range) return "Valeur hors des plages d'interprétation connues.";

    // Retourner l'interprétation pour cette plage
    return range.description;
  }

  /**
   * Obtient le statut (positif, négatif, neutre, prudence) basé sur la valeur de l'indicateur
   * @param indicatorKey - Clé de l'indicateur
   * @param value - Valeur actuelle de l'indicateur
   * @returns Statut de l'indicateur
   */
  public getStatus(indicatorKey: string, value: number): 'positive' | 'negative' | 'neutral' | 'caution' {
    const ranges = this.ranges[indicatorKey];
    if (!ranges) return 'neutral';

    const range = ranges.find(r => value >= r.low && value <= r.high);
    return range ? range.status : 'neutral';
  }

  /**
   * Obtient les implications de trading en fonction de la valeur et de la tendance
   * @param indicatorKey - Clé de l'indicateur
   * @param value - Valeur actuelle
   * @param trend - Tendance ('up', 'down', 'stable')
   * @returns Implications de trading adaptées
   */
  public getTradingImplications(
    indicatorKey: string, 
    value: number, 
    trend: 'up' | 'down' | 'stable'
  ): string {
    const interpretation = this.interpretations[indicatorKey];
    if (!interpretation) return "Aucune implication de trading disponible.";

    if (trend === 'up') {
      return interpretation.tradingImplications.bullish;
    } else if (trend === 'down') {
      return interpretation.tradingImplications.bearish;
    } else {
      // Tendance stable - utiliser le statut pour déterminer
      const status = this.getStatus(indicatorKey, value);
      return status === 'positive' || status === 'neutral' 
        ? interpretation.tradingImplications.bullish 
        : interpretation.tradingImplications.bearish;
    }
  }

  /**
   * Initialise les interprétations détaillées pour tous les indicateurs
   * @returns Collection d'interprétations
   */
  private initializeInterpretations(): InterpretationCollection {
    return {
      'gdp': {
        positive: "Un taux de croissance du PIB positif et robuste indique une économie en expansion, avec une production, des emplois et des revenus en hausse. Cela favorise généralement les entreprises et les marchés boursiers.",
        negative: "Un PIB en baisse ou négatif peut signaler une récession, avec des perspectives réduites pour les bénéfices des entreprises et une augmentation potentielle du chômage.",
        neutral: "Une croissance modérée du PIB suggère une économie stable sans surchauffe ni contraction significative, offrant un équilibre entre stabilité et opportunités de croissance.",
        context: "Le PIB doit être interprété en tenant compte d'autres indicateurs comme l'inflation, le taux de chômage et les politiques monétaires, car une croissance trop rapide peut entraîner une inflation excessive.",
        tradingImplications: {
          bullish: "Une croissance solide du PIB favorise généralement les actifs à risque comme les actions, en particulier dans les secteurs cycliques comme la consommation discrétionnaire, l'industrie et la technologie.",
          bearish: "Un ralentissement du PIB ou une croissance négative tend à favoriser les valeurs défensives, les obligations d'État et l'or comme valeurs refuges."
        }
      },
      'cpi': {
        positive: "Une inflation modérée (autour de 2%) est généralement considérée comme saine pour l'économie, signalant une demande robuste sans pression excessive sur les prix.",
        negative: "Une inflation élevée érode le pouvoir d'achat, augmente les coûts d'emprunt et peut nécessiter un resserrement monétaire, tandis qu'une déflation peut signaler une faiblesse économique grave.",
        neutral: "Une inflation stable et prévisible permet aux entreprises et aux consommateurs de planifier efficacement, sans distorsions majeures dans les décisions économiques.",
        context: "L'inflation doit être analysée en relation avec la croissance des salaires, la politique monétaire et les tendances à long terme pour comprendre son impact réel sur l'économie.",
        tradingImplications: {
          bullish: "Une inflation modérée peut favoriser les actions de valeur, l'immobilier, les matières premières et les obligations indexées sur l'inflation (TIPS) comme protections.",
          bearish: "Une inflation élevée et volatile peut être négative pour les obligations à long terme, les actions de croissance et les secteurs sensibles aux taux d'intérêt comme l'immobilier et les services publics."
        }
      },
      'unemployment': {
        positive: "Un taux de chômage bas indique un marché du travail sain, une économie robuste et un pouvoir d'achat solide pour les consommateurs.",
        negative: "Un taux de chômage élevé signale une faiblesse économique, une demande réduite et potentiellement des problèmes structurels dans l'économie.",
        neutral: "Un taux de chômage proche du 'taux naturel' (4-5% aux États-Unis) suggère un équilibre entre emploi et contrôle de l'inflation.",
        context: "Le taux de chômage doit être analysé conjointement avec le taux de participation au marché du travail, la croissance des salaires et les postes vacants pour une image complète.",
        tradingImplications: {
          bullish: "Un chômage bas favorise les secteurs liés à la consommation, les banques et les sociétés cycliques en raison du pouvoir d'achat accru des consommateurs.",
          bearish: "Une hausse du chômage favorise les valeurs défensives comme les services publics, les soins de santé et les biens de consommation courante."
        }
      },
      'federal': {
        positive: "Des taux d'intérêt bas stimulent l'économie en réduisant les coûts d'emprunt pour les entreprises et les consommateurs, favorisant l'investissement et la consommation.",
        negative: "Des taux élevés peuvent ralentir l'économie en augmentant les coûts d'emprunt, mais peuvent être nécessaires pour contrôler l'inflation excessive.",
        neutral: "Des taux neutres (ni stimulants ni restrictifs) visent à maintenir l'équilibre entre croissance économique et stabilité des prix.",
        context: "Les taux d'intérêt doivent être interprétés en fonction des attentes d'inflation, de la croissance économique et des taux réels (taux nominal moins inflation).",
        tradingImplications: {
          bullish: "Des baisses de taux favorisent généralement les actions de croissance, l'immobilier, les métaux précieux et les marchés émergents.",
          bearish: "Des hausses de taux tendent à favoriser les secteurs financiers, le dollar américain et peuvent nuire aux actions à forte valorisation."
        }
      },
      'treasury10Y': {
        positive: "Des rendements obligataires stables ou modérément croissants, accompagnés d'une croissance économique, indiquent des attentes positives pour l'économie.",
        negative: "Des rendements obligataires en forte hausse peuvent signaler des inquiétudes inflationnistes, tandis que des rendements en forte baisse peuvent indiquer des craintes de récession.",
        neutral: "Des rendements obligataires stables dans une fourchette modérée suggèrent un équilibre entre croissance et inflation anticipées.",
        context: "Les rendements obligataires reflètent les attentes du marché concernant la croissance future, l'inflation et la politique monétaire, et doivent être comparés aux rendements réels et internationaux.",
        tradingImplications: {
          bullish: "Une hausse modérée des rendements, associée à une croissance économique, peut soutenir les valeurs bancaires, cycliques et de valeur.",
          bearish: "Une forte hausse des rendements peut nuire aux valeurs de croissance et aux secteurs sensibles aux taux (immobilier, services publics), tandis qu'une forte baisse peut signaler des craintes économiques."
        }
      },
      'yield-curve': {
        positive: "Une courbe des taux positive (pentue) indique généralement des attentes de croissance économique et un système bancaire sain.",
        negative: "Une courbe des taux inversée (rendements à court terme supérieurs aux rendements à long terme) a historiquement précédé les récessions avec un délai de 12-24 mois.",
        neutral: "Une courbe des taux plate suggère une incertitude sur les perspectives économiques ou une transition dans le cycle économique.",
        context: "La courbe des taux doit être analysée en conjonction avec d'autres indicateurs économiques et la politique monétaire mondiale pour une perspective complète.",
        tradingImplications: {
          bullish: "Une pentification de la courbe favorise généralement les banques, les assurances et les secteurs cycliques.",
          bearish: "Une inversion de la courbe suggère de privilégier la qualité, les valeurs défensives et de réduire l'exposition aux secteurs sensibles au crédit."
        }
      },
      'dollar-index': {
        positive: "Un dollar fort peut réduire les pressions inflationnistes importées et témoigner de la confiance dans l'économie américaine, mais peut nuire aux exportateurs.",
        negative: "Un dollar faible peut stimuler les exportations et les bénéfices étrangers des multinationales américaines, mais peut augmenter l'inflation importée.",
        neutral: "Un dollar stable facilite les échanges internationaux et la planification financière sans créer de distorsions importantes.",
        context: "La force du dollar doit être analysée en fonction des différentiels de taux d'intérêt, des flux de capitaux, des politiques monétaires relatives et des déséquilibres commerciaux.",
        tradingImplications: {
          bullish: "Un dollar fort favorise les importateurs américains, les détaillants nationaux et peut être positif pour les obligations américaines.",
          bearish: "Un dollar fort peut nuire aux multinationales américaines, aux matières premières et aux marchés émergents cotés en dollars."
        }
      },
      'vix': {
        positive: "Un VIX bas (< 15) indique un marché confiant et peu volatil, propice aux prises de risque.",
        negative: "Un VIX élevé (> 30) signale une peur significative sur les marchés et une volatilité élevée, souvent associées à des baisses de marché.",
        neutral: "Un VIX moyen (15-20) reflète un niveau normal d'incertitude sur les marchés.",
        context: "Le VIX doit être analysé en relation avec les niveaux historiques, les tendances récentes et d'autres indicateurs de sentiment et de positionnement des investisseurs.",
        tradingImplications: {
          bullish: "Un VIX qui baisse depuis des niveaux élevés peut signaler un bon moment pour augmenter l'exposition aux actions et autres actifs risqués.",
          bearish: "Un VIX qui monte rapidement depuis des niveaux bas peut indiquer qu'il est temps de réduire le risque et d'augmenter les protections."
        }
      },
      'gold-silver-ratio': {
        positive: "Un ratio or/argent bas ou en baisse peut indiquer un optimisme économique et un appétit pour le risque, bénéficiant généralement à l'argent plus qu'à l'or.",
        negative: "Un ratio élevé ou en hausse suggère une aversion au risque et une préférence pour l'or comme valeur refuge, souvent observée pendant les périodes d'incertitude économique.",
        neutral: "Un ratio stable autour de sa moyenne historique (60-70) indique un équilibre entre les perspectives économiques et les préoccupations de sécurité.",
        context: "Le ratio or/argent doit être interprété en tenant compte des taux d'intérêt réels, de l'inflation, des tensions géopolitiques et de la demande industrielle d'argent.",
        tradingImplications: {
          bullish: "Un ratio en baisse est souvent favorable aux actifs cycliques, aux actions liées aux métaux industriels et peut signaler un bon moment pour préférer l'argent à l'or.",
          bearish: "Un ratio en forte hausse peut signaler un environnement propice aux valeurs défensives, à l'or et aux obligations de qualité."
        }
      },
      'manufacturing-pmi': {
        positive: "Un PMI manufacturier supérieur à 50 indique une expansion du secteur, suggérant une croissance économique et des perspectives positives pour les bénéfices des entreprises.",
        negative: "Un PMI inférieur à 50 signale une contraction, souvent précurseur d'un ralentissement économique plus large.",
        neutral: "Un PMI proche de 50 suggère une stabilité dans le secteur manufacturier, sans expansion ni contraction significative.",
        context: "Le PMI doit être analysé en tenant compte des tendances (amélioration/détérioration), des composantes spécifiques (nouvelles commandes, emploi) et des comparaisons internationales.",
        tradingImplications: {
          bullish: "Un PMI en hausse au-dessus de 50 favorise généralement les secteurs cycliques, les matériaux, l'industrie et peut signaler un bon moment pour réduire l'exposition aux valeurs défensives.",
          bearish: "Un PMI en baisse sous 50 suggère de privilégier les valeurs défensives, les services publics et les biens de consommation courante."
        }
      },
      'retail-sales': {
        positive: "Des ventes au détail en hausse indiquent un consommateur confiant et une demande robuste, moteur principal de l'économie américaine.",
        negative: "Des ventes au détail en baisse peuvent signaler une faiblesse de la confiance des consommateurs et un ralentissement économique potentiel.",
        neutral: "Des ventes au détail stables suggèrent une économie qui progresse à un rythme régulier, sans surchauffe ni contraction.",
        context: "Les ventes au détail doivent être analysées en distinguant les composantes discrétionnaires et essentielles, en tenant compte de l'inflation et des tendances saisonnières.",
        tradingImplications: {
          bullish: "Des ventes au détail solides favorisent les détaillants, les restaurants, les loisirs et la consommation discrétionnaire en général.",
          bearish: "Des ventes au détail faibles suggèrent de privilégier les biens de consommation courante, les services publics et les soins de santé."
        }
      }
    };
  }

  /**
   * Initialise les plages d'interprétation pour les indicateurs clés
   * @returns Collection de plages d'interprétation
   */
  private initializeRanges(): Record<string, InterpretationRange[]> {
    return {
      'gdp': [
        { 
          low: -Infinity, 
          high: 0, 
          status: 'negative',
          description: "Une croissance négative du PIB indique une récession technique si elle persiste sur deux trimestres consécutifs. Cela signale des difficultés économiques importantes avec des risques de hausse du chômage et de baisse des bénéfices des entreprises."
        },
        { 
          low: 0, 
          high: 1.5, 
          status: 'caution',
          description: "Une croissance faible mais positive (0-1.5%) suggère une économie qui progresse mais à un rythme inférieur à son potentiel. Cela peut indiquer des faiblesses structurelles ou un ralentissement cyclique."
        },
        { 
          low: 1.5, 
          high: 3, 
          status: 'neutral',
          description: "Une croissance modérée (1.5-3%) est généralement considérée comme saine et durable, permettant une amélioration des conditions économiques sans risque significatif de surchauffe."
        },
        { 
          low: 3, 
          high: 5, 
          status: 'positive',
          description: "Une croissance forte (3-5%) indique une économie dynamique avec des créations d'emplois importantes et des opportunités d'investissement. Cette plage est particulièrement positive si l'inflation reste maîtrisée."
        },
        { 
          low: 5, 
          high: Infinity, 
          status: 'caution',
          description: "Une croissance très élevée (>5%) peut signaler une économie en surchauffe avec des risques d'inflation accélérée et de formation de bulles d'actifs, potentiellement suivie d'un ajustement."
        }
      ],
      'cpi': [
        { 
          low: -Infinity, 
          high: 0, 
          status: 'negative',
          description: "La déflation (inflation négative) est généralement considérée comme problématique car elle peut conduire à un cercle vicieux de reports de consommation, de baisse des bénéfices et d'augmentation du poids réel de la dette."
        },
        { 
          low: 0, 
          high: 1, 
          status: 'caution',
          description: "Une inflation très basse (0-1%) peut signaler une demande insuffisante ou des pressions déflationnistes, particulièrement préoccupante si elle persiste."
        },
        { 
          low: 1, 
          high: 3, 
          status: 'positive',
          description: "Une inflation modérée (1-3%) est généralement considérée comme optimale, permettant une croissance économique stable tout en préservant le pouvoir d'achat."
        },
        { 
          low: 3, 
          high: 5, 
          status: 'caution',
          description: "Une inflation élevée (3-5%) commence à éroder le pouvoir d'achat et peut nécessiter un resserrement monétaire, créant des incertitudes pour les investisseurs."
        },
        { 
          low: 5, 
          high: Infinity, 
          status: 'negative',
          description: "Une inflation très élevée (>5%) érode significativement le pouvoir d'achat, perturbe la planification économique et peut nécessiter des mesures monétaires agressives qui pèsent sur la croissance."
        }
      ],
      'vix': [
        { 
          low: 0, 
          high: 15, 
          status: 'positive',
          description: "Un VIX bas (<15) indique une faible volatilité attendue et un sentiment de complaisance sur les marchés. Historiquement, des périodes prolongées de VIX bas ont souvent précédé des corrections, mais peuvent durer longtemps."
        },
        { 
          low: 15, 
          high: 20, 
          status: 'neutral',
          description: "Un VIX modéré (15-20) reflète des niveaux normaux d'incertitude sur les marchés, compatible avec un environnement d'investissement équilibré."
        },
        { 
          low: 20, 
          high: 30, 
          status: 'caution',
          description: "Un VIX élevé (20-30) signale une nervosité accrue des marchés et des attentes de volatilité plus importante. Cela peut représenter une opportunité d'achat si d'autres indicateurs sont positifs."
        },
        { 
          low: 30, 
          high: Infinity, 
          status: 'negative',
          description: "Un VIX très élevé (>30) indique une peur extrême sur les marchés et est souvent associé à des chutes rapides des cours. Paradoxalement, ces périodes ont historiquement offert de bonnes opportunités d'achat à moyen terme."
        }
      ],
      'gold-silver-ratio': [
        { 
          low: 0, 
          high: 50, 
          status: 'positive',
          description: "Un ratio or/argent bas (<50) est historiquement associé à des périodes de forte croissance économique, d'inflation modérée et d'appétit pour le risque élevé. L'argent surperforme généralement dans ces conditions en raison de sa composante industrielle."
        },
        { 
          low: 50, 
          high: 70, 
          status: 'neutral',
          description: "Un ratio or/argent moyen (50-70) correspond aux niveaux historiques à long terme et suggère un équilibre entre les perspectives de croissance et les préoccupations de sécurité."
        },
        { 
          low: 70, 
          high: 85, 
          status: 'caution',
          description: "Un ratio or/argent élevé (70-85) peut indiquer des préoccupations économiques croissantes et une préférence pour la sécurité de l'or par rapport à l'argent, plus cyclique."
        },
        { 
          low: 85, 
          high: Infinity, 
          status: 'negative',
          description: "Un ratio or/argent très élevé (>85) a historiquement coïncidé avec des crises économiques ou des périodes de forte aversion au risque. Ces niveaux peuvent signaler des opportunités d'achat pour l'argent à long terme, mais reflètent un environnement économique difficile."
        }
      ],
      'dollar-index': [
        { 
          low: 0, 
          high: 90, 
          status: 'neutral',
          description: "Un dollar faible (<90) peut stimuler les exportations américaines et les bénéfices étrangers des multinationales, mais peut indiquer une faiblesse relative de l'économie américaine ou des politiques monétaires très accommodantes."
        },
        { 
          low: 90, 
          high: 100, 
          status: 'neutral',
          description: "Un dollar dans sa fourchette moyenne (90-100) reflète un équilibre entre la force de l'économie américaine et celle de ses partenaires commerciaux."
        },
        { 
          low: 100, 
          high: 110, 
          status: 'caution',
          description: "Un dollar fort (100-110) peut refléter la vigueur relative de l'économie américaine ou des flux vers les valeurs refuges, mais peut peser sur les exportations et les bénéfices étrangers."
        },
        { 
          low: 110, 
          high: Infinity, 
          status: 'negative',
          description: "Un dollar très fort (>110) peut créer des déséquilibres significatifs, nuire à la compétitivité américaine et potentiellement déclencher des interventions coordonnées des banques centrales."
        }
      ],
      'yield-curve': [
        { 
          low: -Infinity, 
          high: 0, 
          status: 'negative',
          description: "Une courbe des taux inversée (écart négatif entre taux à 10 ans et 2 ans) est un indicateur avancé classique de récession, avec un délai historique de 12-24 mois. Cela reflète des anticipations de ralentissement économique et de futures baisses de taux par la banque centrale."
        },
        { 
          low: 0, 
          high: 0.5, 
          status: 'caution',
          description: "Une courbe des taux très plate (0-0.5%) suggère que les investisseurs anticipent peu de croissance ou d'inflation future, ou que le cycle de resserrement monétaire approche de sa fin."
        },
        { 
          low: 0.5, 
          high: 1.5, 
          status: 'neutral',
          description: "Une courbe des taux modérément pentue (0.5-1.5%) est généralement considérée comme normale et saine, reflétant des attentes de croissance économique future."
        },
        { 
          low: 1.5, 
          high: Infinity, 
          status: 'positive',
          description: "Une courbe des taux très pentue (>1.5%) suggère des attentes de croissance économique solide, d'inflation future potentiellement plus élevée, et est généralement favorable au secteur bancaire."
        }
      ],
      'manufacturing-pmi': [
        { 
          low: 0, 
          high: 42, 
          status: 'negative',
          description: "Un PMI très bas (<42) indique une contraction sévère du secteur manufacturier, souvent associée à des récessions économiques importantes."
        },
        { 
          low: 42, 
          high: 48, 
          status: 'caution',
          description: "Un PMI en contraction modérée (42-48) signale des difficultés dans le secteur manufacturier, potentiellement précurseur d'un ralentissement économique plus large."
        },
        { 
          low: 48, 
          high: 52, 
          status: 'neutral',
          description: "Un PMI proche du seuil d'expansion/contraction (48-52) suggère une stabilité dans le secteur manufacturier, avec une croissance modeste ou un léger ralentissement."
        },
        { 
          low: 52, 
          high: 58, 
          status: 'positive',
          description: "Un PMI en expansion solide (52-58) indique une bonne santé du secteur manufacturier et des perspectives économiques positives."
        },
        { 
          low: 58, 
          high: 100, 
          status: 'positive',
          description: "Un PMI très élevé (>58) signale une forte expansion manufacturière, généralement associée à une croissance économique robuste, mais peut parfois précéder des pressions inflationnistes."
        }
      ]
    };
  }
}

export const interpretationService = InterpretationService.getInstance(); 