import type { UserRole } from "@/lib/auth/session";
import { findOrganizationRows, getExcludedGroupIds } from "@/lib/employees/org-repository";
import { findTestAccountByEmpId, getTestAccounts } from "@/lib/employees/test-accounts";
import { findUserById, findUsersByOracleEmpIds } from "@/lib/users/user-repository";

const DEFAULT_TTL_SECONDS = 60;
const COORDINATOR_GROUP_ID = 1017;
const ADMIN_GROUP_ID = 1024;

type OrganizationSnapshot = {
  adminEmpIds: Set<number>;
  coordinatorEmpIds: Set<number>;
  coordinatorByEmpId: Map<number, number | null>;
  excludedEmpIds: Set<number>;
  staffEmpIds: Set<number>;
  teamByCoordinatorEmpId: Map<number, Set<number>>;
};

type SnapshotState = {
  loadedAt: number;
  promise: Promise<OrganizationSnapshot> | null;
  snapshot: OrganizationSnapshot | null;
};

declare global {
  var __wfhOrganizationSnapshot: SnapshotState | undefined;
}

const state: SnapshotState = globalThis.__wfhOrganizationSnapshot ?? {
  loadedAt: 0,
  promise: null,
  snapshot: null,
};
globalThis.__wfhOrganizationSnapshot = state;

function configuredGroupId(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function getTtlMs() {
  const seconds = Number(process.env.ORG_SNAPSHOT_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("ORG_SNAPSHOT_TTL_SECONDS must be positive.");
  return seconds * 1000;
}

function buildSnapshot(rows: Awaited<ReturnType<typeof findOrganizationRows>>): OrganizationSnapshot {
  const adminGroupId = configuredGroupId("ORACLE_ADMIN_GROUP_ID", ADMIN_GROUP_ID);
  const coordinatorGroupId = configuredGroupId("ORACLE_COORDINATOR_GROUP_ID", COORDINATOR_GROUP_ID);

  const testAccounts = findTestAccountRows(adminGroupId, coordinatorGroupId);
  const organizationRows = testAccounts
    ? {
        roles: [...rows.roles, ...testAccounts.roles],
        hierarchy: [...rows.hierarchy, ...testAccounts.hierarchy],
      }
    : rows;
  const adminEmpIds = new Set(organizationRows.roles.filter((row) => row.GROUP_ID === adminGroupId).map((row) => row.EMP_ID));
  const coordinatorEmpIds = new Set(organizationRows.roles.filter((row) => row.GROUP_ID === coordinatorGroupId).map((row) => row.EMP_ID));
  const excludedGroupIds = new Set(getExcludedGroupIds());
  const excludedEmpIds = new Set(organizationRows.roles
    .filter((row) => excludedGroupIds.has(row.GROUP_ID))
    .map((row) => row.EMP_ID));
  const coordinatorByEmpId = new Map(organizationRows.hierarchy.map((row) => [row.EMP_ID, row.COORDINATOR_EMP_ID]));
  const teamByCoordinatorEmpId = new Map<number, Set<number>>();

  for (const [employeeEmpId, coordinatorEmpId] of coordinatorByEmpId) {
    if (coordinatorEmpId === null) continue;
    const team = teamByCoordinatorEmpId.get(coordinatorEmpId) ?? new Set<number>();
    team.add(employeeEmpId);
    teamByCoordinatorEmpId.set(coordinatorEmpId, team);
  }

  return {
    adminEmpIds,
    coordinatorEmpIds,
    coordinatorByEmpId,
    excludedEmpIds,
    staffEmpIds: new Set(coordinatorByEmpId.keys()),
    teamByCoordinatorEmpId,
  };
}

function findTestAccountRows(adminGroupId: number, coordinatorGroupId: number) {
  const accounts = getTestAccounts();
  if (!accounts) return null;

  const admin = accounts.find((account) => account.role === "admin");
  const coordinator = accounts.find((account) => account.role === "coordinator");
  const employee = accounts.find((account) => account.role === "employee");

  if (!admin || !coordinator || !employee) return null;

  return {
    roles: [
      { EMP_ID: admin.empId, GROUP_ID: adminGroupId },
      { EMP_ID: coordinator.empId, GROUP_ID: coordinatorGroupId },
    ],
    hierarchy: [
      { EMP_ID: admin.empId, COORDINATOR_EMP_ID: null },
      { EMP_ID: coordinator.empId, COORDINATOR_EMP_ID: null },
      { EMP_ID: employee.empId, COORDINATOR_EMP_ID: coordinator.empId },
    ],
  };
}

export async function getOrganizationSnapshot() {
  const now = Date.now();
  if (state.snapshot && now - state.loadedAt < getTtlMs()) return state.snapshot;
  if (!state.promise) {
    state.promise = findOrganizationRows(
      configuredGroupId("ORACLE_ADMIN_GROUP_ID", ADMIN_GROUP_ID),
      configuredGroupId("ORACLE_COORDINATOR_GROUP_ID", COORDINATOR_GROUP_ID),
    )
      .then(buildSnapshot)
      .catch((error) => {
        if (!getTestAccounts()) throw error;
        console.error("Oracle organization unavailable; using test account organization.", error);
        return buildSnapshot({ roles: [], hierarchy: [] });
      })
      .then((snapshot) => {
        state.snapshot = snapshot;
        state.loadedAt = Date.now();
        return snapshot;
      })
      .finally(() => {
        state.promise = null;
      });
  }

  return state.promise;
}

export async function resolveUserRole(user: { oracleEmpId: number | null }): Promise<UserRole> {
  const testAccount = findTestAccountByEmpId(user.oracleEmpId);
  if (testAccount) return testAccount.role;
  if (user.oracleEmpId === null) return "employee";
  const snapshot = await getOrganizationSnapshot();
  if (snapshot.adminEmpIds.has(user.oracleEmpId)) return "admin";
  return snapshot.coordinatorEmpIds.has(user.oracleEmpId) ? "coordinator" : "employee";
}

export type ResolvedOrganizationUser = {
  coordinator: Awaited<ReturnType<typeof findUsersByOracleEmpIds>>[number] | null;
  id: string;
  role: UserRole;
};

export async function resolveOrganizationForUsers(users: { id: string; oracleEmpId: number | null }[]) {
  const snapshot = await getOrganizationSnapshot();
  const coordinatorEmpIds = users.flatMap((user) => {
    if (user.oracleEmpId === null) return [];
    const coordinatorEmpId = snapshot.coordinatorByEmpId.get(user.oracleEmpId);
    return coordinatorEmpId === null || coordinatorEmpId === undefined ? [] : [coordinatorEmpId];
  });
  const coordinators = await findUsersByOracleEmpIds([...new Set(coordinatorEmpIds)]);
  const coordinatorByOracleId = new Map(coordinators.map((user) => [user.oracleEmpId, user]));

  return new Map<string, ResolvedOrganizationUser>(users.map((user) => {
    const testAccount = findTestAccountByEmpId(user.oracleEmpId);
    const role: UserRole = testAccount
      ? testAccount.role
      : user.oracleEmpId !== null && snapshot.adminEmpIds.has(user.oracleEmpId)
        ? "admin"
        : user.oracleEmpId !== null && snapshot.coordinatorEmpIds.has(user.oracleEmpId)
          ? "coordinator"
          : "employee";
    const coordinatorEmpId = user.oracleEmpId === null ? undefined : snapshot.coordinatorByEmpId.get(user.oracleEmpId);
    return [user.id, { coordinator: coordinatorEmpId ? coordinatorByOracleId.get(coordinatorEmpId) ?? null : null, id: user.id, role }] as const;
  }));
}

export async function findCoordinatorUser(user: { oracleEmpId: number | null }) {
  if (user.oracleEmpId === null) return null;
  const snapshot = await getOrganizationSnapshot();
  const coordinatorEmpId = snapshot.coordinatorByEmpId.get(user.oracleEmpId);
  if (coordinatorEmpId === null || coordinatorEmpId === undefined) return null;
  const [coordinator] = await findUsersByOracleEmpIds([coordinatorEmpId]);
  return coordinator ?? null;
}

export async function findUsersForCoordinator(coordinatorId: string) {
  const coordinator = await findUserById(coordinatorId);
  if (!coordinator?.oracleEmpId) return [];
  const snapshot = await getOrganizationSnapshot();
  const teamEmpIds = snapshot.teamByCoordinatorEmpId.get(coordinator.oracleEmpId) ?? new Set<number>();
  return findUsersByOracleEmpIds([...teamEmpIds]);
}

export async function findEmployeeTeamVisibility(employeeId: string) {
  const employee = await findUserById(employeeId);
  if (!employee) return null;
  const coordinator = await findCoordinatorUser(employee);
  if (!coordinator) return null;
  return { coordinatorId: coordinator.id, teamWfhVisible: coordinator.teamWfhVisible };
}

export async function findEmployeeByCoordinatorId(employeeId: string, coordinatorId: string, coordinator?: Awaited<ReturnType<typeof findUserById>>) {
  const [employee, resolvedCoordinator, snapshot] = await Promise.all([
    findUserById(employeeId),
    coordinator ? Promise.resolve(coordinator) : findUserById(coordinatorId),
    getOrganizationSnapshot(),
  ]);

  if (employee?.oracleEmpId === null || employee?.oracleEmpId === undefined || resolvedCoordinator?.oracleEmpId === null || resolvedCoordinator?.oracleEmpId === undefined) return undefined;
  if (!snapshot.teamByCoordinatorEmpId.get(resolvedCoordinator.oracleEmpId)?.has(employee.oracleEmpId)) return undefined;

  return employee;
}

export async function isUserInCoordinatorTeam(employeeId: string, coordinatorId: string, employee?: Awaited<ReturnType<typeof findUserById>>) {
  const [resolvedEmployee, coordinator, snapshot] = await Promise.all([employee ? Promise.resolve(employee) : findUserById(employeeId), findUserById(coordinatorId), getOrganizationSnapshot()]);
  if (resolvedEmployee?.oracleEmpId === null || resolvedEmployee?.oracleEmpId === undefined || coordinator?.oracleEmpId === null || coordinator?.oracleEmpId === undefined) return false;
  return snapshot.teamByCoordinatorEmpId.get(coordinator.oracleEmpId)?.has(resolvedEmployee.oracleEmpId) ?? false;
}

export async function findStaffEmpIds() {
  return (await getOrganizationSnapshot()).staffEmpIds;
}

export async function findExcludedEmpIds() {
  return (await getOrganizationSnapshot()).excludedEmpIds;
}
