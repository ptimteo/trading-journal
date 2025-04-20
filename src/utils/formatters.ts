/**
 * Utilitaires de formatage des valeurs pour l'affichage
 */

/**
 * Formate un nombre en devise (USD par défaut)
 * @param value Valeur à formater
 * @param currency Code de la devise (USD par défaut)
 * @param digits Nombre de chiffres après la virgule (2 par défaut)
 * @returns Chaîne formatée avec le symbole de la devise
 */
export function formatCurrency(value: number, currency = 'USD', digits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

/**
 * Formate un nombre en pourcentage
 * @param value Valeur à formater (0.1 = 10%)
 * @param digits Nombre de chiffres après la virgule (2 par défaut)
 * @returns Chaîne formatée avec le symbole %
 */
export function formatPercentage(value: number, digits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value / 100);
}

/**
 * Formate un nombre avec des séparateurs de milliers
 * @param value Valeur à formater
 * @param digits Nombre de chiffres après la virgule (2 par défaut)
 * @returns Chaîne formatée avec séparateurs de milliers
 */
export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

/**
 * Formate une date en chaîne lisible
 * @param date Date à formater
 * @param includeTime Inclure l'heure (false par défaut)
 * @returns Chaîne représentant la date formatée
 */
export function formatDate(date: Date, includeTime = false): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  };
  
  return new Intl.DateTimeFormat('fr-FR', options).format(date);
} 