import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

import { clearSessionCookie, createSessionToken, getCurrentUser, setSessionCookie, verifySessionToken } from "@/lib/auth/session";
import { generateTemporaryPassword } from "@/lib/users/password-generator";
import { buildPasswordsCsv } from "@/lib/users/passwords-csv";

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

  it("reads, sets and clears the session cookie", async () => {
    cookieStore.get.mockReturnValueOnce(undefined).mockReturnValueOnce({ value: createSessionToken(user) });
    expect(await getCurrentUser()).toBeNull();
    expect(await getCurrentUser()).toEqual(user);
    process.env.SESSION_COOKIE_SECURE = "true";
    await setSessionCookie(user);
    expect(cookieStore.set).toHaveBeenCalledWith("session", expect.any(String), expect.objectContaining({ httpOnly: true, secure: true }));
    await clearSessionCookie();
    expect(cookieStore.delete).toHaveBeenCalledWith("session");
    delete process.env.SESSION_COOKIE_SECURE;
  });
});

describe("temporary passwords and CSV", () => {
  it("generates passwords of the requested length", () => {
    const password = generateTemporaryPassword(16);
    expect(password).toHaveLength(16);
    expect(password).toMatch(/^[A-Za-z2-9]+$/);
  });

  it("escapes CSV fields and adds a UTF-8 BOM", () => {
    const csv = buildPasswordsCsv([{ name: "José \"J\"", email: "jose@example.com", password: "p,1" }]);
    expect(csv.startsWith("\uFEFFname,email,password\n")).toBe(true);
    expect(csv).toContain('"José ""J""","jose@example.com","p,1"');
  });
});
