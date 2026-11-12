import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/guards";
import { streamAssistantChat } from "@/lib/assistant/chat-service";
import type { ModelMessage } from "ai";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const chatRequestSchema = z.strictObject({
  messages: z.array(z.strictObject({
    content: z.string().min(1).max(4000),
    role: z.enum(["user", "assistant"]),
  })).min(1).max(20),
});

export async function POST(request: Request) {
  const user = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role === "employee") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const rateLimit = checkRateLimit(`assistant:${user.id}`, 12, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Has enviado demasiadas consultas. Espera un minuto e inténtalo de nuevo." }, { status: 429 });
  }

  try {
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > 128 * 1024) {
      return NextResponse.json({ error: "El historial no es válido." }, { status: 400 });
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "El historial no es válido." }, { status: 400 });
    }
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "El historial no es válido." }, { status: 400 });
    if (parsed.data.messages.at(-1)?.role !== "user") return NextResponse.json({ error: "El historial no es válido." }, { status: 400 });
    // Assistant messages come from an untrusted browser history and could forge prior system guidance.
    const messages = parsed.data.messages.filter((message) => message.role === "user") as ModelMessage[];
    return (await streamAssistantChat(user, messages)).toTextStreamResponse();
  } catch (error) {
    console.error("Assistant request failed:", error);
    return NextResponse.json({ error: "No se pudo procesar la consulta." }, { status: 500 });
  }
}
