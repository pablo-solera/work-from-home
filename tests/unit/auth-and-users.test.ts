import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth/session-repository", () => ({
  isSessionRevoked: vi.fn(async () => false),
  revokeSession: vi.fn(async () => undefined),
}));

import { isSessionRevoked, revokeSession } from "@/lib/auth/session-repository";
import { clearSessionCookie, createSessionToken, getCurrentUser, setSessionCookie, verifySessionToken } from "@/lib/auth/session";

describe("session tokens", () => {
  const user = { id: "1", name: "Admin", email: "admin@example.com", role: "admin" as const };

  it("round-trips valid sessions and rejects tampering", () => {
    const token = createSessionToken(user);
    expect(verifySessionToken(token)).toEqual(user);
    expect(verifySessionToken(`${token}tampered`)).toBeNull();
    expect(verifySessionToken("not-a-token")).toBeNull();
    expect(verifySessionToken(jwt.sign("text-payload", process.env.SESSION_SECRET!))).toBeNull();
    expect(verifySessionToken(jwt.sign({ id: 1, name: "Admin", email: "admin@example.com", role: "admin" }, process.env.SESSION_SECRET!))).toBeNull();
    expect(verifySessionToken(jwt.sign({ id: "1", name: "Admin", email: "admin@example.com", role: "unknown" }, process.env.SESSION_SECRET!))).toBeNull();
  });

  it("rejects sessions revoked by logout", async () => {
    const token = createSessionToken(user);
    cookieStore.get.mockReturnValueOnce({ value: token });
    await clearSessionCookie();
    expect(revokeSession).toHaveBeenCalledWith(expect.any(String), expect.any(Date));
    vi.mocked(isSessionRevoked).mockResolvedValueOnce(true);
    cookieStore.get.mockReturnValueOnce({ value: token });
    expect(await getCurrentUser()).toBeNull();
  });

  it("reads, sets and clears the session cookie", async () => {
    cookieStore.get.mockReturnValueOnce(undefined).mockReturnValueOnce({ value: createSessionToken(user) });
    expect(await getCurrentUser()).toBeNull();
    expect(await getCurrentUser()).toEqual(user);
    process.env.SESSION_COOKIE_SECURE = "true";
    await setSessionCookie(user);
    expect(cookieStore.set).toHaveBeenCalledWith("session", expect.any(String), expect.objectContaining({ httpOnly: true, secure: true }));
    await clearSessionCookie();
    expect(cookieStore.set).toHaveBeenLastCalledWith("session", "", expect.objectContaining({ maxAge: 0, path: "/", secure: true }));
    delete process.env.SESSION_COOKIE_SECURE;
  });

  it("lets SESSION_COOKIE_SECURE disable secure cookies", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");

    await setSessionCookie(user);

    expect(cookieStore.set).toHaveBeenLastCalledWith(
      "session",
      expect.any(String),
      expect.objectContaining({ secure: false }),
    );

    vi.unstubAllEnvs();
  });

  it("enables secure cookies by default in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.SESSION_COOKIE_SECURE;

    await setSessionCookie(user);

    expect(cookieStore.set).toHaveBeenLastCalledWith("session", expect.any(String), expect.objectContaining({ secure: true }));
    vi.unstubAllEnvs();
  });
});
