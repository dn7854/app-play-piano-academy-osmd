import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { config } from "./config";

type PurchasesState = {
  pro: boolean;
  configured: boolean;
  appUserId: string | null;
  priceLabel: string | null;
  refresh: () => Promise<void>;
  buy: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  devUnlock: () => void;
};

const Ctx = createContext<PurchasesState | null>(null);

function apiKey() {
  if (Platform.OS === "ios") return config.revenueCatIosKey;
  if (Platform.OS === "android") return config.revenueCatAndroidKey;
  return "";
}

async function findPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const named = config.offeringId ? offerings.all[config.offeringId] : undefined;
  const pools = [named, offerings.current, ...Object.values(offerings.all)].filter(Boolean);
  for (const offering of pools) {
    const packages = offering?.availablePackages ?? [];
    const match =
      packages.find((pkg) => pkg.product.identifier === config.productId) ??
      packages.find((pkg) => pkg.identifier === config.productId);
    if (match) return match;
  }
  return null;
}

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [pro, setPro] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [priceLabel, setPriceLabel] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const key = apiKey();
    if (!key) {
      setConfigured(false);
      return;
    }
    if (!configured) {
      Purchases.configure({ apiKey: key });
      setConfigured(true);
    }
    try {
      const info = await Purchases.getCustomerInfo();
      setPro(info.entitlements.active[config.entitlement] != null);
      setAppUserId(await Purchases.getAppUserID());
    } catch {
      setPro(false);
    }
    try {
      const pkg = await findPackage();
      setPriceLabel(pkg?.product.priceString ?? null);
    } catch {
      setPriceLabel(null);
    }
  }, [configured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const buy = useCallback(async () => {
    const pkg = await findPackage();
    if (!pkg) throw new Error(`Add ${config.productId} to a RevenueCat offering.`);
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const unlocked = customerInfo.entitlements.active[config.entitlement] != null;
    setPro(unlocked);
    setAppUserId(await Purchases.getAppUserID());
    return unlocked;
  }, []);

  const restore = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    const unlocked = info.entitlements.active[config.entitlement] != null;
    setPro(unlocked);
    setAppUserId(await Purchases.getAppUserID());
    return unlocked;
  }, []);

  const devUnlock = useCallback(() => {
    if (__DEV__) setPro(true);
  }, []);

  const value = useMemo(
    () => ({ pro, configured, appUserId, priceLabel, refresh, buy, restore, devUnlock }),
    [pro, configured, appUserId, priceLabel, refresh, buy, restore, devUnlock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePurchases() {
  const value = useContext(Ctx);
  if (!value) throw new Error("PurchasesProvider is missing");
  return value;
}

export function purchaseWasCancelled(error: unknown) {
  return Boolean(error && typeof error === "object" && "userCancelled" in error && (error as { userCancelled?: boolean }).userCancelled);
}
