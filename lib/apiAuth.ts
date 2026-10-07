import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { user, response: null };
}
