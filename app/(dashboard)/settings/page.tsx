import { TeamVisibilityToggle } from "@/components/settings/team-visibility-toggle";
import { PageHeader } from "@/components/common/page-header";
import { requireCoordinator } from "@/lib/auth/guards";
import { findUserById } from "@/lib/users/user-repository";

export default async function SettingsPage() {
  const user = await requireCoordinator();
  const dbUser = await findUserById(user.id);

  return (
    <section className="space-y-6">
      <PageHeader><PageHeader.Eyebrow>Configuración</PageHeader.Eyebrow><PageHeader.Title>Preferencias del equipo</PageHeader.Title></PageHeader>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-lg font-semibold text-zinc-950">Visibilidad del teletrabajo del equipo</h2>
            <p className="text-sm leading-6 text-zinc-600">
               Permite que tus empleados vean la disponibilidad, el teletrabajo, las ausencias y los datos de contacto de su propio equipo. Las fechas pasadas permanecen vacías.
            </p>
          </div>
          <TeamVisibilityToggle initialEnabled={dbUser?.teamWfhVisible ?? false} />
        </div>
      </div>
    </section>
  );
}
