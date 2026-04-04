
"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createStudyAction } from '@/app/actions';
import type { OrderData, Study } from '@/lib/types';
import { ALL_STUDIES } from '@/lib/studies-data';
import { ALL_CONSULTATIONS } from '@/lib/consultations-data';
import { usePathname } from 'next/navigation';
import { getModalityLabel, normalizeModalityCode, MODALITY_ORDER } from '@/lib/modality-labels';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trash2, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '../ui/scroll-area';
import { TargetModule } from '@/lib/types';
import { Check, UserPlus, ClipboardList, Stethoscope } from 'lucide-react';


const studySchema = z.object({
  nombre: z.string().min(1, "Nombre del estudio es requerido"),
  cups: z.string().min(1, "CUPS es requerido"),
  modality: z.string().min(1, "Modalidad es requerida"),
  details: z.string().optional(),
});

const formSchema = z.object({
  patient: z.object({
    fullName: z.string().min(1, "Nombre del paciente es requerido."),
    id: z.string().min(1, "ID del paciente es requerido."),
    idType: z.string().optional(),
    entidad: z.string().min(1, "Entidad es requerida."),
    birthDate: z.string().min(1, "Fecha de nacimiento es requerida."),
    sex: z.string().optional(),
  }),
  studies: z.array(studySchema).min(1, "Debe agregar al menos un estudio."),
  diagnosis: z.object({
    code: z.string().min(1, "Código de diagnóstico es requerido."),
    description: z.string().min(1, "La descripción del diagnóstico es requerida."),
  }),
});

export type StudyFormData = z.infer<typeof formSchema>;

interface StudyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Partial<Study>;
    mode: 'manual' | 'edit';
    onCreate?: (data: OrderData) => Promise<{ success: boolean; error?: string; studyCount?: number }>;
}

export function StudyDialog({ open, onOpenChange, initialData, mode, onCreate }: StudyDialogProps) {
        const firstInputRef = useRef<HTMLInputElement>(null);
    const { currentProfile } = useAuth();
    const { toast } = useToast();
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [targetModule, setTargetModule] = useState<TargetModule>('imagenes');

    const isConsultationsModule = pathname ? pathname.includes('/consultations') : false;
    // Agrupar estudios por modalidad para una selección más visual
    const searchList = isConsultationsModule ? ALL_CONSULTATIONS : ALL_STUDIES;
    const groupedStudies = !isConsultationsModule
        ? searchList.reduce((acc, study) => {
            const key = normalizeModalityCode((study as any).modalidad || (study as any).especialidad);
            if (!acc[key]) acc[key] = [];
            acc[key].push(study);
            return acc;
        }, {} as Record<string, any[]>)
        : null;

    const groupedStudySections = useMemo(() => {
        if (!groupedStudies) return [] as { modality: string; label: string; studies: typeof ALL_STUDIES }[];
        const searchValue = searchTerm.trim().toLowerCase();

        const buildSection = (modality: string, studies: typeof ALL_STUDIES | undefined) => {
            if (!studies || !studies.length) return null;
            const filtered = studies.filter(s =>
                s.nombre.toLowerCase().includes(searchValue) ||
                s.cups.toLowerCase().includes(searchValue)
            );
            if (!filtered.length) return null;
            return {
                modality,
                label: getModalityLabel(modality),
                studies: filtered,
            };
        };

        const orderedSections = MODALITY_ORDER.map(modality => buildSection(modality, groupedStudies[modality])).filter(
            (section): section is { modality: string; label: string; studies: typeof ALL_STUDIES } => Boolean(section)
        );

        const extraSections = Object.entries(groupedStudies)
            .filter(([modality]) => !MODALITY_ORDER.includes(modality))
            .map(([modality, studies]) => buildSection(modality, studies))
            .filter((section): section is { modality: string; label: string; studies: typeof ALL_STUDIES } => Boolean(section))
            .sort((a, b) => a.label.localeCompare(b.label));

        return [...orderedSections, ...extraSections];
    }, [groupedStudies, searchTerm]);

    const form = useForm<StudyFormData>({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
        shouldFocusError: true,
    });
    
    useEffect(() => {
        if (open && mode === 'manual') {
            if (initialData) {
                const defaults: Partial<StudyFormData> = {
                    patient: {
                        fullName: initialData.patient?.fullName || '',
                        id: initialData.patient?.id || '',
                        idType: initialData.patient?.idType || '',
                        entidad: initialData.patient?.entidad || '',
                        birthDate: initialData.patient?.birthDate || '',
                        sex: initialData.patient?.sex || '',
                    },
                    studies: initialData.studies || [],
                    diagnosis: initialData.diagnosis || { code: '', description: '' },
                };
                form.reset(defaults);
            }
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
        }
    }, [initialData, open, form, mode]);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "studies"
    });

    const handleStudySelect = (study: { cups: string, nombre: string, modalidad?: string, especialidad?: string }) => {
        const resolvedModality = isConsultationsModule
            ? (study.modalidad || study.especialidad || 'OTROS')
            : normalizeModalityCode(study.modalidad || study.especialidad);

        append({
            cups: study.cups,
            nombre: study.nombre,
            modality: resolvedModality,
            details: ''
        });
        setAddModalOpen(false);
        setSearchTerm("");
    };
    
    const onSubmit = async (data: StudyFormData) => {
        if (mode === 'edit') return; // Should be handled by EditStudyDialog

        setLoading(true);
        const orderData: OrderData = {
           ...data,
           targetModule: targetModule as any
        } as any;

        // Ensure we only pass a PLAIN object for userProfile (no Timestamps from Firebase)
        const sanitizedProfile = currentProfile ? {
            uid: currentProfile.uid,
            nombre: currentProfile.nombre,
            rol: currentProfile.rol,
            servicioAsignado: currentProfile.servicioAsignado,
            subServicioAsignado: currentProfile.subServicioAsignado,
            operadorActivo: currentProfile.operadorActivo,
        } : null;

        const result = onCreate 
            ? await onCreate(orderData) 
            : await createStudyAction(orderData, sanitizedProfile as any);

        if (result.success) {
            toast({ 
                title: onCreate ? 'Registro Creado' : 'Solicitudes Creadas', 
                description: onCreate 
                    ? 'El registro se ha guardado correctamente.' 
                    : `${(result as any).studyCount} nuevas solicitudes han sido registradas.` 
            });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        
        setLoading(false);
    };

    // Robust Enter key handler: Only allow Enter to advance focus between input fields, never trigger buttons or modals
    const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter') {
            const target = e.target as HTMLElement;
            // Only advance focus if the target is an input and not a button or textarea
            if (target.tagName === 'INPUT' && target.getAttribute('type') !== 'submit') {
                e.preventDefault();
                const form = (target as HTMLInputElement).form;
                if (form && form.elements) {
                    const index = Array.prototype.indexOf.call(form, target);
                    // Find next input (skip buttons)
                    for (let i = index + 1; i < form.elements.length; i++) {
                        const el = form.elements[i];
                        if (el.tagName === 'INPUT' && el.getAttribute('type') !== 'submit') {
                            (el as HTMLElement).focus();
                            break;
                        }
                    }
                }
                // If form is null, do nothing (just prevent default)
            } else {
                // Block Enter for all other elements (especially buttons, textareas, etc)
                e.preventDefault();
            }
        }
    };

    useEffect(() => {
        if (open && mode === 'manual') {
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
        }
    }, [open, mode]);

    if (mode === 'edit') {
        return null; // Edit functionality is now in EditStudyDialog
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[850px] p-0 rounded-3xl overflow-hidden border-none shadow-2xl" style={{overflow: 'visible', zIndex: 50}}>
                <div className="bg-white px-10 pt-10 pb-4">
                    <DialogHeader>
                        <DialogTitle className="font-black text-3xl uppercase tracking-tighter text-zinc-900" id="dialog-title">Nueva Solicitud Manual</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-zinc-500" id="dialog-desc">Completa el formulario para registrar una o más solicitudes de estudio.</DialogDescription>
                    </DialogHeader>
                </div>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-0"
                        onKeyDown={handleFormKeyDown}
                        aria-labelledby="dialog-title"
                        aria-describedby="dialog-desc"

                        tabIndex={0}
                    >
                        <div className="max-h-[65vh] overflow-y-auto px-8 pb-8 space-y-6" style={{WebkitOverflowScrolling: 'touch'}} onKeyDown={e => {
                            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
                                // Solo avanza el foco, nunca envía el formulario
                                e.preventDefault();
                                const form = (e.target as HTMLInputElement).form;
                                if (form && form.elements) {
                                    const index = Array.prototype.indexOf.call(form, e.target);
                                    (form.elements[index + 1] as HTMLElement)?.focus();
                                }
                                // Si form es null, solo previene el default y no hace nada más
                            }
                        }} role="region" aria-label="Formulario principal">
                            <section className="bg-white rounded-[2rem] border-2 border-zinc-100 shadow-sm p-8 mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 block">Datos del Paciente</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="patient.fullName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Nombre Completo <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Nombre y apellidos..."
                                                    {...field}
                                                    ref={firstInputRef}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}/>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="patient.id" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">ID Paciente <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Número..."
                                                        {...field}
                                                    />
                                                </FormControl>
                                                {form.formState.isSubmitted ? <FormMessage /> : null}
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="patient.idType" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Tipo ID</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="CC, TI, RC..." {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}/>
                                    </div>
                                    <FormField control={form.control} name="patient.entidad" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Entidad (EPS) <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="EPS o aseguradora..."
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="patient.birthDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Fecha Nacimiento <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="DD/MM/AAAA"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="patient.sex" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Sexo</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona sexo" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="F">FEMENINO</SelectItem>
                                                    <SelectItem value="M">MASCULINO</SelectItem>
                                                    <SelectItem value="O">OTRO / NO ESPECIFICA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}/>
                                </div>
                            </section>
                            <section className="bg-white rounded-[2rem] border-2 border-zinc-100 shadow-sm p-8 mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 block">{isConsultationsModule ? 'Consultas Solicitadas' : 'Estudios Solicitados'}</h3>
                                <Button
                                    variant="outline"
                                    className="w-full h-14 justify-start text-left font-bold tracking-widest uppercase text-xs border-dashed border-2 border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-2xl"
                                    tabIndex={-1}
                                    onClick={() => {
                                        setSearchTerm("");
                                        setAddModalOpen(true);
                                    }}
                                >
                                    <PlusCircle className="mr-2 h-4 w-4 text-yellow-600" />
                                    Añadir {isConsultationsModule ? 'consulta...' : 'estudio...'}
                                </Button>
                                <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                                    <DialogContent className="sm:max-w-[800px]">
                                        <DialogHeader>
                                            <DialogTitle className="font-headline text-xl">Seleccionar {isConsultationsModule ? 'consulta' : 'estudio'}</DialogTitle>
                                            <DialogDescription className="sr-only">Busca y selecciona un estudio médico por nombre o código CUPS.</DialogDescription>
                                        </DialogHeader>
                                        <div className="mb-4">
                                            <Input
                                                id="study-search-input"
                                                name="study-search"
                                                placeholder={`Buscar ${isConsultationsModule ? 'consulta' : 'estudio'} por nombre o CUPS...`}
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full"
                                                autoFocus
                                                aria-label={`Buscar ${isConsultationsModule ? 'consulta' : 'estudio'}`}
                                            />
                                        </div>
                                        <div style={{maxHeight: 320, overflowY: 'auto', borderRadius: 12, border: '1px solid #fbbf24', background: '#f8fafc', boxShadow: '0 2px 8px #fbbf2433'}}>
                                            {!isConsultationsModule ? (
                                                groupedStudySections.length === 0 ? (
                                                    <div className="p-4 text-center text-muted-foreground">No se encontraron resultados.</div>
                                                ) : (
                                                    groupedStudySections.map((section) => (
                                                        <div key={section.modality} className="mb-2">
                                                            <div className="px-3 py-1 text-sm font-bold text-orange-700 uppercase tracking-wide bg-orange-100 rounded-t">
                                                                {section.label}
                                                            </div>
                                                            {section.studies.map((item) => (
                                                                <button
                                                                    key={item.cups}
                                                                    type="button"
                                                                    onClick={() => handleStudySelect(item)}
                                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-200 rounded border-b border-gray-200"
                                                                >
                                                                    <span className="font-mono text-xs text-orange-700 bg-orange-100 rounded px-2 py-1" style={{minWidth: '56px', display: 'inline-block', textAlign: 'center'}}>{item.cups}</span>
                                                                    <span className="font-semibold text-base text-gray-800">{item.nombre}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ))
                                                )
                                            ) : (
                                                searchList.filter(s =>
                                                    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    s.cups.toLowerCase().includes(searchTerm.toLowerCase())
                                                ).length === 0 ? (
                                                    <div className="p-4 text-center text-muted-foreground">No se encontraron resultados.</div>
                                                ) : (
                                                    searchList.filter(s =>
                                                        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                        s.cups.toLowerCase().includes(searchTerm.toLowerCase())
                                                    ).map((item) => (
                                                        <button
                                                            key={item.cups}
                                                            type="button"
                                                            onClick={() => handleStudySelect(item)}
                                                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-blue-100 rounded"
                                                        >
                                                            <span className="font-mono text-xs text-gray-700 bg-gray-100 rounded px-2 py-1">{item.cups}</span>
                                                            <span className="font-semibold text-sm text-gray-900">{item.nombre}</span>
                                                            <span className="ml-2 text-xs text-blue-600 font-bold">{(item as any).modality || (item as any).modalidad || (item as any).especialidad}</span>
                                                        </button>
                                                    ))
                                                )
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <div className="space-y-2 mt-4">
                                    {fields.map((item, index) => (
                                        <div key={item.id} className="flex items-start gap-2 p-2 border rounded-lg bg-blue-50">
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm leading-tight text-blue-900">{item.cups} - {item.nombre}</p>
                                                <p className="text-xs text-blue-700 font-bold">{getModalityLabel(item.modality)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FormField control={form.control} name={`studies.${index}.details`} render={({ field }) => ( 
                                                    <FormItem className="w-[180px]">
                                                        <FormControl><Input id={`details-${index}`} type="text" placeholder="Detalles (Opcional)" {...field} className="h-8 text-xs" aria-label="Detalles adicionales" /></FormControl>
                                                        {form.formState.isSubmitted ? <FormMessage /> : null}
                                                    </FormItem> 
                                                )}/>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 shrink-0">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                            <section className="bg-white rounded-[2rem] border-2 border-zinc-100 shadow-sm p-8">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 block">Diagnóstico</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="diagnosis.code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Código CIE-10 <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Ej: I639"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="diagnosis.description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Descripción Diagnóstico <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Descripción del diagnóstico..."
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}/>
                                </div>
                            </section>
                        </div>
                        <div className="px-8 pb-4">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 px-1">¿A dónde enviar esta solicitud?</p>
                            <div className="grid grid-cols-3 rounded-2xl overflow-hidden border-2 border-zinc-100 shadow-sm">
                                {[
                                    { id: 'imagenes', label: 'SOLICITUD', icon: <UserPlus className="h-4 w-4" />, color: 'zinc' },
                                    { id: 'remisiones', label: 'REMISIÓN', icon: <ClipboardList className="h-4 w-4" />, color: 'blue' },
                                    { id: 'consultas', label: 'CONSULTA', icon: <Stethoscope className="h-4 w-4" />, color: 'emerald' }
                                ].map((dest) => {
                                    const isActive = targetModule === dest.id;
                                    return (
                                        <button
                                            key={dest.id}
                                            type="button"
                                            onClick={() => setTargetModule(dest.id as TargetModule)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-1.5 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-r-2 border-zinc-100 last:border-0",
                                                isActive 
                                                    ? "bg-zinc-900 text-white shadow-inner" 
                                                    : "bg-white text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-xl transition-colors", isActive ? "bg-white/10" : "bg-zinc-100/50")}>
                                                {dest.icon}
                                            </div>
                                            <span>{dest.label}</span>
                                            {isActive && <Check className="h-3 w-3 mt-0.5 text-yellow-400 animate-in zoom-in-50 duration-300" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <DialogFooter className="pt-2 px-8 pb-8">
                            <Button
                                type="submit"
                                disabled={loading || !form.formState.isValid || fields.length === 0}
                                className={cn(
                                    "w-full text-xs py-8 font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]",
                                    targetModule === 'remisiones' ? "bg-blue-600 hover:bg-blue-700 text-white" :
                                    targetModule === 'consultas' ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                                    "bg-zinc-900 hover:bg-zinc-800 text-white"
                                )}
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                                    <span className="flex items-center gap-2">
                                        {targetModule === 'imagenes' ? 'CREAR SOLICITUD' :
                                         targetModule === 'remisiones' ? 'CREAR REMISIÓN' : 'CREAR CONSULTA'}
                                        · {fields.length} {fields.length === 1 ? (isConsultationsModule ? 'CONSULTA' : 'ESTUDIO') : (isConsultationsModule ? 'CONSULTAS' : 'ESTUDIOS')}
                                    </span>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
