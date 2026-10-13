import { createAzure } from "@ai-sdk/azure";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import { assistantTodayContext, getEmployeeRangeStatus } from "./day-status";
import { getAssistantDayOverview, getAssistantRangeOverview } from "./day-summary";
import { resolveEmployeeByName } from "./employee-lookup";
import { getAssistantDateRangeContext } from "./assistant-policy";
import { describeTimerTaskTable, listTimerTaskTables, queryTimerTask, queryWorkFromHome } from "./sql-tools";

const DATABASE_GUIDE = `Postgres (Work From Home), esquema public:
- users(id UUID, oracle_emp_id INTEGER, fallback_email TEXT, fallback_name TEXT, has_wfh BOOLEAN, team_wfh_visible BOOLEAN, can_edit_all_wfh BOOLEAN, wfh_days_allowance INTEGER, created_at TIMESTAMPTZ)
- work_from_home_days(id UUID, user_id UUID REFERENCES users.id, date DATE, created_at TIMESTAMPTZ)
- wfh_change_requests(id UUID, requester_id UUID REFERENCES users.id, coordinator_id UUID REFERENCES users.id, kind, status, requester_comment, decision_comment, decided_by_id, created_at, decided_at, coordinator_notified_at, coordinator_acknowledged_at, admin_notified_at, admin_acknowledged_at)
- wfh_change_request_dates(id UUID, request_id UUID REFERENCES wfh_change_requests.id, requested_date DATE, replaced_date DATE, cancelled_at TIMESTAMPTZ, cancelled_by_id UUID)
TimerTask está en Oracle, solo esquema TIMERTASK_ES. Para descubrir otras tablas utiliza listTimerTaskTables y describeTimerTaskTable. Empieza por TIMERTASK_ES.TEMPLEADOS (emp_id, nombres y email), TIMERTASK_ES.TEMPLEADO_DIAS (emp_id, ehr_fecha, tdia_id), TEMPLEADO_GRUPOS y TGRUPOS. Los TDIA_ID conocidos son vacaciones [1,5,6,15,17,18], ausencias [2], bajas [4], viajes [3], permisos [14], excedencia [16], mudanza [13]. El cruce entre las bases es users.oracle_emp_id = TIMERTASK_ES.TEMPLEADOS.emp_id. Son bases separadas: haz consultas independientes y cruza por ese identificador. No inventes nombres de tablas ni columnas; descúbrelos con las herramientas.`;

export function getAzureConfig() {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT no está configurado.");
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!apiKey || !rawEndpoint) throw new Error("Azure OpenAI no está configurado.");

  const endpoint = new URL(rawEndpoint);
  const isFoundryProject = endpoint.hostname.endsWith(".services.ai.azure.com") && endpoint.pathname.includes("/api/projects/");
  const isVersioned = endpoint.pathname.toLowerCase().endsWith("/openai/v1");

  if (!isFoundryProject && !isVersioned && endpoint.hostname.endsWith(".openai.azure.com") && !endpoint.pathname.endsWith("/openai")) {
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/openai`;
  }

  return { apiKey, apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21", baseURL: endpoint.toString().replace(/\/$/, ""), deployment, isFoundryProject, useDeploymentBasedUrls: !isFoundryProject && !isVersioned };
}

function getModel() {
  const config = getAzureConfig();
  return createAzure({
    apiKey: config.apiKey,
    apiVersion: config.apiVersion,
    baseURL: config.baseURL,
    useDeploymentBasedUrls: config.useDeploymentBasedUrls,
  }).chat(config.deployment);
}

export function streamAssistantChat(actor: SessionUser, messages: ModelMessage[]) {
  const today = assistantTodayContext();
  const week = getAssistantDateRangeContext();
  return streamText({
    model: getModel(),
    system: `Eres el asistente interno de Work From Home. Responde siempre en español, de forma breve y clara. Hoy es ${today} en Madrid y el año actual es ${today.slice(0, 4)}. La semana laboral actual va de ${week.monday} a ${week.friday}. El actor autenticado es ${actor.name} (${actor.role}). Basa cada afirmación sobre empleados en resultados de herramientas; nunca inventes datos. Si no hay resultados, dilo claramente. Si una herramienta devuelve error, comunícalo literalmente; distingue error técnico o dato ausente de permisos. Nunca pidas UUID: busca empleados por nombre. No calcules días de la semana; usa los valores devueltos. Para preguntas que no cubran las herramientas predefinidas, consulta las bases mediante queryWorkFromHome o queryTimerTask. SQL solo lectura, SELECT/WITH, usa únicamente esquemas/tablas permitidos, limita las consultas y no consultes credenciales, catálogos privilegiados ni esquemas distintos de TIMERTASK_ES. Si desconoces una tabla TimerTask, primero usa listTimerTaskTables y describeTimerTaskTable. No afirmes que un dato existe sin obtenerlo de una consulta.

${DATABASE_GUIDE}`,
    messages,
    stopWhen: stepCountIs(12),
    prepareStep: ({ stepNumber }) => ({ toolChoice: stepNumber === 0 ? "required" : "auto" }),
    tools: {
      searchEmployee: tool({
        description: "Busca empleados visibles para el usuario por nombre o email.",
        inputSchema: z.object({ query: z.string().min(1).max(120) }),
        execute: ({ query }) => resolveEmployeeByName(actor, query),
      }),
      getDayOverview: tool({
        description: "Cuenta personas en oficina, teletrabajo y ausencias visibles en un día.",
        inputSchema: z.object({ date: z.string().describe("Fecha ISO YYYY-MM-DD"), status: z.enum(["en oficina", "teletrabajo", "ausente"]).optional() }),
        execute: ({ date, status }) => getAssistantDayOverview(actor, date, status),
      }),
      getRangeOverview: tool({
        description: "Consulta los conteos diarios de oficina, teletrabajo y ausencias en un rango de fechas.",
        inputSchema: z.object({ from: z.string().describe("Fecha ISO YYYY-MM-DD"), to: z.string().describe("Fecha ISO YYYY-MM-DD") }),
        execute: ({ from, to }) => getAssistantRangeOverview(actor, from, to),
      }),
      getEmployeeRange: tool({
        description: "Consulta todos los estados diarios de un empleado visible en un rango de fechas.",
        inputSchema: z.object({ employeeId: z.string().uuid(), from: z.string().describe("Fecha ISO YYYY-MM-DD"), to: z.string().describe("Fecha ISO YYYY-MM-DD") }),
        execute: ({ employeeId, from, to }) => getEmployeeRangeStatus(actor, employeeId, from, to),
      }),
      queryWorkFromHome: tool({
        description: "Ejecuta una consulta SQL de solo lectura sobre las cuatro tablas permitidas de la base Postgres Work From Home. Úsala para preguntas no cubiertas por las herramientas específicas. Solo SELECT o WITH ... SELECT.",
        inputSchema: z.object({ sql: z.string().min(1).max(20_000) }),
        execute: ({ sql }) => queryWorkFromHome(actor, sql),
      }),
      queryTimerTask: tool({
        description: "Ejecuta SQL de solo lectura únicamente sobre tablas cualificadas de TIMERTASK_ES en Oracle TimerTask. Úsala para preguntas sobre datos TimerTask no cubiertos por herramientas específicas. Solo SELECT o WITH ... SELECT.",
        inputSchema: z.object({ sql: z.string().min(1).max(20_000) }),
        execute: ({ sql }) => queryTimerTask(actor, sql),
      }),
      listTimerTaskTables: tool({
        description: "Descubre nombres de tablas accesibles en el esquema TIMERTASK_ES. Usa esta herramienta si no conoces la tabla de TimerTask relevante.",
        inputSchema: z.object({ search: z.string().max(60).optional() }),
        execute: ({ search }) => listTimerTaskTables(search),
      }),
      describeTimerTaskTable: tool({
        description: "Devuelve columnas y tipos de una tabla del esquema TIMERTASK_ES antes de generar SQL sobre ella.",
        inputSchema: z.object({ tableName: z.string().min(1).max(128) }),
        execute: ({ tableName }) => describeTimerTaskTable(tableName),
      }),
    },
  });
}
