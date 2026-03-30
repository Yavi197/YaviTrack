"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Specialist, StudyWithCompletedBy } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addSpecialistAction, updateSpecialistAction, deleteSpecialistAction, sendConsultationSummaryAction } from '@/app/actions';
import { ALL_CONSULTATIONS } from '@/lib/consultations-data';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Pencil, Trash2, Stethoscope, Phone, Send, Activity } from 'lucide-react';
import { NotifyDialog } from '@/components/app/notify-dialog';
import { cn } from '@/lib/utils';

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

function SpecialistDialog({ open, onOpenChange, specialist, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  specialist: Specialist | null; onSave: (data: SpecialistFormData) => Promise<void>;
}) {
  const form = useForm<SpecialistFormData>({ resolver: zodResolver(specialistSchema) });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (specialist) {
      form.reset({ id: specialist.id, name: specialist.name, specialty: specialist.specialty, phoneNumber: specialist.phoneNumber });
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
      <DialogContent className="rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
        <div className="bg-zinc-900 px-8 py-6">
          <DialogTitle className="text-white font-black">{specialist ? 'Editar Especialista' : 'Añadir Nuevo Especialista'}</DialogTitle>
          <p className="text-zinc-500 text-xs font-medium mt-1">Completa los datos del especialista</p>
        </div>
        <div className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-zinc-600">Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Nombre Apellido" {...field}
                      className="h-12 bg-zinc-50 border-transparent rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="specialty" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-zinc-600">Especialidad</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 bg-zinc-50 border-transparent rounded-xl">
                        <SelectValue placeholder="Seleccionar especialidad..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {uniqueSpecialties.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-zinc-600">Número de Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="+573001234567" {...field}
                      className="h-12 bg-zinc-50 border-transparent rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl font-bold text-zinc-500">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}
                  className="flex-[2] h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (specialist ? 'Guardar Cambios' : 'Añadir')}
                </Button>
              </div>
            </form>
          </Form>
        </div>
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
      if (specialty) counts[specialty] = (counts[specialty] || 0) + 1;
    });
    return counts;
  }, [pendingStudies]);

  useEffect(() => {
    if (!authLoading && userProfile?.rol !== 'administrador') router.push('/');
  }, [userProfile, authLoading, router]);

  useEffect(() => {
    if (!userProfile || userProfile?.rol !== 'administrador') { setSpecialists([]); setPendingStudies([]); setLoading(false); return; }
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db, "specialists"), orderBy('name')), (snap) => {
      setSpecialists(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Specialist)));
      setLoading(false);
    }, (err) => { if (err.code !== 'permission-denied') console.error(err); setLoading(false); }));
    unsubs.push(onSnapshot(query(collection(db, "studies"), where('status', '==', 'Pendiente')), (snap) => {
      const data = snap.docs.map(doc => doc.data() as StudyWithCompletedBy);
      setPendingStudies(data.filter(study => {
        const mod = study.studies[0]?.modality;
        return mod && uniqueSpecialties.some(s => normalizeString(s) === normalizeString(mod));
      }));
    }, (err) => { if (err.code !== 'permission-denied') console.error(err); }));
    return () => unsubs.forEach(u => u());
  }, [userProfile]);

  const handleSave = async (data: SpecialistFormData) => {
    const action = data.id ? updateSpecialistAction : addSpecialistAction;
    const result = await action(data as any);
    if (result.success) toast({ title: `Especialista ${data.id ? 'actualizado' : 'añadido'}` });
    else toast({ variant: 'destructive', title: 'Error', description: result.error });
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSpecialistAction(id);
    if (result.success) toast({ title: 'Especialista Eliminado' });
    else toast({ variant: 'destructive', title: 'Error', description: result.error });
  };

  const handleSendSummaries = async (specialistIds: string[]) => {
    let successCount = 0, noPendingCount = 0, errorCount = 0, errorMessages: string[] = [];
    for (const id of specialistIds) {
      const spec = specialists.find(s => s.id === id);
      if (spec) {
        const result = await sendConsultationSummaryAction(spec);
        if (result.success) { if (result.messageSent) successCount++; else noPendingCount++; }
        else { errorCount++; errorMessages.push(`- ${spec.name}: ${result.error}`); }
      }
    }
    let desc = '';
    if (successCount > 0) desc += `${successCount} mensajes enviados. `;
    if (noPendingCount > 0) desc += `${noPendingCount} especialistas sin pendientes. `;
    if (errorCount > 0) desc += `${errorCount} fallaron.`;
    if (desc) toast({ title: 'Notificación Finalizada', description: desc.trim(), variant: errorCount > 0 ? 'destructive' : 'default' });
  };

  if (authLoading || loading || userProfile?.rol !== 'administrador') {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300" /></div>;
  }

  const totalPending = Object.values(pendingCountsBySpecialty).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="py-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg"><Stethoscope className="h-4 w-4 text-blue-600" /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Administración</span>
            </div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Especialistas</h1>
            <p className="text-zinc-500 font-medium mt-1">Gestiona los médicos especialistas y sus interconsultas pendientes.</p>
          </div>
          <Button onClick={() => { setEditingSpecialist(null); setIsDialogOpen(true); }}
            className="h-11 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black shadow-xl transition-all active:scale-95">
            <Plus className="h-4 w-4 mr-2" /> Añadir
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Total Especialistas</p>
            <p className="text-4xl font-black text-zinc-900">{specialists.length}</p>
          </div>
          <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Interconsultas Pendientes</p>
            <p className={cn("text-4xl font-black", totalPending > 0 ? "text-amber-500" : "text-zinc-900")}>{totalPending}</p>
          </div>
        </div>

        {/* Pending by specialty */}
        {Object.keys(pendingCountsBySpecialty).length > 0 && (
          <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-50 flex items-center gap-3">
              <Activity className="h-4 w-4 text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Carga por especialidad</p>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(pendingCountsBySpecialty).filter(([,c]) => c > 0).map(([specialty, count]) => (
                <div key={specialty} className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                  <p className="text-xs font-bold text-amber-800 truncate">{specialty}</p>
                  <span className="text-xs font-black text-amber-600 bg-amber-200/60 rounded-full px-2 py-0.5 ml-2 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Specialists table */}
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Directorio de Especialistas</p>
          </div>
          {specialists.length === 0 ? (
            <div className="py-16 text-center">
              <Stethoscope className="h-8 w-8 text-zinc-200 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">No hay especialistas registrados aún.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {specialists.map((spec) => (
                <div key={spec.id} className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Stethoscope className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{spec.name}</p>
                      <p className="text-xs text-zinc-400 font-medium">{spec.specialty}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1.5 text-zinc-500">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{spec.phoneNumber}</span>
                    </div>
                    {pendingCountsBySpecialty[spec.specialty] > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                        {pendingCountsBySpecialty[spec.specialty]} pend.
                      </span>
                    )}
                    <button onClick={() => { setEditingSpecialist(spec); setIsDialogOpen(true); }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl border-0 shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-black">¿Confirmar eliminación?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción es irreversible. Se eliminará a {spec.name}.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(spec.id)} className="rounded-xl bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <NotifyDialog specialists={specialists} onSend={handleSendSummaries} />
      </div>

      <SpecialistDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        specialist={editingSpecialist}
        onSave={handleSave}
      />
    </>
  );
}
