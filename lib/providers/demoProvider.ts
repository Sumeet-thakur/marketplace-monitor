import type {
  MarketplaceProvider,
  NormalizedListing,
  ProviderConfig,
  ProviderStaticInfo,
  RawFetchResult,
  TestResult,
} from "./types";

// The Demo Provider behaves like a real API provider (testConnection,
// fetchListings, normalizeListing all work the same way) so the rest of the
// platform never needs to know it isn't real. It generates clearly
// synthetic vehicle listings so the whole platform can be demonstrated
// before any live marketplace credentials are connected.

const MAKES_MODELS: Array<{ make: string; models: string[] }> = [
  { make: "Toyota", models: ["Corolla", "RAV4", "Camry", "Hilux", "Yaris", "Land Cruiser"] },
  { make: "Honda", models: ["Civic", "CR-V", "Accord", "City"] },
  { make: "Ford", models: ["Ranger", "Everest", "Focus", "Mustang"] },
  { make: "Suzuki", models: ["Swift", "Vitara", "Alto"] },
  { make: "Mazda", models: ["CX-5", "3", "6"] },
  { make: "Hyundai", models: ["Tucson", "i30", "Santa Fe"] },
  { make: "Kia", models: ["Sportage", "Cerato", "Seltos"] },
];

const CITIES = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Karachi", "Lahore"];
const SELLER_TYPES = ["private", "dealer"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Deterministic-ish id pool so repeated polls mostly re-see the same
// listings (to exercise update/duplicate detection) while occasionally
// producing a brand new one (to exercise new-listing detection).
let idCounter = 1000;
const seenPool: string[] = [];

function makeSyntheticListing(id: string): Record<string, unknown> {
  const group = pick(MAKES_MODELS);
  const model = pick(group.models);
  const year = randInt(2016, 2025);
  const basePrice = randInt(15000, 65000);
  return {
    id,
    title: `${year} ${group.make} ${model}`,
    description: `[DEMO DATA] Well-maintained ${year} ${group.make} ${model}. Single owner, full service history, no accidents.`,
    price: basePrice,
    currency: "AUD",
    make: group.make,
    model,
    year,
    mileage: randInt(2000, 140000),
    location: pick(CITIES),
    sellerName: pick(["AutoHub", "City Motors", "Private Seller", "Prestige Cars", "QuickDrive"]),
    sellerType: pick(SELLER_TYPES),
    imageUrl: `https://picsum.photos/seed/${id}/640/400`,
    listingUrl: `https://demo.example.com/listings/${id}`,
    postedAt: new Date(Date.now() - randInt(0, 72) * 3600_000).toISOString(),
  };
}

export const demoProvider: MarketplaceProvider = {
  key: "demo",

  getProviderStatus(): ProviderStaticInfo {
    return {
      key: "demo",
      label: "Demo Data Provider",
      description:
        "Generates realistic synthetic vehicle listings so the platform can be demonstrated end-to-end without external credentials.",
      minIntervalSec: 5,
      requiresRealCredentials: false,
    };
  },

  async testConnection(): Promise<TestResult> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 150));
    return {
      success: true,
      httpStatus: 200,
      responseTimeMs: Date.now() - start,
      message: "Connection successful (demo data source, no external network call made).",
    };
  },

  async fetchListings(_config: ProviderConfig): Promise<RawFetchResult> {
    // Seed a pool of ids the first time, then mostly re-emit existing ones
    // (so they get "seen again") plus occasionally mint 1-3 new ones.
    if (seenPool.length === 0) {
      for (let i = 0; i < 12; i++) {
        seenPool.push(`demo-${idCounter++}`);
      }
    }
    const newCount = Math.random() < 0.6 ? randInt(1, 3) : 0;
    for (let i = 0; i < newCount; i++) {
      seenPool.push(`demo-${idCounter++}`);
    }

    const items = seenPool.map((id) => makeSyntheticListing(id));
    return { items, httpStatus: 200 };
  },

  normalizeListing(raw: unknown): NormalizedListing {
    const r = raw as Record<string, unknown>;
    return {
      externalId: String(r.id),
      title: String(r.title),
      description: r.description as string | undefined,
      price: r.price as number | undefined,
      currency: r.currency as string | undefined,
      make: r.make as string | undefined,
      model: r.model as string | undefined,
      year: r.year as number | undefined,
      mileage: r.mileage as number | undefined,
      location: r.location as string | undefined,
      sellerName: r.sellerName as string | undefined,
      sellerType: r.sellerType as string | undefined,
      imageUrl: r.imageUrl as string | undefined,
      listingUrl: r.listingUrl as string | undefined,
      postedAt: r.postedAt as string | undefined,
      raw: r,
    };
  },
};
