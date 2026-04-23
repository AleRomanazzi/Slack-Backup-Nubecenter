import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/auth/request-origin";

export async function POST(request: Request) {
  const origin = getRequestOrigin(request);
  await clearSession();
  return NextResponse.redirect(new URL("/login", origin));
}
