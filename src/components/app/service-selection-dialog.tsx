
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { GeneralServices, SubServiceAreas, type GeneralService, type SubServiceArea } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  service: z.enum(GeneralServices),
  subService: z.string().min(1, "Debe seleccionar un sub-servicio."),
});

type ServiceSelectionFormData = z.infer<typeof formSchema>;

interface ServiceSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (service: GeneralService, subService: SubServiceArea) => void;
    onCancel: () => void;
}

export function ServiceSelectionDialog({ open, onOpenChange, onConfirm, onCancel }: ServiceSelectionDialogProps) {
    const [loading, setLoading] = useState(false);

    const form = useForm<ServiceSelectionFormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            service: 'URG',
            subService: '',
        },
    });

    const watchedService = form.watch("service");

    useEffect(() => {
        if (watchedService) {
            form.setValue('subService', ''); // Reset sub-service when service changes
        }
    }, [watchedService, form]);

    const availableSubServices = useMemo(() => {
        return SubServiceAreas[watchedService] || [];
    }, [watchedService]);

    const onSubmit = (data: ServiceSelectionFormData) => {
        setLoading(true);
        onConfirm(data.service, data.subService as SubServiceArea);
        form.reset();
        setLoading(false);
    };

    const handleCancel = () => {
        onCancel();
        onOpenChange(false);
        form.reset();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
            <DialogContent onEscapeKeyDown={handleCancel} onPointerDownOutside={handleCancel}>
                <DialogHeader>
                    <DialogTitle className="font-headline">Seleccionar Servicio del Paciente</DialogTitle>
                    <DialogDescription>
                        Por favor, especifique el servicio y sub-servicio del que proviene el paciente para crear la solicitud.
                    </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                         <FormField
                            control={form.control}
                            name="service"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Servicio General</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {GeneralServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {availableSubServices.length > 0 && (
                             <FormField
                                control={form.control}
                                name="subService"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sub-Servicio</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {availableSubServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={handleCancel}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar y Crear"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

