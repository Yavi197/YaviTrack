
"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from "@/components/ui/label";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import type { Specialist } from '@/lib/types';
import { WhatsAppIcon } from '../icons/whatsapp-icon';

interface NotifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialists: Specialist[];
  specialty: string;
  onSend: (specialistIds: string[]) => void;
}

export function NotifyDialog({
  open,
  onOpenChange,
  specialists,
  specialty,
  onSend,
}: NotifyDialogProps) {
  const [selectedSpecialists, setSelectedSpecialists] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Pre-select all specialists when dialog opens
      const initialSelection: Record<string, boolean> = {};
      specialists.forEach(spec => {
        initialSelection[spec.id] = true;
      });
      setSelectedSpecialists(initialSelection);
    }
  }, [open, specialists]);

  const handleToggle = (id: string) => {
    setSelectedSpecialists(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };
  
  const handleToggleAll = (checked: boolean | "indeterminate") => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
        specialists.forEach(spec => {
            newSelection[spec.id] = true;
        });
    }
    setSelectedSpecialists(newSelection);
  }

  const selectedIds = useMemo(() => {
    return Object.entries(selectedSpecialists)
      .filter(([, isSelected]) => isSelected)
      .map(([id]) => id);
  }, [selectedSpecialists]);

  const handleConfirm = async () => {
    setLoading(true);
    await onSend(selectedIds);
    setLoading(false);
    onOpenChange(false);
  };
  
  const allSelected = specialists.length > 0 && selectedIds.length === specialists.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < specialists.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Notificar a Especialistas de {specialty}</AlertDialogTitle>
          <AlertDialogDescription>
            Selecciona los especialistas a los que deseas enviar un resumen de sus interconsultas pendientes por WhatsApp.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex items-center space-x-2 border-b pb-2">
            <Checkbox
              id="select-all"
              checked={allSelected ? true : (isIndeterminate ? 'indeterminate' : false)}
              onCheckedChange={handleToggleAll}
            />
            <Label htmlFor="select-all" className="font-semibold">
                Seleccionar Todos
            </Label>
        </div>

        <ScrollArea className="max-h-60 w-full pr-4">
          <div className="space-y-3">
            {specialists.map((spec) => (
              <div key={spec.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`spec-${spec.id}`}
                      checked={selectedSpecialists[spec.id] || false}
                      onCheckedChange={() => handleToggle(spec.id)}
                    />
                    <Label htmlFor={`spec-${spec.id}`} className="cursor-pointer">
                      <p className="font-semibold">{spec.name}</p>
                      <p className="text-xs text-muted-foreground">{spec.phoneNumber}</p>
                    </Label>
                </div>
                 <WhatsAppIcon className="h-5 w-5 text-green-600" />
              </div>
            ))}
             {specialists.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No hay especialistas registrados para esta especialidad.</p>}
          </div>
        </ScrollArea>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading || selectedIds.length === 0}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WhatsAppIcon className="mr-2 h-4 w-4" />}
            Enviar a {selectedIds.length} especialista(s)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
