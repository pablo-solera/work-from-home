import { describe, expect, it } from "vitest";
import { changePasswordSchema, deleteUserSchema, isUserRole, loginSchema, updateUserSchema } from "@/lib/users/user-validation";

const id = "11111111-1111-4111-8111-111111111111";

describe("user validation", () => {
  it("normalizes login emails and rejects empty passwords", () => {
    expect(loginSchema.parse({ email: "User@Example.COM", password: "secret" })).toEqual({ email: "user@example.com", password: "secret" });
    expect(loginSchema.safeParse({ email: "bad", password: "" }).success).toBe(false);
  });

  it("parses update fields and optional values", () => {
    expect(updateUserSchema.parse({ canEditAllWfh: "on", hasWfh: "on", id, wfhDaysAllowance: "12" })).toEqual({ canEditAllWfh: true, hasWfh: true, id, wfhDaysAllowance: 12 });
    expect(updateUserSchema.safeParse({ canEditAllWfh: "off", hasWfh: "on", id, wfhDaysAllowance: "-1" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ canEditAllWfh: "on", hasWfh: "on", id, wfhDaysAllowance: "not-a-number" }).success).toBe(false);
  });

  it("validates password modes and deletion ids", () => {
    expect(changePasswordSchema.parse({ id, passwordMode: "generate" })).toMatchObject({ id, passwordMode: "generate" });
    expect(changePasswordSchema.safeParse({ id, password: "short", passwordMode: "manual" }).success).toBe(false);
    expect(deleteUserSchema.parse({ id })).toEqual({ id });
    expect(deleteUserSchema.safeParse({ id: "bad" }).success).toBe(false);
  });

  it("recognizes only supported roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("coordinator")).toBe(true);
    expect(isUserRole("employee")).toBe(true);
    expect(isUserRole("owner")).toBe(false);
  });
});
