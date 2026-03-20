'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { registerQuickRxHandoverAction } from '@/app/actions';
import type { UserProfile } from '@/lib/types';

interface ShiftHandoverDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userProfile: UserProfile | null;
}

export function ShiftHandoverDialog({ open, onOpenChange, userProfile }: ShiftHandoverDialogProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const technicianId = userProfile?.uid || '';
    const technicianName = userProfile?.operadorActivo || userProfile?.nombre || 'Tecnólogo';

    const handleConfirm = async () => {
        if (!technicianId) {
            toast({ variant: 'destructive', title: 'Sin usuario', description: 'No encontramos el perfil para registrar la entrega.' });
            return;
        }
        setIsSubmitting(true);
        const result = await registerQuickRxHandoverAction({ technologistId: technicianId, technologistName: technicianName });
        setIsSubmitting(false);
        if (result.success) {
            toast({ title: 'Turno entregado', description: 'Se registró la entrega RX sin novedad.' });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudo registrar la entrega.' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !isSubmitting && onOpenChange(value)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Confirmar entrega de turno RX</DialogTitle>
                    <DialogDescription>
                        Se generará automáticamente un registro sin novedad en la hoja mensual de Rayos X.
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    La fecha y hora se tomarán ahora mismo. Esta acción deja constancia de que {technicianName} entregó el turno con equipos e inventario en buen estado.
                </p>
                <DialogFooter className="gap-2 pt-4 sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
                        {isSubmitting ? 'Registrando…' : 'Confirmar entrega'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
