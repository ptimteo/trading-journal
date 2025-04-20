import { defineStore } from 'pinia';

interface Settings {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  dateFormat: string;
  showPercentages: boolean;
  notifications: {
    priceAlerts: boolean;
    dailyReports: boolean;
  };
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({
    theme: 'system',
    currency: 'EUR',
    dateFormat: 'fr-FR',
    showPercentages: false,
    notifications: {
      priceAlerts: false,
      dailyReports: false
    }
  }),

  actions: {
    loadSettings() {
      const savedSettings = localStorage.getItem('settings');
      if (savedSettings) {
        this.$patch(JSON.parse(savedSettings));
      }
    },

    saveSettings() {
      localStorage.setItem('settings', JSON.stringify(this.$state));
    },

    updateSettings(settings: Partial<Settings>) {
      this.$patch(settings);
      this.saveSettings();
    }
  }
}); 