import type { MarketplaceProvider } from "./types";
import { demoProvider } from "./demoProvider";
import { genericProvider } from "./genericProvider";
import { metaProvider } from "./metaProvider";
import { pakwheelsProvider } from "./pakwheelsProvider";

// The dashboard, worker, and API routes only ever depend on this registry
// and the MarketplaceProvider interface — never on a concrete provider
// class. Adding a new marketplace = writing one file + one line here.
export const providerRegistry: Record<string, MarketplaceProvider> = {
  demo: demoProvider,
  generic: genericProvider,
  meta: metaProvider,
  pakwheels: pakwheelsProvider,
};

export function getProvider(key: string): MarketplaceProvider {
  const provider = providerRegistry[key];
  if (!provider) throw new Error(`Unknown provider: ${key}`);
  return provider;
}

export function listProviderInfo() {
  return Object.values(providerRegistry).map((p) => p.getProviderStatus());
}
