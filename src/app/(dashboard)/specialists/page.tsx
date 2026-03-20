

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Specialist, StudyWithCompletedBy } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addSpecialistAction, updateSpecialistAction, deleteSpecialistAction, sendConsultationSummaryAction } from '@/app/actions';
import { ALL_CONSULTATIONS } from '@/lib/consultations-data';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Plus, Pencil, Trash2, Send } from 'lucide-react';
import Link from 'next/link';
import { NotifyDialog } from '@/components/app/notify-dialog';

const uniqueSpecialties = Array.from(new Set(ALL_CONSULTATIONS.map(c => c.especialidad)));

const specialistSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  specialty: z.enum(uniqueSpecialties as [string, ...string[]]),
  phoneNumber: z.string().min(10, "El número debe tener al menos 10 dígitos.").refine(val => /^\+?[0-9\s-()]+$/.test(val), {
    message: "Número de teléfono inválido.",
  }),
});

type SpecialistFormData = z.infer<typeof specialistSchema>;

function SpecialistDialog({ open, onOpenChange, specialist, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, specialist: Specialist | null, onSave: (data: SpecialistFormData) => Promise<void> }) {
    const form = useForm<SpecialistFormData>({
        resolver: zodResolver(specialistSchema),
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (specialist) {
            form.reset({
                id: specialist.id,
                name: specialist.name,
                specialty: specialist.specialty,
                phoneNumber: specialist.phoneNumber,
            });
        } else {
            form.reset({ name: '', specialty: undefined, phoneNumber: '' });
        }
    }, [specialist, form]);

    const onSubmit = async (data: SpecialistFormData) => {
        setLoading(true);
        await onSave(data);
        setLoading(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{specialist ? 'Editar Especialista' : 'Añadir Nuevo Especialista'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Dr. Nombre Apellido" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="specialty" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Especialidad</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar especialidad..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {uniqueSpecialties.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="phoneNumber" render={({ field }) => ( <FormItem><FormLabel>Número de Teléfono (con indicativo)</FormLabel><FormControl><Input placeholder="+573001234567" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {specialist ? 'Guardar Cambios' : 'Añadir Especialista'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function SpecialistsPage() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [specialists, setSpecialists] = useState<Specialist[]>([]);
    const [pendingStudies, setPendingStudies] = useState<StudyWithCompletedBy[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);

    const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const pendingCountsBySpecialty = useMemo(() => {
        const counts: Record<string, number> = {};
        pendingStudies.forEach(study => {
            const specialty = study.studies[0]?.modality;
            if (specialty) {
                counts[specialty] = (counts[specialty] || 0) + 1;
            }
        });
        return counts;
    }, [pendingStudies]);


    useEffect(() => {
        if (!authLoading && userProfile?.rol !== 'administrador') {
            router.push('/');
        }
    }, [userProfile, authLoading, router]);

    useEffect(() => {
        if (!userProfile || userProfile?.rol !== 'administrador') {
            setSpecialists([]);
            setPendingStudies([]);
            setLoading(false);
            return;
        }

        const unsubscribes: (() => void)[] = [];

        const specialistsQuery = query(collection(db, "specialists"), orderBy('name'));
        unsubscribes.push(onSnapshot(specialistsQuery, (snapshot) => {
            const data: Specialist[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Specialist));
            setSpecialists(data);
            setLoading(false);
        }, (err) => {
            if (err.code !== 'permission-denied') console.error("Error fetching specialists:", err);
            setLoading(false);
        }));

        const studiesQuery = query(collection(db, "studies"), where('status', '==', 'Pendiente'));
        unsubscribes.push(onSnapshot(studiesQuery, (snapshot) => {
            const studiesData = snapshot.docs.map(doc => doc.data() as StudyWithCompletedBy);
            const consultationStudies = studiesData.filter(study => {
                const modality = study.studies[0]?.modality;
                return modality && uniqueSpecialties.some(s => normalizeString(s) === normalizeString(modality));
            });
            setPendingStudies(consultationStudies);
        }, (err) => {
            if (err.code !== 'permission-denied') console.error("Error fetching pending studies:", err);
        }));
        
        return () => unsubscribes.forEach(unsub => unsub());
    }, [userProfile]);

    const handleSave = async (data: SpecialistFormData) => {
        const action = data.id ? updateSpecialistAction : addSpecialistAction;
        const result = await action(data as any);
        if (result.success) {
            toast({ title: `Especialista ${data.id ? 'actualizado' : 'añadido'}` });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };
    
    const handleDelete = async (id: string) => {
        const result = await deleteSpecialistAction(id);
        if (result.success) {
            toast({ title: 'Especialista Eliminado' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };
    
    const handleSendSummaries = async (specialistIds: string[]) => {
        let successCount = 0;
        let noPendingCount = 0;
        let errorCount = 0;
        let errorMessages: string[] = [];

        for (const id of specialistIds) {
            const specialist = specialists.find(s => s.id === id);
            if (specialist) {
                const result = await sendConsultationSummaryAction(specialist);
                
                if (result.success) {
                    if (result.messageSent) {
                        successCount++;
                    } else {
                        noPendingCount++;
                    }
                } else {
                    errorCount++;
                    errorMessages.push(`- ${specialist.name}: ${result.error}`);
                }
            }
        }
        
        let description = '';
        if (successCount > 0) description += `${successCount} mensajes puestos en cola. `;
        if (noPendingCount > 0) description += `${noPendingCount} especialistas sin pendientes. `;
        if (errorCount > 0) {
            description += `${errorCount} notificaciones fallaron.`;
        }

        if (description) {
            toast({ 
                title: 'Proceso de Notificación Finalizado', 
                description: (
                    <div className="text-xs w-full">
                        <p>{description.trim()}</p>
                        {errorMessages.length > 0 && (
                            <>
                                <p className="font-bold mt-2">Detalles de errores:</p>
                                <pre className="mt-1 w-full rounded-md bg-slate-950 p-2 font-mono text-white whitespace-pre-wrap">
                                    {errorMessages.join('\n')}
                                </pre>
                            </>
                        )}
                    </div>
                ),
                duration: errorCount > 0 ? 20000 : 5000,
                variant: errorCount > 0 ? 'destructive' : 'default',
            });
        }
    }

    if (authLoading || loading || userProfile?.rol !== 'administrador') {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <>
            <div className="container mx-auto py-6 space-y-6">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Resumen de Interconsultas Pendientes</CardTitle>
                            <CardDescription>Vista de la carga de trabajo pendiente por especialidad.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Especialidad</TableHead>
                                    <TableHead>Consultas Pendientes</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {Object.entries(pendingCountsBySpecialty).map(([specialty, count]) => {
                                    if(count === 0) return null;
                                    return (
                                        <TableRow key={specialty}>
                                            <TableCell className="font-medium">{specialty}</TableCell>
                                            <TableCell className="font-bold">{count}</TableCell>
                                        </TableRow>
                                    )
                                })}
                             </TableBody>
                        </Table>
                        {Object.values(pendingCountsBySpecialty).every(c => c === 0) && <p className="text-center text-muted-foreground py-8">No hay interconsultas pendientes.</p>}
                    </CardContent>
                 </Card>


                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Gestión de Especialistas</CardTitle>
                            <CardDescription>Añade, edita o elimina los datos de los especialistas.</CardDescription>
                        </div>
                        <Button onClick={() => { setEditingSpecialist(null); setIsDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4"/> Añadir Especialista
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Especialidad</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {specialists.map((spec) => (
                                    <TableRow key={spec.id}>
                                        <TableCell className="font-medium">{spec.name}</TableCell>
                                        <TableCell>{spec.specialty}</TableCell>
                                        <TableCell>{spec.phoneNumber}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingSpecialist(spec); setIsDialogOpen(true); }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(spec.id)}>Eliminar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {specialists.length === 0 && <p className="text-center text-muted-foreground py-8">No hay especialistas registrados.</p>}
                    </CardContent>
                </Card>
            </div>
            <SpecialistDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} specialist={editingSpecialist} onSave={handleSave} />
        </>
    );
}

