
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { collection, query, onSnapshot, orderBy, where, Timestamp, limit as firestoreLimit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study, GeneralService, UserProfile, Modality, StudyStatus, OperationalStatus, StudyWithCompletedBy, ContrastType, OrderData, SubServiceArea } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { GeneralServices, Modalities, UserRoles } from '@/lib/types';
import { startOfDay, endOfDay } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { StudyDialog } from '@/components/app/study-dialog';
import { EditStudyDialog } from '@/components/app/edit-study-dialog';
import { StudyTable } from '@/components/app/study-table';
import { Search, UploadCloud, Loader2, ShieldPlus, FileClock, FileCheck2, Paperclip, Check, AlertCircle, LogOut, LogIn, UserCheck, UserX, Activity, ListChecks, Hourglass, LogOutIcon, Eye, Syringe, User, LifeBuoy, Beaker, AlertTriangle, X, ChevronsUp, ChevronsDown, Clock, Zap, ArrowRight } from 'lucide-react';
import type { DateRange } from "react-day-picker";
import { createStudyAction, updateUserOperationalStatusAction, setStudyContrastAction, searchStudiesAction, setActiveOperatorAction, createRemissionAction, extractOrderDataAction } from '@/app/actions';
import { handleServerActionError } from '@/lib/client-safe-action';
import { useToast } from '@/hooks/use-toast';
import { HospitalIcon } from '@/components/icons/hospital-icon';
import { UciIcon } from '@/components/icons/uci-icon';
import { CextIcon } from '@/components/icons/cext-icon';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ImpersonationDialog } from '@/components/app/impersonation-dialog';
import { OperatorSelectionDialog } from '@/components/app/operator-selection-dialog';
import { AssignOperatorDialog } from '@/components/app/assign-operator-dialog';
import { useShiftChangeReminder } from '@/hooks/use-shift-change-reminder';
import { HelpTutorialDialog } from '@/components/app/help-tutorial-dialog';
import { tutorialData } from '@/lib/tutorial-data';
import { CreatininePromptDialog } from '@/components/app/creatinine-prompt-dialog';
import { ServiceSelectionDialog } from '@/components/app/service-selection-dialog';
import { ModalityIcon } from '@/components/icons/modality-icon';
import { ViewModeSwitch } from '@/components/app/view-mode-switch';
import { SelectStudiesDialog } from '@/components/app/select-studies-dialog';

import { RemissionRequestDialog } from '@/components/app/remission-request-dialog';
import { ShiftHandoverDialog } from '@/components/app/shift-handover-dialog';
import { ShiftReceiptDialog } from '@/components/app/shift-receipt-dialog';
import { getLatestShiftHandover } from '@/app/actions';
import { DuplicateStudyDialog } from '@/components/app/duplicate-study-dialog';


const ALL_FILTER = "TODOS";
const ALL_SERVICES: (GeneralService | typeof ALL_FILTER)[] = [ALL_FILTER, ...[...GeneralServices].sort()];
const ALL_MODALITIES: (Modality | typeof ALL_FILTER)[] = [ALL_FILTER, ...[...Modalities.filter(m => m !== 'MAMO' && m !== 'DENSITOMETRIA')].sort()];
const ACCEPTED_FILE_TYPES = 'application/pdf,image/*';


const serviceIcons: Record<GeneralService | 'TODOS', React.ElementType> = {
  "URG": ShieldPlus,
  "HOSP": HospitalIcon,
  "UCI": UciIcon,
  "C.EXT": CextIcon,
  "TODOS": ShieldPlus,
};

const serviceDisplayNames: Record<GeneralService | 'TODOS', string> = {
  "URG": "URGENCIAS",
  "HOSP": "HOSPITALIZACIÓN",
  "UCI": "UCI",
  "C.EXT": "C. EXTERNA",
  "TODOS": "TODOS",
};


const modalityIcons: Record<Modality | 'TODOS', React.ElementType> = {
    ECO: (props) => <ModalityIcon modality="ECO" {...props} />,
    RX: (props) => <ModalityIcon modality="RX" {...props} />,
    TAC: (props) => <ModalityIcon modality="TAC" {...props} />,
    RMN: (props) => <ModalityIcon modality="RMN" {...props} />,
    MAMO: () => <svg />,
    DENSITOMETRIA: () => <svg />,
    TODOS: (props) => <ModalityIcon modality="TODOS" {...props} />,
};

const modalityDisplayNames: Record<Modality | 'TODOS', string> = {
  ECO: "ECOGRAFIA", RX: "RAYOS X", TAC: "TOMOGRAFIA", RMN: "R. MAGNETICA", MAMO: "MAMOGRAFIA", DENSITOMETRIA: "DENSITOMETRIA", TODOS: "TODOS",
};


type SummaryCounts = {
    services: Record<GeneralService | 'TODOS', number>;
    modalities: Record<Modality | 'TODOS', number>;
};

type FilteredSummary = {
    pending: number;
    completed: number;
};


type ReportSummaryCounts = {
    pending: number;
    completed: number;
};

type ActiveFilters = {
    service: GeneralService | typeof ALL_FILTER;
    modality: Modality | typeof ALL_FILTER;
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
    orderType,
    onOrderTypeChange,
}: any) : any {
    const { isImpersonating, stopImpersonating } = useAuth();
    const [dragging, setDragging] = useState(false);
    const [newPatientId, setNewPatientId] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canUploadMultiple = currentProfile?.rol === 'administrador';

    const processIncomingFiles = async (incomingFiles: File[]) => {
      if (!incomingFiles.length) return;
      const filesToProcess = canUploadMultiple ? incomingFiles : incomingFiles.slice(0, 1);
      for (const file of filesToProcess) {
        await onAiExtraction(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    const handleFileChange = (files: FileList | null) => {
      if (!files || files.length === 0 || aiLoading) return;
      void processIncomingFiles(Array.from(files));
    };
    
    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
      if (!canCreateRequest || aiLoading) return;
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        void processIncomingFiles(Array.from(files));
        return;
      }

      const pastedText = event.clipboardData?.getData('text')?.trim();
      if (pastedText && canEnterId) {
        const numericId = pastedText.replace(/\D/g, '');
        if (numericId) {
          event.preventDefault();
          onManualRequest(numericId);
          setNewPatientId('');
        }
      }
    };

    const preventDefault = (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleDragEnter = (event: React.DragEvent) => {
      if (!canCreateRequest || aiLoading) return;
      preventDefault(event);
      setDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent) => {
      preventDefault(event);
      setDragging(false);
    };

    const handleDragOver = (event: React.DragEvent) => {
      if (!canCreateRequest || aiLoading) return;
      preventDefault(event);
      event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event: React.DragEvent) => {
      if (!canCreateRequest || aiLoading) return;
      preventDefault(event);
      setDragging(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        void processIncomingFiles(Array.from(files));
      }
    };
    
    const canCreateRequest = useMemo(() => {
        if (!currentProfile) return false;
        const allowedRoles: UserProfile['rol'][] = ['administrador', 'admisionista', 'enfermero', 'tecnologo', 'transcriptora'];
        return allowedRoles.includes(currentProfile.rol);
    }, [currentProfile]);

    const canEnterId = useMemo(() => {
        if (!currentProfile) return false;
        const allowedRoles: UserProfile['rol'][] = ['administrador', 'admisionista', 'tecnologo', 'transcriptora', 'enfermero'];
        return allowedRoles.includes(currentProfile.rol);
    }, [currentProfile]);
    
    const getPlaceholderText = () => {
      if(!canEnterId) return "Arrastre o pegue un archivo aquí";
      return "Crear solicitud...";
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && newPatientId) { 
        onManualRequest(newPatientId); 
        setNewPatientId(''); 
      }
    };

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewPatientId(e.target.value.replace(/[^0-9]/g, ''));
    }
    
    const isServiceFilterDisabled = currentProfile?.rol === 'admisionista';

    const FilterPopover = ({ title, type, options, activeValue, iconMap, nameMap, disabled = false }: { title:string, type: 'service' | 'modality', options: readonly any[], activeValue: string, iconMap: any, nameMap?: any, disabled?: boolean }) => (
      <div>
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1 mb-0.5 block">{title}</label>
          <Popover>
              <PopoverTrigger asChild disabled={disabled}>
                  <button disabled={disabled} className={cn("flex items-center gap-2 p-2 rounded-2xl border-2 bg-white/80 backdrop-blur-sm text-center transition-all duration-300 w-full justify-between h-14 shadow-sm", disabled ? "cursor-not-allowed opacity-50" : "hover:border-amber-400 hover:bg-amber-50 hover:-translate-y-1 hover:shadow-xl", activeValue !== 'TODOS' ? "border-amber-400 shadow-md shadow-amber-100/50" : "border-zinc-100")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-xl transition-colors", activeValue === 'TODOS' ? "bg-zinc-100 text-zinc-400" : "bg-amber-400 text-amber-950")}>
                           {React.createElement(iconMap[activeValue] || iconMap.TODOS, { className: "h-5 w-5" })}
                        </div>
                        <span className="font-black text-xs font-headline tracking-tighter uppercase leading-none">{nameMap ? nameMap[activeValue] : activeValue}</span>
                      </div>
                      <span className="font-black text-2xl tracking-tighter text-zinc-900 leading-none">{type === 'service' ? summary.services[activeValue as GeneralService] : summary.modalities[activeValue as Modality]}</span>
                  </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1.5 rounded-2xl border-zinc-200 overflow-hidden shadow-2xl">
                  <div className="flex flex-col gap-1">
                    {options.map((option) => {
                       const isActive = activeFilters.service === option || activeFilters.modality === option;
                       const isModality = type === 'modality';
                       const getOptionColor = (opt: string) => {
                           if (!isModality) return '';
                           switch (opt) {
                               case 'ECO': return 'text-red-600 hover:bg-red-50';
                               case 'RMN': return 'text-yellow-600 hover:bg-yellow-50';
                               case 'RX': return 'text-blue-600 hover:bg-blue-50';
                               case 'TAC': return 'text-emerald-600 hover:bg-emerald-50';
                               default: return '';
                           }
                       };
                       const colorClass = isActive ? "" : getOptionColor(option);

                       return (
                         <Button 
                            key={option} 
                            variant="ghost" 
                            className={cn(
                                "justify-start font-black text-xs h-10 uppercase tracking-tighter rounded-xl transition-all",
                                isActive ? "bg-amber-400 text-amber-950 hover:bg-amber-500" : cn("text-zinc-500 hover:bg-amber-50 hover:text-amber-600", colorClass)
                            )} 
                            onClick={() => onFilterToggle(type, option)}
                         >
                            {nameMap ? nameMap[option] : option}
                            {isActive && <Check className="ml-auto h-4 w-4 text-amber-950" />}
                         </Button>
                       );
                    })}
                  </div>
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
                    {aiLoading ? (
                        <div className="flex flex-col items-center justify-center text-center h-full w-full absolute inset-0 bg-white/95 backdrop-blur-sm z-10 rounded-[1.5rem]">
                            <Loader2 className="h-10 w-10 text-amber-600 animate-spin" /><p className="mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-600">Procesando Solicitud...</p>
                        </div>
                    ) : (
                        <div className="w-full">
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={(e) => handleFileChange(e.target.files)}
                              accept={ACCEPTED_FILE_TYPES}
                              multiple={canUploadMultiple}
                              disabled={aiLoading || !canCreateRequest}
                            />
                             <div className="relative w-full flex items-center bg-white rounded-xl shadow-sm border border-zinc-100 p-0.5 mb-1.5">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input id="new-request-id" placeholder={getPlaceholderText()} value={newPatientId} onChange={handleIdChange} onKeyDown={handleKeyDown} onPaste={handlePaste} className="pl-10 pr-10 border-0 focus-visible:ring-0 shadow-none bg-transparent h-10 text-xs font-bold text-zinc-900 placeholder:text-zinc-400"/>
                                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-colors" onClick={() => fileInputRef.current?.click()} disabled={aiLoading || !canCreateRequest} aria-label="Cargar archivo"><Paperclip className="h-4 w-4" /></Button>
                            </div>
                           {canEnterId && <span className="text-[10px] text-zinc-400 font-bold px-4 text-center block italic">Arrastra el archivo o ingresa el ID directamente</span>}
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <FilterPopover title="Servicio" type="service" options={ALL_SERVICES} activeValue={activeFilters.service} iconMap={serviceIcons} nameMap={serviceDisplayNames} disabled={isServiceFilterDisabled} />
                   <FilterPopover title="Modalidad" type="modality" options={ALL_MODALITIES} activeValue={activeFilters.modality} iconMap={modalityIcons} nameMap={modalityDisplayNames}/>
                </div>
            </CardContent>
        </Card>
        </>
    );
}

function DailySummaryWidget({ dutyUsers, allUsers, onStatusChange, onStatusFilterToggle, filteredSummary, reportSummary, activeFilters, selectedOperator }: any) : any {
    const { currentProfile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [assignTechnologistOpen, setAssignTechnologistOpen] = useState(false);
    const [assignRadiologistOpen, setAssignRadiologistOpen] = useState(false);
  const handleActionError = useCallback(
    (error: unknown, label: string) => handleServerActionError({ error, toast, actionLabel: label }),
    [toast]
  );

    const handleStatusToggle = async (userId: string, currentStatus: OperationalStatus, isEco: boolean) => {
        let newStatus: OperationalStatus;
        if (isEco) {
            newStatus = currentStatus === 'Disponible' ? 'No Disponible' : 'Disponible';
        } else {
            if(currentStatus === 'En Cirugía') { newStatus = 'Disponible'; } 
            else if (currentStatus === 'No Disponible') { newStatus = 'Disponible'; } 
            else { newStatus = 'En Cirugía'; }
        }
        
        setLoading(prev => ({ ...prev, [userId]: true }));
        try {
          const result = await updateUserOperationalStatusAction(userId, newStatus);
          if (result.success) {
            toast({ title: 'Estado Actualizado', description: `El estado del personal ha sido actualizado.` });
            if (isEco && newStatus === 'Disponible' && (currentProfile?.rol === 'administrador' || currentProfile?.rol === 'transcriptora')) {
              setAssignRadiologistOpen(true);
            }
            if (currentProfile && userId === currentProfile.uid) { onStatusChange(newStatus); }
          } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
          }
        } catch (error) {
          if (!handleActionError(error, 'la actualización del estado operativo')) {
            toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un problema al actualizar el estado.' });
          }
        } finally {
          setLoading(prev => ({ ...prev, [userId]: false }));
        }
    };




    const handleAssignOperator = async (role: 'tecnologo' | 'transcriptora', operatorName: string) => {
        const userToUpdate = role === 'tecnologo' ? dutyUsers.rxTechnologist : dutyUsers.ecoTranscriptionist;
        if (!userToUpdate) return;
        
        setLoading(prev => ({ ...prev, [userToUpdate.uid]: true }));

        try {
          const result = await setActiveOperatorAction(userToUpdate.uid, operatorName);
          if (result.success) {
            toast({ title: 'Operador Asignado', description: `${operatorName} ahora está de turno.` });
          } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
          }
        } catch (error) {
          if (!handleActionError(error, 'la asignación del operador')) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar el operador seleccionado.' });
          }
        } finally {
          setLoading(prev => ({ ...prev, [userToUpdate.uid]: false }));
          setAssignTechnologistOpen(false);
          setAssignRadiologistOpen(false);
        }
    }

    const rxTechnologist = dutyUsers.rxTechnologist;
    const ecoTranscriptionist = dutyUsers.ecoTranscriptionist;
    
    // Allow admin to manage both, or specific roles to manage their own
    const canManageTechnologist = currentProfile?.rol === 'administrador' || currentProfile?.rol === 'tecnologo';
    const canManageRadiologist = currentProfile?.rol === 'administrador' || currentProfile?.rol === 'transcriptora';

    const onDutyRxOperator = rxTechnologist?.operadorActivo;
    const ecoServiceAvailable = ecoTranscriptionist?.operationalStatus === 'Disponible';
    const onDutyEcoOperator = ecoServiceAvailable ? ecoTranscriptionist?.operadorActivo : null;

    const InfoCard = ({ title, value, icon: Icon, color, onClick, isButton = false, isActive = false }: { title: string, value: number, icon: React.ElementType, color: string, onClick?: () => void, isButton?: boolean, isActive?: boolean }) => {
        const Wrapper = isButton && onClick ? 'button' : 'div';
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

    const StatusButton = ({ user, serviceName }: { user: UserProfile | undefined, serviceName: string}) => {
        const isRx = serviceName === 'Rayos X';
        const isEco = serviceName === 'Ecografía';
        const status = user?.operationalStatus || 'NO ASIGNADO';
        
        let bgColor = 'bg-gray-400';
        if (status === 'Disponible') bgColor = 'bg-emerald-600';
        else if (status === 'En Cirugía') bgColor = 'bg-orange-500 hover:bg-orange-600';
        else if (status === 'No Disponible') bgColor = 'bg-red-600 hover:bg-red-700';
        
        let buttonText = status === 'Disponible' ? 'DISPONIBLE' : status.toUpperCase();

        const canToggle = (canManageTechnologist && isRx) || (canManageRadiologist && isEco);
        
        const handleClick = () => {
            if (canToggle && user) {
                handleStatusToggle(user.uid, user.operationalStatus!, isEco);
            }
        };

        const IconToUse = isRx ? (props: any) => <ModalityIcon modality="RX" {...props} /> : (props: any) => <ModalityIcon modality="ECO" {...props} />;

        return (
            <button
                disabled={!canToggle || !user || loading[user.uid]}
                onClick={handleClick}
                className={cn(
                    "flex flex-1 items-center gap-3 p-3 rounded-2xl text-white transition-all duration-300 shadow-md relative group overflow-hidden border-none text-left uppercase font-black tracking-tighter text-xs h-14",
                    bgColor,
                    !canToggle && "cursor-not-allowed opacity-80",
                    status === 'Disponible' && "hover:-translate-y-0.5"
                )}
            >
                <div className="bg-white/20 p-1.5 rounded-lg shadow-inner">
                    <IconToUse className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-3 flex-grow">
                    <div className="flex flex-col border-r border-white/20 pr-3">
                        <span className="text-[10px] opacity-80 font-black tracking-widest leading-none">{serviceName.toUpperCase()}</span>
                    </div>
                    <span className="flex-1 text-[13px] font-black tracking-wide leading-none">{buttonText}</span>
                </div>
                {loading[user?.uid || ''] && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                )}
            </button>
        );
    };
    


    const OperatorDisplay = ({ operator, onClick, role, canChange, serviceAvailable = true }: { operator?: string | null, onClick: () => void, role: 'tecnologo' | 'transcriptora', canChange: boolean, serviceAvailable?: boolean }) => {
      const isTechnologist = role === 'tecnologo';
      const canInteract = canChange && (isTechnologist || serviceAvailable);
      const formatName = (name?: string | null) => name ? name.toUpperCase() : name;
      const displayValue = serviceAvailable
        ? (formatName(operator) || (canInteract ? 'Asignar' : 'No Asignado'))
        : 'No Disponible';

      if (isTechnologist) {
        return (
          <div className="flex items-center gap-2">
            <div className="bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-sm shadow-amber-200">
              <ModalityIcon modality="RX" className="h-4 w-4" />
            </div>
            <span className="text-zinc-500 font-bold uppercase tracking-widest text-[11px]">RAYOS X: </span>
            {canInteract ? (
              <button onClick={onClick} className="font-black text-zinc-900 hover:text-amber-600 hover:underline disabled:text-zinc-400 text-xs transition-colors" disabled={!onClick}>
                {displayValue}
              </button>
            ) : (
              <span className="font-black text-zinc-900 text-xs">{displayValue}</span>
            )}
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2">
            <div className="bg-zinc-100 text-zinc-500 p-1.5 rounded-full">
              <ModalityIcon modality="ECO" className="h-4 w-4" />
            </div>
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-[11px]">ECO: </span>
          {canInteract ? (
            <button onClick={onClick} className="font-black text-zinc-900 hover:text-emerald-600 hover:underline disabled:text-zinc-400 text-xs transition-colors" disabled={!serviceAvailable}>
              {displayValue}
            </button>
          ) : (
            <span className={cn('font-black text-xs', !serviceAvailable ? 'text-zinc-400' : 'text-zinc-900')}>
              {displayValue}
            </span>
          )}
        </div>
      );
    };
    

    return (
        <>
        <Card className="shadow-2xl border-none h-full flex flex-col rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-xl">
            <CardHeader className="px-4 pt-3 pb-1">
                <div className="flex justify-between items-end sm:items-center gap-2">
                    <CardTitle className="font-black text-lg tracking-tight text-zinc-900 uppercase italic shrink-0">Resumen Operativo</CardTitle>
                    <div className="flex flex-row items-center justify-end flex-wrap gap-x-5 gap-y-1">
                   {rxTechnologist && (
                    <OperatorDisplay
                      operator={onDutyRxOperator}
                      onClick={() => setAssignTechnologistOpen(true)}
                      role="tecnologo"
                      canChange={currentProfile?.rol === 'administrador'}
                    />
                   )}
                     {ecoTranscriptionist && ecoServiceAvailable && (
                      <OperatorDisplay
                        operator={onDutyEcoOperator}
                        onClick={() => setAssignRadiologistOpen(true)}
                        role="transcriptora"
                        canChange={canManageRadiologist}
                        serviceAvailable={ecoServiceAvailable}
                      />
                     )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 flex-grow space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <InfoCard title="Pendientes" value={filteredSummary.pending} icon={Hourglass} color="text-red-500" onClick={() => onStatusFilterToggle('Pendiente')} isButton={true} isActive={activeFilters.status.includes('Pendiente')}/>
                    <InfoCard title="Completados" value={filteredSummary.completed} icon={ListChecks} color="text-emerald-600" onClick={() => onStatusFilterToggle('Completado')} isButton={true} isActive={activeFilters.status.includes('Completado')}/>
                    <InfoCard title="Pend. Lectura" value={reportSummary.pending} icon={FileClock} color="text-orange-600" onClick={() => onStatusFilterToggle('Completado')} isButton={true} isActive={activeFilters.status.length === 1 && activeFilters.status[0] === 'Completado'}/>
                    <InfoCard title="Leídos" value={reportSummary.completed} icon={FileCheck2} color="text-emerald-700" onClick={() => onStatusFilterToggle('Leído')} isButton={true} isActive={activeFilters.status.includes('Leído')}/>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <StatusButton user={rxTechnologist} serviceName="Rayos X" />
                    <StatusButton user={ecoTranscriptionist} serviceName="Ecografía" />
                </div>
            </CardContent>
        </Card>
          {assignTechnologistOpen && (
            <AssignOperatorDialog
              open={assignTechnologistOpen}
              onOpenChange={setAssignTechnologistOpen}
              title="Asignar Tecnólogo de Turno"
              description="Seleccione el tecnólogo que estará a cargo de los estudios de Rayos X."
              operators={[...new Set(allUsers.filter(u => u.rol === 'tecnologo').flatMap(u => (u.operadores as any) || []))] as string[]}
              onAssign={op => handleAssignOperator('tecnologo', op)}
            />
          )}

          {assignRadiologistOpen && (
            <AssignOperatorDialog
              open={assignRadiologistOpen}
              onOpenChange={setAssignRadiologistOpen}
              title="Asignar Radiólogo de Turno"
              description="Seleccione el radiólogo que estará a cargo de las ecografías."
              operators={[...new Set(allUsers.filter(u => u.rol === 'transcriptora').flatMap(u => (u.operadores as any) || []))] as string[]}
              onAssign={op => handleAssignOperator('transcriptora', op)}
            />
          )}
        </>
    );
}

function ShiftReminderDialog({ show, onConfirm, onOpenHandover, isTechnologist }: { show: boolean; onConfirm: () => void; onOpenHandover?: () => void; isTechnologist?: boolean }) {
  return (
    <AlertDialog open={show} onOpenChange={(open) => !open && onConfirm()}>
      <AlertDialogContent className="max-w-[440px] rounded-[2.5rem] border-2 border-zinc-900 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden p-0">
        <div className="bg-amber-400 p-6 flex flex-col items-center gap-2">
            <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                <Clock className="h-10 w-10 text-zinc-900 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 uppercase italic tracking-tighter text-center leading-none">
                Cambio de Turno
            </h2>
            <div className="bg-zinc-900 text-amber-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                Importante
            </div>
        </div>
        
        <div className="p-8 space-y-6">
            <p className="text-zinc-600 text-center text-lg leading-relaxed font-medium">
                Son las <span className="text-zinc-900 font-black">7:00 AM</span>. 
                <br />
                <span className="text-sm">Por favor, asegúrate de que el <span className="font-bold text-zinc-800 underline decoration-amber-400 decoration-2 underline-offset-2">operador de turno</span> correcto esté seleccionado para continuar registrando órdenes.</span>
            </p>

            {isTechnologist && onOpenHandover && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
                    <div className="flex gap-3">
                        <div className="bg-blue-100 p-2 rounded-full h-fit">
                            <Zap className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-blue-800 text-xs font-bold leading-tight uppercase">
                            Sugerencia técnica
                            <span className="block mt-1 font-medium lowercase first-letter:uppercase text-blue-600">
                                Como tecnólogo, puedes formalizar la entrega de turno ahora.
                            </span>
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 pt-2">
                {isTechnologist && onOpenHandover && (
                    <Button 
                        onClick={onOpenHandover} 
                        className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-sm transition-all shadow-lg hover:shadow-emerald-200 active:scale-95"
                    >
                        Entregar Turno <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                )}
                <Button 
                    onClick={onConfirm}
                    className="h-14 rounded-2xl bg-amber-400 hover:bg-amber-500 text-zinc-900 font-black uppercase tracking-widest text-sm border-2 border-zinc-900 transition-all shadow-[4px_4px_0px_0px_rgba(24,24,27,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                    Entendido, continuar
                </Button>
            </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AlarmDialog({ alarm, onClose }: { alarm: any; onClose: () => void; }) {
  return (
    <AlertDialog open={!!alarm} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-[440px] rounded-[2.5rem] border-4 border-red-600 shadow-[0_30px_60px_-15px_rgba(220,38,38,0.5)] overflow-hidden p-0 animate-in fade-in zoom-in duration-300">
        <div className="bg-red-600 p-8 flex flex-col items-center gap-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)] animate-pulse" />
            <div className="bg-white/20 p-5 rounded-full backdrop-blur-md relative z-10">
                <AlertTriangle className="h-12 w-12 text-white animate-bounce" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter text-center leading-none relative z-10">
                ¡Alarma General!
            </h2>
            <div className="bg-white text-red-600 px-4 py-1 rounded-full text-sm font-black uppercase tracking-[0.2em] relative z-10">
                Emergencia
            </div>
        </div>
        
        <div className="p-8 space-y-6 bg-white">
            <div className="space-y-4">
                <p className="text-zinc-600 text-center text-lg leading-snug font-medium">
                    Alarma activada por:
                    <span className="block mt-2 text-2xl text-red-600 font-black uppercase tracking-tight">
                        {alarm?.triggeredBy?.name}
                    </span>
                    <span className="inline-block mt-1 px-3 py-0.5 bg-red-50 text-red-700 text-xs font-black rounded-full uppercase border border-red-100">
                        {alarm?.triggeredBy?.rol}
                    </span>
                </p>
                
                <div className="h-px bg-gradient-to-r from-transparent via-red-200 to-transparent w-full" />
                
                <p className="text-zinc-500 text-center text-sm font-bold uppercase italic">
                    Por favor, responda a la emergencia de inmediato.
                </p>
            </div>

            <Button 
                onClick={onClose}
                className="w-full h-16 rounded-2xl bg-red-600 hover:bg-zinc-900 text-white font-black uppercase tracking-[0.2em] text-lg transition-all shadow-[0_8px_0_0_rgba(153,27,27,1)] active:shadow-none active:translate-y-[4px]"
            >
                Entendido
            </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}


export default function DashboardPage() {
  const { user, userProfile, currentProfile, setUserProfile, isImpersonating, selectedOperator } = useAuth();
  const { toast } = useToast();
  const handleActionError = useCallback(
    (error: unknown, label: string) => handleServerActionError({ error, toast, actionLabel: label }),
    [toast]
  );
  
  const [liveStudies, setLiveStudies] = useState<StudyWithCompletedBy[]>([]);
  const [searchedStudies, setSearchedStudies] = useState<StudyWithCompletedBy[] | null>(null);
  const [dutyUsers, setDutyUsers] = useState<{ rxTechnologist: UserProfile | undefined, ecoTranscriptionist: UserProfile | undefined }>({ rxTechnologist: undefined, ecoTranscriptionist: undefined });
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [orderType, setOrderType] = useState<'ADES' | 'EMEDICO'>('ADES');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const { showReminder, confirmReminder, openHandoverDialog, shiftType } = useShiftChangeReminder(!!user);
  const [shiftHandoverOpen, setShiftHandoverOpen] = useState(false);
  const [shiftReceiptOpen, setShiftReceiptOpen] = useState(false);
  const [latestHandover, setLatestHandover] = useState<any>(null);
  
  const getInitialFilters = useCallback((profile: UserProfile | null) => {
    const filters: ActiveFilters = { service: 'TODOS', modality: 'TODOS', status: [] };
    if (!profile) return filters;
    const { rol, servicioAsignado } = profile;
    if (rol === 'tecnologo') { filters.modality = 'RX'; } 
    else if (rol === 'transcriptora') { filters.modality = 'ECO'; } 
    else if (rol === 'enfermero' && GeneralServices.includes(servicioAsignado as any)) { filters.service = servicioAsignado as GeneralService; } 
    else if (rol === 'admisionista') { filters.service = 'C.EXT'; }
    return filters;
  }, []);
  
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(getInitialFilters(currentProfile));
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [initialDialogData, setInitialDialogData] = useState<Partial<Study> | undefined>(undefined);
  const [isSummaryVisible, setIsSummaryVisible] = useState(true);
  
  const [creatininePromptOpen, setCreatininePromptOpen] = useState(false);
  const [serviceSelectionOpen, setServiceSelectionOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<OrderData | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<any | null>(null);
  const [selectStudiesOpen, setSelectStudiesOpen] = useState(false);

  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [duplicateStudyInfo, setDuplicateStudyInfo] = useState<{ studyName: string, patientName: string } | null>(null);
  const [pendingDuplicateData, setPendingDuplicateData] = useState<OrderData | null>(null);

  const [remissionDialogOpen, setRemissionDialogOpen] = useState(false);
  const [remissionStudyData, setRemissionStudyData] = useState<Study | null>(null);
  const [initialRemissionFile, setInitialRemissionFile] = useState<File | null>(null);


  useEffect(() => {
    document.body.classList.add('theme-yellow');
    document.body.classList.remove('theme-blue');
    return () => {
      document.body.classList.remove('theme-yellow');
    };
  }, []);
  
  useEffect(() => {
    if (currentProfile) { setActiveFilters(getInitialFilters(currentProfile)); }
  }, [currentProfile, isImpersonating, getInitialFilters]);
  
  useEffect(() => {
    if (!user) {
      setLiveStudies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const baseQuery = query(collection(db, "studies"), orderBy("requestDate", "desc"), firestoreLimit(35));
    const unsubscribe = onSnapshot(baseQuery, (querySnapshot) => {
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
    return () => unsubscribe();
  }, [user, toast]);

  useEffect(() => {
    if (!user) {
        setAllUsers([]);
        setDutyUsers({ rxTechnologist: undefined, ecoTranscriptionist: undefined });
        return;
    }
    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, (querySnapshot) => {
      const allUsersData: UserProfile[] = [];
      let tech: UserProfile | undefined, trans: UserProfile | undefined;
      let rxTechs: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        const user = { uid: doc.id, ...doc.data() } as UserProfile;
        allUsersData.push(user);
        if (user.rol === 'tecnologo' && user.servicioAsignado === 'RX' && user.activo) { rxTechs.push(user); }
        if (user.rol === 'transcriptora' && user.servicioAsignado === 'ECO' && user.activo) { trans = user; }
      });
      // Priorizar tecnólogo RX con operadorActivo igual al nombre del usuario actual
      if (rxTechs.length > 0 && currentProfile) {
        tech = rxTechs.find(t => t.operadorActivo === currentProfile.nombre) || rxTechs[0];
      }
      setAllUsers(allUsersData);
      setDutyUsers({ rxTechnologist: tech, ecoTranscriptionist: trans });
    }, (error) => {
        if (error.code === 'permission-denied') return;
        console.error("Error fetching users:", error);
    });
    
    let unsubscribeAlarms = () => {};
    if (currentProfile?.rol === 'enfermero') {
        const alarmsQuery = query(collection(db, 'generalAlarms'), where('createdAt', '>', Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000))), orderBy('createdAt', 'desc'), firestoreLimit(1));
        unsubscribeAlarms = onSnapshot(alarmsQuery, (snapshot) => {
            if (!snapshot.empty) { setActiveAlarm(snapshot.docs[0].data()); }
        }, (error) => {
            if (error.code === 'permission-denied') return;
            console.error("Error fetching alarms:", error);
        });
    }
    return () => { unsubscribeUsers(); unsubscribeAlarms(); };
  }, [user, currentProfile]);

  // Load latest handover when shift handover is closed
  useEffect(() => {
    // Only open receipt dialog automatically if user just logged in and is a technologist
    if (currentProfile?.rol === 'tecnologo' && latestHandover && latestHandover.receipt?.receivedTechnicianId !== currentProfile.uid) {
      setShiftReceiptOpen(true);
    }
  }, [currentProfile, latestHandover]);

    const studies = useMemo(() => searchedStudies ?? liveStudies, [searchedStudies, liveStudies]);

    const handleSearch = async (overrideDateRange?: DateRange) => {
        const currentRange = overrideDateRange || dateRange;

        if (currentRange?.from) {
            setIsSearching(true);
            setSearchedStudies(null); // Clear previous search/live data
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
            setIsSearching(true);
            try {
              const result = await searchStudiesAction(searchTerm);
              if (result.success && result.data) {
                const studiesWithDates = result.data.map(study => ({...study, requestDate: study.requestDate ? Timestamp.fromDate(new Date(study.requestDate as any)) : null, completionDate: study.completionDate ? Timestamp.fromDate(new Date(study.completionDate as any)) : null, readingDate: study.readingDate ? Timestamp.fromDate(new Date(study.readingDate as any)) : null })) as StudyWithCompletedBy[];
                setSearchedStudies(studiesWithDates);
                setHasMore(false);
              } else {
                toast({ variant: 'destructive', title: 'Error en Búsqueda', description: result.error });
                setSearchedStudies([]);
              }
            } catch (error) {
              if (!handleActionError(error, 'la búsqueda de estudios')) {
                toast({ variant: 'destructive', title: 'Error en Búsqueda', description: 'No se pudo completar la búsqueda. Intenta nuevamente.' });
              }
              setSearchedStudies([]);
            } finally {
              setIsSearching(false);
            }
        }
        setIsSearching(true);
        const result = await searchStudiesAction(searchTerm);
        if (result.success && result.data) {
            const studiesWithDates = result.data.map(study => ({...study, requestDate: study.requestDate ? Timestamp.fromDate(new Date(study.requestDate as any)) : null, completionDate: study.completionDate ? Timestamp.fromDate(new Date(study.completionDate as any)) : null, readingDate: study.readingDate ? Timestamp.fromDate(new Date(study.readingDate as any)) : null })) as StudyWithCompletedBy[];
            setSearchedStudies(studiesWithDates);
            setHasMore(false);
        } else {
            toast({ variant: 'destructive', title: 'Error en Búsqueda', description: result.error });
            setSearchedStudies([]);
        }
        setIsSearching(false);
    };

    const isSearchActive = useMemo(() => !!searchedStudies, [searchedStudies]);

    const clearSearch = () => { setSearchTerm(''); setDateRange(undefined); setSearchedStudies(null); setHasMore(true); }

    const handleAiExtraction = (file: File) => {
        if (!currentProfile) { toast({ variant: 'destructive', title: 'Error de Usuario', description: 'No se pudo cargar tu perfil. Intenta de nuevo.' }); return; }
        setAiLoading(true);
        (async () => {
            try {
                // Convert file to data URI
                const { fileToDataUri } = await import('@/lib/pdf-to-image');
                const dataUri = await fileToDataUri(file);
                const resultAction = await extractOrderDataAction({ medicalOrderDataUri: dataUri, orderType: orderType });
                
                if (!resultAction.success || !resultAction.data) {
                    throw new Error(resultAction.error || 'No se pudieron extraer los datos.');
                }
                const result = resultAction.data;

                if (!result || result.studies.length === 0) {
                     throw new Error( 'No se encontraron estudios válidos en la orden.');
                }
                
                setPendingOrderData(result);
                setInitialRemissionFile(file); // Keep file for potential RMN remission

                setSelectStudiesOpen(true);
            } catch (error: any) {
                console.error("AI Extraction Error:", error);
                toast({ variant: 'destructive', title: 'Error de Extracción', description: error.message || 'Ocurrió un error inesperado al procesar el archivo.' });
            } finally { setAiLoading(false); }
        })();
    };

    const handleCreateStudy = async (data: OrderData, options?: { creatinine?: number, service?: GeneralService, subService?: SubServiceArea, skipDuplicateCheck?: boolean, bedNumber?: string, bajoSedacion?: boolean }) => {
        if (!currentProfile) return;
        toast({ title: 'Procesando...', description: 'Creando las solicitudes...' });
      try {
        const sanitizedProfile = currentProfile ? {
            uid: currentProfile.uid,
            nombre: currentProfile.nombre,
            rol: currentProfile.rol,
            servicioAsignado: currentProfile.servicioAsignado,
            subServiceAsignado: currentProfile.subServicioAsignado,
            operadorActivo: currentProfile.operadorActivo,
            email: currentProfile.email
        } : null;

        // Strip any non-plain objects like Firestore Timestamps that might be in the data
        const sanitizedData: OrderData = {
            patient: { ...data.patient },
            studies: data.studies.map(s => ({ ...s })),
            diagnosis: { ...data.diagnosis },
            orderingPhysician: data.orderingPhysician ? { ...data.orderingPhysician } : undefined,
            orderDate: data.orderDate,
            admissionNumber: data.admissionNumber,
            referenceNumber: data.referenceNumber,
            bedNumber: data.bedNumber,
            bajoSedacion: data.bajoSedacion,
            requiresCreatinine: data.requiresCreatinine
        };

        const creationResult = await createStudyAction(sanitizedData, sanitizedProfile as any, options);
        setPendingOrderData(null);
        if (creationResult.success) {
          toast({ title: 'Solicitudes Creadas Exitosamente', description: `${creationResult.studyCount} nuevas solicitudes han sido registradas.` });
        } else if ((creationResult as any).requiresConfirmation) {
          setPendingDuplicateData(data);
          setDuplicateStudyInfo({ studyName: (creationResult as any).duplicateStudyName || 'desconocido', patientName: data.patient.fullName, });
          setDuplicateWarningOpen(true);
          toast({ variant: 'destructive', title: 'Posible Duplicado', description: 'Se encontró una solicitud similar reciente.' });
        } else {
          toast({ variant: 'destructive', title: 'Error en Creación', description: creationResult.error });
        }
      } catch (error) {
        if (!handleActionError(error, 'la creación de solicitudes')) {
          console.error('Failed to create study:', error);
          toast({ variant: 'destructive', title: 'Error en Creación', description: 'No se pudo crear la solicitud. Intenta nuevamente.' });
        }
      }
    };
    
    const handleSelectedStudiesSubmit = async (processedData: OrderData, targetModule: 'imagenes' | 'consultas' | 'remisiones' = 'imagenes') => {
        if (pendingOrderData) {
            const creatinineValue = (processedData as any).creatinineValue;

            if (targetModule === 'remisiones') {
                 toast({ title: 'Procesando...', description: `Creando ${processedData.studies.length} remisiones...` });
                 
                 // Split into multiple individual remissions
                 const promises = processedData.studies.map(async (oneStudy, index) => {
                     const tempStudyId = `temp_${Date.now()}_${index}`;
                     const studyForRemission: any = {
                        id: tempStudyId,
                        patient: processedData.patient || { fullName: 'Paciente desconocido', id: `unknown_${Date.now()}` },
                        studies: [oneStudy], // Single study here
                        diagnosis: processedData.diagnosis || [],
                        orderingPhysician: processedData.orderingPhysician || null,
                        service: processedData.service || 'C.EXT',
                        subService: processedData.subService || 'AMB',
                        bedNumber: processedData.bedNumber || '',
                        requiresCreatinine: processedData.requiresCreatinine || false,
                        bajoSedacion: processedData.bajoSedacion || false,
                        creatinine: creatinineValue,
                        requestDate: new Date().toISOString(),
                     };

                     // Sanitize profile to plain object
                     const sanitizedProfile = currentProfile ? {
                        uid: currentProfile.uid,
                        nombre: currentProfile.nombre,
                        rol: currentProfile.rol,
                        servicioAsignado: currentProfile.servicioAsignado,
                        subServicioAsignado: currentProfile.subServicioAsignado,
                        operadorActivo: currentProfile.operadorActivo,
                        email: currentProfile.email
                     } : null;

                     return createRemissionAction({ 
                        studyData: studyForRemission, 
                        remissionData: { 
                          ordenMedicaUrl: '',
                          notaCargoUrl: '',
                          evolucionUrl: ''
                        }, 
                        userProfile: sanitizedProfile as any,
                        service: processedData.service as GeneralService,
                        subService: processedData.subService as any,
                        requiresContrast: processedData.requiresCreatinine,
                        bajoSedacion: processedData.bajoSedacion,
                        creatinine: creatinineValue,
                      });
                 });

                 const results = await Promise.all(promises);
                 const allSuccess = results.every(r => r.success);
                 
                 setPendingOrderData(null);
                 setSelectStudiesOpen(false);

                 if (allSuccess) {
                   toast({ title: 'Remisiones Creadas', description: `${processedData.studies.length} remisiones registradas individualmente.` });
                 } else {
                   const errorCount = results.filter(r => !r.success).length;
                   toast({ variant: 'destructive', title: 'Error Parcial', description: `Se crearon algunas remisiones, pero ${errorCount} fallaron.` });
                 }
                 return;
            }

            if (targetModule === 'consultas') {
                setSelectStudiesOpen(false);
                setPendingOrderData(processedData);
                await handleCreateStudy(processedData, { 
                    service: 'CONSULTAS' as any, // Bypass strict typing for modules
                    subService: processedData.subService as SubServiceArea,
                    bedNumber: processedData.bedNumber,
                    bajoSedacion: processedData.bajoSedacion,
                    creatinine: creatinineValue
                });
                return;
            }

            // Default 'imagenes' flow
            setSelectStudiesOpen(false);
            setPendingOrderData(processedData);
            
            await handleCreateStudy(processedData, { 
                service: processedData.service as GeneralService,
                subService: processedData.subService as SubServiceArea,
                bedNumber: processedData.bedNumber,
                bajoSedacion: processedData.bajoSedacion,
                creatinine: creatinineValue
            });
        }
    };

    
    const handleCreatinineSubmit = async (creatinine: number) => {
        if (pendingOrderData) { await handleCreateStudy(pendingOrderData, { creatinine }); }
        setCreatininePromptOpen(false);
    };

    const handleServiceSelectionSubmit = async (service: GeneralService, subService: SubServiceArea) => {
        if (pendingOrderData) {
            if (pendingOrderData.requiresCreatinine) { setCreatininePromptOpen(true); } 
            else { await handleCreateStudy(pendingOrderData, { service, subService }); }
        }
        setServiceSelectionOpen(false);
    };

    const handleDuplicateConfirmation = () => {
        if (pendingDuplicateData) { handleCreateStudy(pendingDuplicateData, { skipDuplicateCheck: true }); }
        setDuplicateWarningOpen(false); setPendingDuplicateData(null); setDuplicateStudyInfo(null);
    };
  
    const studiesInDateRange = useMemo(() => {
        return searchedStudies ?? liveStudies;
    }, [searchedStudies, liveStudies]);

  const pendingStudiesSummary = useMemo<SummaryCounts>(() => {
    const initialSummary: SummaryCounts = {
        modalities: { ECO: 0, RX: 0, TAC: 0, RMN: 0, MAMO: 0, DENSITOMETRIA: 0, TODOS: 0 },
        services: { URG: 0, HOSP: 0, UCI: 0, "C.EXT": 0, TODOS: 0 },
    };
    const pendingStudies = liveStudies.filter(s => s.status === 'Pendiente' && s.studies.some(st => Modalities.includes(st.modality as any)));
    for (const service of GeneralServices) { initialSummary.services[service] = pendingStudies.filter(s => s.service === service).length; }
    for (const modality of Modalities) { initialSummary.modalities[modality] = pendingStudies.filter(s => s.studies.some(st => st.modality === modality)).length; }
    initialSummary.services.TODOS = pendingStudies.length;
    initialSummary.modalities.TODOS = pendingStudies.length;
    return initialSummary;
  }, [liveStudies]);
  
  const getFilteredStudiesForSummary = useCallback(() => {
    let relevantStudies = studiesInDateRange.filter(s => s.studies.some(st => Modalities.includes(st.modality as any)));
    if (activeFilters.service !== 'TODOS') { relevantStudies = relevantStudies.filter(s => s.service === activeFilters.service); }
    if (activeFilters.modality !== 'TODOS') { relevantStudies = relevantStudies.filter(s => s.studies.some(st => st.modality === activeFilters.modality)); }
    return relevantStudies;
  }, [studiesInDateRange, activeFilters]);

  const filteredSummary = useMemo<FilteredSummary>(() => {
    const relevantStudies = getFilteredStudiesForSummary();
    return relevantStudies.reduce((acc, study) => {
        if (study.status === 'Pendiente') { acc.pending++; } 
        else if (study.status === 'Completado' || study.status === 'Leído') { acc.completed++; }
        return acc;
    }, { pending: 0, completed: 0 });
  }, [getFilteredStudiesForSummary]);

  const reportSummary = useMemo<ReportSummaryCounts>(() => {
    const relevantStudies = getFilteredStudiesForSummary();
    return relevantStudies.reduce((acc, study) => {
        if (study.status === 'Completado') acc.pending++;
        if (study.status === 'Leído') acc.completed++;
        return acc;
    }, { pending: 0, completed: 0 });
  }, [getFilteredStudiesForSummary]);
  
  const filteredStudies = useMemo(() => {
    if (!currentProfile) return [];
    let filteredData = studiesInDateRange.filter(study => study.studies.some(s => Modalities.includes(s.modality as any)));
    if (activeFilters.status.length > 0) { filteredData = filteredData.filter(study => activeFilters.status.includes(study.status)); }
    if (activeFilters.modality !== ALL_FILTER) { filteredData = filteredData.filter(study => study.studies.some(s => s.modality === activeFilters.modality)); }
    if (activeFilters.service !== ALL_FILTER) { filteredData = filteredData.filter(study => study.service === activeFilters.service); }
    return filteredData;
  }, [studiesInDateRange, currentProfile, activeFilters]);
  
  const toggleFilter = useCallback((type: 'service' | 'modality', value: string) => {
    if (currentProfile?.rol === 'admisionista' && type === 'service') { return; }
    setActiveFilters(prev => ({ ...prev, [type]: value, status: [] }));
  }, [currentProfile]);
  
  const toggleStatusFilter = useCallback((status: StudyStatus) => {
      setActiveFilters(prev => {
          const { service: currentService, modality: currentModality, status: prevStatus } = prev;
          const isCurrentlyActive = prevStatus.includes(status);
          let newStatusFilters: StudyStatus[] = [...prevStatus];
          if (isCurrentlyActive) {
            newStatusFilters = newStatusFilters.filter(s => s !== status);
            if(status === 'Completado' && newStatusFilters.includes('Leído')) { newStatusFilters = newStatusFilters.filter(s => s !== 'Leído'); }
          } else {
            if (status === 'Completado') { newStatusFilters = ['Completado']; } 
            else if (status === 'Pendiente'){ newStatusFilters = ['Pendiente']; } 
            else { newStatusFilters = [status]; }
          }
          return { service: currentService, modality: currentModality, status: newStatusFilters };
      });
  }, []);

  const handleManualRequest = useCallback((patientId: string) => {
    const existingStudies = studies.filter(s => s.patient.id === patientId).sort((a, b) => b.requestDate.toMillis() - a.requestDate.toMillis());
    const existingStudy = existingStudies[0];
    const initialData: Partial<Study> = existingStudy 
        ? { 
            patient: { ...existingStudy.patient, id: patientId }, 
            diagnosis: existingStudy.diagnosis,
            orderingPhysician: existingStudy.orderingPhysician,
            service: existingStudy.service,
            subService: existingStudy.subService,
            admissionNumber: existingStudy.admissionNumber,
            referenceNumber: existingStudy.referenceNumber,
            bedNumber: existingStudy.bedNumber,
            bajoSedacion: existingStudy.bajoSedacion,
            studies: [] 
          } 
        : { 
            patient: { fullName: '', id: patientId, entidad: '', birthDate: '' } , 
            studies: [], 
            diagnosis: { code: '', description: '' }, 
          };
    setInitialDialogData(initialData);
    setDialogOpen(true);
}, [studies]);

  const handleEditStudy = useCallback((study: Study) => { setEditingStudy(study); setEditDialogOpen(true); }, []);

  const handleStaffStatusChange = (newStatus: UserProfile['operationalStatus']) => {
    if (userProfile && !isImpersonating) { setUserProfile({ ...userProfile, operationalStatus: newStatus }); }
  };

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
  
  const loadingSkeleton = (<div className='space-y-2 p-4'><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>);

  return (
    <div className="w-full px-4 sm:px-6 xl:px-10 py-6 space-y-6">
      <OperatorSelectionDialog />
      {showReminder && (
        <ShiftReminderDialog 
          show={showReminder} 
          onConfirm={confirmReminder} 
          onOpenHandover={() => setShiftHandoverOpen(true)}
          isTechnologist={currentProfile?.rol === 'tecnologo'}
        />
      )}
      <ShiftHandoverDialog 
        open={shiftHandoverOpen}
        onOpenChange={setShiftHandoverOpen}
        userProfile={currentProfile}
      />
      <ShiftReceiptDialog 
        open={shiftReceiptOpen}
        onOpenChange={setShiftReceiptOpen}
        handover={latestHandover}
        userProfile={currentProfile}
        availableOperators={
          allUsers.filter(u => u.rol === 'tecnologo')
        }
      />
      {activeAlarm && <AlarmDialog alarm={activeAlarm} onClose={() => setActiveAlarm(null)} />}
      <CreatininePromptDialog open={creatininePromptOpen} onOpenChange={setCreatininePromptOpen} onConfirm={handleCreatinineSubmit} onCancel={() => setPendingOrderData(null)}/>
      <ServiceSelectionDialog open={serviceSelectionOpen} onOpenChange={setServiceSelectionOpen} onConfirm={handleServiceSelectionSubmit} onCancel={() => setPendingOrderData(null)}/>
      <SelectStudiesDialog 
            open={selectStudiesOpen}
            onOpenChange={setSelectStudiesOpen}
            orderData={pendingOrderData}
            userProfile={currentProfile}
            onConfirm={handleSelectedStudiesSubmit}
            onCancel={() => setPendingOrderData(null)}
      />
      {duplicateStudyInfo && (<DuplicateStudyDialog open={duplicateWarningOpen} onOpenChange={setDuplicateWarningOpen} onConfirm={handleDuplicateConfirmation} studyName={duplicateStudyInfo.studyName} patientName={duplicateStudyInfo.patientName}/>)}
      <RemissionRequestDialog 
        open={remissionDialogOpen} 
        onOpenChange={(isOpen) => {
            setRemissionDialogOpen(isOpen);
            if (!isOpen) {
                setInitialRemissionFile(null);
                setRemissionStudyData(null);
            }
        }} 
        studyData={remissionStudyData}
        initialFile={initialRemissionFile}
      />

      {/* Shift Handover Button - Visible for Technologists */}
      {/* Shift Handover Button removed from imaging page. Only header button remains. */}

      {isSummaryVisible && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
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
                    dutyUsers={dutyUsers} 
                    allUsers={allUsers}
                    onStatusChange={handleStaffStatusChange} 
                    onStatusFilterToggle={toggleStatusFilter}
                    filteredSummary={filteredSummary}
                    reportSummary={reportSummary}
                    activeFilters={activeFilters}
                    selectedOperator={selectedOperator}
                />
              </div>
        </div>
      )}
      <div className="mt-0">
          {(loading && studies.length === 0) ? (loadingSkeleton) : (
            <Suspense fallback={loadingSkeleton}>
              <StudyTable 
                studies={filteredStudies} 
                userProfile={currentProfile}
                dateRange={dateRange}
                setDateRange={setDateRange}
                activeStatusFilters={activeFilters.status}
                setActiveStatusFilters={toggleStatusFilter}
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
              />
            </Suspense>
          )}
      </div>
      <StudyDialog open={dialogOpen} onOpenChange={setDialogOpen} initialData={initialDialogData} mode="manual" />
      <EditStudyDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} study={editingStudy} />
    </div>
  );
}
