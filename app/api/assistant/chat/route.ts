import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/guards";
import { streamAssistantChat } from "@/lib/assistant/chat-service";
import type { ModelMessage } from "ai";

const messageSchema = Array.isArray;

export async function POST(request: Request) {
  const user = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role === "employee") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const body = await request.json() as { messages?: Array<{ content?: unknown; role?: unknown }> };
    if (!messageSchema(body.messages) || body.messages.length === 0 || body.messages.length > 20 || body.messages.some((message) => (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string" || message.content.length > 4000)) {
      return NextResponse.json({ error: "El historial no es válido." }, { status: 400 });
    }
    const messages = body.messages as ModelMessage[];
    return (await streamAssistantChat(user, messages)).toTextStreamResponse();
  } catch (error) {
    console.error("Assistant request failed:", error);
    return NextResponse.json({ error: "No se pudo procesar la consulta." }, { status: 500 });
  }
}
