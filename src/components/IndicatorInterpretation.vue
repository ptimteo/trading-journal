<script setup lang="ts">
import { computed } from 'vue';
import { interpretationService } from '../services/interpretationService';

const props = defineProps<{
  indicatorKey: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
}>();

// Récupérer l'interprétation complète pour l'indicateur
const interpretation = computed(() => {
  return interpretationService.getInterpretation(props.indicatorKey);
});

// Obtenir l'interprétation contextuelle basée sur la valeur actuelle
const contextualInterpretation = computed(() => {
  return interpretationService.getContextualInterpretation(props.indicatorKey, props.value);
});

// Déterminer le statut de l'indicateur (positif, négatif, neutre, prudence)
const status = computed(() => {
  return interpretationService.getStatus(props.indicatorKey, props.value);
});

// Obtenir les implications de trading
const tradingImplications = computed(() => {
  return interpretationService.getTradingImplications(
    props.indicatorKey, 
    props.value, 
    props.trend
  );
});

// Classes CSS basées sur le statut
const statusClasses = computed(() => {
  switch (status.value) {
    case 'positive':
      return 'bg-green-50 border-green-200 text-green-800';
    case 'negative':
      return 'bg-red-50 border-red-200 text-red-800';
    case 'caution':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'neutral':
    default:
      return 'bg-blue-50 border-blue-200 text-blue-800';
  }
});

// Texte d'interprétation en fonction de la tendance
const trendInterpretation = computed(() => {
  if (!interpretation.value) return '';
  
  if (props.trend === 'up') {
    return status.value === 'negative' || status.value === 'caution' 
      ? interpretation.value.negative 
      : interpretation.value.positive;
  } else if (props.trend === 'down') {
    return status.value === 'positive' || status.value === 'neutral' 
      ? interpretation.value.negative 
      : interpretation.value.positive;
  } else {
    return interpretation.value.neutral;
  }
});
</script>

<template>
  <div v-if="interpretation" class="mt-6">
    <h3 class="text-lg font-semibold text-gray-800 mb-4">Interprétation de l'indicateur</h3>
    
    <!-- Interprétation contextuelle basée sur la valeur actuelle -->
    <div :class="`rounded-lg p-4 border mb-4 ${statusClasses}`">
      <div class="font-medium mb-2">Analyse du niveau actuel :</div>
      <p>{{ contextualInterpretation }}</p>
    </div>
    
    <!-- Interprétation basée sur la tendance -->
    <div class="bg-white rounded-lg p-4 border border-gray-200 mb-4">
      <div class="font-medium mb-2">
        Analyse de la tendance 
        <span v-if="trend === 'up'" class="text-green-600">(en hausse)</span>
        <span v-else-if="trend === 'down'" class="text-red-600">(en baisse)</span>
        <span v-else class="text-gray-600">(stable)</span>:
      </div>
      <p>{{ trendInterpretation }}</p>
    </div>
    
    <!-- Contexte plus large -->
    <div class="bg-indigo-50 rounded-lg p-4 border border-indigo-200 mb-4">
      <div class="font-medium text-indigo-800 mb-2">Contexte à considérer :</div>
      <p class="text-gray-700">{{ interpretation.context }}</p>
    </div>
    
    <!-- Implications pour le trading -->
    <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
      <div class="font-medium text-purple-800 mb-2">Implications pour le trading :</div>
      <p class="text-gray-700">{{ tradingImplications }}</p>
    </div>
  </div>
  
  <div v-else class="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
    <p class="text-gray-700">Aucune interprétation détaillée disponible pour cet indicateur.</p>
  </div>
</template> 