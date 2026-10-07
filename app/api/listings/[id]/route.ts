import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { listingRepo, listingEventRepo } from "@/lib/repositories";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await params;
  const listing = listingRepo.findById(id);
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = listingEventRepo.findByListingId(id);
  return NextResponse.json({ listing, events });
}
