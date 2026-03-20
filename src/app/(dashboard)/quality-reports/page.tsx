"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { QualityReport } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const descriptionFormatter = (value?: string) => {
  if (!value) return "Sin descripción";
  if (value.length <= 120) return value;
  return `${value.slice(0, 117)}...`;
};

type QualityReportRow = QualityReport & { id: string };

const statusBadgeVariants: Record<QualityReport["status"], string> = {
  Pendiente: "bg-amber-100 text-amber-800",
  "En revisión": "bg-blue-100 text-blue-800",
  Cerrado: "bg-emerald-100 text-emerald-800",
};

const roleColors: Record<QualityReport["involvedRole"], string> = {
  "Tecnólogo": "bg-purple-100 text-purple-800",
  Transcriptora: "bg-sky-100 text-sky-800",
  Otro: "bg-gray-200 text-gray-800",
  "N/A": "bg-muted text-muted-foreground",
};

const formatTimestamp = (timestamp?: Timestamp | null) => {
  if (!timestamp) return "Sin registro";
  try {
    return dateFormatter.format(timestamp.toDate());
  } catch {
    return "Sin registro";
  }
};

export default function QualityReportsPage() {
  const { currentProfile, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<QualityReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentProfile?.rol === "administrador";

  useEffect(() => {
    if (!isAdmin) {
      setReports([]);
      setLoadingReports(false);
      return;
    }

    setLoadingReports(true);
    const reportsQuery = query(
      collection(db, "qualityReports"),
      where("status", "==", "Pendiente")
    );

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const pendingReports: QualityReportRow[] = snapshot.docs
          .map((doc) => ({
            ...(doc.data() as QualityReport),
            id: doc.id,
          }))
          .sort((a, b) => {
            const aDate = a.createdAt?.toMillis?.() ?? 0;
            const bDate = b.createdAt?.toMillis?.() ?? 0;
            return bDate - aDate;
          });
        setReports(pendingReports);
        setLoadingReports(false);
        setError(null);
      },
      (listenerError) => {
        console.error("[Quality Reports] Listener error", listenerError);
        setError("No pudimos obtener los reportes. Intenta nuevamente.");
        setLoadingReports(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const summary = useMemo(() => {
    return {
      total: reports.length,
      byType: reports.reduce<Record<string, number>>((acc, report) => {
        acc[report.reportType] = (acc[report.reportType] || 0) + 1;
        return acc;
      }, {}),
    };
  }, [reports]);

  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="py-10">
        <Alert variant="destructive" className="max-w-2xl">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>
            Esta vista es exclusiva para administradores. Si crees que es un error, contacta al equipo de sistemas.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Quejas y Reportes Pendientes</h1>
        <p className="text-muted-foreground">
          Aquí encontrarás todos los reportes enviados por el personal mediante el módulo de calidad. Se actualizan en tiempo real.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Reportes pendientes</CardTitle>
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{loadingReports ? "-" : summary.total}</div>
            <p className="text-sm text-muted-foreground">Estado inicial &quot;Pendiente&quot;</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Tipos destacados</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(summary.byType).length === 0 && !loadingReports && (
              <p className="text-sm text-muted-foreground">Sin reportes activos.</p>
            )}
            {Object.entries(summary.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span>{type}</span>
                <Badge variant="outline" className="border-border">
                  {count}
                </Badge>
              </div>
            ))}
            {loadingReports && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando...
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Indicaciones</CardTitle>
            <CardDescription>Solo el equipo de calidad puede cambiar los estados.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Usa este panel para priorizar llamadas o seguimientos.</p>
            <p>• Verifica los datos del paciente antes de contactar.</p>
            <p>• Cambia el estado desde Firestore o desde el módulo interno (en construcción).</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Listado en tiempo real</CardTitle>
            <CardDescription>Solo se muestran reportes con estado &quot;Pendiente&quot;.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Ocurrió un problema</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {loadingReports ? (
            <div className="flex h-[200px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex h-[160px] flex-col items-center justify-center text-center text-muted-foreground">
              <ShieldCheck className="mb-2 h-6 w-6" />
              <p>No hay reportes pendientes en este momento.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Fecha</TableHead>
                    <TableHead>Tipo / Categoría</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead>Rol involucrado</TableHead>
                    <TableHead>Persona / Paciente</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id} className="align-top">
                      <TableCell>
                        <div className="font-medium">{formatTimestamp(report.createdAt)}</div>
                        <p className="text-xs text-muted-foreground">Ref: {report.referenceId || "N/A"}</p>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{report.reportType}</div>
                        <p className="text-xs text-muted-foreground">{report.category}</p>
                      </TableCell>
                      <TableCell>{report.modality}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", roleColors[report.involvedRole])}>{report.involvedRole}</Badge>
                        {report.involvedRole === "Tecnólogo" && report.involvedUserName && (
                          <p className="text-xs text-muted-foreground mt-1">{report.involvedUserName}</p>
                        )}
                        {report.involvedRole !== "Tecnólogo" && report.otherPersonName && (
                          <p className="text-xs text-muted-foreground mt-1">{report.otherPersonName}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.patientName ? (
                          <div>
                            <p className="font-medium">{report.patientName}</p>
                            <p className="text-xs text-muted-foreground">{report.patientId || "Sin ID"}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin datos</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                        {descriptionFormatter(report.description)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={cn("text-xs", statusBadgeVariants[report.status])}>{report.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
