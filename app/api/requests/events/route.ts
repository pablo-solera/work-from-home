import { getCurrentUser } from "@/lib/auth/session";
import { findUserById } from "@/lib/users/user-repository";
import { subscribeToRequestNotifications } from "@/lib/requests/request-notification-hub";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  if (user.role !== "admin" && user.role !== "coordinator" && user.role !== "employee") return new Response("No autorizado", { status: 403 });
  const currentUser = await findUserById(user.id);
  if (!currentUser || currentUser.role !== user.role) return new Response("No autorizado", { status: 403 });

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
        unsubscribe = await subscribeToRequestNotifications(user.id, controller);
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
