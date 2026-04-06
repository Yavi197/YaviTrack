"use client";

import { useMemo, useEffect, useState, useCallback } from 'react';
import type { InventoryItem, InventoryStockEntry, InventoryConsumption } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Package, Beaker, AlertTriangle, TrendingUp, History, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddSupplyEntryDialog } from '@/components/app/add-supply-entry-dialog';
import { NewItemDialog } from '@/components/app/new-item-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function InventoryPage() {
    const { userProfile, loading: authLoading, inventoryItems } = useAuth();
    const router = useRouter();
    const [history, setHistory] = useState<InventoryStockEntry[]>([]);
    const [consumptions, setConsumptions] = useState<InventoryConsumption[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [isAddSupplyDialogOpen, setIsAddSupplyDialogOpen] = useState(false);
    const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [offsetMl, setOffsetMl] = useState(0);
    const [showPulse, setShowPulse] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowPulse(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Security check

    useEffect(() => {
        if (!authLoading && userProfile?.rol !== 'administrador') {
            router.push('/');
        }
    }, [userProfile, authLoading, router]);

    useEffect(() => {
        if (!userProfile || userProfile.rol !== 'administrador') return;

        setInventoryLoading(true);
        
        // 1. Fetch History (Entries)
        const qEntries = query(collection(db, 'inventoryEntries'), orderBy('date', 'desc'));
        const unsubEntries = onSnapshot(qEntries, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryStockEntry));
            setHistory(data);
            setInventoryLoading(false);
        });

        // 2. Fetch Consumptions
        const qCons = query(collection(db, 'inventoryConsumptions'));
        const unsubCons = onSnapshot(qCons, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryConsumption));
            setConsumptions(data);
        });

        // 3. Fetch Settings (Offset)
        const unsubSettings = onSnapshot(doc(db, 'inventorySettings', 'contrastStock'), (snap) => {
            const data = snap.data();
            setOffsetMl(typeof data?.offsetMl === 'number' ? data.offsetMl : 0);
        });

        return () => {
            unsubEntries();
            unsubCons();
            unsubSettings();
        };
    }, [userProfile]);

    const stats = useMemo(() => {
        const itemsMap = new Map(inventoryItems.map(item => [item.id, item]));
        
        // --- CALCULO DE CONTRASTE (ML) ---
        let totalEnteredMl = 0;
        history.forEach(entry => {
            const item = itemsMap.get(entry.itemId);
            if (item && item.isContrast) {
                const amount = Number(entry.amountAdded) || 0;
                const itemContent = Number(item.content) || 0;
                totalEnteredMl += (amount * itemContent);
            }
        });

        let totalConsumedMl = 0;
        consumptions.forEach(consumption => {
            totalConsumedMl += (Number(consumption.amountConsumed) || 0);
        });

        const netMl = totalEnteredMl - totalConsumedMl - (Number(offsetMl) || 0);

        // --- CALCULO DE ALERTAS (LOGICA REAL) ---
        let lowStockCount = 0;
        inventoryItems.forEach(item => {
            const entriesForItem = history.filter(h => h.itemId === item.id);
            const consForItem = consumptions.filter(c => c.itemId === item.id);
            
            const totalIn = entriesForItem.reduce((acc, h) => acc + (Number(h.amountAdded) || 0), 0);
            
            if (item.isContrast) {
                const totalOutMl = consForItem.reduce((acc, c) => acc + (Number(c.amountConsumed) || 0), 0);
                const currentMl = (totalIn * (Number(item.content) || 1)) - totalOutMl;
                if (currentMl < 300) lowStockCount++; // Menos de 3 frascos (300ml)
            } else {
                const totalOut = consForItem.reduce((acc, c) => acc + (Number(c.amountConsumed) || 0), 0);
                const currentBalance = totalIn - totalOut;
                if (currentBalance <= 2) lowStockCount++; // Menos de 2 unidades
            }
        });

        // --- VALOR TOTAL ---
        const totalValue = history.reduce((acc, e) => {
            const price = Number(e.priceAtEntry) || 0;
            const amount = Number(e.amountAdded) || 0;
            return acc + (price * amount);
        }, 0);

        return {
            netMl: Math.max(0, netMl),
            totalValue: totalValue,
            lastEntry: history[0],
            lowStockCount
        };
    }, [history, consumptions, inventoryItems, offsetMl]);

    const filteredHistory = useMemo(() => {
        if (!searchTerm) return history;
        const lowSearch = searchTerm.toLowerCase();
        return history.filter(h => 
            (h.itemName || "").toLowerCase().includes(lowSearch) || 
            (h.lote || "").toLowerCase().includes(lowSearch)
        );
    }, [history, searchTerm]);

    const formatCurrency = (value: number) => 
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

    if (authLoading || !userProfile || userProfile?.rol !== 'administrador') {
        return (
            <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
                <p className="text-zinc-500 font-bold animate-pulse">Sincronizando seguridad...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
                        <Package className="h-8 w-8 text-emerald-600" />
                        Control de Inventarios
                    </h1>
                    <div className="flex items-center gap-2">
                         <p className="text-zinc-500 font-medium">Gestión administrativa de suministros médicos.</p>
                         <Badge variant="outline" className="text-[10px] font-bold border-zinc-200 text-zinc-400">ADMIN</Badge>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={() => setIsNewItemDialogOpen(true)}
                        className="h-11 border-zinc-200 shadow-sm font-bold hover:bg-zinc-50 transition-all rounded-xl border-dashed"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Insumo
                    </Button>
                    <Button 
                        onClick={() => setIsAddSupplyDialogOpen(true)}
                        className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 font-bold active:scale-95 transition-all rounded-xl px-6"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Pedido
                    </Button>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. BALANCE DE CONTRASTE */}
                <Card className="border-none shadow-[0_20px_50px_-12px_rgba(16,185,129,0.15)] bg-emerald-600 text-white overflow-hidden relative rounded-[2rem] transition-transform hover:scale-[1.02] duration-500">
                    <Beaker className="absolute -right-4 -bottom-4 h-24 w-24 opacity-20 rotate-12" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-100 font-black uppercase text-[9px] tracking-[0.2em]">Contraste (Neto)</CardDescription>
                        <CardTitle className="text-4xl font-black tracking-tighter">{Math.round(stats.netMl)} <span className="text-sm font-medium opacity-70">ml</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-100 bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm shadow-inner">
                            Disponible en sala
                        </div>
                    </CardContent>
                </Card>

                {/* 2. ALERTAS */}
                <Card className={cn(
                    "border-none shadow-xl transition-all duration-500 rounded-[2rem] hover:scale-[1.02]",
                    stats.lowStockCount > 0 ? (showPulse ? "bg-amber-500 text-white animate-pulse" : "bg-amber-500 text-white shadow-amber-200/40") : "bg-white border-2 border-zinc-100"
                )}>

                    <CardHeader className="pb-2">
                        <CardDescription className={cn(
                            "font-black uppercase text-[9px] tracking-[0.2em]",
                            stats.lowStockCount > 0 ? "text-amber-100" : "text-zinc-400"
                        )}>Stock Crítico</CardDescription>
                        <CardTitle className="text-3xl font-black tracking-tighter">{stats.lowStockCount} <span className="text-sm font-medium opacity-70">items</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "flex items-center gap-2 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full w-fit",
                            stats.lowStockCount > 0 ? "bg-white/10" : "bg-amber-50 text-amber-600"
                        )}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Requieren reposición
                        </div>
                    </CardContent>
                </Card>

                {/* 3. ULTIMA ENTRADA */}
                <Card className="border-none shadow-xl bg-white border-2 border-zinc-100 rounded-[2rem] hover:scale-[1.02] transition-transform duration-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-zinc-400 font-black uppercase text-[9px] tracking-[0.2em]">Recorrido Reciente</CardDescription>
                        <CardTitle className="text-[14px] font-black text-zinc-900 truncate leading-tight h-8 flex items-center tracking-tight">
                            {stats.lastEntry?.itemName || "Sin registros"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-2 font-black uppercase tracking-widest bg-zinc-50 px-3 py-1.5 rounded-full w-fit">
                            <History className="h-3.5 w-3.5 text-zinc-400" />
                            {stats.lastEntry?.date ? format(stats.lastEntry.date.toDate(), 'dd MMM yyyy') : '---'}
                        </div>
                    </CardContent>
                </Card>

                {/* 4. VALOR TOTAL (AL FINAL) */}
                <Card className="border-none shadow-xl bg-zinc-900 text-white rounded-[2rem] hover:scale-[1.02] transition-transform duration-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-zinc-500 font-black uppercase text-[9px] tracking-[0.2em]">Valorización</CardDescription>
                        <CardTitle className="text-3xl font-black tracking-tighter">{formatCurrency(stats.totalValue)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full w-fit">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Costo total pedidos
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content - History Table */}
            <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] ring-1 ring-zinc-200/50">
                <CardHeader className="border-b border-zinc-100 bg-zinc-50/30 p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 ring-4 ring-emerald-50">
                                <History className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black text-zinc-900 tracking-tight uppercase italic italic-title">Historial de Movimientos</CardTitle>
                                <CardDescription className="text-zinc-400 font-black uppercase text-[10px] tracking-[0.1em] mt-0.5">Entradas y recepciones registradas</CardDescription>
                            </div>
                        </div>
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input 
                                placeholder="Filtrar por insumo o lote..." 
                                className="pl-11 h-12 border-2 border-zinc-100 rounded-2xl bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-xs font-bold shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[500px] w-full">
                        {inventoryLoading ? (
                            <div className="p-20 flex flex-col items-center justify-center text-zinc-400">
                                <Loader2 className="h-10 w-10 animate-spin mb-4 opacity-20 text-emerald-600" />
                                <p className="font-bold text-sm">Sincronizando historial...</p>
                            </div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="p-20 text-center text-zinc-400">
                                <Package className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                <p className="font-bold">No se encontraron registros de inventario.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-zinc-50/50">
                                    <TableRow className="hover:bg-transparent border-b-2 border-zinc-100">
                                        <TableHead className="w-[160px] font-black text-[10px] uppercase tracking-[0.2em] pl-8 text-zinc-400 py-6">Fecha / Hora</TableHead>

                                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">Insumo Recibido</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">Servicio</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">Lote / Vence</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400 text-right">Cantidad</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400 text-right pr-8">Valor Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredHistory.map((entry) => (
                                        <TableRow key={entry.id} className="hover:bg-emerald-50/30 transition-all duration-300 group border-b border-zinc-50 last:border-0 cursor-default">
                                            <TableCell className="py-6 pl-8">
                                                <div className="font-mono text-[10px] font-black text-zinc-400 tracking-tighter">
                                                    {entry.date ? format(entry.date.toDate(), 'dd/MM/yyyy') : '---'}
                                                </div>
                                                <div className="text-xs font-black text-zinc-900 mt-0.5">
                                                    {entry.date ? format(entry.date.toDate(), 'HH:mm:ss') : '---'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-black text-zinc-900 text-sm tracking-tight">{entry.itemName}</div>
                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{entry.presentation}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "border-none font-black text-[9px] px-2.5 py-1 rounded-lg shadow-sm transition-transform group-hover:scale-105",
                                                    entry.service === 'TAC' ? "bg-blue-600 text-white" :
                                                    entry.service === 'RX' ? "bg-red-600 text-white" :
                                                    entry.service === 'ECO' ? "bg-emerald-600 text-white" :
                                                    "bg-zinc-900 text-white"
                                                )}>
                                                    {entry.service}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lote: <span className="text-zinc-900">{entry.lote || 'N/A'}</span></span>
                                                    {entry.fechaVencimiento && (
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md w-fit mt-1",
                                                            new Date(entry.fechaVencimiento) < new Date() ? "bg-red-100 text-red-600" : "bg-zinc-100 text-zinc-500"
                                                        )}>
                                                            EXP: {entry.fechaVencimiento}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-black text-emerald-600 text-xl tracking-tighter">
                                                    +{entry.amountAdded}
                                                </div>
                                                <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest leading-none">{entry.presentation}</span>
                                            </TableCell>
                                            <TableCell className="text-right py-4 pr-8">
                                                <div className="font-black text-zinc-900 text-base tracking-tighter">
                                                    {formatCurrency((Number(entry.priceAtEntry) || 0) * (Number(entry.amountAdded) || 0))}
                                                </div>
                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">
                                                    {formatCurrency(Number(entry.priceAtEntry) || 0)} / u
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            <AddSupplyEntryDialog
                open={isAddSupplyDialogOpen}
                onOpenChange={setIsAddSupplyDialogOpen}
            />
            <NewItemDialog 
                open={isNewItemDialogOpen}
                onOpenChange={setIsNewItemDialogOpen}
            />
        </div>
    );
}
