"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { QualityReport } from "@/lib/types";
import { QualityReportStatuses } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { updateQualityReportStatusAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle, Clock, Users, ChevronRight, Zap, CheckCircle2, RefreshCw, ArrowUpCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

const descriptionFormatter = (value?: string) => {
  if (!value) return "Sin descripción";
  if (value.length <= 140) return value;
  return `${value.slice(0, 137)}...`;
};

type QualityReportRow = QualityReport & { id: string };

// ── Status ────────────────────────────────────────────────────────────────
const statusStyles: Record<string, { bg: string; dot: string; text: string; icon: React.ElementType }> = {
  "Pendiente":             { bg: "bg-amber-50 border-amber-200",    dot: "bg-amber-400",    text: "text-amber-700",   icon: Clock },
  "En Proceso":            { bg: "bg-blue-50 border-blue-200",      dot: "bg-blue-500",     text: "text-blue-700",    icon: RefreshCw },
  "Escalado":              { bg: "bg-purple-50 border-purple-200",  dot: "bg-purple-500",   text: "text-purple-700",  icon: ArrowUpCircle },
  "Cerrado / Solucionado": { bg: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500",  text: "text-emerald-700", icon: CheckCircle2 },
  // legacy
  "En revisión": { bg: "bg-blue-50 border-blue-200",      dot: "bg-blue-500",    text: "text-blue-700",   icon: RefreshCw },
  "Cerrado":     { bg: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500", text: "text-emerald-700",icon: CheckCircle2 },
};

// ── Category ──────────────────────────────────────────────────────────────
const categoryStyle: Record<string, { bg: string; text: string; dot: string }> = {
  'Asistencial':       { bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500" },
  'Técnica / Equipos': { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  'Infraestructura':   { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  'Administrativa':    { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  'Talento Humano':    { bg: "bg-emerald-100",text: "text-emerald-700",dot: "bg-emerald-500" },
};

// ── Priority ──────────────────────────────────────────────────────────────
const priorityStyle: Record<string, { bg: string; text: string; bar: string }> = {
  'P1 · Crítica':           { bg: "bg-red-100 border-red-200",      text: "text-red-700",    bar: "bg-red-500" },
  'P2 · Alta':              { bg: "bg-orange-100 border-orange-200",text: "text-orange-700", bar: "bg-orange-500" },
  'P3 · Media':             { bg: "bg-amber-100 border-amber-200",  text: "text-amber-700",  bar: "bg-amber-400" },
  'P4 · Baja / Informativa':{ bg: "bg-zinc-100 border-zinc-200",    text: "text-zinc-500",   bar: "bg-zinc-300" },
};

const formatTimestamp = (timestamp?: Timestamp | null) => {
  if (!timestamp) return "Sin registro";
  try { return dateFormatter.format(timestamp.toDate()); }
  catch { return "Sin registro"; }
};

// Status transition order (visual)
const STATUS_ORDER = ["Pendiente", "En Proceso", "Escalado", "Cerrado / Solucionado"];
const STATUS_ICONS: Record<string, React.ElementType> = {
  "Pendiente":             Clock,
  "En Proceso":            RefreshCw,
  "Escalado":              ArrowUpCircle,
  "Cerrado / Solucionado": CheckCircle2,
};

function StatusChanger({ report, currentProfile }: { report: QualityReportRow; currentProfile: any }) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState(report.status);

  const handleChange = async (newStatus: string) => {
    if (newStatus === localStatus) return;
    setUpdating(true);
    const result = await updateQualityReportStatusAction(report.id, newStatus, undefined, currentProfile);
    if (result.success) {
      setLocalStatus(newStatus as any);
      toast({ title: "Estado actualizado", description: `→ ${newStatus}` });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
    setUpdating(false);
  };

  return (
    <div className="border border-zinc-100 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Cambiar estado</p>
        {updating && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
      </div>
      <div className="grid grid-cols-2 gap-px bg-zinc-100">
        {STATUS_ORDER.map((status) => {
          const st = statusStyles[status];
          const Icon = STATUS_ICONS[status];
          const isActive = localStatus === status;
          return (
            <button
              key={status}
              disabled={updating}
              onClick={() => handleChange(status)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-left transition-all text-[10px] font-bold",
                isActive
                  ? cn("bg-zinc-900 text-white")
                  : "bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="leading-tight">{status}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportCard({ report, currentProfile }: { report: QualityReportRow; currentProfile: any }) {
  const status   = statusStyles[report.status] ?? statusStyles["Pendiente"];
  const StatusIcon = status.icon;
  const catStyle = categoryStyle[report.category] ?? { bg: "bg-zinc-100", text: "text-zinc-600", dot: "bg-zinc-400" };
  const priStyle = report.priority ? (priorityStyle[report.priority] ?? priorityStyle['P3 · Media']) : null;
  const [expanded, setExpanded] = useState(false);
  const refId = report.id.slice(0, 8).toUpperCase();

  return (
    <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
      {/* Priority color bar */}
      <div className={cn("h-1 w-full shrink-0", priStyle?.bar || "bg-zinc-200")} />

      {/* Black header: REF + timestamp */}
      <div className="bg-zinc-900 px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">REF</span>
          <span className="font-mono text-xs font-bold text-amber-400">{refId}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-medium">
          <Clock className="h-3 w-3" />
          <span>{formatTimestamp(report.createdAt)}</span>
        </div>
      </div>

      <div className="p-5 space-y-4 flex-1">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", catStyle.bg, catStyle.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", catStyle.dot)} />
            {report.category}
          </span>
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", status.bg, status.text)}>
            <StatusIcon className="h-2.5 w-2.5" />
            {report.status}
          </span>
          {report.priority && priStyle && (
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", priStyle.bg, priStyle.text)}>
              {report.priority}
            </span>
          )}
          {report.shift && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-500">
              {report.shift}
            </span>
          )}
        </div>

        {/* Subcategory + Modality */}
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
          {report.subcategory && <span>{report.subcategory}</span>}
          {report.subcategory && <ChevronRight className="h-3 w-3 text-zinc-300" />}
          <span>{report.modality}</span>
        </div>

        {/* Personnel + Patient */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Personal</p>
            <p className="text-xs font-bold text-zinc-800">{report.involvedRole}</p>
            {report.involvedUserName && <p className="text-[11px] text-zinc-500 mt-0.5">{report.involvedUserName}</p>}
            {report.otherPersonName && <p className="text-[11px] text-zinc-500 mt-0.5">{report.otherPersonName}</p>}
          </div>
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Paciente</p>
            {report.patientName ? (
              <>
                <p className="text-xs font-bold text-zinc-800 leading-snug">{report.patientName}</p>
                {report.referenceId && <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">ID: {report.referenceId}</p>}
                {report.patientId && <p className="text-[11px] text-zinc-400 mt-0.5">HC: {report.patientId}</p>}
              </>
            ) : (
              <p className="text-xs text-zinc-400">Sin datos</p>
            )}
          </div>
        </div>

        {/* Impact */}
        {report.impact && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-[10px] font-black text-red-700 uppercase tracking-wider">
            ⚠️ {report.impact}
          </div>
        )}

        {/* Description */}
        <div className="bg-zinc-50 rounded-xl p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Descripción</p>
          <p className="text-xs text-zinc-700 leading-relaxed">
            {expanded ? report.description : descriptionFormatter(report.description)}
          </p>
          {report.description && report.description.length > 140 && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 mt-2 transition-colors">
              {expanded ? "Mostrar menos" : "Leer más"}
            </button>
          )}
        </div>

        {/* Immediate action */}
        {(report as any).immediateAction && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
            <Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Acción inmediata</p>
              <p className="text-xs text-amber-800 font-medium">{(report as any).immediateAction}</p>
            </div>
          </div>
        )}

        {/* Resolution note (if added by admin) */}
        {(report as any).resolutionNote && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-0.5">Nota de resolución</p>
              <p className="text-xs text-emerald-800 font-medium">{(report as any).resolutionNote}</p>
            </div>
          </div>
        )}

        {/* ── Status changer (admin only) ─────────────── */}
        <StatusChanger report={report} currentProfile={currentProfile} />
      </div>
    </div>
  );
}

export default function QualityReportsPage() {
  const { currentProfile, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<QualityReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const isAdmin = currentProfile?.rol === "administrador";

  useEffect(() => {
    if (!isAdmin) { setReports([]); setLoadingReports(false); return; }
    setLoadingReports(true);
    // Listen to ALL reports (not just Pendiente) so admin can see and manage all
    const q = query(collection(db, "qualityReports"));
    const unsub = onSnapshot(q,
      (snap) => {
        const rows: QualityReportRow[] = snap.docs
          .map(d => ({ ...(d.data() as QualityReport), id: d.id }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setReports(rows);
        setLoadingReports(false);
        setError(null);
      },
      (err) => {
        console.error("[Quality Reports]", err);
        setError("No pudimos obtener los reportes. Intenta nuevamente.");
        setLoadingReports(false);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  const filteredReports = useMemo(() =>
    filterStatus === "all" ? reports : reports.filter(r => r.status === filterStatus),
  [reports, filterStatus]);

  const summary = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => r.status === 'Pendiente').length,
    inProcess: reports.filter(r => r.status === 'En Proceso').length,
    closed: reports.filter(r => r.status === 'Cerrado / Solucionado' || r.status === 'Cerrado').length,
    critical: reports.filter(r => r.priority === 'P1 · Crítica').length,
    byCategory: reports.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {}),
  }), [reports]);

  if (authLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300" /></div>;

  if (!isAdmin) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center gap-4">
        <div className="p-4 bg-red-50 rounded-2xl"><ShieldAlert className="h-8 w-8 text-red-500" /></div>
        <div>
          <h2 className="text-xl font-black text-zinc-900">Acceso restringido</h2>
          <p className="text-zinc-500 font-medium mt-1 max-w-md">Esta vista es exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-100 rounded-lg"><AlertTriangle className="h-4 w-4 text-amber-600" /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sistema de Calidad</span>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Gestión de Novedades</h1>
          <p className="text-zinc-500 font-medium mt-1">Actualiza el estado de cada reporte directamente desde las cards.</p>
        </div>
        {loadingReports && (
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 bg-zinc-50 px-3 py-2 rounded-full border border-zinc-100 mt-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Sincronizando...
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Total",    value: summary.total,     color: "text-zinc-900" },
          { label: "Pendiente",value: summary.pending,   color: "text-amber-600" },
          { label: "En proceso",value: summary.inProcess, color: "text-blue-600" },
          { label: "Cerrados", value: summary.closed,    color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">{label}</p>
            <p className={cn("text-3xl font-black", color)}>{loadingReports ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mr-1">Filtrar:</p>
        {["all", "Pendiente", "En Proceso", "Escalado", "Cerrado / Solucionado"].map(f => (
          <button key={f}
            onClick={() => setFilterStatus(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border",
              filterStatus === f
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
            )}>
            {f === "all" ? "Todos" : f}
            {f !== "all" && (
              <span className="ml-1.5 bg-white/20 text-inherit rounded-full px-1.5 py-0.5 text-[9px]">
                {reports.filter(r => r.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
          <ShieldAlert className="h-6 w-6 text-red-500 shrink-0" />
          <p className="font-bold text-red-700">{error}</p>
        </div>
      )}

      {/* Reports grid */}
      {loadingReports ? (
        <div className="flex h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-zinc-100 rounded-2xl">
          <div className="p-4 bg-emerald-50 rounded-2xl mb-4"><ShieldCheck className="h-8 w-8 text-emerald-500" /></div>
          <h3 className="text-xl font-black text-zinc-900">Sin reportes</h3>
          <p className="text-zinc-400 font-medium mt-1">No hay novedades con este estado.</p>
        </div>
      ) : (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">
            {filteredReports.length} reporte{filteredReports.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredReports.map(report => (
              <ReportCard key={report.id} report={report} currentProfile={currentProfile} />
            ))}
          </div>
        </div>
      )}

      {/* Tips al pie */}
      <div className="bg-zinc-900 rounded-2xl p-6 flex items-center gap-6">
        <div className="p-3 bg-white/10 rounded-xl shrink-0">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-2">
          {[
            "Usa los 4 botones de estado para gestionar cada reporte.",
            "El estado negro = estado activo seleccionado.",
            "El cambio se guarda automáticamente en Firestore.",
            "Usa el filtro superior para ver solo un tipo de estado.",
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs font-medium text-zinc-400">{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
