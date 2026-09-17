import { createAzure } from "@ai-sdk/azure";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import { assistantTodayContext, getEmployeeRangeStatus } from "./day-status";
import { getAssistantDayOverview, getAssistantRangeOverview } from "./day-summary";
import { resolveEmployeeByName } from "./employee-lookup";
import { getAssistantDateRangeContext } from "./assistant-policy";

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
    system: `Eres el asistente interno de Work From Home. Responde siempre en español, de forma breve y clara. Hoy es ${today} en Madrid y el año actual es ${today.slice(0, 4)}. La semana laboral actual va de ${week.monday} a ${week.friday}. Solo puedes responder usando los resultados de tus herramientas. Nunca inventes datos. El usuario actual es ${actor.name} y tiene rol ${actor.role}. No reveles información fuera del ámbito permitido por las herramientas. Nunca pidas UUID ni identificadores internos al usuario: si te falta una persona, vuelve a llamar a searchEmployee usando su nombre. Usa literalmente las etiquetas de fecha que devuelvan las herramientas y no calcules por tu cuenta el día de la semana. Si una herramienta devuelve un campo error, comunícalo literalmente sin reinterpretarlo como un problema de permisos ni cambiar su causa.`,
    messages,
    stopWhen: stepCountIs(8),
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
    },
  });
}
