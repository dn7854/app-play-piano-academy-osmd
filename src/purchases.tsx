import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import Purchases, {
  PACKAGE_TYPE,
  PRODUCT_CATEGORY,
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";
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

function hasPro(info: CustomerInfo) {
  return info.entitlements.active[config.entitlement] != null;
}

/** Lifetime package on `config.offeringId`, or on the current offering when that id is blank. */
async function lifetimePackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const offering = config.offeringId ? (offerings.all[config.offeringId] ?? null) : offerings.current;
  if (!offering) return null;
  return offering.lifetime ?? offering.availablePackages.find((pkg) => pkg.packageType === PACKAGE_TYPE.LIFETIME) ?? null;
}

/** One-time store product used when the offering or its Lifetime package is missing. */
async function storeProduct(): Promise<PurchasesStoreProduct | null> {
  const products = await Purchases.getProducts([config.productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  return products.find((product) => product.identifier === config.productId) ?? products[0] ?? null;
}

async function purchaseTarget(): Promise<
  { kind: "package"; pkg: PurchasesPackage } | { kind: "product"; product: PurchasesStoreProduct }
> {
  try {
    const pkg = await lifetimePackage();
    if (pkg) return { kind: "package", pkg };
  } catch {
    // Offerings can be empty while the store product is still for sale.
  }
  const product = await storeProduct();
  if (!product) throw new Error(`The store product ${config.productId} is not available.`);
  return { kind: "product", product };
}

async function priceLabelForStore(): Promise<string | null> {
  try {
    const pkg = await lifetimePackage();
    if (pkg) return pkg.product.priceString;
  } catch {
    // Fall through to the store product price.
  }
  try {
    const product = await storeProduct();
    return product?.priceString ?? null;
  } catch {
    return null;
  }
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
      setPro(hasPro(info));
      setAppUserId(await Purchases.getAppUserID());
    } catch {
      setPro(false);
    }
    setPriceLabel(await priceLabelForStore());
  }, [configured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const buy = useCallback(async () => {
    const target = await purchaseTarget();
    const { customerInfo } =
      target.kind === "package"
        ? await Purchases.purchasePackage(target.pkg)
        : await Purchases.purchaseStoreProduct(target.product);
    const unlocked = hasPro(customerInfo);
    setPro(unlocked);
    setAppUserId(await Purchases.getAppUserID());
    if (target.kind === "package") setPriceLabel(target.pkg.product.priceString);
    else setPriceLabel(target.product.priceString);
    return unlocked;
  }, []);

  const restore = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    const unlocked = hasPro(info);
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
