<script setup lang="ts">
import { ref } from 'vue'
import { ElCard, ElDivider } from 'element-plus'

interface Resource {
  title: string
  links: {
    name: string
    url: string
    description?: string
  }[]
}

const resources = ref<Resource[]>([
  {
    title: 'ETF & Actions',
    links: [
      {
        name: 'Finviz',
        url: 'https://finviz.com/',
        description: 'Analyse technique et fondamentale des ETF et actions'
      },
      {
        name: 'Investing.com',
        url: 'https://www.investing.com/',
        description: 'Données de marché et analyses'
      },
      {
        name: 'Portfolio de Warren Buffett',
        url: 'https://stockcircle.com/portfolio/warren-buffett?order=latest_trade#tabs',
        description: 'Suivi du portfolio de Warren Buffett en temps réel'
      }
    ]
  },
  {
    title: 'Marchés Financiers',
    links: [
      {
        name: 'CME Group - FedWatch Tool',
        url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
        description: 'Outil de prévision des taux de la Fed'
      },
      {
        name: 'Truflation',
        url: 'https://truflation.com/',
        description: 'Indicateurs d\'inflation en temps réel'
      },
      {
        name: 'Coinglass Bitcoin ETF',
        url: 'https://www.coinglass.com/fr/bitcoin-etf',
        description: 'Suivi des flux et données des Bitcoin ETFs'
      }
    ]
  },
  {
    title: 'Ressources Éducatives',
    links: [
      {
        name: 'Crypto Le Trône',
        url: 'https://www.youtube.com/@CryptoLeTrone',
        description: 'Analyse technique et stratégies de trading crypto'
      },
      {
        name: 'Julien Roman',
        url: 'https://www.youtube.com/@JulienRoman',
        description: 'Formation au trading et analyse de marché'
      },
      {
        name: 'Cryptolize',
        url: 'https://www.youtube.com/@Cryptolyze',
        description: 'Actualités et analyses crypto'
      },
      {
        name: 'Market Sentiment',
        url: 'https://www.marketsentiment.co/p/recession-primer',
        description: 'Analyses approfondies des marchés et de l\'économie'
      }
    ]
  }
])
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">Ressources Utiles</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <el-card
        v-for="resource in resources"
        :key="resource.title"
        class="hover:shadow-lg transition-shadow duration-300"
      >
        <template #header>
          <h2 class="text-xl font-semibold">{{ resource.title }}</h2>
        </template>
        
        <div class="space-y-4">
          <div
            v-for="link in resource.links"
            :key="link.name"
            class="p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="block"
            >
              <h3 class="text-lg font-medium text-blue-600 hover:text-blue-800">
                {{ link.name }}
              </h3>
              <p v-if="link.description" class="text-gray-600 mt-1">
                {{ link.description }}
              </p>
            </a>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}
</style> 