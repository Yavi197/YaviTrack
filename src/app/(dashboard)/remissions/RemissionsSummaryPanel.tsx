import type { RemissionStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface RemissionsSummaryPanelProps {
  selectedStatus: RemissionStatus | "Todos";
  onStatusChange: (status: RemissionStatus | "Todos") => void;
  summaryCounts: Record<string, number>;
}

const statusChips: { value: RemissionStatus | "Todos"; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "Pendiente", label: "Pendiente" },
  { value: "Cupo Solicitado", label: "Cupo solicitado" },
  { value: "Programado", label: "Programado" },
  { value: "Realizado", label: "Realizado" },
  { value: "Vencido", label: "Vencido" },
];

export function RemissionsSummaryPanel({ selectedStatus, onStatusChange, summaryCounts }: RemissionsSummaryPanelProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {statusChips.map((status) => {
        const isActive = selectedStatus === status.value || (selectedStatus === "Todos" && status.value === "Todos");
        const count =
          status.value === "Todos"
            ? Object.values(summaryCounts).reduce((acc, value) => acc + value, 0)
            : summaryCounts[status.value] || 0;
        return (
          <Button
            key={status.value}
            size="lg"
            variant={isActive ? "default" : "outline"}
            onClick={() => onStatusChange(status.value)}
            className="flex min-h-[96px] min-w-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-muted-foreground/20 px-5 py-4 text-center hover:shadow-sm"
          >
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground leading-tight">
              {status.label}
            </span>
            <span className="text-2xl font-bold leading-none">{count}</span>
          </Button>
        );
      })}
    </div>
  );
}
