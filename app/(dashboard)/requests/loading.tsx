import { RequestsPageSkeleton } from "@/components/common/request-skeleton";
import { requireAuthorizedUser } from "@/lib/auth/guards";

export default async function RequestsLoading() {
  const user = await requireAuthorizedUser();

  return <RequestsPageSkeleton coordinatorView={user.role === "coordinator"} showTabs={user.role === "coordinator"} />;
}
