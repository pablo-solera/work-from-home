import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { isSessionRevoked, revokeSession } from "./session-repository";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export type UserRole = "admin" | "coordinator" | "employee";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "change-me-with-a-long-random-secret" || secret.length < 32) {
    throw new Error("SESSION_SECRET must be a non-placeholder value of at least 32 characters.");
  }

  return secret;
}

function shouldUseSecureSessionCookie() {
  if (process.env.SESSION_COOKIE_SECURE) {
    return process.env.SESSION_COOKIE_SECURE === "true";
  }

  return process.env.NODE_ENV === "production";
}

export function createSessionToken(user: SessionUser) {
  return jwt.sign({ ...user, jti: crypto.randomUUID() }, getSessionSecret(), { expiresIn: "1d" });
}

function decodeSessionToken(token: string): { jti: string; user: SessionUser } | null {
  try {
    const payload = jwt.verify(token, getSessionSecret(), { algorithms: ["HS256"] });

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

    if (typeof payload.jti !== "string") return null;

    return {
      jti: payload.jti,
      user: { id: payload.id, name: payload.name, email: payload.email, role: payload.role },
    };
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string): SessionUser | null {
  return decodeSessionToken(token)?.user ?? null;
}

/** Verifies the session cookie signature once, without checking revocation. */
export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? decodeSessionToken(token) : null;
}

export async function getCurrentUser() {
  const session = await readSession();
  if (!session) return null;
  return await isSessionRevoked(session.jti) ? null : session.user;
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
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const payload = jwt.verify(token, getSessionSecret(), { algorithms: ["HS256"] });
      if (typeof payload !== "string" && typeof payload.jti === "string") {
        const expiresAt = typeof payload.exp === "number" ? new Date(payload.exp * 1000) : new Date();
        await revokeSession(payload.jti, expiresAt);
      }
    } catch {
      // Expired or invalid sessions are already unusable.
    }
  }
  store.set(SESSION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
  });
}
