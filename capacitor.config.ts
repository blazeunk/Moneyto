import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneyto.app',
  appName: 'Moneyto',
  webDir: 'www',
  plugins: {
    LocalNotifications: {
      iconColor: '#4f46e5',
    },
  },
};

export default config;
