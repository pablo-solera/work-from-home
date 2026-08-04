import { afterEach, describe, expect, it } from "vitest";
import { findTestAccountByEmail, findTestAccountByEmpId, getTestAccounts, verifyTestAccountPassword } from "@/lib/employees/test-accounts";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("cuentas de prueba", () => {
  it("resuelve las tres cuentas y sus roles cuando están habilitadas", () => {
    process.env.TEST_ACCOUNTS_ENABLED = "true";
    process.env.TEST_ACCOUNTS_PASSWORD = "shared-password";
    process.env.TEST_ACCOUNT_ADMIN = "3509:test.manager@solera.com";
    process.env.TEST_ACCOUNT_COORDINATOR = "3510:test.coordinator@solera.com";
    process.env.TEST_ACCOUNT_EMPLOYEE = "3511:test.employee@solera.com";

    expect(getTestAccounts()).toHaveLength(3);
    expect(findTestAccountByEmail("TEST.COORDINATOR@SOLERA.COM")).toMatchObject({ empId: 3510, role: "coordinator" });
    expect(findTestAccountByEmpId(3511)).toMatchObject({ email: "test.employee@solera.com", role: "employee" });
    expect(verifyTestAccountPassword("shared-password")).toBe(true);
    expect(verifyTestAccountPassword("wrong-password")).toBe(false);
  });

  it("no expone cuentas cuando están deshabilitadas", () => {
    process.env.TEST_ACCOUNTS_ENABLED = "false";

    expect(getTestAccounts()).toBeNull();
    expect(findTestAccountByEmail("test.manager@solera.com")).toBeNull();
  });
});
