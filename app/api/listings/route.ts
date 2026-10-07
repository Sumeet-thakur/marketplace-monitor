import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { listingRepo } from "@/lib/repositories";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(req.url);
  const q = url.searchParams;

  const { rows, total } = listingRepo.find({
    search: q.get("search") ?? undefined,
    source: q.get("source") ?? undefined,
    minPrice: q.get("minPrice") ? Number(q.get("minPrice")) : undefined,
    maxPrice: q.get("maxPrice") ? Number(q.get("maxPrice")) : undefined,
    minYear: q.get("minYear") ? Number(q.get("minYear")) : undefined,
    maxYear: q.get("maxYear") ? Number(q.get("maxYear")) : undefined,
    location: q.get("location") ?? undefined,
    newOnly: q.get("newOnly") === "true",
    sort: (q.get("sort") as "newest" | "price_asc" | "price_desc" | "first_seen") ?? "newest",
    limit: q.get("limit") ? Number(q.get("limit")) : 50,
    offset: q.get("offset") ? Number(q.get("offset")) : 0,
  });

  return NextResponse.json({
    listings: rows.map((r) => ({ ...r, enabled: undefined })),
    total,
    sources: listingRepo.distinctSources(),
    stats: listingRepo.stats(),
  });
}
