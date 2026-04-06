"use client"

import * as React from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Edit, XCircle, FileText, Search, Calendar as CalendarIcon, AlertTriangle, CheckCircle, Ban, ChevronsUp, ChevronsDown, Trash2, Download, Loader2, Check, RotateCcw, Beaker, Droplets, Minus, Plus, User, Building, Fingerprint, CalendarDays, Stethoscope, Briefcase, FileHeart, FileQuestion, FilePlus2, FileCheck, X, Mail, Bed, Bell, Mic, FileUp, Play, StopCircle, CornerDownLeft, Clipboard, Activity, Package, Settings2, Info, CheckCircle2, ChevronRight } from 'lucide-react';
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
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
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
            <AlertDialogContent className="p-0 overflow-hidden bg-white border-2 border-zinc-200 shadow-2xl max-w-sm">
                <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-700 p-4 text-white relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10 scale-125 rotate-12 pointer-events-none">
                        <User className="h-14 w-14" />
                    </div>
                    <AlertDialogHeader className="relative z-10 text-left">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900/40 rounded-full border border-white/10 mb-2 backdrop-blur-md">
                            <Stethoscope className="h-2.5 w-2.5 text-amber-300" />
                            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white">Validación de Especialista</span>
                        </div>
                        <AlertDialogTitle className="text-lg font-black tracking-tight leading-none mb-0.5">
                            Seleccionar Operador
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white font-bold text-[9px] opacity-90">
                           Elija el profesional que realizó el estudio para continuar.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </div>

                <div className="p-4 space-y-4 bg-zinc-50/10 min-h-[120px] flex flex-col justify-center">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cargando especialistas...</span>
                        </div>
                    ) : (
                        <RadioGroup
                            value={selectedOperator ?? undefined}
                            onValueChange={setSelectedOperator}
                            className="grid gap-2"
                        >
                            {operators.length === 0 ? (
                                <div className="text-center py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic">
                                    No se encontraron especialistas activos
                                </div>
                            ) : (
                                operators.map((op) => {
                                    const isSelected = selectedOperator === op;
                                    return (
                                        <div key={op}>
                                            <RadioGroupItem value={op} id={`op-table-${op.replace(/\s+/g, '-')}`} className="sr-only" />
                                            <Label 
                                                htmlFor={`op-table-${op.replace(/\s+/g, '-')}`} 
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer group",
                                                    isSelected 
                                                        ? "bg-amber-50 border-amber-500 shadow-sm" 
                                                        : "bg-white border-zinc-100 hover:border-amber-200 hover:bg-zinc-50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    isSelected ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-400 group-hover:bg-amber-100 group-hover:text-amber-600"
                                                )}>
                                                    <User className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={cn(
                                                        "text-xs font-black uppercase transition-colors leading-none",
                                                        isSelected ? "text-amber-900" : "text-zinc-600 group-hover:text-amber-800"
                                                    )}>
                                                        {op}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">Radiólogo Especialista</span>
                                                </div>
                                                {isSelected && (
                                                    <div className="ml-auto">
                                                        <CheckCircle2 className="h-4 w-4 text-amber-500" />
                                                    </div>
                                                )}
                                            </Label>
                                        </div>
                                    );
                                })
                            )}
                        </RadioGroup>
                    )}
                </div>

                <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-2.5 rounded-b-xl">
                    <AlertDialogCancel className="h-9 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all mt-0 border-none shadow-none">
                        Cerrar
                    </AlertDialogCancel>
                    <Button 
                        onClick={handleConfirm}
                        disabled={!selectedOperator || loading}
                        className="h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-amber-100 hover:shadow-amber-200 transition-all flex items-center gap-1.5 group"
                    >
                        Confirmar <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                </div>
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
                                <RadioGroupItem value={spec.id} id={`spec-${spec.id.replace(/\s+/g, '-')}`} />
                                <Label htmlFor={`spec-${spec.id.replace(/\s+/g, '-')}`} className="text-base font-medium w-full cursor-pointer">
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
                        <Label htmlFor="service-select">Servicio General</Label>
                        <Select value={service} onValueChange={(v) => handleServiceChange(v as GeneralService)}>
                            <SelectTrigger id="service-select">
                                <SelectValue placeholder="Seleccione un servicio" />
                            </SelectTrigger>
                            <SelectContent>
                                {GeneralServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="subservice-select">Sub-Servicio</Label>
                        <Select value={subService} onValueChange={(v) => setSubService(v as SubServiceArea)}>
                            <SelectTrigger id="subservice-select">
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
  customGauge: z.string().optional(),
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
                    const finalName = abbocath.id === 'OTHER' ? `ABBOCATH ${abbocath.customGauge}` : abbocath.name;
                    // If it was a number selection, we try to match the ID from availableAbbocaths again just in case
                    let finalId = abbocath.id;
                    if (['18', '20', '22', '24'].includes(abbocath.id)) {
                        const match = availableAbbocaths.find(a => a.specification?.includes(abbocath.id));
                        if (match) finalId = match.id;
                    }
                    consumedItems.push({ id: finalId, name: finalName, amount: abbocath.amount });
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
        
        const dedupedConsumedItems: ConsumedItem[] = [];
        const seenIds = new Set();
        consumedItems.forEach(item => {
            if (!seenIds.has(item.id)) {
                dedupedConsumedItems.push(item);
                seenIds.add(item.id);
            }
        });

        const finalParams: CompletionParams = {
            kV: parseFloat((data.kV || "0").replace(',', '.')) || undefined,
            mA: parseFloat((data.mA || "0").replace(',', '.')) || undefined,
            timeMs: parseFloat((data.timeMs || "0").replace(',', '.')) || undefined,
            ctdi: parseFloat((data.ctdi || "0").replace(',', '.')) || undefined,
            dlp: parseFloat((data.dlp || "0").replace(',', '.')) || undefined,
            consumedItems: dedupedConsumedItems.length > 0 ? dedupedConsumedItems : undefined,
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
                <FormItem className="space-y-1">
                    <FormLabel className="text-[9px] font-black uppercase text-zinc-400">{label}</FormLabel>
                    <div className="flex items-center bg-zinc-100/80 rounded-xl border border-zinc-200 overflow-hidden group focus-within:border-emerald-500 transition-all">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => form.setValue(name, String(Math.max(0, parseInt(String(field.value || '0')) - 1)) as any)}><Minus className="h-3 w-3" /></Button>
                        <FormControl>
                            <Input type="number" {...field} id={name} name={name} aria-label={label} className="h-8 w-12 border-none bg-transparent text-center font-black text-xs p-0 focus-visible:ring-0" />
                        </FormControl>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => form.setValue(name, String(parseInt(String(field.value || '0')) + 1) as any)}><Plus className="h-3 w-3" /></Button>
                    </div>
                </FormItem>
            )}
        />
    );
    
    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</AlertDialogTrigger>
            <AlertDialogContent className="p-0 overflow-hidden bg-white border-2 border-zinc-200 shadow-2xl max-w-lg">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleConfirm)}>
                    <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-900 p-4 text-white relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10 scale-110 rotate-12 pointer-events-none">
                            <CheckCircle2 className="h-16 w-16" />
                        </div>
                        <AlertDialogHeader className="relative z-10 text-left">
                            <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-zinc-900/40 rounded-full border border-white/10 mb-2 backdrop-blur-md">
                                <Activity className="h-3 w-3 text-emerald-300" />
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Finalización de Estudio</span>
                            </div>
                            <AlertDialogTitle className="text-lg font-black tracking-tight leading-none mb-0.5">
                                Registrar Resultado
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-emerald-100 font-bold text-[10px] opacity-90 truncate max-w-[400px]">
                              {study.studies[0]?.nombre.toUpperCase()}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>

                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto bg-zinc-50/10">
                        {/* Section 01: Adquisición */}
                        {(modality === 'RX' || modality === 'TAC') && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-1.5 font-black text-zinc-900 uppercase tracking-widest text-[9px]">
                                    <div className="p-1 bg-emerald-100 text-emerald-700 rounded-md">
                                        <Settings2 className="h-3 w-3" />
                                    </div>
                                    01. Parámetros de Adquisición
                                </div>
                                
                                {modality === 'RX' ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        <FormField control={form.control} name="kV" render={({ field }) => ( 
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] font-black uppercase text-zinc-400">kV</FormLabel>
                                                <FormControl><Input autoFocus {...field} className="h-8 bg-white border border-zinc-200 focus:bg-emerald-50/50 focus:border-emerald-500 transition-all text-center font-black text-xs shadow-sm rounded-lg" /></FormControl>
                                            </FormItem> 
                                        )}/>
                                        <FormField control={form.control} name="mA" render={({ field }) => ( 
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] font-black uppercase text-zinc-400">mA</FormLabel>
                                                <FormControl><Input {...field} className="h-8 bg-white border border-zinc-200 focus:bg-emerald-50/50 focus:border-emerald-500 transition-all text-center font-black text-xs shadow-sm rounded-lg" /></FormControl>
                                            </FormItem> 
                                        )}/>
                                        <FormField control={form.control} name="timeMs" render={({ field }) => ( 
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] font-black uppercase text-zinc-400">Tiempo (ms)</FormLabel>
                                                <FormControl><Input {...field} className="h-8 bg-white border border-zinc-200 focus:bg-emerald-50/50 focus:border-emerald-500 transition-all text-center font-black text-xs shadow-sm rounded-lg" /></FormControl>
                                            </FormItem> 
                                        )}/>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField control={form.control} name="ctdi" render={({ field }) => ( 
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] font-black uppercase text-zinc-400">CTDI (mGy)</FormLabel>
                                                <FormControl><Input autoFocus placeholder="0" {...field} className="h-8 bg-white border border-zinc-200 focus:bg-emerald-50/50 focus:border-emerald-500 transition-all text-center font-black text-xs shadow-sm rounded-lg" /></FormControl>
                                            </FormItem> 
                                        )}/>
                                        <FormField control={form.control} name="dlp" render={({ field }) => ( 
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] font-black uppercase text-zinc-400">DLP (mGy-cm)</FormLabel>
                                                <FormControl><Input {...field} placeholder="0" className="h-8 bg-white border border-zinc-200 focus:bg-emerald-50/50 focus:border-emerald-500 transition-all text-center font-black text-xs shadow-sm rounded-lg" /></FormControl>
                                            </FormItem> 
                                        )}/>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Section 02: Medio de Contraste */}
                        {isContrastedIV && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-1.5 font-black text-zinc-900 uppercase tracking-widest text-[9px]">
                                    <div className="p-1 bg-rose-100 text-rose-700 rounded-md">
                                        <SyringeIcon className="h-3 w-3" />
                                    </div>
                                    02. Medio de Contraste
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-[9px] font-black uppercase text-zinc-400">Creatinina</Label>
                                      <div className="h-8 bg-zinc-100 border border-zinc-200 rounded-lg flex items-center justify-center font-black text-zinc-600 text-xs shadow-inner">
                                        {study.creatinine ? `${study.creatinine} mg/dL` : 'N/A'}
                                      </div>
                                    </div>
                                    <FormField control={form.control} name="contrastAdministeredMl" render={({ field }) => ( 
                                        <FormItem className="space-y-1">
                                            <FormLabel className="text-[9px] font-black uppercase text-zinc-400 tracking-tighter text-nowrap">Cant. Adminis. (ml)</FormLabel>
                                            <FormControl><Input {...field} placeholder="Ej: 70" className="h-8 bg-white border border-zinc-200 focus:bg-rose-50/50 focus:border-rose-500 transition-all text-center font-black text-xs shadow-sm rounded-lg"/></FormControl>
                                        </FormItem> 
                                    )}/>
                                </div>
                            </div>
                        )}

                        {/* Section 03: Insumos */}
                        {showSupplyRegistration && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-1.5 font-black text-zinc-900 uppercase tracking-widest text-[9px]">
                                    <div className="p-1 bg-zinc-900 text-white rounded-md">
                                        <Package className="h-3 w-3" />
                                    </div>
                                    03. Registro de Insumos
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-zinc-100/50 p-3 rounded-xl border border-zinc-200">
                                    <QuantityInput name="jeringaAmount" label="Jeringas" />
                                    <QuantityInput name="extensionAmount" label="Extensiones"/>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter">Abbocaths</span>
                                        <Button type="button" variant="ghost" size="sm" className="h-6 rounded-md text-emerald-700 hover:bg-emerald-50 font-black text-[8px] uppercase tracking-widest px-2" onClick={() => append({ id: '', name: 'ABBOCATH', amount: 1, customGauge: '' })}>
                                            <Plus className="mr-1 h-2.5 w-2.5" /> Agregar
                                        </Button>
                                    </div>
                                    <div className="grid gap-2">
                                        {fields.length === 0 && (
                                            <div className="h-10 border border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-[9px] font-bold text-zinc-300 uppercase tracking-widest">
                                                Sin Abbocaths registrados
                                            </div>
                                        )}
                                        {fields.map((item, index) => {
                                            const isOther = form.watch(`abbocaths.${index}.id`) === 'OTHER';
                                            return (
                                            <div key={item.id} className="grid grid-cols-[1fr,auto,auto] gap-2 items-end p-2 bg-white border border-zinc-100 rounded-xl shadow-sm animate-in slide-in-from-top-1 duration-200">
                                                <div className="space-y-2">
                                                    <FormField
                                                        control={form.control}
                                                        name={`abbocaths.${index}.id`}
                                                        render={({ field }) => (
                                                            <FormItem className="space-y-1">
                                                                <FormLabel className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter">Calibre #{index + 1}</FormLabel>
                                                                <Select 
                                                                    onValueChange={(value) => {
                                                                        field.onChange(value);
                                                                        if (value !== 'OTHER') {
                                                                            const selectedAbbocath = availableAbbocaths.find(a => 
                                                                                a.id === value || a.specification?.includes(value)
                                                                            );
                                                                            form.setValue(`abbocaths.${index}.name`, selectedAbbocath?.name || `ABBOCATH #${value}`);
                                                                            if (selectedAbbocath) form.setValue(`abbocaths.${index}.id`, selectedAbbocath.id);
                                                                        }
                                                                    }} 
                                                                    value={field.value}
                                                                >
                                                                    <FormControl><SelectTrigger className="h-8 bg-zinc-50/50 rounded-lg border border-zinc-100 font-bold text-xs"><SelectValue placeholder="Calibre..." /></SelectTrigger></FormControl>
                                                                    <SelectContent>
                                                                        {["18", "20", "22", "24"].map(g => (
                                                                            <SelectItem key={g} value={g}>#{g}</SelectItem>
                                                                        ))}
                                                                        <SelectItem value="OTHER">OTRO</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    {isOther && (
                                                        <FormField
                                                            control={form.control}
                                                            name={`abbocaths.${index}.customGauge`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-1">
                                                                    <FormControl>
                                                                        <Input {...field} placeholder="Escriba calibre..." className="h-7 text-[10px] font-bold py-0 rounded-md" />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    )}
                                                </div>
                                                <QuantityInput name={`abbocaths.${index}.amount`} label="Cant." />
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => remove(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-3 rounded-b-xl">
                        <AlertDialogCancel className="h-9 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all mt-0 shadow-none">
                            Cancelar
                        </AlertDialogCancel>
                        <Button 
                            type="submit" 
                            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-emerald-100 hover:shadow-emerald-200 transition-all flex items-center gap-1.5"
                        >
                            Completar <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        </Button>
                    </div>
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

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                {children}
            </AlertDialogTrigger>
            <AlertDialogContent className="p-0 overflow-hidden bg-white border-2 border-zinc-200 shadow-2xl max-w-sm">
                <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-orange-800 p-4 text-white relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10 scale-125 rotate-12 pointer-events-none">
                        <SyringeIcon className="h-14 w-14" />
                    </div>
                    <AlertDialogHeader className="relative z-10 text-left">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900/40 rounded-full border border-white/10 mb-2 backdrop-blur-md">
                            <Droplets className="h-2.5 w-2.5 text-amber-300" />
                            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white">Seguridad del Paciente</span>
                        </div>
                        <AlertDialogTitle className="text-lg font-black tracking-tight leading-none mb-0.5">
                            Valor de Creatinina
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white font-bold text-[9px] opacity-90">
                            Requerido para administración de contraste.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </div>

                <div className="p-5 space-y-4 bg-zinc-50/10">
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                            <Label htmlFor="creatinine-input" className="text-[8px] font-black uppercase text-zinc-400 tracking-wider">
                                Creatinina (mg/dL)
                            </Label>
                        </div>
                        <div className="relative group">
                            <Input
                                id="creatinine-input"
                                ref={inputRef}
                                type="text"
                                value={creatinine}
                                onChange={(e) => setCreatinine(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                className="h-10 bg-white border border-zinc-200 focus:bg-amber-50/30 focus:border-amber-500 transition-all text-center font-black text-xl shadow-inner rounded-xl group-hover:border-zinc-300"
                                placeholder="0.00"
                                autoFocus
                            />
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-300 font-black text-[10px] group-focus-within:text-amber-500 transition-colors">
                                mg/dL
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-2.5 rounded-b-xl">
                    <AlertDialogCancel className="h-9 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all mt-0 border-none shadow-none">
                        Cerrar
                    </AlertDialogCancel>
                    <Button 
                        onClick={handleConfirm}
                        disabled={!creatinine || isNaN(parseFloat(creatinine.replace(',', '.')))}
                        className="h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-amber-100 hover:shadow-amber-200 transition-all flex items-center gap-1.5 group"
                    >
                        Guardar <CheckCircle2 className="h-3 w-3 shrink-0" />
                    </Button>
                </div>
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
            <DialogPrimitiveContent className="sm:max-w-5xl p-0 overflow-hidden bg-white border-2 border-zinc-200 shadow-2xl selection:bg-blue-100 max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 p-6 text-white relative border-b border-white/10 flex-shrink-0">
                   <div className="absolute top-0 right-0 p-8 opacity-10 scale-125 rotate-12 pointer-events-none">
                       <FileText className="h-24 w-24" />
                   </div>
                   <DialogHeader className="relative z-10 text-left">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-zinc-900/40 rounded-full border border-white/10 mb-3 backdrop-blur-md">
                            <Stethoscope className="h-3 w-3 text-blue-300" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Centro de Informes</span>
                        </div>
                        <DialogTitle className="text-2xl font-black tracking-tight leading-none mb-2">
                           {study?.studies[0]?.nombre}
                        </DialogTitle>
                        <DialogDescription className="text-blue-100 font-semibold text-sm opacity-90">
                            Finalice el estudio redactando o adjuntando el PDF oficial.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 flex-grow overflow-y-auto">
                    {/* Opción 1: Redactar */}
                    <div className="p-7 border-r-2 border-zinc-100 bg-white group flex flex-col">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 group-hover:scale-105 transition-transform">
                                <Mic className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-black text-zinc-900 uppercase tracking-tighter text-base leading-none">01. Redactar / Dictar</h4>
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.1em] mt-1">Hallazgos Clínicos</p>
                            </div>
                        </div>

                        <div className="relative flex flex-col h-[300px]">
                            <div className="relative flex-grow flex flex-col">
                                <Textarea
                                    value={reportText}
                                    onChange={(e) => setReportText(e.target.value)}
                                    className="flex-grow resize-none text-sm font-bold leading-relaxed p-5 bg-zinc-100/50 border-2 border-zinc-100 rounded-[2rem] focus:bg-white focus:border-blue-600 focus:ring-0 transition-all placeholder:text-zinc-400 text-zinc-800 shadow-inner"
                                    placeholder="Inicie la redacción aquí..."
                                />
                                {transcribing && (
                                    <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center rounded-[2rem] z-20 border-2 border-blue-50">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-700 mb-3" />
                                        <p className="font-black text-blue-800 uppercase tracking-widest text-[9px]">Transcribiendo...</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <Button 
                                    variant="outline" 
                                    onClick={handleLoadTemplate} 
                                    disabled={loading || isRecording}
                                    className="h-11 border-2 border-zinc-200 rounded-xl hover:bg-zinc-900 hover:text-white transition-all font-black text-[9px] uppercase tracking-widest group"
                                >
                                    <CornerDownLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
                                    Plantilla
                                </Button>
                                {isRecording ? (
                                    <Button 
                                        variant="destructive" 
                                        onClick={handleStopRecording}
                                        className="h-11 rounded-xl font-black text-[9px] uppercase tracking-widest animate-pulse"
                                    >
                                        <StopCircle className="h-4 w-4 mr-2" /> Detener
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="secondary" 
                                        onClick={handleStartRecording} 
                                        disabled={loading}
                                        className="h-11 bg-blue-50 text-blue-800 hover:bg-blue-100 border-2 border-blue-100 rounded-xl font-black text-[9px] uppercase tracking-widest"
                                    >
                                        <Mic className="h-4 w-4 mr-2" /> Dictar
                                    </Button>
                                )}
                            </div>

                            <Button 
                                onClick={() => handleAttach('template')} 
                                disabled={!reportText || loading || isRecording} 
                                className={cn(
                                    "w-full h-12 mt-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all",
                                    !reportText || loading || isRecording 
                                        ? "bg-zinc-100 text-zinc-400 border border-zinc-200" 
                                        : "bg-zinc-900 hover:bg-black text-white shadow-xl shadow-zinc-200"
                                )}
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                    <div className="flex items-center gap-2">
                                        Confirmar Hallazgo <CheckCircle className="h-4 w-4" />
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Opción 2: Cargar PDF */}
                    <div className="p-7 bg-zinc-50/50 group flex flex-col">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-50 group-hover:scale-105 transition-transform">
                                <FileUp className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-black text-zinc-900 uppercase tracking-tighter text-base leading-none">02. Cargar Informe</h4>
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.1em] mt-1">Archivo PDF Oficial</p>
                            </div>
                        </div>

                        <div className="flex flex-col h-[300px]">
                            <div className="flex-grow">
                                <label 
                                    htmlFor="file-upload-dialog" 
                                    className={cn(
                                        "flex flex-col items-center justify-center w-full h-full border-4 border-dashed rounded-[2.5rem] cursor-pointer transition-all duration-500 overflow-hidden relative",
                                        file 
                                            ? "bg-emerald-50 border-emerald-500" 
                                            : "bg-white border-zinc-200 hover:border-blue-600 hover:shadow-xl hover:shadow-blue-50"
                                    )}
                                >
                                    <div className="flex flex-col items-center justify-center p-6 text-center relative z-10">
                                        <div className={cn(
                                            "w-16 h-16 rounded-full flex items-center justify-center mb-5 transition-all duration-500 shadow-lg",
                                            file 
                                                ? "bg-emerald-600 text-white" 
                                                : "bg-zinc-50 text-zinc-400 group-hover:bg-blue-600 group-hover:text-white"
                                        )}>
                                            {file ? <Check className="w-8 h-8" /> : <FileUp className="w-6 h-6" />}
                                        </div>
                                        
                                        {file ? (
                                            <div className="animate-in zoom-in-95 duration-500">
                                                <p className="text-emerald-900 font-black text-base tracking-tight mb-2 uppercase break-all px-4 leading-tight">{file.name}</p>
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-md shadow-emerald-50">
                                                    PDF Listo <CheckCircle className="h-3 w-3" />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-zinc-900 font-black text-lg tracking-tight mb-2 uppercase">Subir archivo</p>
                                                <p className="text-zinc-400 font-bold text-[9px] px-8 leading-tight uppercase tracking-widest leading-relaxed">Máximo 2MB · .PDF</p>
                                            </>
                                        )}
                                    </div>
                                    <Input id="file-upload-dialog" type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                                </label>
                            </div> 

                            <Button 
                                onClick={() => handleAttach('pdf')} 
                                disabled={!file || loading || isRecording} 
                                className={cn(
                                    "w-full h-12 mt-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all",
                                    !file || loading || isRecording 
                                        ? "bg-zinc-100 text-zinc-400 border border-zinc-200" 
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-200"
                                )}
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                    <div className="flex items-center gap-2">
                                        Enviar Archivo <FileCheck className="h-4 w-4" />
                                    </div>
                                )}
                            </Button>
                        </div>
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
        if (value.length <= 3) {
            setTurn(value);
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (turn) {
          try {
            const result = await updateStudyTurnNumberAction(study.id, turn.padStart(3, '0'));
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

    const canEdit = isAdmin || rol === 'admisionista';
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
      <div className="rounded-[2.5rem] border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] bg-white/80 backdrop-blur-3xl overflow-hidden ring-1 ring-zinc-200/50">
        <Table style={{ tableLayout: 'fixed' }}>
          <TableHeader>
            <TableRow className="bg-zinc-50/80 hover:bg-zinc-50 border-b-2 border-zinc-100">
              <TableHead className="p-2" style={{ width: '130px' }}>
                <div className="font-black text-[11px] w-full text-center text-zinc-900 uppercase tracking-widest">ESTADO</div>
              </TableHead>
              <TableHead style={{ minWidth: '280px', width: '24%' }} className="px-2">
                 {(isAdmin || isAdmission) && !isPatientProfile ? (
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
                        triggerClassName="font-black text-[11px] px-3 uppercase tracking-widest text-zinc-900 bg-transparent border-transparent shadow-none hover:bg-zinc-100 hover:border-zinc-200 hover:text-zinc-900 h-9 w-full rounded-xl"
                        showMonths={1}
                    />
                </div>
              </TableHead>
              <TableHead style={{ width: '40px' }} className="text-right px-2"></TableHead>
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
                      'hover:bg-amber-50/50 transition-all duration-300 group z-10 relative cursor-default hover:scale-[1.002] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]',
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
                                        <TurnNumberInput study={study} isAdmin={isAdmin || isAdmission} canAssignTurn={permissions.assignTurn}/>
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
                                      {(isAdmin || isAdmission) && (
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
                                  <AlertDialogTitle>¿Revertir estudio?</AlertDialogTitle>
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
                                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
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









