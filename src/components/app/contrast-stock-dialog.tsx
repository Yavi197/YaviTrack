
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem, InventoryStockEntry, InventoryConsumption } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Beaker, AlertCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDialogFooterComponent, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { collection, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { AddSupplyEntryDialog } from './add-supply-entry-dialog';
import { Alert, AlertDescription as AlertDescriptionComponent, AlertTitle } from '../ui/alert';
import Link from 'next/link';
import { resetContrastStockCounterAction } from '@/app/actions';

interface ContrastStockDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ContrastStockDialog({ open, onOpenChange }: ContrastStockDialogProps) {
    const { userProfile, inventoryItems, inventoryLoading } = useAuth();
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [entries, setEntries] = useState<InventoryStockEntry[]>([]);
    const [consumptions, setConsumptions] = useState<InventoryConsumption[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [offsetMl, setOffsetMl] = useState(0);
    const [resetting, setResetting] = useState(false);
    const { toast } = useToast();

    const contrastItems = useMemo(() => {
        return inventoryItems.filter(item => item.isContrast);
    }, [inventoryItems]);

    useEffect(() => {
        if (!open || !userProfile) return;

        if (contrastItems.length === 0) {
            setHistoryLoading(false);
            setEntries([]);
            setConsumptions([]);
            return;
        }

        setHistoryLoading(true);
        setHistoryError(null);
        const contrastItemIds = contrastItems.map(item => item.id);

        const entriesQuery = query(
            collection(db, 'inventoryEntries'),
            where('itemId', 'in', contrastItemIds),
            orderBy('date', 'desc')
        );

        const consumptionsQuery = query(
            collection(db, 'inventoryConsumptions'),
            where('itemId', 'in', contrastItemIds)
        );

        const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
            const entryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryStockEntry));
            setEntries(entryData);
            setHistoryLoading(false);
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error("Error fetching contrast entries:", error);
                setHistoryError('No se pudo cargar el historial de entradas.');
            }
            setHistoryLoading(false);
        });

        const unsubscribeConsumptions = onSnapshot(consumptionsQuery, (snapshot) => {
            const consumptionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryConsumption));
            setConsumptions(consumptionData);
        }, (error) => {
             if (error.code !== 'permission-denied') {
                console.error("Error fetching contrast consumptions:", error);
                setHistoryError('No se pudo cargar el historial de consumos.');
            }
        });

        const unsubscribeMeta = onSnapshot(doc(db, 'inventorySettings', 'contrastStock'), (snapshot) => {
            const data = snapshot.data();
            setOffsetMl(typeof data?.offsetMl === 'number' ? data.offsetMl : 0);
        });

        return () => {
            unsubscribeEntries();
            unsubscribeConsumptions();
            unsubscribeMeta();
        };
    }, [open, contrastItems, userProfile]);


    const totalMl = useMemo(() => {
        const itemsMap = new Map(inventoryItems.map(item => [item.id, item]));
        
        const totalEntered = entries.reduce((acc, entry) => {
            const itemDetails = itemsMap.get(entry.itemId);
            return acc + (itemDetails ? entry.amountAdded * itemDetails.content : 0);
        }, 0);

        const totalConsumed = consumptions.reduce((acc, consumption) => {
            return acc + consumption.amountConsumed;
        }, 0);
        
        return totalEntered - totalConsumed;
    }, [entries, consumptions, inventoryItems]);

    const netTotalMl = totalMl - offsetMl;

    const handleResetCounter = useCallback(async () => {
        if (!userProfile) return;
        try {
            setResetting(true);
            const result = await resetContrastStockCounterAction({ currentTotalMl: totalMl }, userProfile);
            if (!result.success) {
                toast({ variant: 'destructive', title: 'No se pudo reiniciar', description: result.error || 'Inténtalo de nuevo.' });
                return;
            }
            toast({ title: 'Contador reiniciado', description: 'El stock volverá a contar desde cero sin eliminar el historial.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo reiniciar el contador.' });
        } finally {
            setResetting(false);
        }
    }, [toast, totalMl, userProfile]);


    if (inventoryLoading || !userProfile || userProfile.rol !== 'administrador') {
        return null;
    }

    if (contrastItems.length === 0) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle id="contrast-dialog-title">Gestión de Medios de Contraste</DialogTitle>
                    </DialogHeader>
                    <Alert variant="destructive" role="alert" aria-live="assertive">
                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                        <AlertTitle>No se encontraron insumos de contraste</AlertTitle>
                        <AlertDescriptionComponent id="contrast-dialog-desc">
                            Para gestionar el stock, primero debes crear al menos un insumo y marcarlo como &lsquo;Contraste&rsquo; en la página de inventario.
                        </AlertDescriptionComponent>
                    </Alert>
                    <DialogFooter>
                        <Button asChild aria-label="Ir a Inventario"><Link href="/inventory">Ir a Inventario</Link></Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl p-0 overflow-hidden border-none rounded-[2.5rem] bg-white shadow-2xl">
                    {/* Header Premium */}
                    <div className="bg-zinc-900 p-8 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="bg-amber-400 p-1.5 rounded-lg">
                                    <Beaker className="h-4 w-4 text-zinc-900" />
                                </div>
                                <span className="text-amber-400 text-[10px] font-black uppercase tracking-[0.2em]">Inventory System</span>
                            </div>
                            <DialogTitle className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Stock de Contraste
                            </DialogTitle>
                        </div>
                        <Button 
                            variant="default" 
                            onClick={() => setAddDialogOpen(true)}
                            className="bg-amber-400 hover:bg-amber-500 text-zinc-900 font-black rounded-2xl px-6 h-12 uppercase tracking-widest text-xs transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] active:shadow-none active:translate-y-[2px]"
                        >
                            + Entrada
                        </Button>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Stock Visualizer */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/20 to-zinc-900/5 rounded-[2rem] blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                            <Card className="relative bg-white border-2 border-zinc-100 rounded-[2rem] overflow-hidden shadow-sm">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Nivel de Reserva</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-5xl font-black text-zinc-900 tracking-tighter italic">
                                                    {Math.round(netTotalMl)}
                                                </span>
                                                <span className="text-xl font-bold text-zinc-400 uppercase italic">ml</span>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={handleResetCounter} 
                                            disabled={resetting}
                                            className="rounded-xl border-2 border-zinc-900 font-black uppercase text-[10px] tracking-widest h-10 hover:bg-zinc-900 hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(24,24,27,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                                        >
                                            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reiniciar'}
                                        </Button>
                                    </div>
                                    
                                    <div className="relative h-10 bg-zinc-50 rounded-2xl border-2 border-zinc-100 p-1.5 overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl relative transition-all duration-1000 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                                            style={{ width: `${Math.min(100, (netTotalMl / 1000) * 100)}%` }}
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-[progress-stripe_2s_linear_infinite]" />
                                            {/* Glow effect at the tip */}
                                            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 blur-[2px]" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between mt-3 px-1">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">0 ml</span>
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">+1000 ml</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* History Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-2">
                                <HistoryIcon className="h-4 w-4 text-zinc-400" />
                                <h3 className="text-zinc-900 text-xs font-black uppercase tracking-widest">Historial de Entradas</h3>
                            </div>
                            
                            <ScrollArea className="h-[280px] rounded-[2rem] border-2 border-zinc-50 bg-zinc-50/30 p-2">
                                <div className="space-y-2">
                                    {historyLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                            <Loader2 className="h-8 w-8 animate-spin mb-4 text-zinc-400" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Sincronizando Historial...</p>
                                        </div>
                                    ) : historyError ? (
                                        <div className="p-6">
                                            <Alert variant="destructive" className="rounded-2xl border-2 border-red-100 bg-red-50/50">
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <AlertTitle className="text-xs font-black uppercase mb-1">Error de Conexión</AlertTitle>
                                                <AlertDescriptionComponent className="text-[11px] font-medium leading-relaxed opacity-80">
                                                    {historyError}
                                                </AlertDescriptionComponent>
                                            </Alert>
                                        </div>
                                    ) : entries.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                            <Beaker className="h-10 w-10 mb-4 text-zinc-300" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Sin movimientos registrados</p>
                                        </div>
                                    ) : (
                                        entries.map((entry) => (
                                            <div key={entry.id} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm transition-all hover:shadow-md hover:border-amber-200 group">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                                            <Activity className="h-4 w-4 text-emerald-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-black text-zinc-900 uppercase leading-none mb-1">
                                                                {entry.itemName}
                                                            </p>
                                                            <div className="flex gap-2 items-center">
                                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">
                                                                    {entry.date ? format(entry.date.toDate(), 'dd MMM yyyy', { locale: es }) : 'N/A'}
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-zinc-200" />
                                                                <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">
                                                                    Lote: {entry.lote}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-emerald-600 italic tracking-tighter">
                                                            +{entry.amountAdded} {entry.presentation === 'UNIDAD' ? 'uds' : 'viales'}
                                                        </div>
                                                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Ingreso de stock</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <AddSupplyEntryDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
        </>
    );
}

// Minimal icons used locally
function HistoryIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
        </svg>
    );
}

function Activity(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    );
}
