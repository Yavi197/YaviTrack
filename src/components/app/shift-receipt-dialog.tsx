import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateShiftHandoverReceipt } from '@/app/actions';
import type { UserProfile } from '@/lib/types';
import type { ShiftHandoverInput } from '@/lib/schemas/shift-handover-schema';

      interface ShiftReceiptDialogProps {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        handover: (ShiftHandoverInput & { id: string; createdAt: any }) | null;
        userProfile: UserProfile | null;
        availableOperators: UserProfile[];
      }

      export function ShiftReceiptDialog({
        open,
        onOpenChange,
        handover,
        userProfile,
        availableOperators,
      }: ShiftReceiptDialogProps) {
        const { toast } = useToast();
        const [selectedOperator, setSelectedOperator] = useState<string>('');
        const [observedIssues, setObservedIssues] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [localOpen, setLocalOpen] = useState(open);

        // Sincroniza el estado local con el del padre si cambia
        React.useEffect(() => {
          setLocalOpen(open);
        }, [open]);


        const handleConfirmReceipt = async () => {
          if (!selectedOperator) {
            toast({
              title: 'Error',
              description: 'Debes seleccionar un operador que recibe',
              variant: 'destructive',
            });
            return;
          }
          if (!handover) return;
          setIsSubmitting(true);
          try {
            // Obtener el operador que recibe
            const receivingOperator = availableOperators.find(op => op.uid === selectedOperator);
            if (!receivingOperator) {
              throw new Error('Operador que recibe no encontrado');
            }
            const receivedTechnicianId = receivingOperator.uid;
            const receivedTechnicianName = receivingOperator.nombre;

            const deliveringOperator = availableOperators.find(op => op.uid === handover.handoverTechnicianId);
            if (!deliveringOperator) {
              throw new Error('Operador que entrega no encontrado');
            }
            const previousTechnicianId = deliveringOperator.uid;


            const result = await updateShiftHandoverReceipt(
              handover.id,
              receivedTechnicianId,
              receivedTechnicianName,
              previousTechnicianId,
              observedIssues
            );

            if (result.success) {
              toast({
                title: 'Éxito',
                description: `${receivingOperator.nombre} es ahora el operador activo`,
              });
              if (onOpenChange) onOpenChange(false);
              setSelectedOperator('');
              setObservedIssues('');
              // Cerrar sesión y redirigir al login
              const { getAuth, signOut } = await import('firebase/auth');
              const auth = getAuth();
              await signOut(auth);
              window.location.href = '/login';
            } else {
              toast({
                title: 'Error',
                description: result.error || 'No se pudo registrar la recepción',
                variant: 'destructive',
              });
            }
          } catch (error: any) {
            toast({
              title: 'Error',
              description: error.message || 'Ocurrió un error',
              variant: 'destructive',
            });
          } finally {
            setIsSubmitting(false);
          }
        };

        if (!handover) return null;
        return (
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>Recibir Turno</DialogTitle>
                <DialogDescription>
                  Completa la recepción del turno entregado por {handover.handoverTechnicianName}
                </DialogDescription>
              </DialogHeader>
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg">Resumen de Entrega</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Fecha:</span> {handover.date}
                    </div>
                    <div>
                      <span className="font-medium">Turno:</span> {handover.shift === 'morning' ? 'Mañana' : 'Noche'}
                    </div>
                    <div>
                      <span className="font-medium">Hora:</span> {handover.hora}
                    </div>
                    <div>
                      <span className="font-medium">Técnico que Entrega:</span> {userProfile?.operadorActivo || handover?.handoverTechnicianName || 'Técnico'}
                    </div>
                  </div>
                  {/* Equipos */}
                  <div className="border-t pt-3 mt-3">
                    <span className="font-medium">Estado de Equipos:</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>Rayos X Fijo: {handover.equipment.rayosXFijo === 'B' ? 'Bueno completo' : handover.equipment.rayosXFijo}</div>
                      <div>Rayos X Portátil: {handover.equipment.rayosXPortatil === 'B' ? 'Bueno completo' : handover.equipment.rayosXPortatil}</div>
                      <div>Arco en C: {handover.equipment.arcoCinematico === 'B' ? 'Bueno completo' : handover.equipment.arcoCinematico}</div>
                      <div>Computadores: {handover.equipment.computadores === 'B' ? 'Bueno completo' : handover.equipment.computadores}</div>
                      <div>Monitores: {handover.equipment.monitores === 'B' ? 'Bueno completo' : handover.equipment.monitores}</div>
                      <div>Puesto Trabajo: {handover.equipment.puestoTrabajo === 'B' ? 'Bueno completo' : handover.equipment.puestoTrabajo}</div>
                    </div>
                  </div>
                  {/* Inventario */}
                  <div className="border-t pt-3">
                    <span className="font-medium">Chasis:</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>14x17: {handover.inventory.chasis14x17}</div>
                      <div>10x14: {handover.inventory.chasis10x14}</div>
                      <div>10x12: {handover.inventory.chasis10x12}</div>
                      <div>8x10: {handover.inventory.chasis8x10}</div>
                    </div>
                  </div>
                  {/* Estudios pendientes */}
                  {handover.tieneEstudiosPendientes && handover.estudiosPendientes?.length > 0 && (
                    <div className="border-t pt-3">
                      <span className="font-medium">Estudios Pendientes:</span>
                      <div className="mt-2 space-y-1 text-xs">
                        {handover.estudiosPendientes.map((study, idx) => (
                          <div key={idx}>
                            {study.servicio} ({study.cantidad}) - {study.motivo}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Novedades */}
                  {handover.novedades && (
                    <div className="border-t pt-3">
                      <span className="font-medium">Novedades:</span>
                      <p className="mt-2 text-xs whitespace-pre-wrap">{handover.novedades}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* Formulario de recepción */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="operator">Operador que Recibe el Turno</Label>
                  <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                    <SelectTrigger id="operator">
                      <SelectValue placeholder="Selecciona un operador" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOperators.map(op => (
                        <SelectItem key={op.uid} value={op.uid}>
                          {op.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="issues">Observaciones de Discrepancias (Opcional)</Label>
                  <Textarea
                    id="issues"
                    placeholder="Describe cualquier diferencia encontrada en los equipos o inventario"
                    value={observedIssues}
                    onChange={(e) => setObservedIssues(e.target.value)}
                    className="min-h-24"
                  />
                </div>
              </div>
              {/* Acciones */}
              <div className="flex justify-end gap-2 mt-6">
                <Button onClick={handleConfirmReceipt} disabled={isSubmitting || !selectedOperator} className="w-full">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      'Confirmar Recepción'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        }
