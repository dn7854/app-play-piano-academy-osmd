/** Public configuration. Values come from EXPO_PUBLIC_ variables. See .env.example. */
export const config = {
  apiBase: (process.env.EXPO_PUBLIC_API_BASE_URL || "https://www.danijelbrecelj.com").replace(/\/$/, ""),
  assetBase: (process.env.EXPO_PUBLIC_ASSET_BASE_URL || "https://pub-208bb376563f4685a68fff6e640e1932.r2.dev").replace(/\/$/, ""),
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "",
  entitlement: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || "d8r_piano_academy_pro",
  offeringId: process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ?? "",
  productId: process.env.EXPO_PUBLIC_REVENUECAT_PRODUCT_ID || "d8r_piano_academy_pro",
  /** Free playback of an isPremium piece, in score seconds at the written tempo. */
  previewSeconds: 20,
};

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const path = url.startsWith("/") ? url.slice(1) : url;
  return `${config.assetBase}/${path}`;
}

