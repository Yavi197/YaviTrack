
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { scheduleRemissionAppointmentAction } from '@/app/actions';
import { format, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';


const appointmentSchema = z.object({
  date: z.date({
    required_error: "La fecha de la cita es requerida.",
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:mm)."),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface ScheduleAppointmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    remissionId: string;
    onComplete: () => void;
}

export function ScheduleAppointmentDialog({ open, onOpenChange, remissionId, onComplete }: ScheduleAppointmentDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<AppointmentFormData>({
        resolver: zodResolver(appointmentSchema),
        defaultValues: {
            time: '08:00',
        }
    });

    const onSubmit = async (data: AppointmentFormData) => {
        setLoading(true);
        const [hours, minutes] = data.time.split(':').map(Number);
        const appointmentDate = setMinutes(setHours(data.date, hours), minutes);

        const result = await scheduleRemissionAppointmentAction(remissionId, appointmentDate.toISOString());

        if (result.success) {
            toast({ title: 'Cita Agendada', description: 'Se ha guardado la fecha y hora de la cita.' });
            onComplete();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setLoading(false);
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Agendar Cita de Remisión</DialogTitle>
                    <DialogDescription>
                        Seleccione la fecha y hora para la cita del paciente.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Fecha de la Cita</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button
                                                    autoFocus
                                                    variant={"outline"}
                                                    className={cn(
                                                    "w-[240px] pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                    format(field.value, "PPP", { locale: es })
                                                    ) : (
                                                    <span>Seleccionar fecha</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="time"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Hora (24h)</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} className="w-[120px]" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Cita"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

