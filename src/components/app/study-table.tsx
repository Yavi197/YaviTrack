
"use client"

import * as React from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Edit, XCircle, FileText, Search, Calendar as CalendarIcon, AlertTriangle, CheckCircle, Ban, ChevronsUp, ChevronsDown, Trash2, Download, Loader2, Check, RotateCcw, Beaker, Droplets, Minus, Plus, User, Building, Fingerprint, CalendarDays, Stethoscope, Briefcase, FileHeart, FileQuestion, FilePlus2, FileCheck, X, Mail, Bed, Bell, Mic, FileUp, Play, StopCircle, CornerDownLeft, Clipboard } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';

import type { Study, UserProfile, StudyStatus, GeneralService, SubServiceArea, StudyWithCompletedBy, ContrastType, InventoryItem, ConsumedItem, Specialist } from '@/lib/types';
import { GeneralServices, Modalities, SubServiceAreas } from '@/lib/types';
import { ALL_CONSULTATIONS } from '@/lib/consultations-data';
import { reportTemplates } from '@/lib/report-templates';
import { epsEmailMap } from '@/lib/eps-data';
import { updateStudyStatusAction, cancelStudyAction, deleteStudyAction, updateStudyServiceAction, setStudyContrastAction, getRadiologistOperatorsAction, getInventoryItemsAction, extractReportTextAction, saveReportDataAction, callPatientAction, updateStudyTurnNumberAction, updateStudyBedNumberAction, transcribeAudioAction } from '@/app/actions';
import { handleServerActionError } from '@/lib/client-safe-action';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '../ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';
import { cn, getAgeFromBirthDate, toDateValue } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/context/auth-context';
import { ScrollArea } from '../ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SyringeIcon } from '../icons/syringe-icon';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent as DialogPrimitiveContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Textarea } from '../ui/textarea';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem } from '../ui/form';
import { DateRangePicker } from '../ui/date-range-picker';
import { ModalityIcon } from '../icons/modality-icon';

interface StudyTableProps {
  studies: StudyWithCompletedBy[];
  userProfile: UserProfile | null;
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
  activeStatusFilters: Study['status'][];
  setActiveStatusFilters: (status: StudyStatus) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSearch: (date?: DateRange) => void;
  onClearSearch: () => void;
  isSearching: boolean;
  isSearchActive: boolean;
  isSummaryVisible: boolean;
  setIsSummaryVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  highlightedStudies?: Set<string>;
  onEditStudy: (study: Study) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  onAssignSpecialist?: (study: Study) => void;
  specialists?: Specialist[];
}

function SelectOperatorDialog({ onConfirm, children }: { onConfirm: (operator: string) => void; children: React.ReactNode; }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [operators, setOperators] = React.useState<string[]>([]);
    const [selectedOperator, setSelectedOperator] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

    React.useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);
    (async () => {
      try {
        const ops = await getRadiologistOperatorsAction();
        if (isMounted) {
          setOperators(ops);
        }
      } catch (error) {
        handleServerActionError({ error, toast, actionLabel: 'la carga de operadores' });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isOpen, toast]);

    const handleConfirm = () => {
        if (selectedOperator) {
            onConfirm(selectedOperator);
            setIsOpen(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Seleccionar Radiólogo</AlertDialogTitle>
                    <AlertDialogDescription>
                        Por favor, seleccione el radiólogo que realizó este estudio para continuar.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="animate-spin" />
                        </div>
                    ) : (
                        <RadioGroup
                            value={selectedOperator ?? undefined}
                            onValueChange={setSelectedOperator}
                            className="flex flex-col gap-3"
                        >
                            {operators.map((op) => (
                                <div key={op} className="flex items-center space-x-3 p-3 border rounded-md has-[:checked]:bg-accent has-[:checked]:border-primary">
                                    <RadioGroupItem value={op} id={`op-${op}`} />
                                    <Label htmlFor={`op-${op}`} className="text-base font-medium w-full cursor-pointer">
                                        {op}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm} disabled={!selectedOperator || loading}>
                        Confirmar y Completar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function SelectSpecialistDialog({ study, specialists, onConfirm, children }: { study: Study; specialists: Specialist[]; onConfirm: (specialistId: string, specialistName: string) => void; children: React.ReactNode; }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedSpecialist, setSelectedSpecialist] = React.useState<Specialist | null>(null);

    const filteredSpecialists = React.useMemo(() => {
        const specialty = study.studies[0]?.modality;
        if (!specialty || !specialists) return [];
        return specialists.filter(s => s.specialty === specialty);
    }, [study, specialists]);

    const handleConfirm = () => {
        if (selectedSpecialist) {
            onConfirm(selectedSpecialist.id, selectedSpecialist.name);
            setIsOpen(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Asignar Especialista</AlertDialogTitle>
                    <AlertDialogDescription>
                        Seleccione el especialista que realizó la interconsulta para completarla.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <RadioGroup
                        value={selectedSpecialist?.id ?? undefined}
                        onValueChange={(id) => setSelectedSpecialist(filteredSpecialists.find(s => s.id === id) || null)}
                        className="flex flex-col gap-3"
                    >
                        {filteredSpecialists.length > 0 ? filteredSpecialists.map((spec) => (
                            <div key={spec.id} className="flex items-center space-x-3 p-3 border rounded-md has-[:checked]:bg-accent has-[:checked]:border-primary">
                                <RadioGroupItem value={spec.id} id={`spec-${spec.id}`} />
                                <Label htmlFor={`spec-${spec.id}`} className="text-base font-medium w-full cursor-pointer">
                                    {spec.name}
                                </Label>
                            </div>
                        )) : (
                            <p className="text-sm text-muted-foreground text-center">No hay especialistas registrados para esta área.</p>
                        )}
                    </RadioGroup>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm} disabled={!selectedSpecialist}>
                        Confirmar y Completar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function EditServiceDialog({ study, children }: { study: Study; children: React.ReactNode }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [service, setService] = React.useState<GeneralService>(study.service);
    const [subService, setSubService] = React.useState<SubServiceArea>(study.subService);
    const [loading, setLoading] = React.useState(false);

    const handleServiceChange = (newService: GeneralService) => {
        setService(newService);
        // Reset subService when service changes
        setSubService(SubServiceAreas[newService][0]);
    };
    
    const handleSave = async () => {
        setLoading(true);
      try {
        const result = await updateStudyServiceAction(study.id, service, subService);
        if (result.success) {
          toast({ title: 'Servicio Actualizado', description: 'El servicio del estudio ha sido cambiado.' });
          setIsOpen(false);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
      } catch (error) {
        if (!handleServerActionError({ error, toast, actionLabel: 'la actualización del servicio' })) {
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el servicio.' });
        }
      } finally {
        setLoading(false);
      }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Editar Ubicación del Paciente</AlertDialogTitle>
                    <AlertDialogDescription>
                        Seleccione el nuevo servicio y sub-servicio para esta solicitud.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Servicio General</Label>
                        <Select value={service} onValueChange={(v) => handleServiceChange(v as GeneralService)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un servicio" />
                            </SelectTrigger>
                            <SelectContent>
                                {GeneralServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label>Sub-Servicio</Label>
                        <Select value={subService} onValueChange={(v) => setSubService(v as SubServiceArea)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un sub-servicio" />
                            </SelectTrigger>
                            <SelectContent>
                                {SubServiceAreas[service].map(ss => <SelectItem key={ss} value={ss}>{ss}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Cambios
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

const studyDoseSuggestions: Record<string, { kV: number; mA: number; timeMs: number }> = {
    'RADIOGRAFIA DE MANO': { kV: 48, mA: 1.5, timeMs: 10 },
    'RADIOGRAFIA PARA DETECTAR EDAD OSEA [CARPOGRAMA]': { kV: 48, mA: 1.5, timeMs: 10 },
    'RADIOGRAFIA DE PUÁ‘O O MUÁ‘ECA': { kV: 48, mA: 1.5, timeMs: 10 },
    'RADIOGRAFIA DE ANTEBRAZO': { kV: 52, mA: 2, timeMs: 10 },
    'RADIOGRAFIA DE CODO': { kV: 52, mA: 2, timeMs: 10 },
    'RADIOGRAFIA DE HUMERO': { kV: 70, mA: 7, timeMs: 10 },
    'RADIOGRAFIA DE HOMBRO': { kV: 70, mA: 7, timeMs: 10 },
    'RADIOGRAFIA DE PIE (AP, LATERAL Y OBLICUA)': { kV: 48, mA: 1.8, timeMs: 10 },
    'RADIOGRAFIA DE CALCANEO (AXIAL Y LATERAL)': { kV: 50, mA: 2, timeMs: 10 },
    'RADIOGRAFIA DE PIERNA (AP, LATERAL)': { kV: 54, mA: 2.8, timeMs: 10 },
    'RADIOGRAFIA DE RODILLA (AP, LATERAL)': { kV: 56, mA: 3.5, timeMs: 10 },
    'RADIOGRAFIA DE FEMUR (AP, LATERAL)': { kV: 63, mA: 5, timeMs: 10 },
    'RADIOGRAFIA DE CADERA O ARTICULACION COXO-FEMORAL (AP, LATERAL)': { kV: 74, mA: 24, timeMs: 10 },
    'RADIOGRAFIA DE ARTICULACION TEMPOROMAXILAR [ATM]': { kV: 70, mA: 25, timeMs: 10 },
    'RADIOGRAFIA DE CARA (PERFILOGRAMA)': { kV: 70, mA: 6, timeMs: 10 },
    'RADIOGRAFIA DE COLUMNA CERVICAL': { kV: 73, mA: 7, timeMs: 10 },
    'RADIOGRAFIA DE COLUMNA TORACICA': { kV: 78, mA: 24, timeMs: 10 },
    'RADIOGRAFIA DE COLUMNA LUMBOSACRA': { kV: 80, mA: 55, timeMs: 10 },
    'RADIOGRAFIA DE SACRO COCCIX': { kV: 80, mA: 60, timeMs: 10 },
    'RADIOGRAFIA DE TORAX (P.A. O A.P. Y LATERAL...)': { kV: 80, mA: 5, timeMs: 10 },
    'RADIOGRAFIA DE REJA COSTAL': { kV: 85, mA: 8, timeMs: 10 },
    'RADIOGRAFIA DE CLAVICULA': { kV: 70, mA: 7, timeMs: 10 },
    'RADIOGRAFIA DE ESTERNON': { kV: 76, mA: 17, timeMs: 10 },
    'RADIOGRAFIA DE CRANEO SIMPLE': { kV: 70, mA: 20, timeMs: 10 },
    'RADIOGRAFIA DE HUESOS NASALES': { kV: 50, mA: 4, timeMs: 10 },
    'RADIOGRAFIA DE SENOS PARANASALES': { kV: 70, mA: 6, timeMs: 10 },
    'RADIOGRAFIA DE ARCO CIGOMATICO': { kV: 70, mA: 28, timeMs: 10 },
    'RADIOGRAFIA DE ABDOMEN SIMPLE': { kV: 78, mA: 32, timeMs: 10 },
    'RADIOGRAFIA PARA MEDICION DE MIEMBROS INFERIORES [ESTUDIO DE FARILL...]': { kV: 70, mA: 15, timeMs: 10 },
};


type CompletionParams = {
    kV?: number;
    mA?: number;
    timeMs?: number;
    ctdi?: number;
    dlp?: number;
    consumedItems?: ConsumedItem[];
    contrastAdministeredMl?: number;
};

const abbocathSchema = z.object({
  id: z.string().min(1, 'Debe seleccionar un calibre.'),
  name: z.string(),
  amount: z.coerce.number().min(1, 'Debe ser > 0'),
});

const completionSchema = z.object({
  kV: z.string().optional(),
  mA: z.string().optional(),
  timeMs: z.string().optional(),
  ctdi: z.string().optional(),
  dlp: z.string().optional(),
  contrastAdministeredMl: z.string().optional(),
  abbocaths: z.array(abbocathSchema).optional(),
  jeringaAmount: z.string().optional(),
  extensionAmount: z.string().optional(),
});
type CompletionFormData = z.infer<typeof completionSchema>;

function CompletionDialog({ study, onConfirm, children }: { study: Study; onConfirm: (params: CompletionParams) => void; children: React.ReactNode; }) {
    const studyName = study.studies[0]?.nombre || '';
    const modality = study.studies[0]?.modality;
    const isContrastedIV = study.contrastType === 'IV';
    const showSupplyRegistration = isContrastedIV && study.service === 'C.EXT';
    const suggestion = studyDoseSuggestions[studyName] || { kV: 70, mA: 10, timeMs: 10 };
  const { toast } = useToast();
    
    const [isOpen, setIsOpen] = React.useState(false);
    
    const [availableAbbocaths, setAvailableAbbocaths] = React.useState<InventoryItem[]>([]);
    const [contrastItem, setContrastItem] = React.useState<InventoryItem | null>(null);
    const [jeringaItem, setJeringaItem] = React.useState<InventoryItem | null>(null);
    const [extensionItem, setExtensionItem] = React.useState<InventoryItem | null>(null);

    const form = useForm<CompletionFormData>({
      resolver: zodResolver(completionSchema),
      defaultValues: {
        kV: String(suggestion.kV),
        mA: String(suggestion.mA),
        timeMs: String(suggestion.timeMs),
        ctdi: '',
        dlp: '',
        contrastAdministeredMl: '',
        abbocaths: [],
        jeringaAmount: '1',
        extensionAmount: '1',
      }
    });

    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "abbocaths",
    });

    const onOpenChange = (open: boolean) => {
        if(open) {
            form.reset({
                kV: String(suggestion.kV),
                mA: String(suggestion.mA),
                timeMs: String(suggestion.timeMs),
                ctdi: '',
                dlp: '',
                contrastAdministeredMl: '',
                abbocaths: [],
                jeringaAmount: '1',
                extensionAmount: '1',
            });
            
            const itemsToFetch = ["ABBOCATH", "JERINGA CON AGUJA", "EXTENSION PARA ANESTESIA"];
            (async () => {
              try {
                const items = await getInventoryItemsAction(itemsToFetch);
                const foundContrastItem = items.find(item => item.isContrast);
                setContrastItem(foundContrastItem || null);

                if (showSupplyRegistration) {
                  const abbocathItems = items.filter(item => item.name === "ABBOCATH");
                  setAvailableAbbocaths(abbocathItems);
                  setJeringaItem(items.find(i => i.name === "JERINGA CON AGUJA") || null);
                  setExtensionItem(items.find(i => i.name === "EXTENSION PARA ANESTESIA") || null);
                }
              } catch (error) {
                handleServerActionError({ error, toast, actionLabel: 'la carga de inventario' });
              }
            })();
        }
        setIsOpen(open);
    }

    const handleConfirm = (data: CompletionFormData) => {
        const consumedItems: ConsumedItem[] = [];
        const contrastMl = parseFloat((data.contrastAdministeredMl || "0").replace(',', '.')) || 0;

        if (isContrastedIV && contrastItem && contrastMl > 0) {
             consumedItems.push({ id: contrastItem.id, name: contrastItem.name, amount: contrastMl });
        }

        if (showSupplyRegistration) {
            data.abbocaths?.forEach(abbocath => {
                if (abbocath.id && abbocath.amount > 0) {
                    consumedItems.push({ id: abbocath.id, name: abbocath.name, amount: abbocath.amount });
                }
            });
            
            const jeringaAmount = parseInt(data.jeringaAmount || '0') || 0;
            if (jeringaItem && jeringaAmount > 0) {
                 consumedItems.push({ id: jeringaItem.id, name: jeringaItem.name, amount: jeringaAmount });
            }
            const extensionAmount = parseInt(data.extensionAmount || '0') || 0;
            if (extensionItem && extensionAmount > 0) {
                consumedItems.push({ id: extensionItem.id, name: extensionItem.name, amount: extensionAmount });
            }
        }

        const finalParams: CompletionParams = {
            kV: parseFloat((data.kV || "0").replace(',', '.')) || undefined,
            mA: parseFloat((data.mA || "0").replace(',', '.')) || undefined,
            timeMs: parseFloat((data.timeMs || "0").replace(',', '.')) || undefined,
            ctdi: parseFloat((data.ctdi || "0").replace(',', '.')) || undefined,
            dlp: parseFloat((data.dlp || "0").replace(',', '.')) || undefined,
            consumedItems: consumedItems.length > 0 ? consumedItems : undefined,
            contrastAdministeredMl: contrastMl > 0 ? contrastMl : undefined,
        };
        
        onConfirm(finalParams);
        setIsOpen(false);
    }

     const QuantityInput = ({ name, label }: { name: `jeringaAmount` | `extensionAmount` | `abbocaths.${number}.amount`, label: string }) => (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <Label>{label}</Label>
                    <div className="flex items-center">
                        <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-r-none" onClick={() => form.setValue(name, String(Math.max(0, parseInt(String(field.value || '0')) - 1)) as any)}><Minus className="h-4 w-4" /></Button>
                        <FormControl>
                            <Input type="number" {...field} className="h-8 w-12 rounded-none p-0 text-center" />
                        </FormControl>
                        <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-l-none" onClick={() => form.setValue(name, String(parseInt(String(field.value || '0')) + 1) as any)}><Plus className="h-4 w-4" /></Button>
                    </div>
                </FormItem>
            )}
        />
    );
    
    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</AlertDialogTrigger>
            <AlertDialogContent className="max-w-2xl">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleConfirm)}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Finalizar Estudio y Registrar Insumos</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ingrese los valores de adquisición y los insumos utilizados para completar el estudio.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <div className="space-y-4 py-3 px-1">
                            {modality === 'RX' && (
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField control={form.control} name="kV" render={({ field }) => ( <FormItem><Label className="text-xs">kV</Label><FormControl><Input autoFocus {...field} className="text-center text-sm h-8" /></FormControl></FormItem> )}/>
                                    <FormField control={form.control} name="mA" render={({ field }) => ( <FormItem><Label className="text-xs">mA</Label><FormControl><Input {...field} className="text-center text-sm h-8" /></FormControl></FormItem> )}/>
                                    <FormField control={form.control} name="timeMs" render={({ field }) => ( <FormItem><Label className="text-xs">Tiempo (ms)</Label><FormControl><Input {...field} className="text-center text-sm h-8" /></FormControl></FormItem> )}/>
                                </div>
                            )}
                            {modality === 'TAC' && (
                                 <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="ctdi" render={({ field }) => ( <FormItem><Label className="text-xs">CTDI (mGy)</Label><FormControl><Input autoFocus placeholder="0" {...field} className="text-center text-sm h-8" /></FormControl></FormItem> )}/>
                                    <FormField control={form.control} name="dlp" render={({ field }) => ( <FormItem><Label className="text-xs">DLP (mGy-cm)</Label><FormControl><Input {...field} placeholder="0" className="text-center text-sm h-8" /></FormControl></FormItem> )}/>
                                </div>
                            )}
                            {isContrastedIV && (
                                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Creatinina</Label>
                                      <Input value={study.creatinine || 'N/A'} readOnly className="text-center font-bold text-sm h-8" />
                                    </div>
                                    <FormField control={form.control} name="contrastAdministeredMl" render={({ field }) => ( <FormItem><Label className="text-xs">Contraste Adminis. (ml)</Label><FormControl><Input {...field} placeholder="Ej: 70" className="text-center text-sm h-8"/></FormControl></FormItem> )}/>
                                </div>
                            )}
                            {showSupplyRegistration && (
                                <div className="space-y-3 border-t pt-3">
                                    <div className="grid grid-cols-3 gap-2 items-end">
                                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => append({ id: '', name: 'ABBOCATH', amount: 1 })}>
                                            <Plus className="mr-1 h-3 w-3" /> Abbocath
                                        </Button>
                                        <QuantityInput name="jeringaAmount" label="Jeringas" />
                                        <QuantityInput name="extensionAmount" label="Extensiones"/>
                                    </div>
                                    <div className="space-y-2">
                                        {fields.map((item, index) => (
                                            <div key={item.id} className="grid grid-cols-[1fr,auto,auto] gap-2 items-end p-2 border rounded-md bg-muted/50 text-sm">
                                                <FormField
                                                    control={form.control}
                                                    name={`abbocaths.${index}.id`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Label className="text-xs">Abbocath #{index + 1}</Label>
                                                            <Select 
                                                                onValueChange={(value) => {
                                                                    const selectedAbbocath = availableAbbocaths.find(a => a.id === value);
                                                                    field.onChange(value);
                                                                    form.setValue(`abbocaths.${index}.name`, selectedAbbocath?.name || 'ABBOCATH');
                                                                }} 
                                                                value={field.value}
                                                            >
                                                                <FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Calibre..." /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    {availableAbbocaths.map(a => <SelectItem key={a.id} value={a.id}>{a.specification}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <QuantityInput name={`abbocaths.${index}.amount`} label="Cantidad" />
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button type="submit">Confirmar y Completar</Button>
                    </AlertDialogFooter>
                </form>
              </Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function CreatinineDialog({ onConfirm, children }: { onConfirm: (creatinine: number) => void; children: React.ReactNode; }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [creatinine, setCreatinine] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    const handleConfirm = () => {
        const creatinineValue = parseFloat(creatinine.replace(',', '.'));
        if (!isNaN(creatinineValue) && creatinineValue > 0) {
            onConfirm(creatinineValue);
            setIsOpen(false);
            setCreatinine('');
        }
    };
    
    const handleChange = (value: string) => {
        if (value === '' || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
            setCreatinine(value);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Registrar Creatinina para Contraste IV</AlertDialogTitle>
                    <AlertDialogDescription>
                        Por favor, ingrese el valor de creatinina del paciente antes de continuar.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid grid-cols-1 gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="creatinine-input">Creatinina (mg/dL)</Label>
                        <Input ref={inputRef} id="creatinine-input" type="text" value={creatinine} onChange={(e) => handleChange(e.target.value)} placeholder="Ej: 0.9" className="text-center"/>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm} disabled={!creatinine}>
                        Guardar Creatinina
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function AttachReportDialog({ study, open, onOpenChange }: { study: Study | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [file, setFile] = React.useState<File | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [transcribing, setTranscribing] = React.useState(false);
    const [reportText, setReportText] = React.useState('');
    const [isRecording, setIsRecording] = React.useState(false);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);

    const { selectedOperator } = useAuth();
    const age = getAgeFromBirthDate(study?.patient.birthDate);
    
    const generateReportFromTemplate = React.useCallback(() => {
        if (!study) return '';

        const cups = study.studies[0]?.cups;
        let template = (cups && reportTemplates[cups as keyof typeof reportTemplates]) || '';

        if (!template) {
            return `No se encontró una plantilla de informe para el estudio "${study.studies[0]?.nombre}" (CUPS: ${cups}).\nPuede redactar el informe manualmente aquí.`;
        }

        template = template.replace(/{{paciente\.nombre}}/g, study.patient.fullName || 'N/A');
        template = template.replace(/{{paciente\.idType}}/g, study.patient.idType || 'ID');
        template = template.replace(/{{paciente\.id}}/g, study.patient.id || 'N/A');
        template = template.replace(/{{paciente\.edad}}/g, age !== null ? String(age) : 'N/A');
        template = template.replace(/{{paciente\.sexo}}/g, study.patient.sex || 'N/A');
        template = template.replace(/{{paciente\.entidad}}/g, study.patient.entidad || 'N/A');
        template = template.replace(/{{estudio\.nombre}}/g, study.studies[0]?.nombre || 'N/A');
        template = template.replace(/{{estudio\.cups}}/g, study.studies[0]?.cups || 'N/A');
        template = template.replace(/{{diagnostico\.codigo}}/g, study.diagnosis.code || 'N/A');
        template = template.replace(/{{diagnostico\.descripcion}}/g, study.diagnosis.description || 'N/A');
        template = template.replace(/{{fecha}}/g, format(new Date(), 'dd/MM/yyyy'));
        template = template.replace(/{{hora}}/g, format(new Date(), 'HH:mm'));
        template = template.replace(/{{medico\.nombre}}/g, selectedOperator || 'N/A');

        if (study.contrastType && study.contrastAdministeredMl) {
            template = template.replace(/{{#if contraste}}[\s\S]*?{{\/if}}/g, 
                (template.match(/{{#if contraste}}([\s\S]*?){{\/if}}/)?.[1] || '')
                    .replace('{{contraste.tipo}}', study.contrastType)
                    .replace('{{contraste.administrado}}', String(study.contrastAdministeredMl))
            );
        } else {
            template = template.replace(/{{#if contraste}}[\s\S]*?{{\/if}}/g, '');
        }

        if (study.dlp || (study.kV && study.mA)) {
            const mAs = study.mA && study.timeMs ? (study.mA * study.timeMs / 1000).toFixed(2) : study.mA;
            template = template.replace(/{{#if dosis}}[\s\S]*?{{\/if}}/g,
                (template.match(/{{#if dosis}}([\s\S]*?){{\/if}}/)?.[1] || '')
                    .replace('{{dosis.dlp}}', String(study.dlp || ''))
                    .replace('{{dosis.kv}}', String(study.kV || ''))
                    .replace('{{dosis.ma}}', String(mAs || ''))
            );
        } else {
            template = template.replace(/{{#if dosis}}[\s\S]*?{{\/if}}/g, '');
        }

        template = template.replace(/{{#if \w+}}[\s\S]*?{{\/if}}/g, '');
        
        return template;
    }, [study, age, selectedOperator]);

    const handleLoadTemplate = () => {
        setReportText(generateReportFromTemplate());
    };

    React.useEffect(() => {
        if (!open) {
            setReportText('');
            setFile(null);
            setIsRecording(false);
            setTranscribing(false);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }
        }
    }, [open]);

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
                stream.getTracks().forEach(track => track.stop()); // Stop mic access
                
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result as string;
                    setTranscribing(true);
                    try {
                      const result = await transcribeAudioAction({ audioDataUri: base64Audio });
                      if (result.success && result.text) {
                        setReportText(prev => `${prev}\n${result.text}`);
                        toast({ title: "Transcripción Completa" });
                      } else {
                        throw new Error(result.error || "La transcripción falló.");
                      }
                    } catch (e: any) {
                      if (!handleServerActionError({ error: e, toast, actionLabel: 'la transcripción de audio' })) {
                        toast({ variant: "destructive", title: "Error de Transcripción", description: e.message });
                      }
                    } finally {
                        setTranscribing(false);
                    }
                };
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error de Micrófono', description: 'No se pudo acceder al micrófono.' });
        }
    };
    
    const handleStopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleAttach = async (type: 'pdf' | 'template') => {
        if (!study) return;
        setLoading(true);

        try {
            let finalReportUrl: string | undefined = undefined;
            let finalReportText: string = reportText;
            let isFromTemplate = false;

            if (type === 'pdf' && file) {
                const dataUri = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(file);
                });
                
                const storageRef = ref(storage, `reports/${study.id}_${Date.now()}.pdf`);
                const uploadResult = await uploadString(storageRef, dataUri, 'data_url');
                finalReportUrl = await getDownloadURL(uploadResult.ref);
                
                const textExtractionResult = await extractReportTextAction(dataUri);
                if (textExtractionResult.success) {
                    finalReportText = textExtractionResult.text || '';
                } else {
                    toast({ variant: 'destructive', title: 'Advertencia', description: 'No se pudo extraer el texto del PDF, pero el archivo se adjuntó.' });
                }

            } else if (type === 'template' && reportText) {
                isFromTemplate = true;
                const textDataUri = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(reportText)))}`;
                const textStorageRef = ref(storage, `reports/${study.id}_${Date.now()}.txt`);
                const uploadResult = await uploadString(textStorageRef, textDataUri, 'data_url');
                finalReportUrl = await getDownloadURL(uploadResult.ref);
            } else {
                throw new Error("No hay informe para adjuntar.");
            }

            const saveResult = await saveReportDataAction(study.id, finalReportUrl, finalReportText);
            if (!saveResult.success) {
                throw new Error(saveResult.error || "No se pudo guardar la información del informe.");
            }
            
            toast({ title: "Informe Adjuntado", description: "El informe ha sido procesado y el estudio marcado como 'Leído'." });
            onOpenChange(false);

        } catch (error: any) {
          console.error("Attachment error:", error);
          if (!handleServerActionError({ error, toast, actionLabel: 'el procesamiento del informe' })) {
            toast({ variant: 'destructive', title: "Error al Adjuntar", description: error.message || 'No se pudo adjuntar el informe.' });
          }
        } finally {
            setLoading(false);
        }
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPrimitiveContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Adjuntar Informe para {study?.studies[0]?.nombre}</DialogTitle>
                    <DialogDescription>
                        Puedes dictar el informe, usar una plantilla, o cargar un PDF existente.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="flex flex-col space-y-4">
                        <h4 className="font-semibold">Opción 1: Redactar o Dictar Informe</h4>
                        <div className="relative flex-grow">
                             <Textarea
                                value={reportText}
                                onChange={(e) => setReportText(e.target.value)}
                                className="h-full min-h-[340px] text-xs font-mono"
                                placeholder="Comienza a redactar o usa los botones de abajo..."
                            />
                            {transcribing && (
                                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="font-semibold mt-2">Transcribiendo audio...</p>
                                </div>
                            )}
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                             <Button variant="outline" onClick={handleLoadTemplate} disabled={loading || isRecording}>
                                 <CornerDownLeft className="mr-2" /> Cargar Plantilla
                             </Button>
                              {isRecording ? (
                                <Button variant="destructive" onClick={handleStopRecording}>
                                    <StopCircle className="mr-2" /> Detener
                                </Button>
                            ) : (
                                <Button variant="secondary" onClick={handleStartRecording} disabled={loading}>
                                    <Mic className="mr-2" /> Grabar Dictado
                                </Button>
                            )}
                         </div>
                         <Button onClick={() => handleAttach('template')} disabled={!reportText || loading || isRecording} className="w-full">
                            {loading ? <Loader2 className="animate-spin" /> : "Finalizar con este Texto"}
                        </Button>
                    </div>
                    <div className="flex flex-col space-y-4">
                         <h4 className="font-semibold">Opción 2: Cargar PDF</h4>
                         <div className="flex items-center justify-center w-full flex-grow">
                            <label htmlFor="file-upload-dialog" className="flex flex-col items-center justify-center w-full h-full border-2 border-border border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                    <FileUp className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click para cargar</span> o arrastre y suelte</p>
                                    {file ? <p className="text-xs text-primary font-bold">{file.name}</p> : <p className="text-xs text-muted-foreground">PDF (MAX. 2MB)</p>}
                                </div>
                                <Input id="file-upload-dialog" type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                            </label>
                        </div> 
                        <Button onClick={() => handleAttach('pdf')} disabled={!file || loading || isRecording} className="w-full">
                            {loading ? <Loader2 className="animate-spin" /> : "Finalizar con PDF"}
                        </Button>
                    </div>
                </div>
            </DialogPrimitiveContent>
        </Dialog>
    );
}

function ViewReportDialog({ study, open, onOpenChange }: { study: StudyWithCompletedBy | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [reportText, setReportText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [generatingPdf, setGeneratingPdf] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!open || !study) return;

    let canceled = false;
    const loadReport = async () => {
      setLoading(true);

      // Prefer inline text when available to avoid unnecessary fetches/CORS issues
      if (study.reportText) {
        if (!canceled) setReportText(study.reportText);
        setLoading(false);
        return;
      }

      if (study.reportUrl) {
        try {
          const response = await fetch(study.reportUrl);
          if (!response.ok) throw new Error('Network response was not ok');
          const contentType = response.headers.get('content-type');

          if (contentType && (contentType.includes('text/plain') || contentType.includes('application/octet-stream'))) {
            const text = await response.text();
            if (!canceled) setReportText(text);
          } else if (contentType && contentType.includes('application/pdf')) {
            if (!canceled)
              setReportText(`Este es un informe en PDF. <a href="${study.reportUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline">Abrir PDF en nueva pestaña.</a>`);
          } else {
            if (!canceled)
              setReportText(`No se pudo determinar el tipo de archivo del informe. <a href="${study.reportUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline">Abrir directamente.</a>`);
          }
        } catch (error) {
          console.error('Error fetching report content:', error);
          if (!canceled) {
            setReportText(study.reportText || 'No se pudo cargar el contenido del informe.');
          }
        }
      } else {
        if (!canceled) setReportText('No hay informe disponible para este estudio.');
      }

      if (!canceled) setLoading(false);
    };

    loadReport();

    return () => {
      canceled = true;
    };
  }, [open, study]);

  const handleGeneratePdf = async () => {
    if (!study || (!study.reportText && !study.reportUrl)) return;
    setGeneratingPdf(true);
    const printWindow = window.open(`/documents/${study.id}/report`, '_blank');
    if(printWindow) {
      printWindow.onload = () => {
         setTimeout(() => {
            printWindow.print();
          }, 500);
      };
    }
    setGeneratingPdf(false);
  };
  

  if (!study) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitiveContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Informe del Estudio</DialogTitle>
          <DialogDescription>
            Vista previa del informe para {study.studies[0]?.nombre}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 my-4 p-4 border rounded-md bg-muted/50 whitespace-pre-wrap">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <p className="text-sm" dangerouslySetInnerHTML={{ __html: reportText || "No se encontró texto en este informe."}}></p>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button onClick={handleGeneratePdf} disabled={generatingPdf || loading || (!reportText && !study.reportUrl)}>
            {generatingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Imprimir / Guardar PDF
          </Button>
        </DialogFooter>
      </DialogPrimitiveContent>
    </Dialog>
  );
}

function NursingNoteDialog({ study, open, onOpenChange }: { study: Study | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const noteRef = React.useRef<HTMLTextAreaElement>(null);
    const [noteText, setNoteText] = React.useState("");

    React.useEffect(() => {
        if (open && study) {
            const age = getAgeFromBirthDate(study.patient.birthDate);
            const now = new Date();
            const time = format(now, 'HH:mm');
            const date = format(now, 'dd/MM/yyyy');
            
            const catheterInfo = study.consumedSupplies?.find(item => item.name.includes("ABBOCATH"));
            const patientDescription = study.patient.fullName.toUpperCase().includes("DISCAPACIDAD")
                ? 'en compañía de familiar, quien asiste en la orientación debido a diagnóstico de base de discapacidad intelectual'
                : 'consciente, orientado(a) y colaborador(a)';

            const template = `
${time} HORAS - INGRESO Y EVALUACIÁ“N INICIAL
Se recibe paciente ${study.patient.sex === 'F' ? 'femenina' : 'masculino'} de ${age || 'N/A'} años de edad, ${patientDescription}, procedente del servicio de ${study.service}, para la realización de ${study.studies.map(s => s.nombre).join(', ')}.
Estado General: Afebril, tolerando oxígeno ambiente, con buen patrón respiratorio.
Examen Físico: Cuello móvil, tórax simétrico, abdomen blando no doloroso a la palpación. Miembros simétricos sin limitación para la movilidad. Piel sin lesiones evidentes.
Diagnóstico: ${study.diagnosis.description}.

SIGNOS VITALES (PRE-PROCEDIMIENTO)
T/A: 120/80 mmHg  |  FC: 75 lpm  |  FR: 18 rpm  |  Temp: 36.5 Â°C  |  SatO2: 98 %

${format(new Date(now.getTime() + 1 * 60000), 'HH:mm')} HORAS - PREPARACIÁ“N Y ACCESO VENOSO
Se explican riesgos y se verifica consentimiento informado. Con técnica aséptica, se canaliza vena en miembro superior derecho con ${catheterInfo ? `${catheterInfo.name}` : 'Abocath #22'}, se instala extensión de anestesia y se confirma permeabilidad de la vía.

${format(new Date(now.getTime() + 3 * 60000), 'HH:mm')} HORAS - ADMINISTRACIÁ“N DE CONTRASTE Y MONITOREO
Se administran ${study.contrastAdministeredMl || '___'} ml de medio de contraste IV. Paciente tolera adecuadamente, refiriendo solo sensación de calor. Se mantiene bajo vigilancia clínica sin evidencia de reacciones adversas.

SIGNOS VITALES (POST-CONTRASTE)
T/A: 122/81 mmHg  |  FC: 78 lpm  |  FR: 18 rpm  |  Temp: 36.5 Â°C  |  SatO2: 97 %

${format(new Date(now.getTime() + 6 * 60000), 'HH:mm')} HORAS - FINALIZACIÁ“N Y RECOMENDACIONES
Se finaliza el estudio. Se retira vía venosa sin complicaciones, logrando hemostasia con presión local.
Educación al Alta: Se brindan recomendaciones verbales claras al familiar sobre la importancia de una hidratación abundante en las próximas horas para facilitar la eliminación del medio de contraste. Se indican signos de alarma por los cuales consultar (p. ej., reacción alérgica tardía, náuseas, mareo).

Condición de Salida: El procedimiento concluye sin novedades. La paciente se retira del servicio en condición estable, deambulando, en compañía de su familiar.
            `;
            setNoteText(template.trim());
        }
    }, [open, study]);

    const handleCopy = () => {
        if (noteRef.current) {
            navigator.clipboard.writeText(noteRef.current.value);
            toast({ title: 'Copiado', description: 'La nota de enfermería ha sido copiada al portapapeles.' });
        }
    };

    if (!study) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPrimitiveContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Nota de Enfermería</DialogTitle>
                    <DialogDescription>
                        Esta es una plantilla generada automáticamente. Revise y edite según sea necesario antes de copiarla.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        ref={noteRef}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="h-96 font-mono text-xs"
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleCopy}>
                        <Clipboard className="mr-2 h-4 w-4" />
                        Copiar al Portapapeles
                    </Button>
                </DialogFooter>
            </DialogPrimitiveContent>
        </Dialog>
    );
}

function TurnNumberInput({ study, isAdmin, canAssignTurn }: { study: Study; isAdmin: boolean; canAssignTurn: boolean; }) {
    const [turn, setTurn] = React.useState(study.turnNumber || '');
    const [isEditing, setIsEditing] = React.useState(false);
    const { toast } = useToast();

    const handleTurnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length <= 2) {
            setTurn(value);
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (turn) {
          try {
            const result = await updateStudyTurnNumberAction(study.id, turn.padStart(2, '0'));
            if (result.success) {
              setIsEditing(false);
              toast({ title: 'Turno Asignado' });
            } else {
              toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
          } catch (error) {
            if (!handleServerActionError({ error, toast, actionLabel: 'la actualización del turno' })) {
              toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar el turno.' });
            }
          }
            }
        }
    };

    if (isEditing) {
        return (
            <Input
                type="text"
                value={turn}
                onChange={handleTurnChange}
                onKeyDown={handleKeyDown}
                onBlur={() => !study.turnNumber && setIsEditing(canAssignTurn)}
                className="font-mono font-bold h-auto w-10 px-1 py-0 text-center bg-background text-[10px] leading-none"
                onClick={(e) => e.stopPropagation()}
            />
        );
    }

    return (
        <span
            className={cn(
                "font-mono font-bold cursor-text text-[10px] leading-none",
                (isAdmin || canAssignTurn) && "hover:underline cursor-pointer"
            )}
            onClick={(e) => {
                e.stopPropagation();
                if (isAdmin || (!study.turnNumber && canAssignTurn)) {
                    setIsEditing(true);
                }
            }}
        >
            {study.turnNumber ? `/${study.turnNumber}` : '/--'}
        </span>
    );
}

function BedNumberInput({ study, canEdit }: { study: Study; canEdit: boolean; }) {
    const [bed, setBed] = React.useState(study.bedNumber || '');
    const [isEditing, setIsEditing] = React.useState(false);
    const { toast } = useToast();

    const handleBedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBed(e.target.value.toUpperCase());
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        try {
          const result = await updateStudyBedNumberAction(study.id, bed);
          if (result.success) {
            setIsEditing(false);
            toast({ title: 'Cama Asignada' });
          } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
          }
        } catch (error) {
          if (!handleServerActionError({ error, toast, actionLabel: 'la asignación de cama' })) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar la cama.' });
          }
        }
        }
        if (e.key === 'Escape') {
            setIsEditing(false);
            setBed(study.bedNumber || '');
        }
    };
    
    const handleBlur = async () => {
      setIsEditing(false);
      if (bed !== (study.bedNumber || '')) {
         try {
          const result = await updateStudyBedNumberAction(study.id, bed);
          if (result.success) {
            toast({ title: 'Cama Asignada' });
          } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
          }
         } catch (error) {
          if (!handleServerActionError({ error, toast, actionLabel: 'la asignación de cama' })) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar la cama.' });
          }
         }
      }
    };

    if (isEditing) {
        return (
            <Input
                type="text"
                value={bed}
                onChange={handleBedChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="font-mono font-bold h-auto w-16 px-1 py-0 text-center bg-background text-[10px] leading-none"
                onClick={(e) => e.stopPropagation()}
                placeholder="CAMA"
            />
        );
    }

    return (
        <span
            className={cn(
                "font-mono font-bold cursor-text text-[10px] leading-none",
                canEdit && "hover:underline cursor-pointer"
            )}
            onClick={(e) => {
                e.stopPropagation();
                if (canEdit) {
                    setIsEditing(true);
                }
            }}
        >
            {study.bedNumber ? `/${study.bedNumber}` : '/--'}
        </span>
    );
}


export function StudyTable({ 
  studies, 
  userProfile,
  dateRange,
  setDateRange,
  activeStatusFilters,
  setActiveStatusFilters,
  searchTerm,
  setSearchTerm,
  onSearch,
  onClearSearch,
  isSearching,
  isSearchActive,
  isSummaryVisible,
  setIsSummaryVisible,
  highlightedStudies = new Set(),
  onEditStudy,
  hasMore,
  onLoadMore,
  isLoadingMore,
  onAssignSpecialist,
  specialists = [],
}: StudyTableProps) {
  const { toast } = useToast();
  const { selectedOperator } = useAuth();
  const [cancelReason, setCancelReason] = React.useState('');
  const [customCancelReason, setCustomCancelReason] = React.useState('');
  const [attachingReportToStudy, setAttachingReportToStudy] = React.useState<Study | null>(null);
  const [viewingReportStudy, setViewingReportStudy] = React.useState<StudyWithCompletedBy | null>(null);
  const [nursingNoteStudy, setNursingNoteStudy] = React.useState<Study | null>(null);
  const displayedStudiesRef = React.useRef(new Set<string>());
  const pathname = usePathname();
  const isConsultations = pathname?.includes('/consultations') ?? false;
  const isPatientProfile = pathname?.startsWith('/patients/') ?? false;
  const isAdmin = userProfile?.rol === 'administrador';
  const isAdmission = userProfile?.rol === 'admisionista';
  const isTechnologist = userProfile?.rol === 'tecnologo';
  const canManageDocuments = isAdmin || isAdmission || isTechnologist;

  const getModalityDisplay = (study: StudyWithCompletedBy) => {
    const singleStudy = study.studies[0];
    if (!singleStudy) return null;

    const modality = singleStudy.modality;
    const isImaging = Modalities.includes(modality as any);
    
    if (isImaging) {
        return <p>{modality}</p>;
    }

    const consultation = ALL_CONSULTATIONS.find(c => c.especialidad === modality);
    return (
        <>
            <Stethoscope className="h-6 w-6" />
            <p className="text-xs leading-tight">{consultation?.shortName || modality}</p>
        </>
    );
  };

  const abbreviateSubService = (subService: string) => {
    const abbreviations: Record<string, string> = {
      'TRIAGE': 'TRG',
      'OBSERVACION 1': 'OBS1',
      'OBSERVACION 2': 'OBS2',
      'HOSPITALIZACION 2': 'HOS2',
      'HOSPITALIZACION 4': 'HOS4',
      'UCI 2': 'UCI2',
      'UCI 3': 'UCI3',
      'UCI NEO': 'NEO',
      'AMB': 'AMB',
    };
    return abbreviations[subService] || subService;
  };

  const serializeUserProfile = (profile: UserProfile | null) => {
    if (!profile) return null;
    return {
      ...profile,
      lastShiftHandoverAt: profile.lastShiftHandoverAt ? 
        (typeof profile.lastShiftHandoverAt === 'object' && 'toMillis' in profile.lastShiftHandoverAt 
          ? profile.lastShiftHandoverAt.toMillis() 
          : profile.lastShiftHandoverAt) 
        : null,
    };
  };

  const handleStatusChange = async (studyId: string, status: StudyStatus, params?: CompletionParams, operator?: string) => {
    const result = await updateStudyStatusAction(studyId, status, serializeUserProfile(userProfile), params, operator);
    if (result.success) {
      toast({ title: 'Estado Actualizado', description: `El estudio ahora está ${status}.` });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleSetContrast = async (studyId: string, contrastType: ContrastType, params?: { creatinine?: number; }) => {
    const result = await setStudyContrastAction(studyId, contrastType, params);
    if(result.success) {
      toast({ title: 'Estado de Contraste Actualizado' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleRemoveContrast = async (studyId: string) => {
    const result = await setStudyContrastAction(studyId, null);
     if(result.success) {
      toast({ title: 'Marca de Contraste Eliminada' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  }
  
  const handleQuickStatusChange = (study: Study, params?: CompletionParams, operator?: string) => {
    if (!userProfile || !study.studies || study.studies.length === 0) return;
    const { id, status } = study;
    const { rol } = userProfile;
    
    let nextStatus: StudyStatus | null = null;
    
    if (status === 'Pendiente') {
        nextStatus = 'Completado';
    } else if (status === 'Completado') {
        if (rol === 'transcriptora' || rol === 'administrador') {
            setAttachingReportToStudy(study);
            return;
        }
    }

    if (nextStatus) {
      handleStatusChange(id, nextStatus, params, operator || selectedOperator || undefined);
    }
  };

  const handleCancelStudy = async (studyId: string) => {
    const finalReason = cancelReason === 'Otro' ? customCancelReason : cancelReason;
    if (!finalReason) {
        toast({ variant: "destructive", title: "Error", description: "Debe seleccionar o escribir un motivo de cancelación." });
        return;
    }
    const result = await cancelStudyAction(studyId, finalReason, userProfile);
    if (result.success) {
      toast({ title: "Estudio Cancelado", description: "La solicitud ha sido marcada como cancelada." });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
    setCancelReason('');
    setCustomCancelReason('');
  };
  
 const handleDeleteStudy = async (studyId: string) => {
    const result = await deleteStudyAction(studyId, userProfile);
    if (result.success) {
      toast({ title: 'Estudio Eliminado', description: 'La solicitud ha sido eliminada permanentemente.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleCallPatient = async (study: Study) => {
    if (!study.studies || study.studies.length === 0) return;
    const modality = study.studies[0].modality as 'ECO' | 'RX' | 'TAC';
    const result = await callPatientAction(study.id, modality);
    if (result.success) {
        toast({ title: 'Paciente Llamado', description: `Llamando a turno ${study.turnNumber} para ${modality}.` });
    } else {
        toast({ variant: 'destructive', title: 'Error al Llamar', description: result.error });
    }
  };

  const handleDocumentOpen = (studyId: string, docType: string) => {
    window.open(`/documents/${studyId}/${docType}`, '_blank');
  };

  const handleKitContrastado = (studyId: string) => {
    handleDocumentOpen(studyId, 'consent');
    handleDocumentOpen(studyId, 'checklist');
  };

  const getEmailForEntidad = (entidad: string): string => {
    const normalizedEntidad = entidad.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    for (const key in epsEmailMap) {
        if (normalizedEntidad.includes(key)) {
            return epsEmailMap[key];
        }
    }
    return '';
  };


    const handleRequestAuthorization = (study: StudyWithCompletedBy) => {
        if (!study) return;
    
        const to = getEmailForEntidad(study.patient.entidad);
        const subject = `SOLICITUD DE ${study.studies[0]?.nombre} - ${study.patient.fullName} (${study.patient.id})`;
        
        let body = `Estimados ${study.patient.entidad},\n\n`;
        body += `Por medio del presente, solicito la realización del siguiente estudio:\n\n`;
        body += `---------------------------------------------------\n`;
        body += `DATOS DEL PACIENTE:\n`;
        body += `---------------------------------------------------\n`;
        body += `- Nombre: ${study.patient.fullName}\n`;
        body += `- Identificación: ${study.patient.idType || 'ID'} ${study.patient.id}\n`;
        body += `- Entidad: ${study.patient.entidad}\n\n`;
        body += `---------------------------------------------------\n`;
        body += `DATOS DEL ESTUDIO SOLICITADO:\n`;
        body += `---------------------------------------------------\n`;
        body += `- Estudio: ${study.studies[0]?.nombre}\n`;
        body += `- Código CUPS: ${study.studies[0]?.cups}\n`;
        body += `- Diagnóstico: ${study.diagnosis.code} - ${study.diagnosis.description}\n\n`;
        body += `---------------------------------------------------\n`;
        body += `DATOS DEL MÉDICO SOLICITANTE:\n`;
        body += `---------------------------------------------------\n`;
        body += `- Nombre: ${study.orderingPhysician?.name || 'No especificado'}\n`;
        body += `- Registro Médico: ${study.orderingPhysician?.register || 'No especificado'}\n\n`;
        body += `Agradecemos su pronta gestión.\n\n`;
        body += `Saludos cordiales.`;
        
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
    };
  
  const canPerformAction = (study: Study) => {
    if (!userProfile || !study.studies || study.studies.length === 0) return { edit: false, cancel: false, quickChange: false, delete: false, revert: false, contrast: false, attachReport: false, viewReport: false, hasAnyAction: false, assignTurn: false, call: false, editBed: false, nursingNote: false };
    
    const { rol } = userProfile;
    const { status } = study;
    const studyModality = study.studies[0]?.modality;

    const isAdmin = rol === 'administrador';
    const isNurse = rol === 'enfermero';
    const isTech = rol === 'tecnologo';

    const canEdit = isAdmin;
    const canCancel = (isAdmin || rol === 'tecnologo' || rol === 'transcriptora' || rol === 'admisionista') && status === 'Pendiente';
    const canDelete = isAdmin;
    const canRevert = isAdmin && status !== 'Pendiente';
    const canContrast = (isAdmin || isNurse) && (studyModality === 'RX' || studyModality === 'TAC');
    const canAttachReport = (rol === 'transcriptora' || isAdmin) && status === 'Completado';
    const canViewReport = status === 'Leído' && !!(study.reportUrl || study.reportText);
    const canAssignTurn = rol === 'admisionista' && study.service === 'C.EXT' && !study.turnNumber;
    const canCall = study.service === 'C.EXT' && study.status === 'Pendiente' && !!study.turnNumber && (rol === 'tecnologo' || rol === 'admisionista' || isAdmin);
    const canEditBed = (isNurse || isAdmin) && study.service !== 'C.EXT';
    const canCreateNursingNote = (isNurse || isAdmin) && !isConsultations && study.status === 'Completado' && study.contrastType === 'IV';


    let canQuickChange = false;
    if (status === 'Pendiente') {
        if (rol === 'transcriptora' && (studyModality === 'ECO' || !Modalities.includes(studyModality as any))) {
            canQuickChange = true;
        } else if (rol === 'tecnologo' && studyModality !== 'ECO' && Modalities.includes(studyModality as any)) {
            canQuickChange = true;
        } else if (isAdmin && !isConsultations) {
            // Admin can complete any imaging study
            canQuickChange = true;
        }
    } else if (status === 'Completado') {
        if (rol === 'transcriptora' || isAdmin) {
            canQuickChange = true; // This will now trigger the dialog
        }
    }

    const hasAnyAction = canEdit || canCancel || canDelete || canRevert || canContrast || canAttachReport || canCall || canCreateNursingNote;

    return { edit: canEdit, cancel: canCancel, quickChange: canQuickChange, delete: canDelete, revert: canRevert, contrast: canContrast, attachReport: canAttachReport, viewReport: canViewReport, hasAnyAction: hasAnyAction, assignTurn: canAssignTurn, call: canCall, editBed: canEditBed, nursingNote: canCreateNursingNote };
  };
  
  const statusConfig: Record<StudyStatus, { icon: React.ElementType, label: string, style: string }> = {
    Pendiente: { icon: AlertTriangle, label: "Pendiente", style: "bg-red-600 text-white shadow-sm" },
    Completado: { icon: CheckCircle, label: "Completado", style: "bg-emerald-600 text-white shadow-sm" },
    Leído: { icon: FileText, label: "Leído", style: "bg-blue-600 text-white shadow-sm" },
    Cancelado: { icon: Ban, label: "Cancelado", style: "bg-slate-500 text-white shadow-sm" },
    Anulado: { icon: XCircle, label: "Anulado", style: "bg-zinc-500 text-white shadow-sm" },
  };

  const statusOptions: StudyStatus[] = ["Pendiente", "Completado", "Leído", "Cancelado", "Anulado"];

  const formatEntityName = (name: string) => {
    if (name.toUpperCase().includes('CAJACOPI')) {
      return 'CAJACOPI EPS S.A.S.';
    }
    return name;
  };

  const getTableTitle = () => {
    if (isPatientProfile) return "Solicitud";
    if (isConsultations) return "Especialidad";
    return "Estudio";
  };
  
  React.useEffect(() => {
    studies.forEach(study => displayedStudiesRef.current.add(study.id));
  }, [studies]);

  return (
    <>
      <AttachReportDialog 
        study={attachingReportToStudy}
        open={!!attachingReportToStudy}
        onOpenChange={(open) => { if (!open) setAttachingReportToStudy(null); }}
      />
      <ViewReportDialog 
        study={viewingReportStudy}
        open={!!viewingReportStudy}
        onOpenChange={(open) => { if (!open) setViewingReportStudy(null); }}
      />
       <NursingNoteDialog 
        study={nursingNoteStudy}
        open={!!nursingNoteStudy}
        onOpenChange={(open) => { if (!open) setNursingNoteStudy(null); }}
      />
      <div className="rounded-2xl border-none shadow-xl bg-white overflow-hidden ring-1 ring-zinc-200/50">
        <Table style={{ tableLayout: 'fixed' }}>
          <TableHeader>
            <TableRow className="bg-zinc-50/80 hover:bg-zinc-50 border-b-2 border-zinc-100">
              <TableHead className="p-2" style={{ width: '130px' }}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className='font-black text-[11px] w-full h-full justify-start px-2 text-zinc-900 uppercase tracking-widest'>ESTADO</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusOptions.map(status => (
                            <DropdownMenuItem key={status} onSelect={() => setActiveStatusFilters(status)} className="flex justify-between">
                                {status}
                                {activeStatusFilters.includes(status) && <Check className="h-4 w-4" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              <TableHead style={{ minWidth: '280px', width: '24%' }} className="px-2">
                 {isAdmin && !isPatientProfile ? (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar por paciente o ID..."
                            className="w-full rounded-xl bg-white border-2 border-zinc-100 focus-visible:ring-amber-400 focus-visible:border-amber-400 pl-9 h-10 shadow-sm transition-all font-semibold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
                        />
                        {(isSearchActive) && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={onClearSearch}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                 ) : (
                    <div className='font-black text-[11px] w-full text-zinc-900 uppercase tracking-widest'>PACIENTE</div>
                 )}
              </TableHead>
              <TableHead className="px-2 align-middle" style={{ width: 'auto' }}>
                <div className="font-black text-[11px] text-zinc-900 uppercase tracking-widest">{getTableTitle().toUpperCase()}</div>
              </TableHead>
              <TableHead style={{ width: '170px' }} className="text-left font-black text-[11px] text-zinc-900 uppercase tracking-widest px-2">
                <div className="flex items-center gap-2 pr-6">
                    <DateRangePicker 
                        date={dateRange}
                        setDate={setDateRange}
                        onApply={onSearch}
                        align="start"
                        triggerClassName="font-black text-[11px] px-3 uppercase tracking-widest text-zinc-900 bg-transparent border-transparent shadow-none hover:bg-zinc-100 hover:border-zinc-200 h-9 w-full rounded-xl"
                        showMonths={1}
                    />
                </div>
              </TableHead>
              <TableHead style={{ width: '40px' }} className="text-right px-2">
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setIsSummaryVisible(!isSummaryVisible)}
                    title={isSummaryVisible ? "Ocultar Paneles" : "Ver Paneles"}
                    className="h-8 w-8 rounded-full text-zinc-400 hover:text-amber-600 hover:bg-amber-50"
                >
                    {isSummaryVisible ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isSearching ? (
                 <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Buscando...</span>
                      </div>
                    </TableCell>
                  </TableRow>
             ) : studies.length > 0 ? (
              studies.map((study) => {
                const currentStatus = statusConfig[study.status];
                const age = getAgeFromBirthDate(study.patient.birthDate);
                const permissions = canPerformAction(study);
                const singleStudy = study.studies[0];
                const isNew = !displayedStudiesRef.current.has(study.id);
                const isTech = userProfile?.rol === 'tecnologo';

                const showCompletionDialog = study.status === 'Pendiente' && (singleStudy.modality === 'RX' || singleStudy.modality === 'TAC') && (isTech || isAdmin);
                
                const StatusButtonContent = ({ isButton, onClick }: { isButton: boolean, onClick?: () => void }) => (
                  <div
                    onClick={onClick}
                    className={cn(
                      "w-full max-w-[120px] min-h-[58px] flex flex-col items-center justify-center font-black text-[9.5px] rounded-xl px-1 py-2 transition-all outline-none shadow-sm uppercase tracking-widest mx-auto",
                      currentStatus.style,
                      isButton
                        ? "cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        : "cursor-default",
                    )}
                  >
                    <currentStatus.icon className="h-5 w-5 mb-0.5" />
                    <span className="leading-tight text-center truncate w-full px-1">{currentStatus.label}</span>
                  </div>
                );

                const contrastIvMenuItem = (
                    <CreatinineDialog onConfirm={(creatinine) => handleSetContrast(study.id, 'IV', { creatinine })}>
                        <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                            <SyringeIcon className="mr-2 h-4 w-4" />
                            <span>Intravenoso (IV)</span>
                        </div>
                    </CreatinineDialog>
                );
                
                const ecoCompletionButton = (
                  <SelectOperatorDialog onConfirm={(operator) => handleStatusChange(study.id, 'Completado', undefined, operator)}>
                      <div className="w-full h-full"><StatusButtonContent isButton /></div>
                  </SelectOperatorDialog>
                );

                return (
                  <TableRow
                    key={study.id}
                    data-state={study.status === 'Cancelado' ? 'inactive' : 'active'}
                    className={cn(
                      'hover:bg-amber-50/40 transition-colors group',
                      'data-[state=inactive]:opacity-60',
                       isNew && 'animate-fade-in-row'
                    )}
                  >
                    <TableCell className="p-2">
                       {permissions.viewReport ? (
                         <button className="w-full h-full" onClick={() => setViewingReportStudy(study)}>
                            <StatusButtonContent isButton />
                         </button>
                       ) : isAdmin && isConsultations && study.status === 'Pendiente' ? (
                          <SelectSpecialistDialog study={study} specialists={specialists} onConfirm={(specialistId, specialistName) => updateStudyStatusAction(study.id, 'Completado', serializeUserProfile(userProfile), undefined, specialistName)}>
                             <div className="w-full h-full"><StatusButtonContent isButton /></div>
                          </SelectSpecialistDialog>
                      ): study.studies[0]?.modality === 'ECO' && study.status === 'Pendiente' ? (
                          ecoCompletionButton
                       ) : isAdmin && !isConsultations && singleStudy && !Modalities.includes(singleStudy.modality as any) && study.status === 'Pendiente' ? (
                          <SelectOperatorDialog onConfirm={(operator) => handleStatusChange(study.id, 'Completado', undefined, operator)}>
                             <div className="w-full h-full"><StatusButtonContent isButton /></div>
                          </SelectOperatorDialog>
                      ) : showCompletionDialog ? (
                          <CompletionDialog study={study} onConfirm={(params) => handleQuickStatusChange(study, params)}>
                            <div className="w-full h-full"><StatusButtonContent isButton /></div>
                          </CompletionDialog>
                      ) : (
                          <button
                            className="w-full h-full disabled:cursor-default"
                            disabled={!permissions.quickChange}
                            onClick={() => permissions.quickChange ? handleQuickStatusChange(study) : {}}
                          >
                            <StatusButtonContent isButton={permissions.quickChange} />
                          </button>
                      )}
                    </TableCell>
                    <TableCell className="p-2 align-top">
                        <div className="flex flex-col space-y-0">
                            <div className="h-5 flex items-center justify-between">
                               <Link href={`/patients/${study.patient.id}`} className="hover:underline flex-1 truncate pr-2">
                                  <span className="font-black text-sm uppercase text-zinc-900 tracking-wide leading-none">{study.patient.fullName}</span>
                               </Link>
                                <div className={cn(
                                    "w-[56px] h-[22px] rounded-lg border border-zinc-200 bg-white shadow-sm flex items-center justify-center font-black text-[10px] uppercase tracking-tighter shrink-0"
                                )}>
                                    <EditServiceDialog study={study}>
                                        <span className="font-mono font-bold cursor-pointer hover:underline text-[10px] leading-none">{abbreviateSubService(study.subService)}</span>
                                    </EditServiceDialog>
                                     {study.service === 'C.EXT' ? (
                                        <TurnNumberInput study={study} isAdmin={isAdmin} canAssignTurn={permissions.assignTurn}/>
                                    ) : (
                                        <BedNumberInput study={study} canEdit={permissions.editBed} />
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col space-y-0">
                                <div className="h-4 flex items-center text-xs text-muted-foreground gap-x-3 flex-wrap">
                                   <div className="flex items-center gap-1.5 shrink-0">
                                     <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                                     <span className="leading-none"><span className="font-semibold">ID:</span> {study.patient.id}</span>
                                   </div>
                                   <div className="flex items-center gap-1.5 shrink-0">
                                     <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                                     <span className="leading-none"><span className="font-semibold">FN:</span> {study.patient.birthDate}{age !== null ? ` - ${age} AÑOS` : ''}</span>
                                   </div>
                                </div>
                                {study.patient.entidad && (
                                  <div className="h-4 flex items-center text-xs text-muted-foreground gap-1.5 flex-nowrap">
                                    <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                                    <span className="truncate leading-none"><span className="font-semibold">ENTIDAD:</span> {formatEntityName(study.patient.entidad)}</span>
                                  </div>
                                )}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="p-2 align-top">
                        <div className='flex gap-3 items-start'>
                             <div className="h-5 flex items-center">
                                 <div className={cn(
                                    "w-[72px] h-[26px] rounded-lg border shadow-sm flex items-center justify-center gap-1.5 font-black text-[10px] uppercase tracking-wider shrink-0 bg-white",
                                    (() => {
                                        const mod = study.studies[0]?.modality?.toUpperCase();
                                        switch (mod) {
                                            case 'TAC': return "text-emerald-600 border-emerald-200 shadow-emerald-50";
                                            case 'RX': return "text-blue-600 border-blue-200 shadow-blue-50";
                                            case 'ECO': return "text-rose-600 border-rose-200 shadow-rose-50";
                                            case 'MAMO': return "text-pink-500 border-pink-200 shadow-pink-50";
                                            case 'DENSITOMETRIA': return "text-indigo-600 border-indigo-200 shadow-indigo-50";
                                            case 'RMN': return "text-amber-600 border-amber-200 shadow-amber-50";
                                            default: return "text-zinc-600 border-zinc-200 shadow-zinc-50";
                                        }
                                    })()
                                 )}>
                                    <ModalityIcon modality={study.studies[0]?.modality} className="h-3.5 w-3.5 text-black" />
                                    {study.studies[0]?.modality}
                                </div>
                             </div>
                            <div className="flex-1 min-w-0 pr-2 flex flex-col space-y-0">
                              {/* Line 1: Study Name */}
                              <div className="h-5 flex items-center">
                                <p className="font-black text-zinc-900 text-sm uppercase tracking-wide leading-none truncate" title={singleStudy?.nombre?.toUpperCase()}>
                                  {singleStudy?.nombre?.toUpperCase()}
                                </p>
                              </div>

                              {/* Line 2: Observations & Creatinine */}
                              <div className="h-4 flex items-center gap-x-3 flex-wrap text-xs text-muted-foreground">
                                {singleStudy?.details && (
                                    <div className="flex items-center gap-1.5 max-w-[280px] shrink-0 min-w-0" title={singleStudy.details}>
                                        <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                                        <span className="truncate leading-none"><span className="font-semibold">OBS:</span> {singleStudy.details.toUpperCase()}</span>
                                    </div>
                                )}
                                {study.contrastType === 'IV' && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                                        {study.creatinine ? (
                                            <span className="leading-none"><span className="font-semibold">CREAT:</span> {study.creatinine}</span>
                                        ) : (
                                            <span className="font-semibold leading-none">IV</span>
                                        )}
                                    </div>
                                )}
                                {study.contrastType === 'Bario' && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-1 w-1 rounded-full bg-zinc-300 shrink-0" />
                                        <span className="font-semibold leading-none">BARIO</span>
                                    </div>
                                )}
                              </div>

                              {/* Line 3: CUPS & CIE 10 */}
                              <div className="h-4 flex items-center gap-x-3 text-xs text-muted-foreground flex-wrap">
                                {singleStudy?.cups && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="h-1 w-1 rounded-full bg-zinc-300" />
                                    <span className="leading-none"><span className="font-semibold">CUPS:</span> {singleStudy.cups}</span>
                                  </div>
                                )}
                                {study.diagnosis.code && (
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <div className="h-1 w-1 rounded-full bg-zinc-300" />
                                    <span className="truncate leading-none" title={`${study.diagnosis.code}: ${study.diagnosis.description?.toUpperCase()}`}>
                                      <span className="font-semibold">CIE 10:</span> {study.diagnosis.code} - {study.diagnosis.description?.toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {study.status === 'Cancelado' && study.cancellationReason && (
                                  <div className="h-4 flex items-center">
                                    <p className="text-orange-500 text-xs font-semibold uppercase leading-none">
                                        MOTIVO: {study.cancellationReason.toUpperCase()}
                                    </p>
                                  </div>
                              )}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="p-2 align-top text-left w-[170px]">
                        <div className="flex flex-col space-y-0">
                            {study.requestDate ? (
                                <div className="h-4 flex items-center gap-1.5 text-xs text-red-500 font-bold">
                                    <div className="h-1 w-1 rounded-full shrink-0 bg-red-400" />
                                    <span className="leading-none"><span className="font-semibold inline-block w-[50px] text-red-600">PEND:</span> {(() => { const d = toDateValue(study.requestDate); return d ? format(d, "dd/MM, HH:mm") : '--'; })()}</span>
                                </div>
                            ) : <div className="h-4" />}
                            {study.completionDate ? (
                                <div className="h-4 flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                                    <div className="h-1 w-1 rounded-full shrink-0 bg-emerald-400" />
                                    <span className="leading-none"><span className="font-semibold inline-block w-[50px] text-emerald-600">COMP:</span> {(() => { const d = toDateValue(study.completionDate); return d ? format(d, "dd/MM, HH:mm") : '--'; })()}</span>
                                </div>
                            ) : <div className="h-4" />}
                            {study.readingDate ? (
                                <div className="h-4 flex items-center gap-1.5 text-xs text-indigo-500 font-bold">
                                    <div className="h-1 w-1 rounded-full shrink-0 bg-indigo-400" />
                                    <span className="leading-none"><span className="font-semibold inline-block w-[50px] text-indigo-600">INFO:</span> {(() => { const d = toDateValue(study.readingDate); return d ? format(d, "dd/MM, HH:mm") : '--'; })()}</span>
                                </div>
                            ) : <div className="h-4" />}
                        </div>
                    </TableCell>
                    <TableCell className="p-2 text-right align-top">
                    {(permissions.hasAnyAction || permissions.edit || permissions.cancel || permissions.delete || permissions.revert || permissions.contrast || canManageDocuments) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-7 w-7 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          {permissions.nursingNote && (
                            <DropdownMenuItem onClick={() => setNursingNoteStudy(study)}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Nota de Enfermería</span>
                            </DropdownMenuItem>
                          )}

                          {permissions.call && (
                              <DropdownMenuItem onClick={() => handleCallPatient(study)}>
                                <Bell className="mr-2 h-4 w-4" />
                                <span>Llamar Paciente</span>
                              </DropdownMenuItem>
                          )}
                          
                           {onAssignSpecialist &&(
                            <DropdownMenuItem onClick={() => onAssignSpecialist(study)}>
                              <User className="mr-2 h-4 w-4" />
                              <span>Asignar Especialista</span>
                            </DropdownMenuItem>
                          )}

                          {canManageDocuments && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <FileText className="mr-2 h-4 w-4" />
                                  <span>Documentos</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                      {/* Group 1: Clinical/Primary */}
                                      {!isAdmission && (
                                        <>
                                          <DropdownMenuItem onClick={() => handleDocumentOpen(study.id, 'consent')}>
                                              <FileHeart className="mr-2 h-4 w-4" />
                                              <span>Consentimiento Informado</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleDocumentOpen(study.id, 'checklist')}>
                                              <FileCheck className="mr-2 h-4 w-4" />
                                              <span>Lista de Chequeo</span>
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      
                                      <DropdownMenuItem onClick={() => handleDocumentOpen(study.id, 'survey')}>
                                          <FileQuestion className="mr-2 h-4 w-4" />
                                          <span>Encuesta de Satisfacción</span>
                                      </DropdownMenuItem>

                                      {/* Kit Contrastado between groups */}
                                      {isAdmin && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => handleKitContrastado(study.id)}>
                                              <SyringeIcon className="mr-2 h-4 w-4" />
                                              <span>Kit Contrastado</span>
                                          </DropdownMenuItem>
                                        </>
                                      )}

                                      {/* Group 2: External/Administrative */}
                                      <DropdownMenuSeparator />
                                      {isAdmin && (
                                        <DropdownMenuItem onClick={() => handleRequestAuthorization(study)}>
                                            <Mail className="mr-2 h-4 w-4" />
                                            <span>Solicitar a EPS</span>
                                        </DropdownMenuItem>
                                      )}

                                      {!isAdmission && !isTechnologist && (
                                        <DropdownMenuItem onClick={() => handleDocumentOpen(study.id, 'authorization')}>
                                            <FilePlus2 className="mr-2 h-4 w-4" />
                                            <span>Autorización Propia</span>
                                        </DropdownMenuItem>
                                      )}

                                      {!isTechnologist && (
                                        <DropdownMenuItem onClick={() => handleDocumentOpen(study.id, 'imaging-order')}>
                                          <Clipboard className="mr-2 h-4 w-4" />
                                          <span>Orden Imágenes Diagnósticas</span>
                                        </DropdownMenuItem>
                                      )}
                                  </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                              </DropdownMenuSub>
                          )}


                          {permissions.edit && (
                            <DropdownMenuItem onClick={() => onEditStudy(study)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                          )}

                          {permissions.attachReport && (
                            <DropdownMenuItem onClick={() => setAttachingReportToStudy(study)}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Adjuntar Informe</span>
                            </DropdownMenuItem>
                          )}

                          {permissions.contrast && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Beaker className="mr-2 h-4 w-4" />
                                <span>Contraste</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    {singleStudy?.modality === 'TAC' && contrastIvMenuItem}
                                    {singleStudy?.modality === 'RX' && (
                                        <>
                                        <DropdownMenuItem onClick={() => handleSetContrast(study.id, 'Bario')}>
                                            <Beaker className="mr-2 h-4 w-4" />
                                            <span>Oral/Rectal (Bario)</span>
                                        </DropdownMenuItem>
                                        {contrastIvMenuItem}
                                        </>
                                    )}
                                    {study.contrastType && (
                                        <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleRemoveContrast(study.id)} className="text-destructive">
                                            <XCircle className="mr-2 h-4 w-4" />
                                            <span>Quitar marca</span>
                                        </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                          )}

                          {permissions.revert && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start font-semibold text-sm relative flex select-none cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-all hover:bg-amber-50 hover:text-amber-900 focus:bg-amber-50 focus:text-amber-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-zinc-700"
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Revertir a Pendiente
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Â¿Revertir estudio?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción cambiará el estado a &quot;Pendiente&quot; y borrará las asociadas.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleStatusChange(study.id, 'Pendiente')}>
                                    Sí, revertir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {permissions.cancel && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  disabled={!permissions.cancel}
                                  className="w-full justify-start font-semibold text-sm relative flex select-none cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-all hover:bg-amber-50 hover:text-amber-900 focus:bg-amber-50 focus:text-amber-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-zinc-700"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancelar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Solicitud</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Selecciona un motivo para la cancelación. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <RadioGroup
                                  value={cancelReason}
                                  onValueChange={setCancelReason}
                                  className="my-4 grid grid-cols-2 gap-2"
                                >
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Error en la solicitud" id="r1" /><Label htmlFor="r1">Error en la solicitud</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Solicitud duplicada" id="r2" /><Label htmlFor="r2">Solicitud duplicada</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Petición del médico tratante" id="r3" /><Label htmlFor="r3">Petición del médico tratante</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Paciente no se presenta" id="r4" /><Label htmlFor="r4">Paciente no se presenta</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Paciente rechaza el procedimiento" id="r5" /><Label htmlFor="r5">Paciente rechaza el procedimiento</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Condición clínica del paciente no permite" id="r6" /><Label htmlFor="r6">Condición clínica del paciente no permite</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Falta de preparación del paciente" id="r7" /><Label htmlFor="r7">Falta de preparación del paciente</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Orden mal cargada" id="r8" /><Label htmlFor="r8">Orden mal cargada</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="No cumple ayuno" id="r9" /><Label htmlFor="r9">No cumple ayuno</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Paciente no colabora" id="r10" /><Label htmlFor="r10">Paciente no colabora</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Otro" id="r11" /><Label htmlFor="r11">Otro (especificar)</Label></div>
                                </RadioGroup>
                                {cancelReason === 'Otro' && (
                                    <Textarea 
                                        placeholder="Especifique el motivo de la cancelación..."
                                        value={customCancelReason}
                                        onChange={(e) => setCustomCancelReason(e.target.value)}
                                        className="my-2"
                                    />
                                )}
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => { setCancelReason(''); setCustomCancelReason(''); }}>Cerrar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleCancelStudy(study.id)}>
                                    Confirmar Cancelación
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          
                          {permissions.delete && (
                            <>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  disabled={!permissions.delete}
                                  className="w-full justify-start font-semibold text-sm relative flex select-none cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-all hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:text-red-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-red-500"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Â¿Estás seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción es permanente y no se puede deshacer. La solicitud se eliminará de
                                    la base de datos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteStudy(study.id)}>
                                    Sí, eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                       )}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No se encontraron solicitudes.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {hasMore && !isSearchActive && (
        <div className="flex justify-center py-6">
          <Button 
            onClick={onLoadMore} 
            disabled={isLoadingMore}
            variant="outline"
            className="rounded-full shadow-sm bg-white border-2 border-zinc-200 text-zinc-500 hover:text-amber-600 hover:border-amber-300 focus-visible:ring-amber-400 hover:bg-amber-50/50 transition-all h-10 px-8 font-black text-xs uppercase tracking-widest gap-2 min-w-[200px]"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                CARGANDO...
              </>
            ) : (
              "Ver más solicitudes"
            )}
          </Button>
        </div>
      )}
    </>
  );
}









