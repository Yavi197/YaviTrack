
"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RemissionsTable } from "./RemissionsTable";
import type { Remission, RemissionStatus } from "@/lib/types";
import { CalendarCheck, Check, ClipboardList, CheckCircle2, Hourglass } from "lucide-react";
import { ModalityIcon } from '@/components/icons/modality-icon';
import { EditStudyDialog } from "@/components/app/edit-study-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";

function FilterPopover({ title, options, activeValue, onFilterToggle, countsMap }: { title: string, options: any[], activeValue: string, onFilterToggle: any, countsMap: any }) {
  return (
      <div>
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1 mb-0.5 block">{title}</label>
          <Popover>
              <PopoverTrigger asChild>
                  <button className={cn("flex items-center gap-2 p-2 rounded-2xl border-2 bg-white/80 backdrop-blur-sm text-center transition-all duration-300 w-full justify-between h-14", "hover:border-amber-500 hover:bg-amber-50 hover:-translate-y-1 hover:shadow-lg", activeValue !== 'ALL' ? "border-amber-600 shadow-lg shadow-amber-50" : "border-zinc-100")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-xl transition-colors", activeValue === 'ALL' ? "bg-zinc-100 text-zinc-400" : "bg-amber-100 text-amber-600")}>
                           <ModalityIcon modality={activeValue === 'ALL' ? 'TODOS' : activeValue} className="h-5 w-5" />
                        </div>
                        <span className="font-black text-[11px] tracking-tight uppercase">{activeValue === 'ALL' ? 'TODOS' : activeValue}</span>
                      </div>
                      <span className="font-black text-2xl tracking-tighter text-zinc-900">{activeValue === 'ALL' ? (countsMap?.total || 0) : (countsMap[activeValue] || 0)}</span>
                  </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1">
                  <div className="flex flex-col gap-1">
                    {options.map((option: string) => {
                       const isModality = title === 'Modalidad';
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
                       const colorClass = getOptionColor(option);

                       return (
                           <Button 
                              key={option} 
                              variant={activeValue === option ? 'default' : 'ghost'} 
                              className={cn(
                                  "justify-start uppercase font-black text-[10px] tracking-widest transition-all",
                                  activeValue === option ? "" : colorClass
                              )} 
                              onClick={() => onFilterToggle(option)}
                           >
                              {option === 'ALL' ? 'TODOS' : option}
                              {activeValue === option && <Check className="ml-auto h-4 w-4" />}
                           </Button>
                       );
                    })}
                  </div>
              </PopoverContent>
          </Popover>
      </div>
  );
}

function InfoCard({ title, value, icon: Icon, color, onClick, isButton = false, isActive = false }: { title: string, value: number, icon: React.ElementType, color: string, onClick?: () => void, isButton?: boolean, isActive?: boolean }) {
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
}

function DailySummaryWidget({ metrics, selectedStatus, setSelectedStatus, filterModality, setFilterModality, modalityCounts, filterService, setFilterService, serviceCounts }: any) {

    return (
        <Card className="shadow-2xl border-none h-full flex flex-col rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-xl">
            <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="font-black text-lg tracking-tight text-zinc-900 uppercase italic">Resumen de Hoy</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 flex-grow">
                 <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 h-full pb-1">
                    <div className="flex flex-col gap-2 h-full justify-between w-full">
                        <FilterPopover title="Servicio" options={['ALL', 'URG', 'HOSP', 'UCI', 'C.EXT']} activeValue={filterService} onFilterToggle={setFilterService} countsMap={{ ...serviceCounts, total: metrics.total }} />
                        <FilterPopover title="Modalidad" options={['ALL', 'RX', 'TAC', 'RMN', 'ECO']} activeValue={filterModality} onFilterToggle={setFilterModality} countsMap={{ ...modalityCounts, total: metrics.total }} />
                    </div>
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
  const [selectedStatus, setSelectedStatus] = useState<RemissionStatus | "Todos">("Todos");
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});
  const [modalityCounts, setModalityCounts] = useState<Record<string, number>>({});
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});
  const [editingRemission, setEditingRemission] = useState<Remission | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filterService, setFilterService] = useState<string>("ALL");
  const [filterModality, setFilterModality] = useState<string>("ALL");

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

  const handleCountsChange = useCallback(({ status, modalities, services }: { status: Record<string, number>, modalities: Record<string, number>, services: Record<string, number> }) => {
    setStatusSummary(status || {});
    setModalityCounts(modalities || {});
    setServiceCounts(services || {});
  }, []);

  return (
    <div className="w-full px-4 sm:px-6 xl:px-10 py-6 space-y-6">

      <div className="w-full">
            <DailySummaryWidget
               metrics={metrics}
               selectedStatus={selectedStatus}
               setSelectedStatus={(st: any) => { setSelectedStatus(st); setFilterModality('ALL'); }}
               filterModality={filterModality}
               setFilterModality={(mod: any) => { setFilterModality(mod); setSelectedStatus('Todos'); }}
               modalityCounts={modalityCounts}
               filterService={filterService}
               setFilterService={(svc: any) => { setFilterService(svc); setSelectedStatus('Todos'); }}
               serviceCounts={serviceCounts}
            />
      </div>

      <div className="w-full">
          <RemissionsTable
            statusFilter={selectedStatus}
            modalityFilter={filterModality}
            serviceFilter={filterService}
            onStatusSummaryChange={setStatusSummary}
            onCountsChange={handleCountsChange}
            onEditRemission={handleEditRemission}
          />
      </div>
      <EditStudyDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingRemission(null);
        }}
        study={editingRemission}
      />
    </div>
  );
}
