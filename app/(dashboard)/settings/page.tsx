import { TeamVisibilityToggle } from "@/components/settings/team-visibility-toggle";
import { requireCoordinator } from "@/lib/auth/guards";
import { findUserById } from "@/lib/users/user-repository";

export default async function SettingsPage() {
  const user = await requireCoordinator();
  const dbUser = await findUserById(user.id);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Configuración</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Preferencias del equipo</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-lg font-semibold text-zinc-950">Visibilidad del teletrabajo del equipo</h2>
            <p className="text-sm leading-6 text-zinc-600">
              Permite que los integrantes de tu equipo vean el calendario de teletrabajo del grupo. El calendario incluye tus días y los de tus empleados.
            </p>
          </div>
          <TeamVisibilityToggle initialEnabled={dbUser?.teamWfhVisible ?? false} />
        </div>
      </div>
    </section>
  );
}
