import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { UserRole } from "@/db/schema";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

function getSessionSecret() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required to manage sessions.");
  }

  return process.env.SESSION_SECRET;
}

function shouldUseSecureSessionCookie() {
  if (process.env.SESSION_COOKIE_SECURE) {
    return process.env.SESSION_COOKIE_SECURE === "true";
  }

  return process.env.NODE_ENV === "production";
}

export function createSessionToken(user: SessionUser) {
  return jwt.sign(user, getSessionSecret(), { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, getSessionSecret());

    if (!payload || typeof payload === "string") {
      return null;
    }

    if (
      typeof payload.id !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      (payload.role !== "admin" && payload.role !== "coordinator" && payload.role !== "employee")
    ) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function setSessionCookie(user: SessionUser) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
