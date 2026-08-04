import { beforeAll, describe, expect, it, vi } from "vitest";

const oracleQuery = vi.fn(async (sql: string) => {
  if (sql.includes("eg.grupo_id IN")) {
    return [
      { EMP_ID: 220, GROUP_ID: 1024 },
      { EMP_ID: 415, GROUP_ID: 1017 },
    ];
  }

  return [
    { EMP_ID: 415, COORDINATOR_EMP_ID: 220 },
    { EMP_ID: 500, COORDINATOR_EMP_ID: 415 },
    { EMP_ID: 501, COORDINATOR_EMP_ID: null },
    { EMP_ID: 502, COORDINATOR_EMP_ID: 999 },
  ];
});

const localUsers = [
  { id: "admin", oracleEmpId: 220, fallbackEmail: null },
  { id: "coordinator", oracleEmpId: 415, fallbackEmail: null },
  { id: "employee", oracleEmpId: 500, fallbackEmail: null },
];

vi.mock("@/db/oracle", () => ({ queryOracle: oracleQuery }));
vi.mock("@/lib/users/user-repository", () => ({
  findUserById: vi.fn(async (id: string) => localUsers.find((user) => user.id === id)),
  findUsersByOracleEmpIds: vi.fn(async (ids: number[]) => localUsers.filter((user) => user.oracleEmpId !== null && ids.includes(user.oracleEmpId))),
}));

describe("organización Oracle", () => {
  beforeAll(() => {
    process.env.ORACLE_TIMERTASK_SCHEMA = "TIMERTASK_ES";
    process.env.ORACLE_STAFF_LINE_IDS = "100,1600";
    process.env.ORACLE_ADMIN_GROUP_ID = "1024";
    process.env.ORACLE_COORDINATOR_GROUP_ID = "1017";
    process.env.TEST_ACCOUNTS_ENABLED = "false";
  });

  it("carga el snapshot una vez, deriva roles, personal y equipos", async () => {
    const {
      findStaffEmpIds,
      findUsersForCoordinator,
      getOrganizationSnapshot,
      isUserInCoordinatorTeam,
      resolveOrganizationForUsers,
      resolveUserRole,
    } = await import("@/lib/employees/org-service");

    const snapshot = await getOrganizationSnapshot();
    expect(snapshot.adminEmpIds).toEqual(new Set([220]));
    expect(snapshot.coordinatorEmpIds).toEqual(new Set([415]));
    expect(await resolveUserRole(localUsers[0])).toBe("admin");
    expect(await resolveUserRole(localUsers[1])).toBe("coordinator");
    expect(await resolveUserRole({ oracleEmpId: 501 })).toBe("employee");
    expect(await resolveUserRole({ oracleEmpId: null })).toBe("employee");
    expect(await resolveUserRole({ oracleEmpId: null })).toBe("employee");
    expect(await findStaffEmpIds()).toEqual(new Set([415, 500, 501, 502]));
    expect(await findUsersForCoordinator("coordinator")).toEqual([localUsers[2]]);
    expect(await isUserInCoordinatorTeam("employee", "coordinator")).toBe(true);
    expect(await isUserInCoordinatorTeam("coordinator", "employee")).toBe(false);
    expect(await isUserInCoordinatorTeam("missing", "coordinator")).toBe(false);
    expect(await findUsersForCoordinator("missing")).toEqual([]);

    const resolved = await resolveOrganizationForUsers(localUsers);
    expect(resolved.get("admin")).toMatchObject({ role: "admin", coordinator: null });
    expect(resolved.get("employee")).toMatchObject({ role: "employee", coordinator: { id: "coordinator" } });
    expect(oracleQuery).toHaveBeenCalledTimes(2);
    expect(await (await import("@/lib/employees/org-service")).findCoordinatorUser({ oracleEmpId: 501 })).toBeNull();
    expect(await (await import("@/lib/employees/org-service")).findCoordinatorUser({ oracleEmpId: 502 })).toBeNull();
    expect(await (await import("@/lib/employees/org-service")).findCoordinatorUser({ oracleEmpId: null })).toBeNull();
  });
});
