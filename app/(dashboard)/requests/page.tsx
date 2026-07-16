import { redirect } from "next/navigation";
import { RequestList } from "@/components/requests/request-list";
import { requireUser } from "@/lib/auth/guards";
import { getRequestsForCoordinator, getRequestsForRequester } from "@/lib/requests/request-service";

export default async function RequestsPage() {
  const user = await requireUser();

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role === "coordinator") {
    const requests = await getRequestsForCoordinator(user.id);
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium text-zinc-500">Gestión</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Solicitudes de teletrabajo</h1>
          <p className="mt-2 text-sm text-zinc-600">Revisa y decide las solicitudes de tu equipo.</p>
        </div>
        <RequestList coordinatorView requests={requests} />
      </section>
    );
  }

  const requests = await getRequestsForRequester(user.id);
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Teletrabajo</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Mis solicitudes</h1>
        <p className="mt-2 text-sm text-zinc-600">Consulta el estado de tus solicitudes. Puedes crear nuevas solicitudes desde tu calendario.</p>
      </div>
      <RequestList requests={requests} />
    </section>
  );
}
