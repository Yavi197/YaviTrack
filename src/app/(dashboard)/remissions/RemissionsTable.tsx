import { normalizeModalityCode } from '@/lib/modality-labels';
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GeneralServices, SubServiceAreas, type GeneralService, type SubServiceArea, type Remission, type RemissionStatus } from "@/lib/types";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { appendOrUpdateRemissionSheet } from "@/services/google-sheets";
import { collection, query, onSnapshot, orderBy, startAfter, getDocs } from "firebase/firestore";
import { limit as firestoreLimit } from 'firebase/firestore';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Mail, FileText, Edit, Trash2, AlertTriangle, CheckCircle, CalendarCheck, Send, Clock3, Fingerprint, CalendarDays, Building, Stethoscope, Search, Loader2, MoreHorizontal } from "lucide-react";
import { epsEmailMap } from "@/lib/eps-data";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn, toDateValue } from "@/lib/utils";
import { updateRemissionBedNumberAction } from "@/app/actions";



// Utilidad para calcular la edad
function getAge(birthDateString?: string) {
  if (!birthDateString) return '';
  try {
    const dateParts = birthDateString.split(/[-\/]/);
    let year, month, day;
    if (dateParts.length === 3) {
      if (dateParts[2].length === 4) {
        day = parseInt(dateParts[0]);
        month = parseInt(dateParts[1]);
        year = parseInt(dateParts[2]);
      } else if (dateParts[0].length === 4) {
        year = parseInt(dateParts[0]);
        month = parseInt(dateParts[1]);
        day = parseInt(dateParts[2]);
      } else {
        return '';
      }
      if (month > 12) {
        [day, month] = [month, day];
      }
      const birthDate = new Date(year, month - 1, day);
      if (!isNaN(birthDate.getTime())) {
        const age = new Date().getFullYear() - birthDate.getFullYear();
        return age;
      }
    }
  } catch {
    return '';
  }
  return '';
}

const normalizeEntidad = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const getEmailForEntidad = (entidad?: string) => {
  const normalizedEntidad = normalizeEntidad(entidad);
  for (const key in epsEmailMap) {
    if (normalizedEntidad.includes(key)) {
      return epsEmailMap[key];
    }
  }
  return '';
};

const extraAuthorizationEmails = ["emil.mejia@cajacopieps.com"];

const parseEmails = (value?: string) =>
  (value || '')
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);

const getPrimaryStudy = (remission: Remission) => {
  if (Array.isArray(remission.studies) && remission.studies.length > 0) {
    return remission.studies[0];
  }
  return null;
};

const getPrimaryDiagnosis = (remission: Remission) => {
  if (Array.isArray(remission.diagnosis)) {
    return remission.diagnosis[0];
  }
  if (remission.diagnosis) {
    return remission.diagnosis as any;
  }
  return null;
};

const formatEntityName = (name?: string) => {
  if (!name) return "--";
  if (name.toUpperCase().includes("CAJACOPI")) {
    return "CAJACOPI EPS S.A.S.";
  }
  return name;
};

const serviceDisplayNames: Record<GeneralService, string> = {
  URG: "URG",
  HOSP: "HOSP",
  UCI: "UCI",
  "C.EXT": "C.EXT",
};

const subServiceAbbreviations: Record<string, string> = {
  TRIAGE: "TRIAGE",
  "OBSERVACION 1": "OBS 1",
  "OBSERVACION 2": "OBS 2",
  "HOSPITALIZACION 2": "HOSP 2",
  "HOSPITALIZACION 4": "HOSP 4",
  "UCI 2": "UCI 2",
  "UCI 3": "UCI 3",
  "UCI NEO": "UCI NEO",
  AMB: "AMB",
};

const abbreviateService = (value?: GeneralService) => {
  if (!value) return "--";
  return serviceDisplayNames[value] || value;
};

const abbreviateSubService = (value?: string) => {
  if (!value) return "--";
  return subServiceAbbreviations[value] || value;
};

const getObservationNote = (remission: Remission) => {
  const anyRemission = remission as any;
  return (
    anyRemission?.observaciones ||
    anyRemission?.observations ||
    anyRemission?.observacion ||
    anyRemission?.observation ||
    getPrimaryStudy(remission)?.details ||
    ''
  );
};

const remissionStatusStyles: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; style: string }> = {
  Pendiente: { icon: AlertTriangle, label: "Pendiente", style: "bg-red-600 text-white shadow-sm" },
  "Pendiente Aut": { icon: AlertTriangle, label: "Pendiente Aut", style: "bg-red-600 text-white shadow-sm" },
  Solicitado: { icon: Send, label: "Solicitado", style: "bg-blue-600 text-white shadow-sm" },
  "Cupo Solicitado": { icon: Send, label: "Cupo Solicitado", style: "bg-blue-600 text-white shadow-sm" },
  Programado: { icon: CalendarCheck, label: "Programado", style: "bg-indigo-600 text-white shadow-sm" },
  Autorizado: { icon: CheckCircle, label: "Autorizado", style: "bg-emerald-600 text-white shadow-sm" },
  Informado: { icon: CheckCircle, label: "Informado", style: "bg-emerald-600 text-white shadow-sm" },
  Realizado: { icon: CheckCircle, label: "Realizado", style: "bg-emerald-600 text-white shadow-sm" },
  Vencido: { icon: Clock3, label: "Vencido", style: "bg-slate-500 text-white shadow-sm" },
};

// Componente para cambiar el estado manualmente
function StatusButton({ currentStatus, remissionId }: { currentStatus: string, remissionId: string }) {
  const allowed = [
    "Pendiente Aut",
    "Cupo Solicitado",
    "Programado",
    "Informado"
  ];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentStatus);
  const [date, setDate] = useState<string | null>(null);

  // Leer la fecha del estado desde Firestore al montar
  React.useEffect(() => {
    const fetchStatusDate = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const remissionSnap = await getDoc(doc(db, "remissions", remissionId));
        const remissionData = remissionSnap.data();
        if (remissionData && remissionData.statusDate) {
          setDate(remissionData.statusDate);
        } else {
          setDate(null);
        }
      } catch {
        setDate(null);
      }
    };
    fetchStatusDate();
  }, [remissionId]);
  function formatStatus(status: string) {
    return status.toUpperCase();
  }

  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const handleSelect = async (status: string) => {
    setSelected(status);
    setOpen(false);
    setStatusLoading(true);
    setStatusError(null);
    try {
      const now = new Date();
      const formattedDate = format(now, "dd/MM/yyyy HH:mm");
      setDate(formattedDate);
      const { updateDoc, doc, getDoc, serverTimestamp } = await import("firebase/firestore");
      const updateData: any = {
        status: status,
        statusDate: formattedDate
      };
      if (status === 'Programado') updateData.programadoAt = serverTimestamp();
      if (status === 'Informado') updateData.informadoAt = serverTimestamp();
      
      await updateDoc(doc(db, "remissions", remissionId), updateData);
      console.log("[Remissions] Estado y fecha guardados en Firestore", remissionId, status, formattedDate);
      // Obtener datos actualizados de la remisión
      const remissionSnap = await getDoc(doc(db, "remissions", remissionId));
      const remissionData = remissionSnap.data();
      // Convertir Timestamps a valores simples
      function simplifyTimestamps(obj: any) {
        if (!obj || typeof obj !== "object") return obj;
        const result: any = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
          const val = obj[key];
          if (val && typeof val === "object" && typeof val.seconds === "number" && typeof val.nanoseconds === "number") {
            // Firestore Timestamp: convertir a milisegundos
            result[key] = val.seconds * 1000;
          } else if (Array.isArray(val)) {
            result[key] = val.map(simplifyTimestamps);
          } else if (val && typeof val === "object") {
            result[key] = simplifyTimestamps(val);
          } else {
            result[key] = val;
          }
        }
        return result;
      }
      // Actualizar en Google Sheets
      if (remissionData) {
        try {
          const plainRemission = simplifyTimestamps(remissionData);
          await appendOrUpdateRemissionSheet(plainRemission, remissionId);
          console.log("[Remissions] Estado actualizado en Sheets", remissionId, status, formattedDate);
        } catch (sheetErr) {
          setStatusError("Error al actualizar Sheets");
          console.error("[Remissions] Error actualizando Sheets", sheetErr);
        }
      }
      setStatusLoading(false);
    } catch (e) {
      setStatusError("Error al guardar estado");
      setStatusLoading(false);
      console.error("[Remissions] Error guardando estado en Firestore", e);
    }
  };

  const visual = remissionStatusStyles[selected] || {
    icon: Clock3,
    label: selected,
    style: "bg-zinc-200 text-zinc-900",
  };
  const Icon = visual.icon;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
                "relative flex w-full max-w-[120px] min-h-[58px] mx-auto flex-col items-center justify-center rounded-xl px-1 py-2 text-[9.5px] font-black uppercase tracking-widest shadow-sm transition text-center leading-[1.1]",
                visual.style,
                statusLoading && "opacity-50 cursor-not-allowed"
            )}
            disabled={statusLoading}
            title={date ? `Actualizado ${date}` : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="whitespace-normal">{formatStatus(visual.label)}</span>
            {date && <span className="text-[7.5px] opacity-90 mt-0.5">{date}</span>}
            {statusLoading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-900" />
              </div>
            )}
            {statusError && (
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-100 text-red-700 text-[8px] font-bold">{statusError}</span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-[140px] rounded-xl border border-zinc-200 bg-white shadow-xl p-1 z-[100]">
          {allowed.map(status => (
            <DropdownMenuItem
              key={status}
              className={cn(
                  "flex w-full items-center justify-center px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg cursor-pointer mb-0.5 last:mb-0 text-center",
                  selected === status ? 'bg-zinc-900 text-white shadow-md' : 'hover:bg-zinc-100 text-zinc-600'
              )}
              onSelect={() => handleSelect(status)}
              disabled={statusLoading}
            >
              {formatStatus(status)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RemissionBedNumberInput({ remission, canEdit }: { remission: Remission; canEdit: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [bed, setBed] = useState(remission.bedNumber || '');
  const { toast } = useToast();

  const handleBedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toUpperCase();
      setBed(val);
  };

  const handleBlur = async () => {
      setIsEditing(false);
      if (bed !== (remission.bedNumber || '')) {
          try {
              const res = await updateRemissionBedNumberAction(remission.id, bed);
              if (res.success) {
                  toast({ title: "Cama actualizada" });
              } else {
                  toast({ variant: "destructive", title: "Error", description: res.error });
                  setBed(remission.bedNumber || '');
              }
          } catch (err) {
              toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la cama" });
              setBed(remission.bedNumber || '');
          }
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          handleBlur();
      } else if (e.key === 'Escape') {
          setIsEditing(false);
          setBed(remission.bedNumber || '');
      }
  };

  if (isEditing) {
      return (
          <Input
              className="h-5 w-14 px-1 py-0 text-center font-mono text-[11px] font-bold uppercase bg-white border-zinc-300"
              value={bed}
              onChange={handleBedChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              placeholder="CAMA"
          />
      );
  }

  return (
      <span
          className={cn(
              "font-mono font-bold cursor-text text-[10px] leading-none",
              canEdit && "hover:underline cursor-pointer"
          )}
          onClick={(e) => {
              if (canEdit) {
                  e.stopPropagation();
                  setIsEditing(true);
              }
          }}
      >
          {remission.bedNumber ? `/${remission.bedNumber}` : '/--'}
      </span>
  );
}

function RemissionServiceDialog({ remission, children }: { remission: Remission; children: React.ReactNode }) {

  const [open, setOpen] = useState(false);
  const isGeneralService = (svc: any): svc is GeneralService => GeneralServices.includes(svc);
  const initialService = isGeneralService(remission.service) ? remission.service : "C.EXT";
  const [service, setService] = useState<GeneralService>(initialService);
  const initialSubService = remission.subService && SubServiceAreas[initialService].includes(remission.subService) 
    ? remission.subService 
    : SubServiceAreas[initialService][0];
  const [subService, setSubService] = useState<SubServiceArea>(initialSubService);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const freshService = isGeneralService(remission.service) ? remission.service : "C.EXT";
      setService(freshService);
      const freshSubService = remission.subService && SubServiceAreas[freshService].includes(remission.subService)
        ? remission.subService
        : SubServiceAreas[freshService][0];
      setSubService(freshSubService);
    }
  };

  const handleServiceChange = (nextService: string) => {
    const typedService = (GeneralServices.includes(nextService as GeneralService) ? nextService : "C.EXT") as GeneralService;
    setService(typedService);
    const availableSubServices = SubServiceAreas[typedService];
    setSubService(prev => availableSubServices.includes(prev) ? prev : availableSubServices[0]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "remissions", remission.id), {
        service,
        subService,
      });
      toast({ title: "Servicio actualizado", description: `${service} Â· ${subService}` });
      setOpen(false);
    } catch (error) {
      console.error("[Remissions] Error updating service", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el servicio." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar servicio del paciente</AlertDialogTitle>
          <AlertDialogDescription>
            Actualiza el servicio y sub-servicio de esta remisión para mantener la trazabilidad.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Servicio general</Label>
            <Select value={service} onValueChange={handleServiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un servicio" />
              </SelectTrigger>
              <SelectContent>
                {GeneralServices.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sub-servicio</Label>
            <Select value={subService} onValueChange={(value) => setSubService(value as SubServiceArea)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un sub-servicio" />
              </SelectTrigger>
              <SelectContent>
                {SubServiceAreas[service].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RemissionAuthorizationActions({ remission, enabled, onEdit }: { remission: Remission; enabled: boolean; onEdit?: (remission: Remission) => void }) {
  const patient = remission.patient;
  const primaryStudy = getPrimaryStudy(remission);
  const primaryDiagnosis = getPrimaryDiagnosis(remission);
  const epsEmail = getEmailForEntidad(patient?.entidad);
  const observationNote = getObservationNote(remission);
  const patientAge = getAge(patient?.birthDate);
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const buildMailSubject = () => {
    const studyName = primaryStudy?.nombre || 'ESTUDIO';
    return `SOLICITUD DE| ${studyName} | ${patient.fullName} DOCUMENTO DEL PACIENTE`;
  };

  const buildMailBody = () => {
    const entity = patient.entidad || 'CAJACOPI EPS S.A.S.';
    const diagnosisCode = primaryDiagnosis?.code || '--';
    const diagnosisDesc = primaryDiagnosis?.description || '--';
    const cups = primaryStudy?.cups || '--';
    const studyName = primaryStudy?.nombre || '--';
    const physician = remission.orderingPhysician?.name || 'No especificado';
    const physicianReg = remission.orderingPhysician?.register || 'No especificado';

    const observationText = observationNote || 'Sin observaciones adicionales.';

    const separator = '-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------';

    let body = `Estimados ${entity},\n\n`;
    body += `Cordial saludo. Solicitamos amablemente la realización del siguiente estudio:\n`;
    body += `${separator}\n`;
    body += `DATOS DEL PACIENTE\n`;
    body += `${separator}\n`;
    body += `PACIENTE: ${patient.fullName}\n`;
    body += `IDENTIFICACIÁ“N: ${patient.idType || 'ID'} ${patient.id || '--'}\n`;
    body += `EDAD: ${patientAge || '--'} AÁ‘OS\n`;
    body += `ENTIDAD: ${entity}\n`;
    body += `${separator}\n`;
    body += `DATOS DEL ESTUDIO\n`;
    body += `${separator}\n`;
    body += `ESTUDIO: ${studyName}\n`;
    body += `CÁ“DIGO CUPS: ${cups}\n`;
    body += `DIAGNÁ“STICO: ${diagnosisCode} - ${diagnosisDesc}\n`;
    body += `OBSERVACIONES: ${observationText}\n`;
    body += `${separator}\n`;
    body += `INFORMACIÁ“N DEL MÉDICO TRATANTE\n`;
    body += `${separator}\n`;
    body += `MÉDICO: ${physician}\n`;
    body += `REGISTRO MÉDICO: ${physicianReg}\n`;
    body += `${separator}\n`;
    body += `Quedamos atentos a la confirmación de la gestión y al envío del número de autorización. Adjuntamos los soportes clínicos pertinentes.\n\n`;
    body += `Atentamente,\n`;
    body += `IMAGENES DIAGNOSTICAS\n`;
    body += `CLINICA SAN SEBASTIAN\n`;
    body += `Equipo de Coordinación Médica\n`;
    return body;
  };

  const openGmailCompose = () => {
    if (!enabled) return;
    const subject = buildMailSubject();
    const body = buildMailBody();
    const recipients = Array.from(new Set([...parseEmails(epsEmail), ...extraAuthorizationEmails]));
    const toParam = recipients.join(',');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toParam)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener');
  };

  const openOwnAuthorization = () => {
    if (!enabled) return;
    const url = `/documents/${remission.id}/authorization?source=remissions`;
    window.open(url, '_blank', 'noopener');
  };
  const handleDeleteRemission = async () => {
    if (!enabled) return;
    setDeleteLoading(true);
    try {
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "remissions", remission.id));
      toast({ title: "Remisión eliminada", description: `${patient.fullName} fue removido del listado.` });
    } catch (error) {
      console.error("[Remissions] Error deleting remission", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la remisión." });
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenuItem onClick={openGmailCompose} disabled={!enabled} className="flex items-center gap-2 cursor-pointer">
        <Mail className="h-4 w-4 shrink-0" />
        <span>Enviar EPS</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={openOwnAuthorization} disabled={!enabled} className="flex items-center gap-2 cursor-pointer">
        <FileText className="h-4 w-4 shrink-0" />
        <span>Radicar Propia</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onEdit?.(remission)} disabled={!enabled} className="flex items-center gap-2 cursor-pointer">
        <Edit className="h-4 w-4 shrink-0" />
        <span>Editar Remisión</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeleteDialogOpen(true); }} disabled={!enabled} className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-700 bg-red-50/50 focus:bg-red-50">
        <Trash2 className="h-4 w-4 shrink-0" />
        <span>Eliminar</span>
      </DropdownMenuItem>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar remisión</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción quitará el registro de {patient.fullName}. Â¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRemission}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
type RemissionsTableProps = {
  statusFilter: RemissionStatus | "Todos";
  onStatusSummaryChange?: (summary: Record<string, number>) => void;
  onCountsChange?: (counts: { status: Record<string, number>; modalities: Record<string, number>; services: Record<string, number> }) => void;
  onEditRemission?: (remission: Remission) => void;
  modalityFilter?: string;
  serviceFilter?: string;
};

export function RemissionsTable({ statusFilter, onStatusSummaryChange, onCountsChange, onEditRemission, modalityFilter = 'ALL', serviceFilter = 'ALL' }: RemissionsTableProps) {
  const [remissions, setRemissions] = useState<Remission[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const { currentProfile } = useAuth();

  useEffect(() => {
    const PAGE_SIZE = 15;
    const q = query(collection(db, "remissions"), orderBy('createdAt', 'desc'), firestoreLimit(PAGE_SIZE));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Remission));
      // Ordenar por fecha de creación descendente
      const sorted = data.sort((a, b) => {
        const aDate = typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const bDate = typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return bDate - aDate;
      });
      setRemissions(sorted);
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      setLastVisible(lastDoc);
      setHasMore(snapshot.docs.length === PAGE_SIZE);

      const summary: Record<string, number> = {};
      sorted.forEach((item) => {
        const key = item.status || 'Sin estado';
        summary[key] = (summary[key] || 0) + 1;
      });

      if (onStatusSummaryChange) {
        onStatusSummaryChange(summary);
      }

      if (onCountsChange) {
        const modalities: Record<string, number> = {};
        const services: Record<string, number> = {};
        
        sorted.forEach((item) => {
          const raw = (item.studies && item.studies[0] && item.studies[0].modality) || 'OTROS';
          const modKey = normalizeModalityCode(String(raw));
          modalities[modKey] = (modalities[modKey] || 0) + 1;

          const svc = item.service || 'C.EXT';
          services[svc] = (services[svc] || 0) + 1;
        });

        onCountsChange({ status: summary, modalities, services });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [onStatusSummaryChange, onCountsChange]);

  const handleLoadMore = async () => {
    if (!lastVisible) return;
    if (searchTerm.trim() !== '') return; // don't load more while searching
    if (modalityFilter && modalityFilter !== 'ALL') return; // don't load more while modality filtered
    const PAGE_SIZE = 15;
    setIsLoadingMore(true);
    try {
      const nextQuery = query(collection(db, "remissions"), orderBy('createdAt', 'desc'), startAfter(lastVisible), firestoreLimit(PAGE_SIZE));
      const documentSnapshots = await getDocs(nextQuery);
      const newData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Remission));
      if (newData.length > 0) {
        setRemissions(prev => [...prev, ...newData]);
        const newLast = documentSnapshots.docs[documentSnapshots.docs.length - 1] || null;
        setLastVisible(newLast);
        setHasMore(documentSnapshots.docs.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('[Remissions] Error loading more remissions', error);
    }
    setIsLoadingMore(false);
  };

  const filteredRemissions = remissions
    .filter(r => statusFilter === "Todos" ? true : r.status === statusFilter)
    .filter(r => {
      if (modalityFilter && modalityFilter !== 'ALL') {
        const raw = (r.studies && r.studies[0] && r.studies[0].modality) || 'OTROS';
        const key = normalizeModalityCode(String(raw));
        if (key !== modalityFilter) return false;
      }
      if (serviceFilter && serviceFilter !== 'ALL') {
        const svc = r.service || 'C.EXT';
        if (svc !== serviceFilter) return false;
      }
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      const haystack = `${r.patient.fullName} ${r.patient.id}`.toLowerCase();
      return haystack.includes(query);
    });

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Cargando remisiones...</div>;
  }



  return (
    <div className="rounded-2xl border-none shadow-xl bg-white overflow-hidden ring-1 ring-zinc-200/50">
      <Table style={{ tableLayout: "fixed" }}>
        <TableHeader>
          <TableRow className="bg-zinc-50/80 hover:bg-zinc-50 border-b-2 border-zinc-100">
            <TableHead className="p-2" style={{ width: '130px' }}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className='font-black text-[11px] w-full h-full justify-start px-2 text-zinc-900 uppercase tracking-widest'>ESTADO</Button>
                    </DropdownMenuTrigger>
                </DropdownMenu>
            </TableHead>
            <TableHead style={{ minWidth: "340px", width: "30%" }} className="px-2">
                  <div className="relative">
                    {currentProfile?.rol === 'administrador' ? (
                      <>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Buscar por paciente o ID..."
                          className="w-full rounded-xl bg-white border-2 border-zinc-100 focus-visible:ring-amber-400 focus-visible:border-amber-400 pl-9 h-10 shadow-sm transition-all font-semibold"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </>
                    ) : (
                      <div className="font-black text-[11px] w-full text-zinc-900 uppercase tracking-widest px-2">PACIENTE</div>
                    )}
                  </div>
            </TableHead>
            <TableHead className="px-2 align-middle" style={{ width: "auto" }}>
                <div className="font-black text-[11px] text-zinc-900 uppercase tracking-widest">ESTUDIO</div>
            </TableHead>
            <TableHead style={{ width: "170px" }} className="text-left font-black text-[11px] text-zinc-900 uppercase tracking-widest px-2">
                <div className="flex items-center gap-2 pr-6">
                    <DateRangePicker 
                        date={dateRange}
                        setDate={setDateRange}
                        align="start"
                        triggerClassName="font-black text-[11px] px-3 uppercase tracking-widest text-zinc-900 bg-transparent border-transparent shadow-none hover:bg-zinc-100 hover:border-zinc-200 h-9 w-full rounded-xl"
                        showMonths={1}
                    />
                </div>
            </TableHead>
            <TableHead style={{ width: '40px' }} className="text-right px-2"></TableHead>
          </TableRow>
        </TableHeader>
      <TableBody>
        {filteredRemissions.length > 0 ? (
          filteredRemissions.map(rem => {
            const primaryStudy = getPrimaryStudy(rem);
          const patientLink = rem.patient.id ? `/patients/${rem.patient.id}` : null;
          const createdAtDate = typeof rem.createdAt === 'number'
            ? new Date(rem.createdAt)
            : rem.createdAt?.seconds
              ? new Date(rem.createdAt.seconds * 1000)
              : null;
          const createdAtLabel = createdAtDate ? format(createdAtDate, "dd/MM, HH:mm") : null;

          const isInactive = (rem.status as string) === "Vencido";
          return (
            <TableRow
              key={rem.id}
              data-state={isInactive ? 'inactive' : 'active'}
              className="data-[state=inactive]:opacity-60 border-b border-zinc-100 bg-white hover:bg-zinc-50 last:border-0"
            >
              <TableCell className="p-2">
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <StatusButton currentStatus={rem.status} remissionId={rem.id} />
                </div>
              </TableCell>
              <TableCell className="p-2 align-top relative">
                <div className="flex flex-col space-y-0">
                  <div className="h-5 flex items-center justify-between">
                    {patientLink ? (
                      <Link href={patientLink} className="flex-1 truncate hover:underline pr-2">
                        <span className="font-black text-sm uppercase text-zinc-900 tracking-wide leading-none">{rem.patient.fullName}</span>
                      </Link>
                    ) : (
                      <span className="font-black text-sm uppercase text-zinc-900 tracking-wide leading-none flex-1 truncate pr-2">{rem.patient.fullName}</span>
                    )}
                    <div className={cn(
                        "w-[56px] h-[22px] rounded-lg border border-zinc-200 bg-white shadow-sm flex items-center justify-center font-black text-[10px] uppercase tracking-tighter shrink-0"
                    )}>
                        <RemissionServiceDialog remission={rem}>
                            <span className="font-mono font-bold cursor-pointer hover:underline text-[10px] leading-none">
                                {abbreviateSubService(rem.subService)}
                            </span>
                        </RemissionServiceDialog>
                        <RemissionBedNumberInput 
                            remission={rem} 
                            canEdit={currentProfile?.rol === 'administrador' || currentProfile?.rol === 'adminisonista'} 
                        />
                    </div>
                  </div>
                  <div className="flex flex-col space-y-0">
                      <div className="h-4 flex items-center text-xs text-muted-foreground gap-x-3 flex-wrap">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                          <span className="leading-none"><span className="font-semibold">ID:</span> {rem.patient.id || '--'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                          <span className="leading-none"><span className="font-semibold">FN:</span> {rem.patient.birthDate || '--'} {(rem.patient.birthDate && getAge(rem.patient.birthDate) !== '') ? `- ${getAge(rem.patient.birthDate)} AÑOS` : ''}</span>
                        </div>
                      </div>
                      <div className="h-4 flex items-center text-xs text-muted-foreground gap-1.5 flex-nowrap">
                        <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                        <span className="truncate leading-none"><span className="font-semibold">ENTIDAD:</span> {formatEntityName(rem.patient.entidad)}</span>
                      </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="p-2 align-top">
                <div className='flex gap-3 items-start'>
                  <div className="h-5 flex items-center shrink-0">
                     <div className={cn(
                        "w-[56px] h-[22px] rounded-lg border shadow-sm flex items-center justify-center font-black text-[10px] uppercase tracking-wider shrink-0",
                        (() => {
                            const mod = (primaryStudy ? (primaryStudy.modality || rem.service) : (rem.service || 'N/A'))?.toString().toUpperCase();
                            switch (mod) {
                                case 'TAC': return "bg-emerald-50 text-emerald-700 border-emerald-200";
                                case 'RX': return "bg-blue-50 text-blue-700 border-blue-200";
                                case 'ECO': return "bg-red-50 text-red-700 border-red-200";
                                case 'MAMO': return "bg-amber-50 text-amber-700 border-amber-200";
                                case 'DENSITOMETRIA': return "bg-rose-50 text-rose-700 border-rose-200";
                                case 'RMN': return "bg-yellow-50 text-yellow-700 border-yellow-200";
                                default: return "bg-zinc-100 text-zinc-600 border-zinc-200";
                            }
                        })()
                    )}>
                        {primaryStudy ? (primaryStudy.modality || rem.service) : (rem.service || 'N/A')}
                    </div>
                  </div>
                    <div className="flex-1 min-w-0 pr-2 flex flex-col space-y-0">
                      <div className="h-5 flex items-center">
                        <p className="font-black text-zinc-900 text-sm uppercase tracking-wide leading-none truncate" title={primaryStudy?.nombre?.toUpperCase()}>
                          {primaryStudy?.nombre?.toUpperCase() || 'REMISIÓN MÉDICA'}
                        </p>
                      </div>
                      
                      {(() => {
                          const obs = getObservationNote(rem);
                          if (!obs) return null;
                          return (
                            <div className="h-4 flex items-center gap-x-3 flex-wrap text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 max-w-[280px] shrink-0 min-w-0" title={obs}>
                                    <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                                    <span className="truncate leading-none"><span className="font-semibold">OBS:</span> {obs.toUpperCase()}</span>
                                </div>
                            </div>
                          );
                      })()}

                      <div className="h-4 flex items-center gap-x-3 text-xs text-muted-foreground flex-wrap">
                        {primaryStudy?.cups && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="h-1 w-1 rounded-full bg-zinc-300" />
                            <span className="leading-none"><span className="font-semibold">CUPS:</span> {primaryStudy.cups}</span>
                          </div>
                        )}
                        {(() => {
                            let code = '--';
                            let description = '';
                            if (Array.isArray(rem.diagnosis)) {
                                code = rem.diagnosis[0]?.code || '--';
                                description = rem.diagnosis[0]?.description || '';
                            } else if (rem.diagnosis) {
                                code = (rem.diagnosis as any).code || '--';
                                description = (rem.diagnosis as any).description || '';
                            }
                            if (code !== '--') {
                                return (
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <div className="h-1 w-1 rounded-full bg-zinc-300" />
                                    <span className="truncate leading-none" title={`${code}: ${description.toUpperCase()}`}>
                                      <span className="font-semibold">CIE 10:</span> {code} - {description.toUpperCase()}
                                    </span>
                                  </div>
                                );
                            }
                            return null;
                        })()}
                      </div>
                    </div>
                </div>
              </TableCell>
              <TableCell className="p-2 align-top text-left">
                  <div className="flex flex-col space-y-0">
                      {rem.pendienteAutAt || rem.createdAt ? (
                          <div className="h-4 flex items-center gap-1.5 text-xs text-red-500 font-bold">
                              <div className="h-1 w-1 rounded-full shrink-0 bg-red-400" />
                              <span className="leading-none"><span className="font-semibold inline-block w-[50px] text-red-600">P. AUT:</span> {(() => { const d = toDateValue(rem.pendienteAutAt || rem.createdAt); return d ? format(d, "dd/MM, HH:mm") : '--'; })()}</span>
                          </div>
                      ) : null }

                      {rem.programadoAt ? (
                          <div className="h-4 flex items-center gap-1.5 text-xs text-indigo-500 font-bold">
                              <div className="h-1 w-1 rounded-full shrink-0 bg-indigo-400" />
                              <span className="leading-none"><span className="font-semibold inline-block w-[50px] text-indigo-600">PROGR:</span> {(() => { const d = toDateValue(rem.programadoAt); return d ? format(d, "dd/MM, HH:mm") : '--'; })()}</span>
                          </div>
                      ) : null }

                      {rem.informadoAt ? (
                          <div className="h-4 flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                              <div className="h-1 w-1 rounded-full shrink-0 bg-emerald-400" />
                              <span className="leading-none"><span className="font-semibold inline-block w-[50px] text-emerald-600">INFOR:</span> {(() => { const d = toDateValue(rem.informadoAt); return d ? format(d, "dd/MM, HH:mm") : '--'; })()}</span>
                          </div>
                      ) : null }
                  </div>
              </TableCell>

              <TableCell className="p-2 text-right align-top relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-7 w-7 p-0">
                      <span className="sr-only">Abrir menú</span>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <RemissionAuthorizationActions
                      remission={rem}
                      enabled={currentProfile?.rol === 'administrador'}
                      onEdit={onEditRemission}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })
        ) : (
          <TableRow>
            <TableCell colSpan={5}>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-background border shadow-sm w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">No se encontraron remisiones</p>
                <p className="text-xs text-muted-foreground mt-1">Intenta ajustar los filtros de búsqueda.</p>
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    {hasMore && searchTerm.trim() === '' && modalityFilter === 'ALL' && (
      <div className="flex justify-center py-4">
        <Button onClick={handleLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando...
            </>
          ) : (
            "Ver más remisiones..."
          )}
        </Button>
      </div>
    )}
    </div>
  );
}

