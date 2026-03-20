
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
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle className="font-headline text-2xl" id="contrast-dialog-title">Gestión de Medios de Contraste</DialogTitle>
                                <DialogDescription id="contrast-dialog-desc">Consulta el historial de entradas y el stock total de contraste.</DialogDescription>
                            </div>
                            <Button variant="default" onClick={() => setAddDialogOpen(true)} aria-label="Agregar Entrada de Insumo">
                                + Agregar Entrada de Insumo
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-6 pt-4">
                        <Card role="region" aria-label="Estado Actual del Stock">
                            <CardHeader>
                                <div className='flex justify-between items-start'>
                                    <div>
                                        <CardTitle>Estado Actual del Stock</CardTitle>
                                        <DialogDescription>Resumen del inventario total de contraste.</DialogDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleResetCounter} disabled={resetting}>
                                        {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reiniciar contador'}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <Beaker className="h-12 w-12 text-primary" aria-hidden="true" />
                                    <div className="w-full">
                                        <div className="flex justify-between font-bold text-lg">
                                            <span>{Math.round(netTotalMl)} ml</span>
                                        </div>
                                        <Progress value={(netTotalMl / 1000) * 100} className="mt-2 h-2.5" aria-valuenow={Math.round((netTotalMl / 1000) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Porcentaje de stock de contraste" />
                                        {offsetMl !== 0 && (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                Ajuste aplicado: {Math.round(offsetMl)} ml (historial intacto)
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card role="region" aria-label="Historial de Entradas">
                            <CardHeader>
                                <CardTitle>Historial de Entradas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-64 border rounded-lg" tabIndex={0} aria-label="Historial de entradas de contraste">
                                    {historyLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground" role="status" aria-live="polite">
                                            <Loader2 className="h-6 w-6 animate-spin mr-2" aria-hidden="true" /> Cargando...
                                        </div>
                                    ) : historyError ? (
                                        <div className="p-4">
                                            <Alert variant="destructive" role="alert" aria-live="assertive">
                                                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                                <AlertTitle>Error</AlertTitle>
                                                <AlertDescriptionComponent>
                                                    {historyError}
                                                </AlertDescriptionComponent>
                                            </Alert>
                                        </div>
                                    ) : entries.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground" role="status" aria-live="polite">
                                            No hay historial de entradas.
                                        </div>
                                    ) : (
                                        <Table role="table" aria-label="Tabla de historial de entradas de contraste">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead scope="col">Fecha</TableHead>
                                                    <TableHead scope="col">Descripción</TableHead>
                                                    <TableHead scope="col" className="text-right">Cantidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {entries.map((entry) => (
                                                    <TableRow key={entry.id} tabIndex={0} role="row">
                                                        <TableCell className="text-xs" role="cell">{entry.date ? format(entry.date.toDate(), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                                                        <TableCell role="cell">
                                                            <p className="font-medium">{entry.itemName} ({entry.presentation})</p>
                                                            <p className="text-xs text-muted-foreground">Lote: {entry.lote}</p>
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold text-green-600" role="cell">+{entry.amountAdded} {entry.presentation}(s)</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Diálogo para agregar insumo */}
            <AddSupplyEntryDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
        </>
    );
}
