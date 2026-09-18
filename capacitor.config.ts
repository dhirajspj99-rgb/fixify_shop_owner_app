import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.fixifiy.shop',
  appName: 'Fixifiy Shop',
 webDir: 'out',
  server: {
    // 🔥 Yeh aapka live link hai, jisse app bina kisi crash ke seedha chalega
    url: 'https://fixify-app-seven.vercel.app',
    cleartext: true
  }
};

export default config;