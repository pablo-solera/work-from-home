import { getCurrentUser } from "@/lib/auth/session";
import { getAuthorizedUser } from "@/lib/auth/guards";
import { subscribeToRequestNotifications } from "@/lib/requests/request-notification-hub";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  const authorizedUser = await getAuthorizedUser();
  if (!authorizedUser) return new Response("No autorizado", { status: 403 });
  let cleanup = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let unsubscribe: (() => void) | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try { controller.close(); } catch { /* stream already closed */ }
      };

      try {
        unsubscribe = await subscribeToRequestNotifications(authorizedUser.id, authorizedUser.role, controller);
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
          } catch {
            cleanup();
          }
        }, 20_000);

        request.signal.addEventListener("abort", cleanup, { once: true });
      } catch {
        cleanup();
        controller.error(new Error("No se pudo abrir el canal de notificaciones."));
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
