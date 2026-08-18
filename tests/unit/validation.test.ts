import { describe, expect, it } from "vitest";
import { loginSchema, updateUserSchema } from "@/lib/users/user-validation";

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

});
