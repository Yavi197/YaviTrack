
import React from 'react';
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
import { AlertTriangle } from 'lucide-react';

interface DuplicateStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  studyName: string;
  patientName: string;
}

export function DuplicateStudyDialog({
  open,
  onOpenChange,
  onConfirm,
  studyName,
  patientName
}: DuplicateStudyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[2rem]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <span>Posible Solicitud Duplicada</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-4 text-zinc-900 font-medium">
            Se ha detectado una solicitud de <span className="font-black underline">&quot;{studyName}&quot;</span> para el paciente <span className="font-black italic">{patientName}</span> en las últimas 24 horas.
            <br /><br />
            ¿Desea crear esta nueva solicitud de todas formas o cancelar el proceso?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
          <AlertDialogCancel className="rounded-xl border-2">Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-100"
          >
            Crear de todas formas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
