import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

function shouldUseSecureCookies(): boolean {
  if (process.env.AUTH_COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.AUTH_COOKIE_SECURE === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-change-me";
}

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}:${getAuthSecret()}`).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}
