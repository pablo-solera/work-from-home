import type { SessionUser } from "@/lib/auth/session";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { getAssistantVisibleUsers } from "./assistant-scope";

export type AssistantEmployee = {
  email: string;
  id: string;
  name: string;
};

export type VisibleAssistantEmployee = AssistantEmployee & {
  oracleEmpId: number | null;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export async function getVisibleAssistantEmployeeRecords(actor: SessionUser): Promise<VisibleAssistantEmployee[]> {
  const users = await getAssistantVisibleUsers(actor);
  if (!users) return [];
  const identities = await resolveUserIdentities(users);

  return users.map((user) => {
    const identity = identities.get(user.id);
    return { id: user.id, name: identity?.name ?? "Usuario", email: identity?.email ?? "", oracleEmpId: user.oracleEmpId };
  });
}

export async function getVisibleAssistantEmployees(actor: SessionUser): Promise<AssistantEmployee[]> {
  const records = await getVisibleAssistantEmployeeRecords(actor);
  return records.map(({ id, name, email }) => ({ id, name, email }));
}

export async function resolveEmployeeByName(actor: SessionUser, query: string) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 3) return { matches: [] as AssistantEmployee[], query, error: "Indica al menos tres caracteres del nombre o email." };

  const employees = await getVisibleAssistantEmployees(actor);
  const allMatches = employees.filter((employee) => normalize(`${employee.name} ${employee.email}`).includes(normalizedQuery));
  return { matches: allMatches.slice(0, 10), query, truncated: allMatches.length > 10 };
}
