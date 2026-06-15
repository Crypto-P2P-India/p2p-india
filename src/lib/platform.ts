import { Capacitor } from "@capacitor/core";

/** Current bundled app version. Bump this whenever you build a new APK. */
export const APP_VERSION = "1.13";
export const APP_SIZE = "8.4 MB";


/** Public URL where the latest version manifest is hosted (always website, not the APK). */
export const VERSION_MANIFEST_URL = "https://crypto-p2p.store/app-version.json";

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};
