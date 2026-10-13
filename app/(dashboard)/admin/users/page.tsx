import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth/guards";
import { searchEmployees } from "@/lib/employees/employee-repository";
import { findUsersForAdmin, findUsersByOracleEmpIds } from "@/lib/users/user-repository";
import { resolveOrganizationForUsers } from "@/lib/employees/org-service";
import { resolveUserIdentities } from "@/lib/employees/identity-service";

type AdminUsersPageProps = {
  searchParams?: Promise<{ page?: string; query?: string }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const queryParam = params?.query?.trim() ?? "";
  const query = queryParam.toLowerCase();
  const requestedPage = Number.parseInt(params?.page ?? "1", 10);
  const admin = await requireAdmin();
  const pageSize = 10;
  const page = Number.isInteger(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const allUsers = await findUsersForAdmin();
  const allSystemUsers = allUsers.filter((user) => user.oracleEmpId === null);
  const systemIdentities = await resolveUserIdentities(allSystemUsers);
  const systemUsers = allSystemUsers.map((user) => ({
    ...user,
    name: systemIdentities.get(user.id)?.name ?? user.fallbackName ?? "Usuario",
    email: systemIdentities.get(user.id)?.email ?? user.fallbackEmail ?? "",
  })).filter((user) => !query || `${user.name} ${user.email} ${user.canEditAllWfh ? "cobertura" : ""}`.toLowerCase().includes(query));
  const systemOffset = (page - 1) * pageSize;
  const systemPage = systemUsers.slice(systemOffset, systemOffset + pageSize);
  const employeeOffset = Math.max(0, systemOffset - systemUsers.length);
  const employeeLimit = Math.max(1, pageSize - systemPage.length);
  const searchedEmployees = await searchEmployees(query, employeeOffset, employeeLimit);
  const employeesForPage = await findUsersByOracleEmpIds(searchedEmployees.employees.map((employee) => employee.empId));
  const employeeByOracleId = new Map(searchedEmployees.employees.map((employee) => [employee.empId, employee]));
  const usersByOracleId = new Map(employeesForPage.map((user) => [user.oracleEmpId, user]));
  const pageUsers = [...systemPage, ...searchedEmployees.employees.flatMap((employee) => usersByOracleId.has(employee.empId) ? [usersByOracleId.get(employee.empId)!] : [])];
  const organization = await resolveOrganizationForUsers(pageUsers);
  const coordinators = [...organization.values()].flatMap((user) => user.coordinator ? [user.coordinator] : []);
  const pageIdentities = await resolveUserIdentities([...pageUsers, ...coordinators]);
  const users = pageUsers.map((user) => {
    const oracleIdentity = user.oracleEmpId === null ? null : employeeByOracleId.get(user.oracleEmpId);
    const identity = pageIdentities.get(user.id) ?? { name: oracleIdentity?.name ?? "Usuario", email: oracleIdentity?.email ?? null, wdNumber: oracleIdentity?.wdNumber ?? null };
    const organizationUser = organization.get(user.id);
    const coordinator = organizationUser?.coordinator;
    const coordinatorIdentity = coordinator ? pageIdentities.get(coordinator.id) : null;
    return {
      canEditAllWfh: user.canEditAllWfh,
      coordinator: coordinator && coordinatorIdentity ? { id: coordinator.id, name: coordinatorIdentity.name, email: coordinatorIdentity.email ?? "" } : null,
      coordinatorId: coordinator?.id ?? null,
      email: identity.email ?? "",
      hasWfh: user.hasWfh,
      id: user.id,
      name: identity.name,
      role: organizationUser?.role ?? "employee",
      wfhDaysAllowance: user.wfhDaysAllowance,
      wdNumber: identity.wdNumber,
    };
  });
  const totalPages = Math.max(1, Math.ceil((searchedEmployees.total + systemUsers.length) / pageSize));
  const managedUsers = users;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Gestión de usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
           La identidad, los roles y la jerarquía se gestionan en TimerTask. Aquí administras opciones de teletrabajo.
        </p>
      </div>

        <UsersTable currentUserId={admin.id} page={page} query={queryParam} totalPages={totalPages} totalUsers={searchedEmployees.total + systemUsers.length} users={managedUsers} />
    </section>
  );
}
