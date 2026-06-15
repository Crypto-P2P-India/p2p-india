import { Capacitor } from "@capacitor/core";
import { useIsMobile } from "@/hooks/use-mobile";

/** Current bundled app version. Bump this whenever you build a new APK. */
export const APP_VERSION = "1.17";
export const APP_SIZE = "101.5 MB";



/** Public URL where the latest version manifest is hosted (always website, not the APK). */
export const VERSION_MANIFEST_URL = "https://crypto-p2p.store/app-version.json";

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Returns true when the UI should render in "app style" — either inside the
 * native Capacitor APK, or in any mobile-sized browser viewport. This makes
 * the mobile website feel identical to the installed app.
 */
export const useAppStyleUI = (): boolean => {
  const isMobile = useIsMobile();
  return isNativeApp() || isMobile;
};
