
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet } from 'lucide-react';

interface RmnChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (choice: 'order' | 'remission') => void;
}

export function RmnChoiceDialog({ open, onOpenChange, onSelect }: RmnChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Estudio de Resonancia Detectado</DialogTitle>
          <DialogDescription>
            Se ha detectado una Resonancia Magnética (RMN). ¿Qué desea generar con esta orden?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <Button variant="outline" className="h-24" onClick={() => onSelect('order')}>
            <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8" />
                <span className="font-semibold">Solicitud Interna</span>
            </div>
          </Button>
          <Button variant="outline" className="h-24" onClick={() => onSelect('remission')}>
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="h-8 w-8" />
              <span className="font-semibold">Remisión Externa</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
