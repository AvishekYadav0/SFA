import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sfa.salestracker',
  appName: 'SFA Sales Tracker',
  webDir: 'dist',
  server: {
    url: 'https://sfa-frontend-rosy.vercel.app/',
    cleartext: false,
  },
}

export default config