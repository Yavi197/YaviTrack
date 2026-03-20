
"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RemissionsTable } from "./RemissionsTable";
import type { Remission, RemissionStatus } from "@/lib/types";
import { CalendarCheck, CheckCircle2, ClipboardList, Hourglass } from "lucide-react";
import { ModalityIcon } from '@/components/icons/modality-icon';
import { EditStudyDialog } from "@/components/app/edit-study-dialog";
import ScanBar from '@/components/app/scan-bar';
import { Input } from '@/components/ui/input';
import { Paperclip, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { extractOrderData } from '@/ai/flows/extract-order-flow';
import { createRemissionAction } from '@/app/actions';
import { Timestamp } from 'firebase/firestore';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Check } from 'lucide-react';
import { SelectStudiesDialog } from '@/components/app/select-studies-dialog';
import type { OrderData, GeneralService, SubServiceArea } from "@/lib/types";

function UnifiedControlPanel({ 
    searchTerm, setSearchTerm, handleScanFile, handleManualEntry,
    filterModality, setFilterModality, modalityCounts, metricsTotal,
    filterService, setFilterService, serviceCounts,
    orderType, onOrderTypeChange
}: any) {
    const FilterPopover = ({ title, options, activeValue, onFilterToggle, countsMap }: { title: string, options: any[], activeValue: string, onFilterToggle: any, countsMap: any }) => (
      <div>
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1 mb-0.5 block">{title}</label>
          <Popover>
              <PopoverTrigger asChild>
                  <button className={cn("flex items-center gap-2 p-2 rounded-2xl border-2 bg-white/80 backdrop-blur-sm text-center transition-all duration-300 w-full justify-between h-14", "hover:border-amber-500 hover:bg-amber-50 hover:-translate-y-1 hover:shadow-lg", activeValue !== 'ALL' ? "border-amber-600 shadow-lg shadow-amber-50" : "border-zinc-100")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-xl transition-colors", activeValue === 'ALL' ? "bg-zinc-100 text-zinc-400" : "bg-amber-100 text-amber-600")}>
                           <ModalityIcon className="h-5 w-5" />
                        </div>
                        <span className="font-black text-[11px] tracking-tight uppercase">{activeValue === 'ALL' ? 'TODOS' : activeValue}</span>
                      </div>
                      <span className="font-black text-2xl tracking-tighter text-zinc-900">{activeValue === 'ALL' ? metricsTotal : (countsMap[activeValue] || 0)}</span>
                  </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1">
                  <div className="flex flex-col gap-1">
                    {options.map((option: string) => (
                       <Button key={option} variant={activeValue === option ? 'default' : 'ghost'} className="justify-start uppercase font-black text-[10px] tracking-widest" onClick={() => onFilterToggle(option)}>
                          {option === 'ALL' ? 'TODOS' : option}
                          {activeValue === option && <Check className="ml-auto h-4 w-4" />}
                       </Button>
                    ))}
                  </div>
              </PopoverContent>
          </Popover>
      </div>
    );

    return (
        <Card className="shadow-2xl border-none h-full flex flex-col rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-xl">
            <CardHeader className="px-4 pt-3 pb-1">
                <div className="flex justify-between items-center">
                    <CardTitle className="font-black text-lg tracking-tight text-zinc-900 uppercase italic">Panel de Control</CardTitle>
                    <div className="flex gap-1 bg-zinc-100/80 p-1 rounded-xl">
                        <Button 
                            variant={orderType === 'ADES' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => onOrderTypeChange && onOrderTypeChange('ADES')}
                            className={cn("text-[10px] font-black px-4 py-1 h-8 uppercase tracking-widest rounded-lg transition-all", orderType === 'ADES' ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-500")}
                        >
                            ADES
                        </Button>
                        <Button 
                            variant={orderType === 'EMEDICO' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => onOrderTypeChange && onOrderTypeChange('EMEDICO')}
                            className={cn("text-[10px] font-black px-4 py-1 h-8 uppercase tracking-widest rounded-lg transition-all", orderType === 'EMEDICO' ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-500")}
                        >
                            eMED
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 pt-1 flex-grow">
                <div className="relative flex flex-col items-center justify-center w-full border-2 border-dashed border-zinc-200 rounded-[1rem] transition-colors py-2 px-2 min-h-[60px] bg-zinc-50/50 backdrop-blur-md hover:border-amber-400 hover:bg-white">
                  <ScanBar onlyInput inputId="remission-scan-input" onFileSelect={(file) => { void handleScanFile(file); }} />
                  <div className="relative w-full flex items-center bg-white rounded-xl shadow-sm border border-zinc-100 p-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input id="new-request-id" placeholder="ID / pegar / cargar" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleManualEntry(searchTerm); } }} className="pl-9 pr-10 border-0 focus-visible:ring-0 shadow-none bg-transparent placeholder:text-zinc-400 text-sm font-bold h-9" />
                    <button type="button" aria-label="Cargar archivo" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-zinc-100 hover:bg-amber-100 hover:text-amber-600 rounded-lg text-zinc-400 transition-colors flex items-center justify-center" onClick={() => { const el = document.getElementById('remission-scan-input') as HTMLInputElement | null; el?.click(); }}>
                      <Paperclip className="h-4 w-4 text-current" />
                    </button>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-2 text-center block leading-tight">(Ingrese un ID o cargue la orden)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <FilterPopover title="Servicio" options={['ALL', 'URG', 'HOSP', 'UCI', 'C.EXT']} activeValue={filterService} onFilterToggle={setFilterService} countsMap={serviceCounts} />
                   <FilterPopover title="Modalidad" options={['ALL', 'RX', 'TAC', 'RMN', 'ECO']} activeValue={filterModality} onFilterToggle={setFilterModality} countsMap={modalityCounts} />
                </div>
            </CardContent>
        </Card>
    );
}

function DailySummaryWidget({ metrics, selectedStatus, setSelectedStatus }: any) {
    const InfoCard = ({ title, value, icon: Icon, color, onClick, isButton = false, isActive = false }: { title: string, value: number, icon: React.ElementType, color: string, onClick?: () => void, isButton?: boolean, isActive?: boolean }) => {
        const Wrapper = isButton && onClick ? 'button' : 'div' as any;
        const shadowColor = color.includes('red') ? 'shadow-red-100' : color.includes('green') ? 'shadow-emerald-100' : color.includes('sky') ? 'shadow-sky-100' : 'shadow-violet-100';
        const bgColor = color.includes('red') ? 'bg-red-600' : color.includes('green') ? 'bg-emerald-600' : color.includes('sky') ? 'bg-sky-600' : 'bg-violet-600';

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
                    <InfoCard title="Totales" value={metrics.total} icon={ClipboardList} color="text-sky-600" onClick={() => setSelectedStatus("Todos")} isButton={true} isActive={selectedStatus === 'Todos'}/>
                    <InfoCard title="Pend. Aut" value={metrics.pendingAuthorization} icon={Hourglass} color="text-red-500" onClick={() => setSelectedStatus("Pendiente Aut")} isButton={true} isActive={selectedStatus === 'Pendiente Aut'}/>
                    <InfoCard title="Programados" value={metrics.scheduled} icon={CalendarCheck} color="text-violet-600" onClick={() => setSelectedStatus("Programado")} isButton={true} isActive={selectedStatus === "Programado"}/>
                    <InfoCard title="Informados" value={metrics.informed} icon={CheckCircle2} color="text-emerald-600" onClick={() => setSelectedStatus("Informado")} isButton={true} isActive={selectedStatus === "Informado"}/>
                </div>
            </CardContent>
        </Card>
    );
}



export default function RemissionsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<RemissionStatus | "Todos">("Todos");
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});
  const [modalityCounts, setModalityCounts] = useState<Record<string, number>>({});
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});
  const [editingRemission, setEditingRemission] = useState<Remission | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterService, setFilterService] = useState<string>("ALL");
  const [filterModality, setFilterModality] = useState<string>("ALL");
  const [orderType, setOrderType] = useState<'ADES' | 'EMEDICO'>('ADES');
  const [selectStudiesOpen, setSelectStudiesOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<OrderData | null>(null);

  const handleEditRemission = useCallback((remission: Remission) => {
    setEditingRemission(remission);
    setEditDialogOpen(true);
  }, []);

  const metrics = useMemo(() => {
    const total = Object.values(statusSummary).reduce((acc, value) => acc + value, 0);
    const pendingAuthorization = statusSummary["Pendiente Aut"] ?? 0;
    const scheduled = statusSummary["Programado"] ?? 0;
    const informed = statusSummary["Informado"] ?? 0;

    return { total, pendingAuthorization, scheduled, informed };
  }, [statusSummary]);

  const handleScanFile = (file: File) => {
    if (!file) return;
    if (!userProfile) { toast({ variant: 'destructive', title: 'Error', description: 'Usuario no autenticado.' }); return; }
    
    toast({ title: 'Procesando archivo', description: 'Extrayendo datos de la orden...' });
    (async () => {
        try {
          const { fileToDataUri } = await import('@/lib/pdf-to-image');
          const dataUri = await fileToDataUri(file);
          const result = await extractOrderData({ medicalOrderDataUri: dataUri, orderType: orderType });

          if (!result || !Array.isArray(result.studies) || result.studies.length === 0) {
            throw new Error('No se encontraron estudios válidos en la orden.');
          }

          setPendingOrderData(result);

          if (result.studies.length > 1) {
            setSelectStudiesOpen(true);
          } else {
            await handleCreateRemission(result);
          }
        } catch (error: any) {
          console.error('Scan error:', error);
          toast({ variant: 'destructive', title: 'Error de Escaneo', description: error.message || 'Error al procesar el archivo.' });
        }
    })();
  };

  const handleCreateRemission = async (data: OrderData) => {
      if (!userProfile) return;
      const tempStudyId = `temp_${Date.now()}`;
      const studyForRemission: any = {
        id: tempStudyId,
        patient: data.patient || { fullName: 'Paciente desconocido', id: `unknown_${Date.now()}` },
        studies: data.studies || [],
        diagnosis: data.diagnosis || [],
        orderingPhysician: data.orderingPhysician || null,
        service: data.service || (userProfile as any)?.servicioAsignado || 'C.EXT',
        subService: (userProfile as any)?.subServicioAsignado || 'AMB',
        requestDate: Timestamp.now(),
      };

      const createResult = await createRemissionAction({ studyData: studyForRemission, remissionData: { ordenMedicaUrl: '' }, userProfile });
      setPendingOrderData(null);
      if (createResult.success) {
        toast({ title: 'Remisión creada', description: 'La remisión se registró correctamente.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: createResult.error || 'No se pudo crear la remisión.' });
      }
  };

  const handleSelectedStudiesSubmit = async (selectedStudies: OrderData['studies']) => {
    if (pendingOrderData) {
        const newOrderData = { ...pendingOrderData, studies: selectedStudies };
        await handleCreateRemission(newOrderData);
    }
    setSelectStudiesOpen(false);
  };

  const handleManualEntry = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Usuario no autenticado.' });
      return;
    }

    toast({ title: 'Creando remisión', description: 'Entrada manual detectada. Creando remisión...' });
    try {
      const tempStudyId = `manual_${Date.now()}`;
      const studyForRemission: any = {
        id: tempStudyId,
        patient: { fullName: text.trim(), id: `manual_${Date.now()}` },
        studies: [],
        diagnosis: [],
        orderingPhysician: null,
        service: (userProfile as any)?.servicioAsignado || 'C.EXT',
        subService: (userProfile as any)?.subServicioAsignado || 'AMB',
        requestDate: Timestamp.now(),
      };

      const createResult = await createRemissionAction({ studyData: studyForRemission, remissionData: { ordenMedicaUrl: '' }, userProfile });
      if (createResult.success) {
        toast({ title: 'Remisión creada', description: createResult.error ? `Guardada pero: ${createResult.error}` : 'La remisión se creó correctamente.' });
        setSearchTerm('');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: createResult.error || 'No se pudo crear la remisión.' });
      }
    } catch (error: any) {
      console.error('Manual create error:', error);
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Error al crear la remisión manual.' });
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
           <UnifiedControlPanel
              handleScanFile={handleScanFile}
              handleManualEntry={handleManualEntry}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterModality={filterModality}
              setFilterModality={(mod: any) => { setFilterModality(mod); setSelectedStatus('Todos'); }}
              modalityCounts={modalityCounts}
              metricsTotal={metrics.total}
              filterService={filterService}
              setFilterService={(svc: any) => { setFilterService(svc); setSelectedStatus('Todos'); }}
              serviceCounts={serviceCounts}
              orderType={orderType}
              onOrderTypeChange={setOrderType}
           />
        </div>
        <div className="lg:col-span-3">
            <DailySummaryWidget
               metrics={metrics}
               selectedStatus={selectedStatus}
               setSelectedStatus={(st) => { setSelectedStatus(st); setFilterModality('ALL'); }}
            />
        </div>
      </div>

      {/* Removed duplicated SummaryCard grid (we show compact 2x2 on the right now) */}

      <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-xl">
        {/* Header intentionally removed to hide module title and status label */}
        <CardContent className="p-0">
          <RemissionsTable
            statusFilter={selectedStatus}
            modalityFilter={filterModality}
            serviceFilter={filterService}
            onStatusSummaryChange={setStatusSummary}
            onCountsChange={({ status, modalities, services }) => {
              setStatusSummary(status || {});
              setModalityCounts(modalities || {});
              setServiceCounts(services || {});
            }}
            onEditRemission={handleEditRemission}
          />
        </CardContent>
      </Card>
      <EditStudyDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingRemission(null);
        }}
        study={editingRemission}
      />
      <SelectStudiesDialog 
            open={selectStudiesOpen}
            onOpenChange={setSelectStudiesOpen}
            orderData={pendingOrderData}
            onConfirm={handleSelectedStudiesSubmit}
            onCancel={() => setPendingOrderData(null)}
        />
    </div>
  );
}
