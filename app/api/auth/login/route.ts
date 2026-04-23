import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/auth/request-origin";

export async function POST(request: Request) {
  try {
    const origin = getRequestOrigin(request);
    const formData = await request.formData();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
      return NextResponse.redirect(new URL("/login?error=missing_fields", origin));
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", origin));
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", origin));
    }

    await createSession(user.id);
    return NextResponse.redirect(new URL("/", origin));
  } catch (error) {
    console.error("Login route error", error);
    return NextResponse.redirect(new URL("/login?error=server_error", getRequestOrigin(request)));
  }
}
