"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { collection, query, onSnapshot, orderBy, where, Timestamp, limit as firestoreLimit, startAfter, getDocs, DocumentSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study, GeneralService, UserProfile, Modality, StudyStatus, OperationalStatus, StudyWithCompletedBy, ContrastType, OrderData, SubServiceArea, Specialist } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { GeneralServices, Modalities, UserRoles } from '@/lib/types';
import { ALL_CONSULTATIONS } from '@/lib/consultations-data';
import { startOfDay, endOfDay } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { StudyDialog } from '@/components/app/study-dialog';
import { EditStudyDialog } from '@/components/app/edit-study-dialog';
import { StudyTable } from '@/components/app/study-table';
import { Search, UploadCloud, Loader2, Paperclip, Check, AlertCircle, Eye, LifeBuoy, AlertTriangle, Stethoscope, User, Send, ShieldAlert } from 'lucide-react';
import type { DateRange } from "react-day-picker";
import { createStudyAction, searchStudiesAction, sendConsultationSummaryAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { HospitalIcon } from '@/components/icons/hospital-icon';
import { UciIcon } from '@/components/icons/uci-icon';
import { CextIcon } from '@/components/icons/cext-icon';
import { ShieldPlus, Hourglass, ListChecks, LogOutIcon, FileClock, FileCheck2 } from 'lucide-react';
import { OperatorSelectionDialog } from '@/components/app/operator-selection-dialog';
import { useShiftChangeReminder } from '@/hooks/use-shift-change-reminder';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { extractConsultationData } from '@/ai/flows/extract-consultation-flow';
import { ServiceSelectionDialog } from '@/components/app/service-selection-dialog';
import { DuplicateStudyDialog } from '@/components/app/duplicate-study-dialog';
import { ModalityIcon } from '@/components/icons/modality-icon';
import { ViewModeSwitch } from '@/components/app/view-mode-switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotifyDialog } from '@/components/app/notify-dialog';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SelectStudiesDialog } from '@/components/app/select-studies-dialog';

const ALL_FILTER = "TODOS";
const ALL_SERVICES: (GeneralService | typeof ALL_FILTER)[] = [ALL_FILTER, ...[...GeneralServices].sort()];

const uniqueSpecialties = [...new Map(ALL_CONSULTATIONS.map(item => [item.especialidad, item])).values()]
  .sort((a, b) => a.especialidad.localeCompare(b.especialidad));

const ALL_SPECIALTIES_DATA = [
    { value: ALL_FILTER, name: "TODOS" },
    ...uniqueSpecialties.map(c => ({ value: c.especialidad, name: c.especialidad }))
];
const ALL_SPECIALTIES_VALUES = [ALL_FILTER, ...Array.from(new Set(uniqueSpecialties.map(c => c.especialidad)))];

const serviceIcons: Record<GeneralService | 'TODOS', React.ElementType> = {
  "URG": ShieldPlus, "HOSP": HospitalIcon, "UCI": UciIcon, "C.EXT": CextIcon, "TODOS": ShieldPlus,
};

const serviceDisplayNames: Record<GeneralService | 'TODOS', string> = {
  "URG": "URGENCIAS", "HOSP": "HOSPITALIZACIÓN", "UCI": "UCI", "C.EXT": "C. EXTERNA", "TODOS": "TODOS",
};

const specialtyIcons: Record<string, React.ElementType> = ALL_SPECIALTIES_VALUES.reduce((acc, spec) => {
    acc[spec] = Stethoscope;
    return acc;
}, {} as Record<string, React.ElementType>);


type SummaryCounts = {
    services: Record<GeneralService | 'TODOS', number>;
    specialties: Record<string, number>;
};

type DetailedPendingSummary = {
    specialty: string;
    total: number;
    services: { name: GeneralService, count: number }[];
};


type ActiveFilters = {
    service: GeneralService | typeof ALL_FILTER;
    specialty: string;
    status: StudyStatus[];
};


function UnifiedControlPanel({ 
    onManualRequest, 
    userProfile, 
    currentProfile,
    summary, 
    activeFilters, 
    onFilterToggle,
    onAiExtraction,
    aiLoading,
    orderType = 'ADES',
    onOrderTypeChange
}: any) {
    const [dragging, setDragging] = useState(false);
    const [newPatientId, setNewPatientId] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        onAiExtraction(files[0]);
    };
    
    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    event.preventDefault(); 
                    onAiExtraction(file);
                }
            }
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); if (!aiLoading) setDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault(); e.stopPropagation(); setDragging(false);
        if (!aiLoading) { onAiExtraction(e.dataTransfer.files[0]); }
    };
    
    const canCreateRequest = useMemo(() => {
        return currentProfile?.rol === 'administrador';
    }, [currentProfile]);

    const canEnterId = useMemo(() => {
        return currentProfile?.rol === 'administrador';
    }, [currentProfile]);
    
    const getPlaceholderText = () => {
      if(!canEnterId) return "Arrastre o pegue un archivo aquí";
      return "Crear solicitud...";
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (currentProfile?.rol === 'enfermero') {
        if (e.key === 'Enter') e.preventDefault(); return;
      }
      if (e.key === 'Enter' && newPatientId) { 
        onManualRequest(newPatientId); setNewPatientId(''); 
      }
    }

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (currentProfile?.rol === 'enfermero') return;
        setNewPatientId(e.target.value.replace(/[^0-9]/g, ''));
    }
    
    const isServiceFilterDisabled = currentProfile?.rol === 'admisionista' && currentProfile?.rol !== 'administrador';

    const FilterPopover = ({ title, type, options, activeValue, iconMap, nameMap, disabled = false }: { title:string, type: 'service' | 'specialty', options: readonly any[], activeValue: string, iconMap: any, nameMap?: any, disabled?: boolean }) => (
      <div>
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1 mb-0.5 block">{title}</label>
          <Popover>
              <PopoverTrigger asChild disabled={disabled}>
                  <button disabled={disabled} className={cn("flex items-center gap-2 p-2 rounded-2xl border-2 bg-white/80 backdrop-blur-sm text-center transition-all duration-300 w-full justify-between h-14", disabled ? "cursor-not-allowed opacity-50" : "hover:border-amber-500 hover:bg-amber-50 hover:-translate-y-1 hover:shadow-lg", activeValue !== 'TODOS' ? "border-amber-600 shadow-lg shadow-amber-50" : "border-zinc-100")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-xl transition-colors", activeValue === 'TODOS' ? "bg-zinc-100 text-zinc-400" : "bg-amber-100 text-amber-600")}>
                           {React.createElement(iconMap[activeValue] || iconMap.TODOS, { className: "h-5 w-5" })}
                        </div>
                        <span className="font-black text-[11px] tracking-tight uppercase">{(nameMap ? nameMap[activeValue] : activeValue)}</span>
                      </div>
                      <span className="font-black text-2xl tracking-tighter text-zinc-900">{type === 'service' ? summary.services[activeValue as GeneralService] : summary.specialties[activeValue]}</span>
                  </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1">
                  <ScrollArea className="h-72">
                    <div className="flex flex-col gap-1 pr-3">
                      {options.map((option) => {
                         const isActive = activeValue === option.value;
                         const getOptionColor = (name: string) => {
                             const upper = name.toUpperCase();
                             if (upper.includes('ECO')) return 'text-red-600 hover:bg-red-50';
                             if (upper.includes('MAGNETIC')) return 'text-yellow-600 hover:bg-yellow-50';
                             if (upper.includes('RAYOS') || upper.includes('RX')) return 'text-blue-600 hover:bg-blue-50';
                             if (upper.includes('TOMO') || upper.includes('TAC')) return 'text-emerald-600 hover:bg-emerald-50';
                             return '';
                         };
                         const colorClass = isActive ? "" : getOptionColor(option.name);

                         return (
                           <Button 
                              key={option.value} 
                              variant={isActive ? 'default' : 'ghost'} 
                              className={cn(
                                  "justify-start uppercase font-black text-[10px] tracking-widest transition-all",
                                  isActive ? "" : colorClass
                              )} 
                              onClick={() => onFilterToggle(type, option.value)}
                           >
                              {option.name}
                              {isActive && <Check className="ml-auto h-4 w-4" />}
                           </Button>
                         );
                      })}
                    </div>
                  </ScrollArea>
              </PopoverContent>
          </Popover>
      </div>
    );
    
    return (
        <>
        <Card className="shadow-2xl border-none h-full flex flex-col rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-xl">
            <CardHeader className="px-4 pt-3 pb-1">
                <div className="flex justify-between items-center">
                    <CardTitle className="font-black text-lg tracking-tight text-zinc-900 uppercase italic">Panel de Control</CardTitle>
                    <div className="flex gap-1 bg-zinc-100/80 p-1 rounded-xl">
                        <Button 
                            variant={orderType === 'ADES' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => onOrderTypeChange('ADES')}
                            disabled={aiLoading}
                            className={cn(
                                "text-[10px] font-black px-4 py-1 h-8 uppercase tracking-widest rounded-lg transition-all",
                                orderType === 'ADES' ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-500"
                            )}
                        >
                            ADES
                        </Button>
                        <Button 
                            variant={orderType === 'EMEDICO' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => onOrderTypeChange('EMEDICO')}
                            disabled={aiLoading}
                            className={cn(
                                "text-[10px] font-black px-4 py-1 h-8 uppercase tracking-widest rounded-lg transition-all",
                                orderType === 'EMEDICO' ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-500"
                            )}
                        >
                            eMED
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 pt-1 flex-grow">
                <div 
                    onDragEnter={canCreateRequest ? handleDragEnter : undefined}
                    onDragLeave={canCreateRequest ? handleDragLeave : undefined}
                    onDragOver={canCreateRequest ? handleDragOver : undefined}
                    className={cn("relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-[1rem] transition-all py-2 px-2 min-h-[60px]", dragging ? "border-amber-500 bg-amber-500/10 shadow-2xl shadow-amber-200" : "bg-zinc-50/50 border-zinc-200 hover:border-amber-400 hover:bg-white", aiLoading ? "cursor-not-allowed" : "", !canCreateRequest && "opacity-50 pointer-events-none")}>
                    {!canCreateRequest ? (
                        <div className="flex items-center gap-2 py-4 px-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Operación reservada a Administrador</span>
                        </div>
                    ) : aiLoading ? (
                        <div className="flex flex-col items-center justify-center text-center h-full w-full absolute inset-0 bg-white/95 backdrop-blur-sm z-10 rounded-[1.5rem]">
                            <Loader2 className="h-10 w-10 text-amber-600 animate-spin" /><p className="mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-600">Procesando Solicitud...</p>
                        </div>
                    ) : (
                        <div className="w-full">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileChange(e.target.files)} accept=".pdf,.png,.jpg,.jpeg" disabled={aiLoading || !canCreateRequest}/>
                             <div className="relative w-full flex items-center bg-white rounded-xl shadow-sm border border-zinc-100 p-0.5 mb-1.5">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input id="new-request-id" placeholder={getPlaceholderText()} value={newPatientId} onChange={handleIdChange} onKeyDown={handleKeyDown} onPaste={handlePaste} className="pl-10 pr-10 border-0 focus-visible:ring-0 shadow-none bg-transparent h-10 text-xs font-bold text-zinc-900 placeholder:text-zinc-400"/>
                                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-colors" onClick={() => fileInputRef.current?.click()} disabled={aiLoading || !canCreateRequest} aria-label="Cargar archivo"><Paperclip className="h-4 w-4" /></Button>
                            </div>
                           {canEnterId && <span className="text-[10px] text-zinc-400 font-bold px-4 text-center block italic mt-1">Arrastra el archivo o ingresa el ID directamente</span>}
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <FilterPopover title="Servicio" type="service" options={ALL_SERVICES.map(s => ({value: s, name: serviceDisplayNames[s]}))} activeValue={activeFilters.service} iconMap={serviceIcons} nameMap={serviceDisplayNames} disabled={isServiceFilterDisabled} />
                   <FilterPopover title="Especialidad" type="specialty" options={ALL_SPECIALTIES_DATA} activeValue={activeFilters.specialty} iconMap={specialtyIcons} nameMap={Object.fromEntries(ALL_SPECIALTIES_DATA.map(o => [o.value, o.name]))}/>
                </div>
            </CardContent>
        </Card>
        </>
    );
}

function DailySummaryWidget({ statusCounts, activeFilters, onStatusFilterToggle }: { statusCounts: any; activeFilters: ActiveFilters; onStatusFilterToggle: (status: StudyStatus) => void; }) {
    const InfoCard = ({ title, value, icon: Icon, color, onClick, isButton = false, isActive = false }: { title: string, value: number, icon: React.ElementType, color: string, onClick?: () => void, isButton?: boolean, isActive?: boolean }) => {
        const Wrapper = isButton && onClick ? 'button' : 'div' as any;
        const shadowColor = color.includes('red') ? 'shadow-red-100' : color.includes('green') ? 'shadow-emerald-100' : 'shadow-amber-100';
        const bgColor = color.includes('red') ? 'bg-red-600' : color.includes('green') ? 'bg-emerald-600' : 'bg-orange-500';

        return (
            <Wrapper 
                onClick={onClick} 
                className={cn(
                    "relative flex flex-col p-3.5 rounded-[1.2rem] transition-all duration-500 group overflow-hidden border-none text-left h-full w-full",
                    isButton ? "cursor-pointer hover:-translate-y-1" : "",
                    isActive ? cn(bgColor, "text-white shadow-2xl", shadowColor) : "bg-white text-zinc-900 shadow-xl shadow-zinc-100 hover:shadow-2xl"
                )}
            >
                {/* Decorative Icon Background */}
                <div className="absolute top-[-5px] right-[-5px] p-1 opacity-5 scale-125 rotate-12 pointer-events-none group-hover:scale-105 group-hover:opacity-10 transition-all duration-700">
                    <Icon className="h-20 w-20" />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className={cn(
                        "p-1.5 w-fit rounded-lg mb-2 transition-all duration-500",
                        isActive ? "bg-white/20 text-white" : cn("bg-zinc-100", color)
                    )}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", isActive ? "text-white/70" : "text-zinc-400")}>{title}</p>
                        <p className={cn("text-2xl font-black tracking-tighter leading-none mt-0.5")}>{value}</p>
                    </div>
                </div>
            </Wrapper>
        );
    };

    return (
        <Card className="shadow-2xl border-none h-full flex flex-col rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-xl">
            <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="font-black text-lg tracking-tight text-zinc-900 uppercase italic">Resumen de Hoy</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 flex-grow">
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full pb-1">
                    <InfoCard title="Pendientes" value={statusCounts.pending} icon={Hourglass} color="text-red-500" onClick={() => onStatusFilterToggle('Pendiente')} isButton={true} isActive={activeFilters.status.includes('Pendiente')}/>
                    <InfoCard title="Completadas" value={statusCounts.completed} icon={ListChecks} color="text-green-600" onClick={() => onStatusFilterToggle('Completado')} isButton={true} isActive={activeFilters.status.includes('Completado')}/>
                    <InfoCard title="Leídas" value={statusCounts.read} icon={FileClock} color="text-orange-600" onClick={() => onStatusFilterToggle('Leído')} isButton={true} isActive={activeFilters.status.includes('Leído')}/>
                    <InfoCard title="Anuladas" value={statusCounts.rejected} icon={FileCheck2} color="text-gray-500" onClick={() => onStatusFilterToggle('Anulado')} isButton={true} isActive={activeFilters.status.includes('Anulado')}/>
                </div>
            </CardContent>
        </Card>
    );
}

function ShiftReminderDialog({ show, onConfirm }: { show: boolean; onConfirm: () => void }) {
  return (<AlertDialog open={show} onOpenChange={(open) => !open && onConfirm()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-amber-500 h-6 w-6" /><span>Recordatorio de Cambio de Turno</span></AlertDialogTitle><AlertDialogDescription className="pt-2">Son las 7:00. Por favor, asegúrate de que el operador de turno correcto esté seleccionado para continuar registrando las órdenes a su nombre.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction onClick={onConfirm}>Entendido</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>);
}

function AlarmDialog({ alarm, onClose }: { alarm: any; onClose: () => void; }) {
  return (<AlertDialog open={!!alarm} onOpenChange={(open) => !open && onClose()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-8 w-8" /><span className="text-2xl">¡ALARMA GENERAL!</span></AlertDialogTitle><AlertDialogDescription className="pt-4 text-lg">Alarma activada por <span className="font-bold">{alarm?.triggeredBy?.name}</span> ({alarm?.triggeredBy?.rol}).<br/>Por favor, responda a la emergencia.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction onClick={onClose} className="bg-red-600 hover:bg-red-700">Entendido</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>);
}

export default function ConsultationsDashboardPage() {
  const { user, userProfile, currentProfile, isImpersonating } = useAuth();
  const { toast } = useToast();
  
  const [liveStudies, setLiveStudies] = useState<StudyWithCompletedBy[]>([]);
  const [searchedStudies, setSearchedStudies] = useState<StudyWithCompletedBy[]>();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const { showReminder, confirmReminder } = useShiftChangeReminder(!!user);
  
  const getInitialFilters = useCallback((profile: UserProfile | null) => {
    const filters: ActiveFilters = { service: 'TODOS', specialty: 'TODOS', status: [] };
    if (!profile) return filters;
    if (profile.rol === 'enfermero' && GeneralServices.includes(profile.servicioAsignado as any)) {
      filters.service = profile.servicioAsignado as GeneralService;
    } else if (profile.rol === 'admisionista') {
      filters.service = 'C.EXT';
    }
    return filters;
  }, []);
  
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(getInitialFilters(currentProfile));
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [initialDialogData, setInitialDialogData] = useState<Partial<Study> | undefined>(undefined);
  const [isSummaryVisible, setIsSummaryVisible] = useState(true);
  const [serviceSelectionOpen, setServiceSelectionOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<OrderData | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<any | null>(null);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [specialtyToNotify, setSpecialtyToNotify] = useState<string>('');
  const [selectStudiesOpen, setSelectStudiesOpen] = useState(false);
  const [orderType, setOrderType] = useState<'ADES' | 'EMEDICO'>('ADES');
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [duplicateStudyInfo, setDuplicateStudyInfo] = useState<{ studyName: string, patientName: string } | null>(null);
  const [pendingDuplicateData, setPendingDuplicateData] = useState<OrderData | null>(null);
  

  useEffect(() => {
    document.body.classList.add('theme-blue');
    document.body.classList.remove('theme-yellow');
    return () => {
      document.body.classList.remove('theme-blue');
    };
  }, []);

  useEffect(() => {
    if (currentProfile) {
        setActiveFilters(getInitialFilters(currentProfile));
    }
  }, [currentProfile, isImpersonating, getInitialFilters]);
  
  useEffect(() => {
    if (!user) {
      setLiveStudies([]);
      setSpecialists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const baseQuery = query(collection(db, "studies"), orderBy("requestDate", "desc"), firestoreLimit(35));
    
    const unsubscribeStudies = onSnapshot(baseQuery, (querySnapshot) => {
      const newStudiesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyWithCompletedBy));
      setLiveStudies(newStudiesData);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(!querySnapshot.empty);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("Error fetching studies: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los estudios." });
      }
      setLoading(false);
    });
    
    const specialistsQuery = query(collection(db, "specialists"));
    const unsubscribeSpecialists = onSnapshot(specialistsQuery, (snapshot) => {
        const data: Specialist[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Specialist));
        setSpecialists(data);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error("Error fetching specialists:", error);
        }
    });

    return () => {
      unsubscribeStudies();
      unsubscribeSpecialists();
    };
  }, [user, toast]);

  useEffect(() => {
      if (!user || currentProfile?.rol !== 'enfermero') {
          setActiveAlarm(null);
          return;
      }
      const alarmsQuery = query(collection(db, 'generalAlarms'), where('createdAt', '>', Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000))), orderBy('createdAt', 'desc'), firestoreLimit(1));
      const unsubscribeAlarms = onSnapshot(alarmsQuery, (snapshot) => {
          if (!snapshot.empty) { setActiveAlarm(snapshot.docs[0].data()); }
      }, (error) => {
          if (error.code === 'permission-denied') return;
          console.error("Error fetching alarms:", error);
      });
      return () => unsubscribeAlarms();
  }, [user, currentProfile]);

    const studies = useMemo(() => searchedStudies ?? liveStudies, [searchedStudies, liveStudies]);

    const handleSearch = async (overrideDateRange?: DateRange) => {
        const currentRange = overrideDateRange || dateRange;
    
        if (currentRange?.from) {
            setIsSearching(true);
            const from = startOfDay(currentRange.from);
            const to = currentRange.to ? endOfDay(currentRange.to) : endOfDay(currentRange.from);
            
            let q = query(
                collection(db, "studies"),
                where('requestDate', '>=', Timestamp.fromDate(from)),
                where('requestDate', '<=', Timestamp.fromDate(to)),
                orderBy('requestDate', 'desc')
            );
            
            try {
                const querySnapshot = await getDocs(q);
                const studiesData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyWithCompletedBy));
                setSearchedStudies(studiesData);
                setHasMore(false);
            } catch (error) {
                console.error("Error fetching date range studies:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los estudios para ese rango de fechas.' });
                setSearchedStudies([]);
            }
            setIsSearching(false);
            return;
        }

        if (!searchTerm.trim()) {
            if (searchedStudies) { 
                setSearchedStudies(undefined); 
                setHasMore(true); 
                 // Here you might want to re-fetch initial live studies if your logic requires it
            } 
            return;
        }
        setIsSearching(true);
        const result = await searchStudiesAction(searchTerm);
        if (result.success && result.data) {
            const studiesWithDates = result.data.map(study => ({...study, requestDate: study.requestDate ? Timestamp.fromDate(new Date(study.requestDate as any)) : null, completionDate: study.completionDate ? Timestamp.fromDate(new Date(study.completionDate as any)) : null, orderDate: study.orderDate ? Timestamp.fromDate(new Date(study.orderDate as any)) : null })) as StudyWithCompletedBy[];
            setSearchedStudies(studiesWithDates);
            setHasMore(false);
        } else {
            toast({ variant: 'destructive', title: 'Error en Búsqueda', description: result.error });
            setSearchedStudies([]);
        }
        setIsSearching(false);
    };

    const isSearchActive = useMemo(() => searchedStudies !== undefined, [searchedStudies]);

  const clearSearch = () => { setSearchTerm(''); setDateRange(undefined); setSearchedStudies(undefined); setHasMore(true); }

    const handleAiExtraction = (file: File) => {
        if (!currentProfile) { toast({ variant: 'destructive', title: 'Error de Usuario', description: 'No se pudo cargar tu perfil. Intenta de nuevo.' }); return; }
        setAiLoading(true);
        (async () => {
            try {
                const { fileToDataUri } = await import('@/lib/pdf-to-image');
                const dataUri = await fileToDataUri(file);
                const result = await extractConsultationData({ medicalOrderDataUri: dataUri });
                
                if (!result?.studies || result.studies.length === 0) {
                    throw new Error('No se encontraron estudios válidos en la orden.');
                }
                
                setPendingOrderData(result);

                if (result.studies.length > 1) {
                    setSelectStudiesOpen(true);
                } else {
                    const userRole = currentProfile?.rol;
                    const extractedService = result.service as GeneralService | undefined;
                    
                    if (extractedService && (userRole === 'tecnologo' || userRole === 'transcriptora')) {
                         await handleCreateStudy(result, { service: extractedService });
                    } else if (userRole === 'tecnologo' || userRole === 'transcriptora') { 
                        setServiceSelectionOpen(true); 
                    } else { 
                        await handleCreateStudy(result); 
                    }
                }
            } catch (error: any) {
                console.error("AI Extraction Error:", error);
                toast({ variant: 'destructive', title: 'Error de Extracción', description: error.message || 'Ocurrió un error inesperado al procesar el archivo.' });
            } finally { setAiLoading(false); }
        })();
    };

    const handleCreateStudy = async (data: OrderData, options?: { service?: GeneralService, subService?: SubServiceArea, skipDuplicateCheck?: boolean }) => {
        if (!currentProfile) return;
        toast({ title: 'Procesando...', description: 'Creando las solicitudes...' });
        const creationResult = await createStudyAction(data, currentProfile, options);
        setPendingOrderData(null);
        if (creationResult.success) {
            toast({ title: 'Solicitudes Creadas Exitosamente', description: `${creationResult.studyCount} nuevas solicitudes han sido registradas.` });
        } else if ((creationResult as any).requiresConfirmation) {
            setPendingDuplicateData(data);
            setDuplicateStudyInfo({ studyName: (creationResult as any).duplicateStudyName || 'desconocido', patientName: data.patient.fullName, });
            setDuplicateWarningOpen(true);
            toast({ variant: 'destructive', title: 'Posible Duplicado', description: 'Se encontró una solicitud similar reciente.' });
        } else { toast({ variant: 'destructive', title: 'Error en Creación', description: creationResult.error }); }
    };

    const handleDuplicateConfirmation = () => {
        if (pendingDuplicateData) { handleCreateStudy(pendingDuplicateData, { skipDuplicateCheck: true }); }
        setDuplicateWarningOpen(false); setPendingDuplicateData(null); setDuplicateStudyInfo(null);
    };
    
    const handleSelectedStudiesSubmit = async (processedData: OrderData, targetModule: 'imagenes' | 'consultas' | 'remisiones' = 'consultas') => {
        if (pendingOrderData) {
            setPendingOrderData(processedData); // Update pending data with selection
            
            const userRole = currentProfile?.rol;
            if (userRole === 'tecnologo' || userRole === 'transcriptora') {
                setServiceSelectionOpen(true);
            } else {
                await handleCreateStudy(processedData);
            }
        }
        setSelectStudiesOpen(false);
    };

    const handleServiceSelectionSubmit = async (service: GeneralService, subService: SubServiceArea) => {
        if (pendingOrderData) { await handleCreateStudy(pendingOrderData, { service, subService }); }
        setServiceSelectionOpen(false);
    };
  
    const studiesInDateRange = useMemo(() => {
        return searchedStudies ?? liveStudies;
    }, [searchedStudies, liveStudies]);

  const pendingStudiesSummary = useMemo<SummaryCounts>(() => {
    const initialSummary: SummaryCounts = {
        specialties: ALL_SPECIALTIES_VALUES.reduce((acc, spec) => ({ ...acc, [spec]: 0 }), {}),
        services: { URG: 0, HOSP: 0, UCI: 0, "C.EXT": 0, TODOS: 0 },
    };
    const pendingStudies = liveStudies.filter(s => s.status === 'Pendiente' && s.studies.some(st => !Modalities.includes(st.modality as any)));
    for (const service of GeneralServices) { initialSummary.services[service] = pendingStudies.filter(s => s.service === service).length; }
    for (const specialty of ALL_SPECIALTIES_VALUES) {
        if(specialty === 'TODOS') continue;
        initialSummary.specialties[specialty] = pendingStudies.filter(s => s.studies.some(st => st.modality === specialty)).length;
    }
    initialSummary.services.TODOS = pendingStudies.length;
    initialSummary.specialties.TODOS = pendingStudies.length;
    return initialSummary;
  }, [liveStudies]);
  
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, completed: 0, read: 0, rejected: 0 };
    studiesInDateRange.forEach(study => {
        if (study.status === 'Pendiente') counts.pending++;
        else if (study.status === 'Completado') counts.completed++;
        else if (study.status === 'Leído') counts.read++;
        else if (study.status === 'Anulado') counts.rejected++;
    });
    return counts;
  }, [studiesInDateRange]);

  const toggleStatusFilter = useCallback((status: StudyStatus) => {
    setActiveFilters(prev => {
        const statuses = [...prev.status];
        if (statuses.includes(status)) {
            return { ...prev, status: statuses.filter(s => s !== status) };
        } else {
            return { ...prev, status: [...statuses, status] };
        }
    });
  }, []);

  const filteredStudies = useMemo(() => {
    if (!currentProfile) return [];
    let filteredData = studiesInDateRange.filter(s => s.studies.some(st => !Modalities.includes(st.modality as any)));
    if (activeFilters.status.length > 0) { filteredData = filteredData.filter(study => activeFilters.status.includes(study.status)); }
    if (activeFilters.specialty !== ALL_FILTER) { filteredData = filteredData.filter(study => study.studies.some(s => s.modality === activeFilters.specialty)); }
    
    if (currentProfile.rol !== 'administrador' && activeFilters.service !== ALL_FILTER) {
        filteredData = filteredData.filter(study => study.service === activeFilters.service);
    } else if (currentProfile.rol === 'administrador' && activeFilters.service !== ALL_FILTER) {
        filteredData = filteredData.filter(study => study.service === activeFilters.service);
    }
    
    return filteredData;
  }, [studiesInDateRange, currentProfile, activeFilters]);
  
  const toggleFilter = useCallback((type: 'service' | 'specialty', value: string) => {
    if (currentProfile?.rol === 'admisionista' && type === 'service') { return; }
    setActiveFilters(prev => ({ ...prev, [type]: value, status: [] }));
  }, [currentProfile]);

  const handleManualRequest = useCallback((patientId: string) => {
    const existingStudies = studies.filter(s => s.patient.id === patientId).sort((a, b) => b.requestDate.toMillis() - a.requestDate.toMillis());
    const existingStudy = existingStudies[0];
    const initialData: Partial<Study> = existingStudy ? { ...existingStudy, id: '', patient: { ...existingStudy.patient, id: patientId }, studies: [] } : { patient: { fullName: '', id: patientId, entidad: '', birthDate: '' } , studies: [], diagnosis: { code: '', description: '' }, };
    setInitialDialogData(initialData);
    setDialogOpen(true);
}, [studies]);

  const handleEditStudy = useCallback((study: Study) => { setEditingStudy(study); setEditDialogOpen(true); }, []);
  
  const handleLoadMore = async () => {
    if (!lastVisible || searchedStudies) return;
    setIsLoadingMore(true);
    const nextQuery = query(collection(db, "studies"), orderBy("requestDate", "desc"), startAfter(lastVisible), firestoreLimit(50));
    try {
        const documentSnapshots = await getDocs(nextQuery);
        const newStudies = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyWithCompletedBy));
        setLiveStudies(prevStudies => [...prevStudies, ...newStudies]);
        const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        setLastVisible(newLastVisible);
        if (documentSnapshots.empty || !newLastVisible) { setHasMore(false); }
    } catch (error) {
        console.error("Error fetching more studies: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar más estudios." });
    }
    setIsLoadingMore(false);
  };
  
    const specialistsBySpecialty = useMemo(() => {
        const grouped: Record<string, Specialist[]> = {};
        specialists.forEach(spec => {
            if (!grouped[spec.specialty]) {
                grouped[spec.specialty] = [];
            }
            grouped[spec.specialty].push(spec);
        });
        return grouped;
    }, [specialists]);

    const handleNotify = (specialty: string) => {
        setSpecialtyToNotify(specialty);
        setNotifyDialogOpen(true);
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

  const loadingSkeleton = (<div className='space-y-2 p-4'><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>);

  return (
    <div className="w-full px-4 sm:px-6 xl:px-10 py-6 space-y-6">
      <OperatorSelectionDialog />
      <ShiftReminderDialog show={showReminder} onConfirm={confirmReminder} />
      <AlarmDialog alarm={activeAlarm} onClose={() => setActiveAlarm(null)} />
      <ServiceSelectionDialog open={serviceSelectionOpen} onOpenChange={setServiceSelectionOpen} onConfirm={handleServiceSelectionSubmit} onCancel={() => setPendingOrderData(null)}/>
        <SelectStudiesDialog 
            open={selectStudiesOpen}
            onOpenChange={setSelectStudiesOpen}
            orderData={pendingOrderData}
            onConfirm={handleSelectedStudiesSubmit}
            onCancel={() => setPendingOrderData(null)}
        />
      {duplicateStudyInfo && (
        <DuplicateStudyDialog 
            open={duplicateWarningOpen} 
            onOpenChange={setDuplicateWarningOpen} 
            onConfirm={handleDuplicateConfirmation} 
            studyName={duplicateStudyInfo.studyName} 
            patientName={duplicateStudyInfo.patientName}
        />
      )}
      {currentProfile?.rol === 'administrador' && (
        <NotifyDialog 
            open={notifyDialogOpen}
            onOpenChange={setNotifyDialogOpen}
            specialists={specialistsBySpecialty[specialtyToNotify] || []}
            specialty={specialtyToNotify}
            onSend={handleSendSummaries}
        />
      )}

      {isSummaryVisible && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <UnifiedControlPanel 
                    onManualRequest={handleManualRequest} 
                    userProfile={userProfile} 
                    currentProfile={currentProfile}
                    summary={pendingStudiesSummary}
                    activeFilters={activeFilters}
                    onFilterToggle={toggleFilter}
                    onAiExtraction={handleAiExtraction}
                    aiLoading={aiLoading}
                    orderType={orderType}
                    onOrderTypeChange={setOrderType}
                />
              </div>
              <div className="lg:col-span-3">
                <DailySummaryWidget 
                    statusCounts={statusCounts}
                    activeFilters={activeFilters}
                    onStatusFilterToggle={toggleStatusFilter}
                />
              </div>
        </div>
      )}
      
      <div className="w-full">
          {(loading && studies.length === 0) ? (loadingSkeleton) : (
            <Suspense fallback={loadingSkeleton}>
              <StudyTable 
                studies={filteredStudies} 
                userProfile={currentProfile}
                dateRange={dateRange}
                setDateRange={setDateRange}
                activeStatusFilters={activeFilters.status}
                setActiveStatusFilters={() => {}}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onSearch={handleSearch}
                onClearSearch={clearSearch}
                isSearching={isSearching}
                isSearchActive={isSearchActive}
                isSummaryVisible={isSummaryVisible}
                setIsSummaryVisible={setIsSummaryVisible}
                onEditStudy={handleEditStudy}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                isLoadingMore={isLoadingMore}
                specialists={specialists}
              />
            </Suspense>
          )}
      </div>
      <StudyDialog open={dialogOpen} onOpenChange={setDialogOpen} initialData={initialDialogData} mode="manual" />
      <EditStudyDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} study={editingStudy} />
    </div>
  );
}
