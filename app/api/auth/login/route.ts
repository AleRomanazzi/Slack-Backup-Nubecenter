import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return NextResponse.redirect(new URL("/login?error=missing_fields", request.url));
  }

  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url));
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url));
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/", request.url));
}
