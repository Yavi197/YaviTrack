"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createRemissionAction } from '@/app/actions';
import { GeneralServices, SubServiceAreas, type GeneralService, type Study, type SubServiceArea } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint, User } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';

interface RemissionRequestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studyData: Study | null;
    initialFile?: File | null;
}

const serializeStudyData = (study: Study | null): any => {
    if (!study) return null;
    const { requestDate, completionDate, readingDate, orderDate, ...rest } = study;
    const serialized = { ...rest, id: study.id } as any;

    if (requestDate) serialized.requestDate = (requestDate as any).toDate().toISOString();
    if (completionDate) serialized.completionDate = (completionDate as any).toDate().toISOString();
    if (readingDate) serialized.readingDate = (readingDate as any).toDate().toISOString();

    if (orderDate) {
        if (typeof (orderDate as any).toDate === 'function') {
            serialized.orderDate = (orderDate as any).toDate().toISOString();
        } else if (typeof orderDate === 'string') {
            serialized.orderDate = orderDate;
        }
    }

    return serialized;
};

export function RemissionRequestDialog({ open, onOpenChange, studyData: initialStudyData, initialFile: _initialFile = null }: RemissionRequestDialogProps) {
    const { toast } = useToast();
    const { userProfile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedService, setSelectedService] = useState<GeneralService | ''>('');
    const [selectedSubService, setSelectedSubService] = useState<SubServiceArea | ''>('');
    const [requiresContrast, setRequiresContrast] = useState(false);
    const [requiresSedation, setRequiresSedation] = useState(false);

    useEffect(() => {
        if (!initialStudyData) {
            setSelectedService('');
            setSelectedSubService('');
            setRequiresContrast(false);
            setRequiresSedation(false);
            return;
        }

        setSelectedService(initialStudyData.service || '');
        setSelectedSubService(initialStudyData.subService || '');
        const studyAny = initialStudyData as any;
        setRequiresContrast(Boolean(studyAny?.requiereContraste || studyAny?.contrastType));
        setRequiresSedation(Boolean(studyAny?.bajoSedacion));
    }, [initialStudyData, open]);

    const resetDialog = useCallback(() => {
        setIsSubmitting(false);
        setSelectedService('');
        setSelectedSubService('');
        setRequiresContrast(false);
        setRequiresSedation(false);
    }, []);

    useEffect(() => {
        if (!open) {
            resetDialog();
        }
    }, [open, resetDialog]);

    const subServiceOptions = selectedService ? SubServiceAreas[selectedService] || [] : [];
    const canSubmit = Boolean(initialStudyData) && Boolean(selectedService);

  const onSubmit = async () => {
    if (!initialStudyData || !userProfile || !selectedService) return;

    setIsSubmitting(true);
    try {
        const serializedData = serializeStudyData(initialStudyData);
        if (!serializedData) {
            throw new Error("No se pudieron serializar los datos del estudio.");
        }

        const resolvedService = selectedService as GeneralService;
        const resolvedSubService = (selectedSubService || initialStudyData.subService || SubServiceAreas[resolvedService]?.[0] || 'AMB') as SubServiceArea;
        serializedData.service = resolvedService;
        serializedData.subService = resolvedSubService;

        const result = await createRemissionAction({
            studyData: serializedData,
            remissionData: {
                notaCargoUrl: '',
                ordenMedicaUrl: '',
                evolucionUrl: ''
            },
            userProfile,
            service: resolvedService,
            subService: resolvedSubService,
            requiresContrast,
            bajoSedacion: requiresSedation
        });

        if (result.success) {
            toast({ 
                title: 'Remisión Registrada', 
                description: `Se ha creado el registro para ${initialStudyData.patient.fullName} en Firestore.`
            });
            
            // Show warning if sheets update failed
            if (result.error) {
                toast({ 
                    variant: 'default',
                    title: 'Advertencia', 
                    description: result.error
                });
            }
            
            onOpenChange(false);
        } else {
             throw new Error(result.error || 'No se pudo crear la remisión.');
        }

    } catch (error: any) {
        console.error("Error creating remission:", error);
        toast({ 
            variant: 'destructive', 
            title: 'Error', 
            description: error.message || 'Error desconocido al crear la remisión.'
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (!initialStudyData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
                    <DialogTitle className="font-headline text-xl">Generar Remisión Externa</DialogTitle>
                    <DialogDescription>
                        Confirma el servicio de origen y los datos operativos antes de registrar la remisión.
                    </DialogDescription>
        </DialogHeader>
        
        <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2">
                <h4 className="font-bold text-base">{initialStudyData.patient.fullName}</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><User className="h-4 w-4"/> {initialStudyData.studies[0]?.nombre}</span>
                    <span className="flex items-center gap-1.5"><Fingerprint className="h-4 w-4"/> {initialStudyData.patient.id}</span>
                </div>
            </CardContent>
        </Card>
        
        <div className="py-4 space-y-4">
            <section className="space-y-4 rounded-lg border bg-muted/40 p-4">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">Servicio solicitante</Label>
                    <Select
                        value={selectedService}
                        onValueChange={(value) => {
                            setSelectedService(value as GeneralService);
                            setSelectedSubService('');
                        }}
                    >
                        <SelectTrigger aria-label="Seleccionar servicio de origen">
                            <SelectValue placeholder="Selecciona el servicio" />
                        </SelectTrigger>
                        <SelectContent>
                            {GeneralServices.map((service) => (
                                <SelectItem key={service} value={service}>
                                    {service}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-900">Subservicio</Label>
                    <Select
                        value={selectedSubService}
                        onValueChange={(value) => setSelectedSubService(value as SubServiceArea)}
                        disabled={!selectedService || subServiceOptions.length === 0}
                    >
                        <SelectTrigger aria-label="Seleccionar subservicio">
                            <SelectValue placeholder={subServiceOptions.length ? 'Selecciona subservicio' : 'No aplica'} />
                        </SelectTrigger>
                        <SelectContent>
                            {subServiceOptions.map((sub) => (
                                <SelectItem key={sub} value={sub}>
                                    {sub}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">¿Estudio contrastado?</p>
                            <p className="text-xs text-muted-foreground">Se exportará como “Si” o “No”.</p>
                        </div>
                        <Switch id="contrastado-toggle" checked={requiresContrast} onCheckedChange={setRequiresContrast} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">¿Bajo sedación?</p>
                            <p className="text-xs text-muted-foreground">También quedará registrado en la hoja.</p>
                        </div>
                        <Switch id="sedacion-toggle" checked={requiresSedation} onCheckedChange={setRequiresSedation} />
                    </div>
                </div>
            </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={onSubmit} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Registrar Remisión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
