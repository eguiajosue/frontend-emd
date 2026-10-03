import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando">
      <Skeleton className="bg-muted h-10 w-72 rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-24 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="bg-muted h-64 w-full rounded-2xl" />
    </div>
  );
}
