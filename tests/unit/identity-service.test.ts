import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findEmployeesByIds: vi.fn() }));

vi.mock("@/lib/employees/employee-repository", () => ({ findEmployeesByIds: mocks.findEmployeesByIds }));

const user = (oracleEmpId: number, fallbackName = "Usuario local") => ({ id: `user-${oracleEmpId}`, oracleEmpId, fallbackName, fallbackEmail: "local@example.com" });

describe("identidades de empleados", () => {
  afterEach(() => {
    mocks.findEmployeesByIds.mockReset();
    vi.useRealTimers();
  });

  it("deduplica cargas concurrentes y reutiliza el resultado", async () => {
    mocks.findEmployeesByIds.mockImplementation(async (ids: number[]) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Map(ids.map((empId) => [empId, { empId, name: `Empleado ${empId}`, email: `${empId}@example.com`, wdNumber: null }]));
    });
    const { resolveUserIdentities } = await import("@/lib/employees/identity-service");

    const [first, second] = await Promise.all([resolveUserIdentities([user(9101)]), resolveUserIdentities([user(9101)])]);

    expect(first.get("user-9101")?.name).toBe("Empleado 9101");
    expect(second.get("user-9101")?.email).toBe("9101@example.com");
    expect(mocks.findEmployeesByIds).toHaveBeenCalledTimes(1);
  });

  it("usa fallback cuando Oracle no devuelve una identidad", async () => {
    mocks.findEmployeesByIds.mockResolvedValue(new Map());
    const { resolveUserIdentities } = await import("@/lib/employees/identity-service");

    const result = await resolveUserIdentities([user(9102, "Nombre de fallback")]);

    expect(result.get("user-9102")).toMatchObject({ name: "Nombre de fallback", email: "local@example.com" });
  });

  it("degrada a fallback cuando Oracle no está disponible", async () => {
    mocks.findEmployeesByIds.mockRejectedValue(new Error("Oracle offline"));
    const { resolveUserIdentities } = await import("@/lib/employees/identity-service");

    const result = await resolveUserIdentities([user(9103)]);

    expect(result.get("user-9103")).toMatchObject({ name: "Usuario local", email: "local@example.com" });
  });
});
