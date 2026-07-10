import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.muncipal.zonemanagermonit',
  appName: 'Zone Manager Monitoring System',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
