
"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { exportStudiesAction } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { GeneralServices, Modalities } from "@/lib/types";
import { format as formatDate } from 'date-fns';
import { DateRangePicker } from "../ui/date-range-picker";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(undefined);
  const [service, setService] = useState<string>("TODOS");
  const [modality, setModality] = useState<string>("TODOS");
  const [status, setStatus] = useState<string>("TODOS");

  const studyStatuses = ["Pendiente", "Completado", "Leído", "Cancelado"];

  const handleExport = async () => {
    setIsExporting(true);
    const result = await exportStudiesAction({ 
        dateRange: exportDateRange,
        filters: {
            service: service === "TODOS" ? undefined : service,
            modality: modality === "TODOS" ? undefined : modality,
            status: status === "TODOS" ? undefined : status,
        }
    });
    setIsExporting(false);

    if (result.success && result.fileBuffer) {
      const byteCharacters = atob(result.fileBuffer);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      let fileName = "Med-iTrack Export";
      if (exportDateRange?.from) {
        const from = formatDate(exportDateRange.from, 'dd-MM-yyyy');
        if (exportDateRange.to) {
          const to = formatDate(exportDateRange.to, 'dd-MM-yyyy');
          fileName += ` ${from} al ${to}`;
        } else {
          fileName += ` ${from}`;
        }
      } else {
        fileName += ` (Todos)`;
      }
      
      link.setAttribute("href", url);
      link.setAttribute("download", `${fileName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onOpenChange(false);
      toast({
        title: "Exportación Exitosa",
        description: "El archivo Excel ha sido descargado.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error de Exportación",
        description:
          result.error || "No se pudo generar el archivo Excel.",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Exportar Datos a Excel</AlertDialogTitle>
          <AlertDialogDescription>
            Selecciona filtros para acotar los datos a exportar. Los datos se organizarán en hojas por modalidad.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col md:flex-row gap-4 py-4">
          <DateRangePicker date={exportDateRange} setDate={setExportDateRange} className="w-full md:w-auto" />
          <div className="flex-1 space-y-4 md:border-l md:pl-4">
             <div className="space-y-2">
                <Label>Servicio</Label>
                <Select value={service} onValueChange={setService}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        {GeneralServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>
              <div className="space-y-2">
                <Label>Modalidad</Label>
                <Select value={modality} onValueChange={setModality}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="TODOS">Todas</SelectItem>
                        {Modalities.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label>Estado</Label>
                 <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        {studyStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exportando...
              </>
            ) : (
              "Exportar a Excel"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
