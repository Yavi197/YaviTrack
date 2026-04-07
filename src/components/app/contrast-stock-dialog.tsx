
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
import { useContrast } from '@/context/contrast-context';
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
    const { entries, consumptions, offsetMl, netTotalMl, loading: contrastLoading } = useContrast();
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [resetting, setResetting] = useState(false);
    const { toast } = useToast();

    const contrastItems = useMemo(() => inventoryItems.filter(item => item.isContrast), [inventoryItems]);

    // Sort entries by date desc for the history view (context gives unsorted)
    const sortedEntries = useMemo(() =>
        [...entries].sort((a, b) => {
            const da = a.date?.toDate?.()?.getTime() ?? 0;
            const db2 = b.date?.toDate?.()?.getTime() ?? 0;
            return db2 - da;
        }),
    [entries]);

    const totalMl = useMemo(() => {
        const itemsMap = new Map(inventoryItems.map(item => [item.id, item]));
        const totalEntered = entries.reduce((acc, entry) => {
            const itemDetails = itemsMap.get(entry.itemId);
            return acc + (itemDetails ? entry.amountAdded * itemDetails.content : 0);
        }, 0);
        const totalConsumed = consumptions.reduce((acc, consumption) => acc + consumption.amountConsumed, 0);
        return totalEntered - totalConsumed;
    }, [entries, consumptions, inventoryItems]);

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
                <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[2rem] bg-white shadow-2xl">
                    {/* Header Premium - Mas compacto */}
                    <div className="bg-zinc-900 px-6 py-4 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full -mr-12 -mt-12 blur-2xl" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <div className="bg-amber-400 p-1 rounded-md">
                                    <Beaker className="h-3 w-3 text-zinc-900" />
                                </div>
                                <span className="text-amber-400 text-[8px] font-black uppercase tracking-[0.2em]">Inventory System</span>
                            </div>
                            <DialogTitle className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Stock de Contraste
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Gestión del inventario y consumo de medios de contraste.
                            </DialogDescription>
                        </div>
                        <Button 
                            variant="default" 
                            onClick={() => setAddDialogOpen(true)}
                            className="bg-amber-400 hover:bg-amber-500 text-zinc-900 font-black rounded-xl px-4 h-9 uppercase tracking-widest text-[10px] transition-all shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] active:shadow-none active:translate-y-[2px]"
                        >
                            + Entrada
                        </Button>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Stock Visualizer - Mas denso */}
                        <div className="relative group">
                            <Card className="relative bg-white border-2 border-zinc-100 rounded-[1.5rem] overflow-hidden shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-zinc-400 text-[8px] font-black uppercase tracking-[0.2em] mb-0.5">Nivel de Reserva</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-zinc-900 tracking-tighter italic">
                                                    {Math.round(netTotalMl)}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-400 uppercase italic">ml</span>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={handleResetCounter} 
                                            disabled={resetting}
                                            className="rounded-lg border-2 border-zinc-900 font-black uppercase text-[8px] tracking-widest h-8 px-3 hover:bg-zinc-900 hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                                        >
                                            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reiniciar'}
                                        </Button>
                                    </div>
                                    
                                    <div className="relative h-7 bg-zinc-50 rounded-xl border-2 border-zinc-100 p-1 overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg relative transition-all duration-1000 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                                            style={{ width: `${Math.min(100, (netTotalMl / 1000) * 100)}%` }}
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[progress-stripe_2s_linear_infinite]" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between mt-2 px-0.5">
                                        <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">0 ml</span>
                                        <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">+1000 ml</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* History Section - Reducido en altura */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-1.5 px-1">
                                <HistoryIcon className="h-3 w-3 text-zinc-400" />
                                <h3 className="text-zinc-900 text-[10px] font-black uppercase tracking-widest">Historial</h3>
                            </div>
                            
                            <ScrollArea className="h-[180px] rounded-[1.5rem] border-2 border-zinc-50 bg-zinc-50/20 p-1.5">
                                <div className="space-y-1.5">
                                    {contrastLoading ? (
                                        <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                            <Loader2 className="h-6 w-6 animate-spin mb-2 text-zinc-400" />
                                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400">Sincronizando...</p>
                                        </div>
                                    ) : historyError ? (
                                        <div className="p-4">
                                            <Alert variant="destructive" className="rounded-xl border-2 border-red-50 bg-red-50/30 p-3">
                                                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                                                <AlertTitle className="text-[10px] font-black uppercase mb-0.5">Fallo de Carga</AlertTitle>
                                                <AlertDescriptionComponent className="text-[9px] font-medium leading-tight opacity-70">
                                                    {historyError}
                                                </AlertDescriptionComponent>
                                            </Alert>
                                        </div>
                                    ) : entries.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 opacity-30">
                                            <Beaker className="h-8 w-8 mb-2 text-zinc-300" />
                                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400">Sin movimientos</p>
                                        </div>
                                    ) : (
                                        sortedEntries.map((entry) => (
                                            <div key={entry.id} className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm transition-all hover:shadow-md group flex justify-between items-center">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="bg-emerald-50 p-1.5 rounded-lg group-hover:bg-emerald-100 transition-colors">
                                                        <Activity className="h-3 h-3 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-zinc-900 uppercase leading-none mb-0.5">
                                                            {entry.itemName}
                                                        </p>
                                                        <div className="flex gap-1.5 items-center">
                                                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">
                                                                {entry.date ? format(entry.date.toDate(), 'dd MMM yy', { locale: es }) : 'N/A'}
                                                            </span>
                                                            <span className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">
                                                                #{entry.lote}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[11px] font-black text-emerald-600 italic tracking-tighter leading-none">
                                                        +{entry.amountAdded} ud
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
