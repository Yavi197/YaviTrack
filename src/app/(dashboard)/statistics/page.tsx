"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, Timestamp, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import type { StudyWithCompletedBy, OperationalExpense, InventoryStockEntry } from '@/lib/types';
import { format, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { updateFinanceConfigAction, addOperationalExpenseAction, updateOperationalExpenseAction, deleteOperationalExpenseAction } from '@/app/actions';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Hourglass, BarChart, Droplets, Calendar as CalendarIcon, Syringe, PieChart, Clock, DollarSign, Package, Beaker, Plus, Pencil, Trash2, TrendingUp, Filter, RefreshCcw, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modalities, GeneralServices } from '@/lib/types';
import { SyringeIcon } from '@/components/icons/syringe-icon';
import type { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, PieChart as RechartsPieChart, Pie, Cell, Sector } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SyncStudiesDialog } from '@/components/app/sync-studies-dialog';
import { Badge } from '@/components/ui/badge';

const expenseCategories = ['Sueldos', 'Servicios', 'Arriendo', 'Insumos', 'Otro'] as const;

const expenseSchema = z.object({
    id: z.string().optional(),
    category: z.enum(expenseCategories),
    description: z.string().min(3, "La descripción es muy corta."),
    amount: z.coerce.number().min(1, "El monto debe ser mayor a 0."),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

// --- ENHANCED UI CONSTANTS ---
const CHART_COLORS = ["#0284c7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-black text-xs uppercase tracking-tighter">
        {payload.name}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill}/>
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 4} outerRadius={outerRadius + 6} fill={fill} opacity={0.5}/>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="font-black text-[10px]">{`${value} (${(percent * 100).toFixed(0)}%)`}</text>
    </g>
  );
};

// --- DIALOG COMPONENT ---
function ExpenseDialog({ open, onOpenChange, expense, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, expense: OperationalExpense | null, onSave: (data: ExpenseFormData) => Promise<void> }) {
    const form = useForm<ExpenseFormData>({
        resolver: zodResolver(expenseSchema),
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (expense) {
            form.reset({ id: expense.id, category: expense.category, description: expense.description, amount: expense.amount });
        } else {
            form.reset({ category: undefined, description: '', amount: '' as any });
        }
    }, [expense, form]);

    const onSubmit = async (data: ExpenseFormData) => {
        setLoading(true);
        await onSave(data);
        setLoading(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                <div className="bg-zinc-900 p-6 text-white text-center">
                    <DialogTitle className="text-xl font-black">{expense ? 'Editar Movimiento' : 'Nuevo Gasto Administrativo'}</DialogTitle>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Gestión Financiera</p>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4 bg-zinc-50 border-t">
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold text-xs uppercase text-zinc-500">Categoría</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger className="h-11 font-bold rounded-xl border-zinc-200"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {expenseCategories.map(cat => <SelectItem key={cat} value={cat} className="font-bold">{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => ( 
                            <FormItem>
                                <FormLabel className="font-bold text-xs uppercase text-zinc-500">Descripción Detallada</FormLabel>
                                <FormControl><Input placeholder="Concepto del gasto..." className="h-11 font-bold rounded-xl border-zinc-200" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem> 
                        )}/>
                        <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold text-xs uppercase text-zinc-500">Monto Global (COP)</FormLabel>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600" />
                                    <FormControl><Input type="number" className="pl-10 h-11 font-black text-emerald-600 rounded-xl border-zinc-200 text-lg" placeholder="0" {...field} /></FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter className="pt-4 gap-2">
                            <Button type="button" variant="ghost" className="font-bold text-zinc-500" onClick={() => onOpenChange(false)}>Descartar</Button>
                            <Button type="submit" disabled={loading} className="font-black bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl px-8 h-11">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                                {expense ? 'Sincronizar Cambios' : 'Garantizar Gasto'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function StatisticsPage() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [allStudies, setAllStudies] = useState<StudyWithCompletedBy[]>([]);
    const [statusHistory, setStatusHistory] = useState<{id: string, startTime: Timestamp, endTime: Timestamp | null, durationMinutes: number | null}[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [service, setService] = useState('ALL');
    const [modality, setModality] = useState('ALL');
    const [volumeChartGrouping, setVolumeChartGrouping] = useState<'modality' | 'service' | 'entidad'>('modality');
    const [activeIndex, setActiveIndex] = useState(0);

    const [opExpenses, setOpExpenses] = useState<OperationalExpense[]>([]);
    const [supplyEntries, setSupplyEntries] = useState<InventoryStockEntry[]>([]);
    const [costPerVial, setCostPerVial] = useState(0);
    const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<OperationalExpense | null>(null);
    const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

    const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

    const onPieEnter = useCallback((_: any, index: number) => {
        setActiveIndex(index);
    }, [setActiveIndex]);

    useEffect(() => {
        if (!authLoading && userProfile?.rol !== 'administrador') {
            router.push('/');
        }
    }, [userProfile, authLoading, router]);

    const fetchData = useCallback((range: DateRange | undefined) => {
        if (userProfile?.rol !== 'administrador' || !range?.from) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const fromDate = startOfDay(range.from);
        const toDate = range.to ? endOfDay(range.to) : endOfDay(range.from);

        const studiesQuery = query(collection(db, "studies"), where('requestDate', '>=', Timestamp.fromDate(fromDate)), where('requestDate', '<=', Timestamp.fromDate(toDate)), orderBy('requestDate', 'desc'));
        const statusHistoryQuery = query(collection(db, "operationalStatusHistory"), where('startTime', '>=', Timestamp.fromDate(fromDate)), where('startTime', '<=', Timestamp.fromDate(toDate)));
        const expensesQuery = query(collection(db, "operationalExpenses"), where('date', '>=', Timestamp.fromDate(fromDate)), where('date', '<=', Timestamp.fromDate(toDate)), orderBy('date', 'desc'));
        const suppliesQuery = query(collection(db, "inventoryEntries"), where('date', '>=', Timestamp.fromDate(fromDate)), where('date', '<=', Timestamp.fromDate(toDate)), orderBy('date', 'desc'));
        
        (async () => {
            try {
                const configSnap = await getDoc(doc(db, 'appConfig', 'finance'));
                const [studiesSnap, statusSnap, expensesSnap, suppliesSnap] = await Promise.all([
                    getDocs(studiesQuery),
                    getDocs(statusHistoryQuery),
                    getDocs(expensesQuery),
                    getDocs(suppliesQuery),
                ]);

                setAllStudies(studiesSnap.docs.map(d => ({ id: d.id, ...d.data(), requestDate: d.data().requestDate?.toDate(), completionDate: d.data().completionDate?.toDate(), readingDate: d.data().readingDate?.toDate(), orderDate: d.data().orderDate?.toDate() } as any)));
                setStatusHistory(statusSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
                setOpExpenses(expensesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
                setSupplyEntries(suppliesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
                if (configSnap.exists()) { setCostPerVial(configSnap.data().costPerContrastVial || 0); }
            } catch (error) {
                console.error("Error fetching data: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron sincronizar las estadísticas.' });
            } finally {
                setLoading(false);
            }
        })();
    }, [userProfile, toast]);

    const filteredStudies = useMemo(() => {
        let studies = allStudies;
        if (service !== 'ALL') studies = studies.filter(s => s.service === service);
        if (modality !== 'ALL') studies = studies.filter(s => s.studies?.some((st: any) => st.modality === modality));
        return studies;
    }, [allStudies, service, modality]);
    
    const { monthlyTotal, allSupplyEntries } = useMemo(() => {
        const opTotal = opExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
        const allEntries = supplyEntries.map(entry => ({...entry, cost: (Number(entry.priceAtEntry) || 0) * (Number(entry.amountAdded) || 0)}));
        const suppliesTotal = allEntries.reduce((acc, entry) => acc + entry.cost, 0);
        return { monthlyTotal: opTotal + suppliesTotal, allSupplyEntries: allEntries };
    }, [opExpenses, supplyEntries]);

    const kpis = useMemo(() => {
        const completed = filteredStudies.filter(s => s.status === 'Completado' || s.status === 'Leído');
        const totalStudies = completed.length;
        
        // Turnaround
        const ttimes = completed.map(s => {
            const compDate = s.completionDate instanceof Timestamp ? (s.completionDate as Timestamp).toDate() : (s.completionDate as any);
            const reqDate = s.requestDate instanceof Timestamp ? (s.requestDate as Timestamp).toDate() : (s.requestDate as any);
            return compDate && reqDate ? differenceInMinutes(compDate, reqDate) : null;
        }).filter((t): t is number => t !== null);
        const avgT = ttimes.length > 0 ? ttimes.reduce((a, b) => a + b, 0) / ttimes.length : 0;
        let avgFormatted = "---";
        if (avgT > 0) {
            const h = Math.floor(avgT / 60);
            const m = Math.round(avgT % 60);
            avgFormatted = `${h > 0 ? `${h}h ` : ''}${m}m`;
        }

        const contrastBilled = completed.reduce((acc, s) => acc + (Number(s.contrastBilledMl) || 0), 0);
        const contrastAdmin = completed.reduce((acc, s) => acc + (Number(s.contrastAdministeredMl) || 0), 0);
        const savingsMl = contrastBilled - contrastAdmin;
        const totalContrastSavings = (savingsMl / 100) * costPerVial;

        const surgeryMins = statusHistory.reduce((acc, entry) => acc + (Number(entry.durationMinutes) || 0), 0);
        const hSurg = Math.floor(surgeryMins / 60);
        const mSurg = Math.round(surgeryMins % 60);

        return { 
            totalStudies, 
            avgFormatted, 
            surgeryTime: `${hSurg}h ${mSurg}m`,
            contrastBilled,
            totalContrastSavings: Math.max(0, totalContrastSavings)
        };
    }, [filteredStudies, statusHistory, costPerVial]);

    const volumeChartData = useMemo(() => {
        const dataMap = new Map<string, number>();
        const imagingModalities = ["TAC", "RX", "ECO", "RMN", "MAMO", "DENSITOMETRIA"];
        filteredStudies.forEach(study => {
            let key: string | undefined;
            if (volumeChartGrouping === 'modality') key = imagingModalities.includes(study.studies?.[0]?.modality as any) ? study.studies?.[0]?.modality : 'OTROS';
            else if (volumeChartGrouping === 'service') key = study.service;
            else if (volumeChartGrouping === 'entidad') key = study.patient?.entidad || 'PARTICULAR';
            
            if (key) dataMap.set(key, (dataMap.get(key) || 0) + 1);
        });
        return Array.from(dataMap.entries()).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total).slice(0, 10);
    }, [filteredStudies, volumeChartGrouping]);
    
    const cancellationData = useMemo(() => {
        const cancelled = filteredStudies.filter(s => s.status === 'Cancelado');
        const reasonMap = new Map<string, number>();
        cancelled.forEach(study => {
            const reason = (study as any).cancellationReason || 'Sin motivo';
            reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
        });
        return Array.from(reasonMap.entries()).map(([name, value]) => ({ name, value }));
    }, [filteredStudies]);
    
    const handleSaveExpense = async (data: ExpenseFormData) => {
        const result = data.id ? await updateOperationalExpenseAction({ ...data, id: data.id }) : await addOperationalExpenseAction(data);
        if (result.success) toast({ title: `Sincronización Exitosa` });
        else toast({ variant: 'destructive', title: 'Error', description: result.error });
        fetchData(dateRange);
    };

    const handleDeleteExpense = async (id: string) => {
        const result = await deleteOperationalExpenseAction(id);
        if (result.success) { toast({ title: 'Movimiento Eliminado' }); fetchData(dateRange); }
        else toast({ variant: 'destructive', title: 'Error', description: result.error });
    };

    const handleCostUpdate = async () => {
        const result = await updateFinanceConfigAction(costPerVial);
        if (result.success) toast({ title: 'Tarifa Sincronizada' });
        else toast({ variant: 'destructive', title: 'Error', description: result.error });
    };

    if (authLoading || !userProfile || userProfile.rol !== 'administrador') {
        return (
            <div className="flex flex-col h-screen w-full items-center justify-center bg-zinc-50">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
                <p className="font-black text-xs uppercase tracking-widest text-zinc-400">Verificando Privilegios</p>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-700">
            {/* 1. HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
                        <BarChart className="h-8 w-8 text-blue-600" />
                        Business Intelligence
                    </h1>
                    <div className="flex items-center gap-2">
                         <p className="text-zinc-500 font-medium">Análisis operativo y financiero en tiempo real.</p>
                         <Badge className="bg-blue-600 text-white font-black text-[10px] uppercase rounded-md shadow-lg shadow-blue-100">Pro</Badge>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setIsSyncDialogOpen(true)}
                        className="h-11 border-zinc-200 shadow-sm font-black text-xs uppercase hover:bg-zinc-50 transition-all rounded-xl gap-2 active:scale-95"
                    >
                        <RefreshCcw className="h-4 w-4 text-blue-600" />
                        Sync Google Sheets
                    </Button>
                    <SyncStudiesDialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen} />
                </div>
            </div>

            {/* 2. FILTER TOOLBAR */}
            <Card className="border-none shadow-sm bg-zinc-50/50 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-zinc-100 pl-4">
                        <CalendarIcon className="h-4 w-4 text-zinc-400" />
                        <DateRangePicker date={dateRange} setDate={setDateRange} onApply={fetchData} />
                    </div>
                    
                    <div className="flex items-center gap-3 flex-1">
                        <Select value={service} onValueChange={setService}>
                            <SelectTrigger className="w-[180px] h-11 font-black text-xs uppercase border-zinc-200 rounded-xl bg-white"><div className="flex items-center gap-2"><Filter className="h-3 w-3 text-zinc-400"/> <SelectValue placeholder="Servicio" /></div></SelectTrigger>
                            <SelectContent className="rounded-xl border-zinc-200">
                                <SelectItem value="ALL" className="font-bold">Todos los Servicios</SelectItem>
                                {GeneralServices.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        
                        <Select value={modality} onValueChange={setModality}>
                            <SelectTrigger className="w-[180px] h-11 font-black text-xs uppercase border-zinc-200 rounded-xl bg-white"><div className="flex items-center gap-2"><Beaker className="h-3 w-3 text-zinc-400"/> <SelectValue placeholder="Modalidad" /></div></SelectTrigger>
                            <SelectContent className="rounded-xl border-zinc-200">
                                <SelectItem value="ALL" className="font-bold">Todas las Modalidades</SelectItem>
                                {Modalities.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {loading && <Loader2 className="h-5 w-5 animate-spin text-zinc-400 ml-auto" />}
                    </div>
                </div>
            </Card>

            {/* 3. MAIN DASHBOARD CONTENT */}
            {!dateRange?.from ? (
                <Card className="flex flex-col items-center justify-center py-32 text-center border-dashed border-2 bg-zinc-50 border-zinc-200 rounded-[2rem] gap-6 animate-pulse">
                    <div className="p-6 bg-white rounded-3xl shadow-xl shadow-zinc-100 rotate-3">
                        <LayoutDashboard className="h-20 w-20 text-blue-200" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black text-zinc-300 uppercase tracking-tighter">Esperando Parámetros</CardTitle>
                        <CardDescription className="text-zinc-400 font-bold max-w-xs mx-auto mt-2 italic px-3">Por favor selecciona un rango de fechas para cargar el dashboard ejecutivo.</CardDescription>
                    </div>
                </Card>
            ) : (
                <>
                {/* 4. KPI GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="border-none shadow-md bg-emerald-600 text-white relative h-32 overflow-hidden flex flex-col justify-center">
                        <TrendingUp className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 rotate-12" />
                        <CardHeader className="py-0">
                            <CardDescription className="text-emerald-100 font-black uppercase text-[10px] tracking-widest leading-none mb-1">Impacto Financiero</CardDescription>
                            <CardTitle className="text-2xl font-black">{kpis.totalContrastSavings > 0 ? formatCurrency(kpis.totalContrastSavings) : "---"}</CardTitle>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-200 mt-1"><Syringe className="h-3 w-3"/> Ahorro Contraste</div>
                        </CardHeader>
                    </Card>

                    <Card className="border-none shadow-md bg-blue-600 text-white relative h-32 overflow-hidden flex flex-col justify-center">
                        <BarChart className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 rotate-12" />
                        <CardHeader className="py-0">
                            <CardDescription className="text-blue-100 font-black uppercase text-[10px] tracking-widest leading-none mb-1">Volumen Estudios</CardDescription>
                            <CardTitle className="text-3xl font-black">{kpis.totalStudies}</CardTitle>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-200 mt-1"><RefreshCcw className="h-3 w-3"/> Completados</div>
                        </CardHeader>
                    </Card>

                    <Card className="border-none shadow-md bg-amber-500 text-white relative h-32 overflow-hidden flex flex-col justify-center">
                        <Hourglass className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 rotate-12" />
                        <CardHeader className="py-0">
                            <CardDescription className="text-amber-100 font-black uppercase text-[10px] tracking-widest leading-none mb-1">Op. Opportunity</CardDescription>
                            <CardTitle className="text-2xl font-black">{kpis.avgFormatted}</CardTitle>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-200 mt-1"><Clock className="h-3 w-3"/> Tiempo de Respuesta</div>
                        </CardHeader>
                    </Card>

                    <Card className="border-none shadow-md bg-zinc-900 text-white relative h-32 overflow-hidden flex flex-col justify-center">
                        <DollarSign className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 rotate-12" />
                        <CardHeader className="py-0">
                            <CardDescription className="text-zinc-400 font-black uppercase text-[10px] tracking-widest leading-none mb-1">Inversión (Out)</CardDescription>
                            <CardTitle className="text-2xl font-black">{formatCurrency(monthlyTotal)}</CardTitle>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 mt-1"><TrendingUp className="h-3 w-3"/> Gastos + Insumos</div>
                        </CardHeader>
                    </Card>

                    <Card className="border-none shadow-md bg-white border border-zinc-100 relative h-32 overflow-hidden flex flex-col justify-center">
                        <Clock className="absolute -right-4 -bottom-4 h-20 w-20 opacity-10 rotate-45 text-zinc-900" />
                        <CardHeader className="py-0">
                            <CardDescription className="text-zinc-400 font-black uppercase text-[10px] tracking-widest leading-none mb-1">Ocupación Quirúrgica</CardDescription>
                            <CardTitle className="text-2xl font-black text-zinc-900">{kpis.surgeryTime}</CardTitle>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 mt-1"><RefreshCcw className="h-3 w-3"/> Disponibilidad RX</div>
                        </CardHeader>
                    </Card>
                </div>

                {/* 5. CHARTS AND ANALYSIS ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* VOLUME CHART */}
                    <Card className="lg:col-span-8 border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                        <CardHeader className="bg-zinc-50/50 border-b border-zinc-50 px-8 py-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg font-black text-zinc-900 uppercase tracking-tighter">Productividad por Segmento</CardTitle>
                                    <CardDescription className="text-xs font-bold text-zinc-500 italic">Desglose acumulado por parámetros operativos.</CardDescription>
                                </div>
                                <Select value={volumeChartGrouping} onValueChange={(v) => setVolumeChartGrouping(v as any)}>
                                    <SelectTrigger className="w-[180px] h-10 font-bold border-zinc-200 rounded-xl bg-white shadow-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-zinc-200">
                                        <SelectItem value="modality" className="font-bold">Eje: Modalidad</SelectItem>
                                        <SelectItem value="service" className="font-bold">Eje: Servicio</SelectItem>
                                        <SelectItem value="entidad" className="font-bold">Eje: Entidad (EPS)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <ResponsiveContainer width="100%" height={320}>
                                {volumeChartData.length > 0 ? (
                                    <RechartsBarChart data={volumeChartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }} barSize={40}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" fontSize={10} fontWeight={800} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                                        <YAxis fontSize={10} fontWeight={800} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                                            labelStyle={{fontWeight: 900, marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px'}}
                                            itemStyle={{fontSize: '11px', fontWeight: 700}}
                                        />
                                        <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                                            {volumeChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                            <LabelList dataKey="total" position="top" className="font-black text-[12px] fill-zinc-900" offset={10} />
                                        </Bar>
                                    </RechartsBarChart>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-zinc-300 gap-4 opacity-50 italic">
                                        <BarChart className="h-16 w-16" />
                                        <p className="font-bold">Sin datos de volumen disponibles</p>
                                    </div>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* CONTRAST DRILLDOWN */}
                    <Card className="lg:col-span-4 border-none shadow-xl bg-zinc-900 rounded-[2rem] text-white">
                        <CardHeader className="border-b border-white/5 px-8 pt-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl"><Beaker className="h-5 w-5 text-emerald-400" /></div>
                                <div>
                                    <CardTitle className="text-lg font-black uppercase tracking-tighter">Consumo de Contraste</CardTitle>
                                    <CardDescription className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Análisis de Desperdicio</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 p-4 bg-white/5 rounded-2xl">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Facturado</p>
                                    <p className="text-2xl font-black">{kpis.contrastBilled} <span className="text-[10px] text-zinc-500 font-bold">ml</span></p>
                                </div>
                                <div className="space-y-1 p-4 bg-white/5 rounded-2xl">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Inyectado</p>
                                    <p className="text-2xl font-black text-emerald-400">{(kpis.contrastBilled - (kpis.totalContrastSavings / (costPerVial || 1) * 100)).toFixed(0)} <span className="text-[10px] text-zinc-500 font-bold">ml</span></p>
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tarifa Sinc. por Frasco (100ml)</Label>
                                    <div className="relative group">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500 group-focus-within:scale-110 transition-transform" />
                                        <Input 
                                            type="number" 
                                            className="bg-white/5 border-white/10 h-12 pl-10 font-black text-lg focus:ring-emerald-500 focus:border-emerald-500 transition-all rounded-xl placeholder:text-zinc-700" 
                                            value={costPerVial || ''} 
                                            onChange={(e) => setCostPerVial(Number(e.target.value))} 
                                            onBlur={handleCostUpdate}
                                        />
                                    </div>
                                    <p className="text-[9px] font-bold text-zinc-600 flex items-center gap-1 italic"><RefreshCcw className="h-2 w-2" /> Los cambios se guardan automáticamente al salir del campo.</p>
                                </div>

                                <div className="bg-emerald-600/10 p-4 rounded-2xl border border-emerald-600/20">
                                    <div className="flex justify-between items-center mb-1">
                                         <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Rendimiento Operativo</span>
                                         <Badge className="bg-emerald-600 text-white font-black text-[9px]">+ Eficacia</Badge>
                                    </div>
                                    <p className="text-2xl font-black text-white">{formatCurrency(kpis.totalContrastSavings)}</p>
                                    <p className="text-[9px] font-bold text-zinc-500 italic mt-1">Estimado ahorrado vs facturación teórica.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 6. LISTS AND TABLES ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
                     {/* GASTOS OPERATIVOS */}
                     <Card className="lg:col-span-12 border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                         <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-6">
                             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                 <div className="flex items-center gap-4">
                                     <div className="p-3 bg-zinc-900 rounded-2xl"><DollarSign className="h-6 w-6 text-white" /></div>
                                     <div>
                                         <CardTitle className="text-lg font-black text-zinc-900 uppercase tracking-tighter">Reporte de Gastos e Insumos</CardTitle>
                                         <CardDescription className="text-xs font-bold text-zinc-500 italic">Consolidado de salidas de capital por período.</CardDescription>
                                     </div>
                                 </div>
                                 <Button 
                                    onClick={() => { setEditingExpense(null); setIsExpenseDialogOpen(true); }}
                                    className="h-11 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl px-6 font-black text-xs uppercase shadow-lg shadow-zinc-200 active:scale-95 transition-all"
                                 >
                                     <Plus className="mr-2 h-4 w-4"/> Añadir Movimiento
                                 </Button>
                             </div>
                         </CardHeader>
                         <CardContent className="p-0">
                             <div className="grid grid-cols-1 lg:grid-cols-2">
                                 {/* Gastos Administrativos */}
                                 <div className="border-r border-zinc-100 p-8">
                                     <div className="flex items-center justify-between mb-6">
                                         <h3 className="font-black text-xs uppercase tracking-widest text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full w-fit">Administrativos</h3>
                                         <span className="font-black text-sm text-zinc-900">{formatCurrency(opExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0))}</span>
                                     </div>
                                     <ScrollArea className="h-[20rem]">
                                         <Table>
                                             <TableHeader>
                                                 <TableRow className="hover:bg-transparent">
                                                     <TableHead className="font-bold text-[10px] uppercase">Concepto</TableHead>
                                                     <TableHead className="text-right font-bold text-[10px] uppercase">Monto</TableHead>
                                                     <TableHead className="w-[80px] text-right font-bold text-[10px] uppercase">Acciones</TableHead>
                                                 </TableRow>
                                             </TableHeader>
                                             <TableBody>
                                                 {opExpenses.map((expense) => (
                                                     <TableRow key={expense.id} className="group hover:bg-zinc-50/50 transition-colors">
                                                         <TableCell>
                                                             <div className="font-black text-zinc-900 text-sm leading-tight">{expense.description}</div>
                                                             <div className="flex items-center gap-2 mt-0.5">
                                                                 <Badge variant="outline" className="text-[9px] font-black uppercase text-zinc-400 py-0 h-4 border-zinc-200">{expense.category}</Badge>
                                                                 <span className="text-[9px] font-bold text-zinc-400 italic font-mono">{format(expense.date.toDate(), 'dd/MM/yy')}</span>
                                                             </div>
                                                         </TableCell>
                                                         <TableCell className="text-right font-black text-zinc-900">{formatCurrency(expense.amount)}</TableCell>
                                                         <TableCell className="text-right">
                                                             <div className="flex items-center justify-end gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                                                                 <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100" onClick={() => { setEditingExpense(expense); setIsExpenseDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                                                 <AlertDialog>
                                                                     <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 text-red-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                     <AlertDialogContent className="rounded-2xl border-none shadow-2xl"><AlertDialogHeader><AlertDialogTitle className="font-black">¿Eliminar Movimiento?</AlertDialogTitle><AlertDialogDescription className="font-bold text-zinc-500">Esta acción descontará el monto de los balances acumulados. No se puede revertir.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-bold rounded-xl h-11 border-zinc-200">Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteExpense(expense.id)} className="font-black bg-red-600 hover:bg-red-700 text-white rounded-xl h-11">Confirmar Eliminación</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                                 </AlertDialog>
                                                             </div>
                                                         </TableCell>
                                                     </TableRow>
                                                 ))}
                                             </TableBody>
                                         </Table>
                                         {opExpenses.length === 0 && <div className="p-20 text-center text-zinc-300 font-bold italic text-sm">Sin movimientos de capital registrados.</div>}
                                     </ScrollArea>
                                 </div>

                                 {/* Compras de Insumos (Automático) */}
                                 <div className="p-8 bg-zinc-50/30">
                                     <div className="flex items-center justify-between mb-6">
                                         <h3 className="font-black text-xs uppercase tracking-widest text-zinc-500 bg-white px-3 py-1 rounded-full border border-zinc-100 w-fit">Insumos (Sincronizado)</h3>
                                         <span className="font-black text-sm text-zinc-900">{formatCurrency(allSupplyEntries.reduce((acc, e) => acc + e.cost, 0))}</span>
                                     </div>
                                     <ScrollArea className="h-[20rem]">
                                         <Table>
                                             <TableHeader>
                                                 <TableRow className="hover:bg-transparent">
                                                     <TableHead className="font-bold text-[10px] uppercase">Suministro</TableHead>
                                                     <TableHead className="text-right font-bold text-[10px] uppercase">Gasto Total</TableHead>
                                                 </TableRow>
                                             </TableHeader>
                                             <TableBody>
                                                 {allSupplyEntries.map((entry) => (
                                                     <TableRow key={entry.id} className="hover:bg-white/80 transition-colors">
                                                         <TableCell>
                                                             <div className="font-black text-zinc-900 text-sm">{entry.itemName}</div>
                                                             <div className="text-[10px] font-bold text-zinc-400 mt-0.5 uppercase tracking-tighter">
                                                                 <span className="text-emerald-600 font-black">+{entry.amountAdded}</span> {entry.presentation}(s) - {format(entry.date.toDate(), 'dd MMM yy', {locale: es})}
                                                             </div>
                                                         </TableCell>
                                                         <TableCell className="text-right">
                                                             <div className="font-black text-zinc-900">{formatCurrency(entry.cost)}</div>
                                                             <div className="text-[9px] font-bold text-zinc-400 font-mono">{formatCurrency(entry.priceAtEntry!)} / u</div>
                                                         </TableCell>
                                                     </TableRow>
                                                 ))}
                                             </TableBody>
                                         </Table>
                                         {allSupplyEntries.length === 0 && <div className="p-20 text-center text-zinc-300 font-bold italic text-sm">No se registran compras para este período.</div>}
                                     </ScrollArea>
                                 </div>
                             </div>
                         </CardContent>
                     </Card>

                     {/* CANCELLATIONS DRILLDOWN */}
                     <Card className="lg:col-span-12 border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                        <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-600 rounded-2xl"><PieChart className="h-6 w-6 text-white" /></div>
                                <div>
                                    <CardTitle className="text-lg font-black text-zinc-900 uppercase tracking-tighter">Causa Raíz de Cancelaciones</CardTitle>
                                    <CardDescription className="text-xs font-bold text-zinc-500 italic">Análisis cualitativo de la deserción de pacientes.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {cancellationData.length > 0 ? (
                                            <RechartsPieChart>
                                                <Pie 
                                                    activeIndex={activeIndex} 
                                                    activeShape={renderActiveShape} 
                                                    data={cancellationData} 
                                                    cx="50%" cy="50%" 
                                                    innerRadius={70} outerRadius={90} 
                                                    dataKey="value" 
                                                    onMouseEnter={onPieEnter}
                                                    paddingAngle={5}
                                                >
                                                    {cancellationData.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={0} />))}
                                                </Pie>
                                            </RechartsPieChart>
                                        ) : <div className="flex items-center justify-center h-full text-zinc-300 italic font-bold">Sin alertas de cancelación</div>}
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-4 pr-12">
                                     <h4 className="font-black text-xs uppercase tracking-widest text-zinc-400 mb-6">Leyenda de Motivos</h4>
                                     <div className="grid grid-cols-1 gap-3">
                                         {cancellationData.map((d, i) => (
                                             <div key={d.name} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100 transition-all hover:scale-[1.02] cursor-default">
                                                 <div className="flex items-center gap-3">
                                                     <div className="w-4 h-4 rounded-full" style={{backgroundColor: CHART_COLORS[i % CHART_COLORS.length]}} />
                                                     <span className="font-black text-xs uppercase text-zinc-700">{d.name}</span>
                                                 </div>
                                                 <Badge className="bg-white border-zinc-200 text-zinc-900 font-black px-3">{d.value} Estudios</Badge>
                                             </div>
                                         ))}
                                     </div>
                                </div>
                            </div>
                        </CardContent>
                     </Card>
                </div>
                </>
            )}

            <ExpenseDialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen} expense={editingExpense} onSave={handleSaveExpense}/>
        </div>
    );
}
