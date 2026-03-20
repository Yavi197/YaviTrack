
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { UserRoles, GeneralServices, Modalities, SubServiceAreas, type UserRole, type GeneralService, type SubServiceArea, type Modality } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';


const impersonationSchema = z.object({
  rol: z.enum(UserRoles),
  servicioAsignado: z.string().min(1, "Debe seleccionar un servicio."),
  subServicioAsignado: z.string().optional(),
});

type ImpersonationFormData = z.infer<typeof impersonationSchema>;

interface ImpersonationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImpersonationDialog({ open, onOpenChange }: ImpersonationDialogProps) {
    const { startImpersonating, currentProfile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<ImpersonationFormData>({
        resolver: zodResolver(impersonationSchema),
        defaultValues: {
            rol: currentProfile?.rol || 'enfermero',
            servicioAsignado: currentProfile?.servicioAsignado || '',
            subServicioAsignado: currentProfile?.subServicioAsignado || '',
        }
    });

    const watchedRol = form.watch("rol");
    const watchedService = form.watch("servicioAsignado");

    useEffect(() => {
        let autoService: string | null = null;
        if (watchedRol === 'tecnologo') autoService = 'RX';
        if (watchedRol === 'transcriptora') autoService = 'ECO';
        if (watchedRol === 'administrador') autoService = 'General';

        if (autoService) {
            form.setValue('servicioAsignado', autoService);
            form.setValue('subServicioAsignado', '');
        } else {
             // Reset if role changes to one that needs manual selection
            if (form.getValues('servicioAsignado') && !GeneralServices.includes(form.getValues('servicioAsignado') as any)) {
               form.setValue('servicioAsignado', '');
            }
        }
    }, [watchedRol, form]);

    const availableServices = useMemo(() => {
        if (watchedRol === 'enfermero' || watchedRol === 'adminisonista') {
            return [...GeneralServices];
        }
        return [];
    }, [watchedRol]);

    const isGeneralService = GeneralServices.includes(watchedService as any);
    const showServiceSelection = availableServices.length > 0;
    
    const onSubmit = (data: ImpersonationFormData) => {
        setLoading(true);
        startImpersonating({
            rol: data.rol,
            servicioAsignado: data.servicioAsignado as GeneralService | Modality,
            subServicioAsignado: data.subServicioAsignado as SubServiceArea | undefined,
        });
        toast({
            title: 'Vista Previa Activada',
            description: `Ahora estás viendo la aplicación como un ${data.rol}.`,
        });
        setLoading(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Vista Previa de Perfil</DialogTitle>
                    <DialogDescription>
                        Selecciona un rol para ver la aplicación desde esa perspectiva.
                    </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="rol" render={({ field }) => ( 
                            <FormItem>
                                <FormLabel>Rol</FormLabel>
                                <Select onValueChange={(value) => form.setValue('rol', value as UserRole)} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                                    <SelectContent>{UserRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem> 
                        )}/>
                        
                        {showServiceSelection && (
                            <FormField control={form.control} name="servicioAsignado" render={({ field }) => ( 
                                <FormItem>
                                    <FormLabel>Servicio Asignado</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un servicio" /></SelectTrigger></FormControl>
                                        <SelectContent>{availableServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem> 
                            )}/>
                        )}

                        {isGeneralService && (
                            <FormField control={form.control} name="subServicioAsignado" render={({ field }) => ( 
                                <FormItem>
                                    <FormLabel>Sub-Servicio Asignado</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un sub-servicio" /></SelectTrigger></FormControl>
                                        <SelectContent>{SubServiceAreas[watchedService as keyof typeof SubServiceAreas].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem> 
                            )}/>
                        )}

                        <DialogFooter className="pt-4">
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Activar Vista Previa"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
