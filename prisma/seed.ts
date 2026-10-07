import "dotenv/config";
import { userRepo, integrationRepo, listingRepo, listingEventRepo } from "../lib/repositories";
import { hashPassword } from "../lib/auth";

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
const SOURCES = ["demo", "pakwheels", "generic"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Seeding database...");

  // --- Admin user -----------------------------------------------------
  const existingAdmin = userRepo.findByEmail("admin@example.com");
  if (!existingAdmin) {
    const passwordHash = await hashPassword("admin123");
    userRepo.create({ email: "admin@example.com", passwordHash, name: "Admin" });
    console.log("Created admin user: admin@example.com / admin123 (change this after first login)");
  }

  // --- Integrations -----------------------------------------------------
  const existing = integrationRepo.findAll();
  let demoIntegration = existing.find((i) => i.provider === "demo");
  if (!demoIntegration) {
    demoIntegration = integrationRepo.create({
      provider: "demo",
      displayName: "Demo Data Provider",
      enabled: true,
      demo: true,
      requestIntervalSec: 8,
      minIntervalSec: 5,
    });
    integrationRepo.update(demoIntegration.id, { status: "connected" });
  }

  if (!existing.find((i) => i.provider === "meta")) {
    integrationRepo.create({
      provider: "meta",
      displayName: "Meta / Facebook Marketplace",
      enabled: false,
      requestIntervalSec: 10,
      minIntervalSec: 30,
      authMethod: "bearer",
    });
  }

  if (!existing.find((i) => i.provider === "pakwheels")) {
    integrationRepo.create({
      provider: "pakwheels",
      displayName: "PakWheels",
      enabled: false,
      requestIntervalSec: 30,
      minIntervalSec: 30,
    });
  }

  // --- Seed listings so the dashboard looks populated immediately -------
  const listingCount = listingRepo.find({ limit: 1 }).total;
  if (listingCount === 0) {
    for (let i = 0; i < 34; i++) {
      const group = pick(MAKES_MODELS);
      const model = pick(group.models);
      const year = randInt(2016, 2025);
      const source = pick(SOURCES);
      const externalId = `seed-${source}-${i}-${Date.now()}`;
      const firstSeenDaysAgo = randInt(0, 5);

      const listing = listingRepo.create(source, externalId, demoIntegration.id, i < 4 ? "NEW" : "ACTIVE", {
        title: `${year} ${group.make} ${model} [DEMO DATA]`,
        description: `[DEMO DATA] Synthetic seed listing for demonstration purposes. Well-maintained ${year} ${group.make} ${model}.`,
        price: randInt(15000, 65000),
        currency: "AUD",
        make: group.make,
        model,
        year,
        mileage: randInt(2000, 140000),
        location: pick(CITIES),
        sellerName: pick(["AutoHub", "City Motors", "Private Seller", "Prestige Cars", "QuickDrive"]),
        sellerType: pick(["private", "dealer"]),
        imageUrl: `https://picsum.photos/seed/seed-${i}/640/400`,
        listingUrl: `https://demo.example.com/listings/seed-${i}`,
        postedAt: new Date(Date.now() - firstSeenDaysAgo * 86_400_000),
      });
      listingEventRepo.create(listing.id, "FIRST_DETECTED", "First detected (seed data)");
    }
    console.log("Seeded 34 synthetic listings.");
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
