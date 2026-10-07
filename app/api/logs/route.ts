import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { apiLogRepo } from "@/lib/repositories";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(req.url);
  const level = url.searchParams.get("level") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 200;

  const logs = apiLogRepo.recent(limit, level, category);
  return NextResponse.json({ logs });
}
