
"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { updateStudyAction } from '@/app/actions';
import type { Study } from '@/lib/types';
import { ALL_STUDIES } from '@/lib/studies-data';
import { ALL_CONSULTATIONS } from '@/lib/consultations-data';
import { usePathname } from 'next/navigation';
import { getModalityLabel, MODALITY_ORDER, normalizeModalityCode } from '@/lib/modality-labels';
import { PlusCircle } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  studies: z.array(studySchema).min(1, "Debe haber un estudio."),
  diagnosis: z.object({
    code: z.string().min(1, "Código de diagnóstico es requerido."),
    description: z.string().min(1, "La descripción del diagnóstico es requerida."),
  }),
});

type EditStudyFormData = z.infer<typeof formSchema>;

interface EditStudyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    study: Study | null;
}

const normalizeText = (text: string): string => {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
};

export function EditStudyDialog({ open, onOpenChange, study }: EditStudyDialogProps) {
    const { toast } = useToast();
    const pathname = usePathname();
    const firstInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const isConsultationsModule = pathname ? pathname.includes('/consultations') : false;
    const searchList = isConsultationsModule ? ALL_CONSULTATIONS : ALL_STUDIES;
    
        const resolveStudyModality = (item: { modality?: string; modalidad?: string; especialidad?: string }) =>
            normalizeModalityCode(item.modality || item.modalidad || item.especialidad);

        const groupedStudies = !isConsultationsModule
            ? (searchList as typeof ALL_STUDIES).reduce((acc, study) => {
                const key = resolveStudyModality(study);
                if (!acc[key]) acc[key] = [];
                acc[key].push(study);
                return acc;
                }, {} as Record<string, typeof ALL_STUDIES>)
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

    const form = useForm<EditStudyFormData>({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
    });

    const { fields: studyFields, append: appendStudy, remove: removeStudy } = useFieldArray({
        control: form.control,
        name: "studies",
    });

    useEffect(() => {
        if (study && open) {
            form.reset({
                patient: {
                    fullName: study.patient.fullName || '',
                    id: study.patient.id || '',
                    idType: study.patient.idType || '',
                    entidad: study.patient.entidad || '',
                    birthDate: study.patient.birthDate || '',
                    sex: study.patient.sex || '',
                },
                studies: study.studies.map(s => ({
                    cups: s.cups || '',
                    nombre: s.nombre || '',
                    modality: s.modality || '',
                    details: s.details || '',
                })),
                diagnosis: {
                    code: study.diagnosis.code || '',
                    description: study.diagnosis.description || '',
                },
            });
            setTimeout(() => firstInputRef.current?.focus(), 0);
        }
    }, [study, open, form]);

    const handleStudySelect = (selectedStudy: { cups: string; nombre: string; modality?: string; modalidad?: string; especialidad?: string }) => {
        const resolvedModality = resolveStudyModality(selectedStudy);
        appendStudy({
            cups: selectedStudy.cups,
            nombre: selectedStudy.nombre,
            modality: resolvedModality,
            details: '',
        });
        setAddModalOpen(false);
        setSearchTerm("");
    };

    const onSubmit = async (data: EditStudyFormData) => {
        if (!study) return;
        
        setLoading(true);
        try {
            await updateStudyAction(study.id, {
                patient: data.patient,
                studies: data.studies,
                diagnosis: data.diagnosis,
            } as any);
            toast({
                title: "Éxito",
                description: "Solicitud actualizada correctamente.",
                variant: "default",
            });
            onOpenChange(false);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Error al actualizar la solicitud.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            const form = (e.target as HTMLInputElement).form;
            if (form && form.elements) {
                const index = Array.prototype.indexOf.call(form, e.target);
                (form.elements[index + 1] as HTMLElement)?.focus();
            }
        }
    };

    if (!study) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[850px] p-0 rounded-3xl overflow-hidden border-none shadow-2xl" style={{overflow: 'visible', zIndex: 50}}>
                <div className="bg-white px-10 pt-10 pb-4">
                    <DialogHeader>
                        <DialogTitle className="font-black text-3xl uppercase tracking-tighter text-zinc-900" id="dialog-title">Editar Solicitud</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-zinc-500" id="dialog-desc">Actualiza los datos del paciente y los estudios solicitados.</DialogDescription>
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
                        <div className="max-h-[65vh] overflow-y-auto px-8 pb-8 space-y-6" style={{WebkitOverflowScrolling: 'touch'}} role="region" aria-label="Formulario principal">
                            {/* Datos del Paciente */}
                            <section className="bg-white rounded-[2rem] border-2 border-zinc-100 shadow-sm p-8 mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 block">Datos del Paciente</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="patient.fullName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Nombre Completo <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Nombre y apellidos..." {...field} ref={firstInputRef} />
                                            </FormControl>
                                            {form.formState.isSubmitted ? <FormMessage /> : null}
                                        </FormItem>
                                    )}/>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="patient.id" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">ID Paciente <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Número..." {...field} />
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
                                                <Input placeholder="EPS o aseguradora..." {...field} />
                                            </FormControl>
                                            {form.formState.isSubmitted ? <FormMessage /> : null}
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="patient.birthDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Fecha Nacimiento <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="DD/MM/AAAA" {...field} />
                                            </FormControl>
                                            {form.formState.isSubmitted ? <FormMessage /> : null}
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
                                                    <SelectItem value="FEMENINO">FEMENINO</SelectItem>
                                                    <SelectItem value="MASCULINO">MASCULINO</SelectItem>
                                                    <SelectItem value="OTRO / NO ESPECIFICA">OTRO / NO ESPECIFICA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}/>
                                </div>
                            </section>

                            {/* Estudios/Consultas */}
                            <section className="bg-white rounded-[2rem] border-2 border-zinc-100 shadow-sm p-8 mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 block">{isConsultationsModule ? 'Consultas Solicitadas' : 'Estudios Solicitados'}</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-14 justify-start text-left font-bold tracking-widest uppercase text-xs border-dashed border-2 border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-2xl"
                                    onClick={() => {
                                        setSearchTerm("");
                                        setAddModalOpen(true);
                                    }}
                                >
                                    <PlusCircle className="mr-2 h-4 w-4 text-yellow-600" />
                                    Añadir {isConsultationsModule ? 'consulta...' : 'estudio...'}
                                </Button>

                                {/* Modal de búsqueda de estudios */}
                                <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                                    <DialogContent className="sm:max-w-[800px]">
                                        <DialogHeader>
                                            <DialogTitle className="font-headline text-xl">Seleccionar {isConsultationsModule ? 'consulta' : 'estudio'}</DialogTitle>
                                        </DialogHeader>
                                        <div className="mb-4">
                                            <Input
                                                id="edit-study-search-input"
                                                name="edit-study-search"
                                                placeholder={`Buscar ${isConsultationsModule ? 'consulta' : 'estudio'} por nombre o CUPS...`}
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full"
                                                autoFocus
                                                aria-label={`Buscar ${isConsultationsModule ? 'consulta' : 'estudio'}`}
                                            />
                                        </div>
                                        <ScrollArea className="max-h-80 w-full rounded-md border border-yellow-300 bg-yellow-50 p-0">
                                            {!isConsultationsModule ? (
                                                groupedStudySections.length === 0 ? (
                                                    <div className="p-4 text-center text-muted-foreground">No se encontraron resultados.</div>
                                                ) : (
                                                    groupedStudySections.map((section) => (
                                                        <div key={section.modality}>
                                                            <div className="px-3 py-2 text-sm font-bold text-orange-700 uppercase tracking-wide bg-orange-100 sticky top-0">
                                                                {section.label}
                                                            </div>
                                                            {section.studies.map((item) => (
                                                                <button
                                                                    key={item.cups}
                                                                    type="button"
                                                                    onClick={() => handleStudySelect(item)}
                                                                    className="w-full text-left px-3 py-2 hover:bg-yellow-100 transition-colors border-b border-yellow-200 last:border-b-0"
                                                                >
                                                                    <div className="font-medium text-sm text-gray-900">{item.nombre}</div>
                                                                    <div className="text-xs text-gray-600">CUPS: {item.cups}</div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ))
                                                )
                                            ) : (
                                                searchList.filter(item =>
                                                    normalizeText(item.nombre).includes(normalizeText(searchTerm)) ||
                                                    item.cups.includes(searchTerm)
                                                ).length === 0 ? (
                                                    <div className="p-4 text-center text-muted-foreground">No se encontraron resultados.</div>
                                                ) : (
                                                    searchList.filter(item =>
                                                        normalizeText(item.nombre).includes(normalizeText(searchTerm)) ||
                                                        item.cups.includes(searchTerm)
                                                    ).map((item) => (
                                                        <button
                                                            key={item.cups}
                                                            type="button"
                                                            onClick={() => handleStudySelect(item)}
                                                            className="w-full text-left px-3 py-2 hover:bg-yellow-100 transition-colors border-b border-yellow-200 last:border-b-0"
                                                        >
                                                            <div className="font-medium text-sm text-gray-900">{item.nombre}</div>
                                                            <div className="text-xs text-gray-600">CUPS: {item.cups}</div>
                                                        </button>
                                                    ))
                                                )
                                            )}
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>

                                {/* Lista de estudios seleccionados */}
                                {studyFields.length > 0 && (
                                    <div className="mt-4 space-y-3">
                                        {studyFields.map((field, index) => (
                                            <div key={field.id} className="bg-blue-50 rounded-lg p-3 border border-blue-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm text-gray-900">{form.getValues(`studies.${index}.nombre`)}</div>
                                                    <div className="text-xs text-gray-600">CUPS: {form.getValues(`studies.${index}.cups`)}</div>
                                                </div>
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full md:w-auto">
                                                    <FormField control={form.control} name={`studies.${index}.details`} render={({ field }) => (
                                                        <FormItem className="w-full sm:w-64">
                                                            <FormLabel className="text-xs font-semibold text-blue-900">Observacion</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Detalles del estudio" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}/>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeStudy(index)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Diagnóstico */}
                            <section className="bg-white rounded-[2rem] border-2 border-zinc-100 shadow-sm p-8">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 block">Diagnóstico</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="diagnosis.code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Código ICD-10 <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: E11.9" {...field} />
                                            </FormControl>
                                            {form.formState.isSubmitted ? <FormMessage /> : null}
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="diagnosis.description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-1">Descripción <span className="text-red-500" title="Campo obligatorio">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Descripción del diagnóstico..." {...field} />
                                            </FormControl>
                                            {form.formState.isSubmitted ? <FormMessage /> : null}
                                        </FormItem>
                                    )}/>
                                </div>
                            </section>
                        </div>

                        {/* Footer con botones */}
                        <div className="flex justify-end gap-3 px-8 pb-8 pt-4 bg-white">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs border-2">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading || !form.formState.isValid} className="h-14 px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-xs">
                                {loading ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
