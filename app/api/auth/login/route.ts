import { NextResponse } from "next/server";
import { userRepo, createSession, verifyPassword, createUserIfNoneExist } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Bootstrap: if this is a brand new install with no users yet, the first
  // login attempt creates the admin account with the credentials supplied.
  await createUserIfNoneExist(email, password);

  const user = userRepo.findByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
