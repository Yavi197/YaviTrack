"use client";

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, CloudUpload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { syncSheetsDataAction } from '@/app/actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Modalities } from '@/lib/types';

type StudyStatusOptionValue = 'completed' | 'pending' | 'informed' | 'all';

const ENTITY_COPY = {
    studies: {
        label: 'Estudios por modalidad',
        badge: 'Modalidades RX · ECO · TAC',
        helper: 'Sincroniza los estudios completados para auditar producción o respaldar reportes clínicos.',
    },
    remissions: {
        label: 'Remisiones externas',
        badge: 'Referencia institucional',
        helper: 'Descarga un histórico de remisiones con la misma estructura enviada cada noche.',
    },
    inventory: {
        label: 'Entradas de insumos',
        badge: 'Farmacia + almacén',
        helper: 'Replica el consolidado mensual de entradas para cuadrar contra el kardex.',
    },
} as const;

const REPLACE_COPY = {
    merge: 'Conserva las filas ya existentes y solo agrega las nuevas.',
    replace: 'Elimina coincidencias dentro del rango antes de escribir los datos.',
} as const;

const STUDY_STATUS_OPTIONS: Array<{ value: StudyStatusOptionValue; label: string; description: string; rangeHint: string }> = [
    {
        value: 'completed',
        label: 'Solo completados',
        description: 'Exporta únicamente los estudios finalizados. Tomamos la fecha de finalización para el rango.',
        rangeHint: 'Filtrado por fecha de finalización.',
    },
    {
        value: 'pending',
        label: 'Pendientes',
        description: 'Incluye los estudios en cola. Usamos la fecha de creación para evaluar el rango.',
        rangeHint: 'Filtrado por fecha de creación.',
    },
    {
        value: 'informed',
        label: 'Informados',
        description: 'Sincroniza los estudios leídos/informados. La fecha usada es la de creación.',
        rangeHint: 'Filtrado por fecha de creación.',
    },
    {
        value: 'all',
        label: 'Todos (Pend.+Compl.+Infor.)',
        description: 'Combina los tres estados. Los completados usan fecha de finalización; el resto, la de creación.',
        rangeHint: 'Se mezclan fechas de finalización y creación según el estado.',
    },
];

const createSyncId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `sync-${Date.now().toString(36)}`;
};

const formatDateLabel = (value?: string) => {
    if (!value) return 'fecha sin definir';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'fecha sin definir' : format(parsed, 'PPP', { locale: es });
};

const formatRangeLabel = (from: string, to?: string) => {
    if (!from && !to) return 'Rango sin definir';
    if (!to || from === to) {
        return formatDateLabel(from);
    }
    return `${formatDateLabel(from)} → ${formatDateLabel(to)}`;
};

interface SyncStudiesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SyncStudiesDialog({ open, onOpenChange }: SyncStudiesDialogProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; synced: number; failed: number; message: string } | null>(null);
    const defaultFrom = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultTo = new Date().toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState<string>(defaultFrom);
    const [toDate, setToDate] = useState<string>(defaultTo);
    const [entity, setEntity] = useState<'studies' | 'remissions' | 'inventory'>('studies');
    const [modality, setModality] = useState<string>('ALL');
    const [replaceStrategy, setReplaceStrategy] = useState<'merge' | 'replace'>('merge');
    const [currentSyncId, setCurrentSyncId] = useState<string | null>(null);
    const [studyStatus, setStudyStatus] = useState<StudyStatusOptionValue>('completed');

    const rangeLabel = useMemo(() => formatRangeLabel(fromDate, toDate || undefined), [fromDate, toDate]);
    const entityCopy = ENTITY_COPY[entity];
    const selectedStatusOption = STUDY_STATUS_OPTIONS.find(option => option.value === studyStatus);

    const handleSync = async () => {
        if (!fromDate) {
            alert('Por favor selecciona una fecha');
            return;
        }

        const newSyncId = createSyncId();
        setCurrentSyncId(newSyncId);
        setLoading(true);
        setResult(null);

        try {
            const res = await syncSheetsDataAction({
                entity,
                fromDate,
                toDate: toDate || undefined,
                modality: entity === 'studies' ? modality : undefined,
                replaceStrategy,
                studyStatus: entity === 'studies' ? studyStatus : undefined,
                syncId: newSyncId,
            });
            setResult(res);
        } catch (error: any) {
            setResult({
                success: false,
                synced: 0,
                failed: 0,
                message: `Error: ${error.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setResult(null);
        setFromDate(defaultFrom);
        setToDate(defaultTo);
        setEntity('studies');
        setModality('ALL');
        setReplaceStrategy('merge');
        setStudyStatus('completed');
        setCurrentSyncId(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] lg:max-w-[920px] max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                        <CloudUpload className="h-5 w-5 text-amber-600" />
                        Sincronizar datos con Google Sheets
                    </DialogTitle>
                    <DialogDescription className="text-sm text-neutral-600">
                        Selecciona rango, modalidad y estrategia de escritura. Usamos la misma estructura que la exportación automática nocturna.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-5 py-2 pb-16">
                    <div>
                        {loading ? (
                            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/80 p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                                    <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-amber-900">Enviando a Google Sheets</p>
                                    <p className="text-xs text-neutral-600">Mantén abierta esta ventana; la API puede demorar hasta 2 minutos.</p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-700">
                                <span className="flex gap-1">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-amber-600" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-amber-600 [animation-delay:0.15s]" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-amber-600 [animation-delay:0.3s]" />
                                </span>
                                <span>Google no expone progreso granular; este estado es referencial.</span>
                            </div>
                            {currentSyncId && (
                                <p className="mt-2 text-[11px] font-mono text-amber-800">
                                    UID en curso: {currentSyncId}
                                </p>
                            )}
                            </div>
                        ) : result ? (
                            <div className={`rounded-2xl border p-4 ${result.success ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                {result.success ? (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        <span className="text-emerald-800">Sincronización completada</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                        <span className="text-amber-800">Sincronización con advertencias</span>
                                    </>
                                )}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-neutral-800">
                                <div>
                                    <p className="text-xs uppercase text-neutral-500">Registros escritos</p>
                                    <p className="text-lg font-semibold">{result.synced}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-neutral-500">Errores</p>
                                    <p className="text-lg font-semibold">{result.failed}</p>
                                </div>
                            </div>
                            {result.message && (
                                <p className="mt-3 text-sm text-neutral-700">{result.message}</p>
                            )}
                                {currentSyncId && (
                                    <p className="mt-2 text-[11px] font-mono text-neutral-500">UID de referencia: {currentSyncId}</p>
                                )}
                            </div>
                        ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Tipo</p>
                            <div className="mt-2 grid gap-2">
                                <Label className="text-[13px]">Tipo de datos</Label>
                                <Select value={entity} onValueChange={value => setEntity(value as typeof entity)} disabled={loading}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Selecciona una opción" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="studies">Estudios por modalidad</SelectItem>
                                        <SelectItem value="remissions">Remisiones externas</SelectItem>
                                        <SelectItem value="inventory">Entradas de insumos</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-neutral-500">{entityCopy.helper}</p>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:col-span-2 lg:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rango</p>
                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <div className="grid gap-1">
                                    <Label htmlFor="from-date" className="text-[13px]">Desde</Label>
                                    <Input id="from-date" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} disabled={loading} className="h-10" />
                                </div>
                                <div className="grid gap-1">
                                    <Label htmlFor="to-date" className="text-[13px]">Hasta</Label>
                                    <Input id="to-date" type="date" value={toDate} onChange={e => setToDate(e.target.value)} disabled={loading} className="h-10" />
                                </div>
                                <div className="lg:col-span-2 text-[12px] text-neutral-500">{rangeLabel}</div>
                            </div>
                        </section>

                        {entity === 'studies' && (
                            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Estado del lote</p>
                                <div className="mt-2 grid gap-2">
                                    <Label className="text-[13px]">Estado a exportar</Label>
                                    <Select value={studyStatus} onValueChange={value => setStudyStatus(value as StudyStatusOptionValue)} disabled={loading}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Elige el estado" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STUDY_STATUS_OPTIONS.map(option => (
                                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-neutral-500">{selectedStatusOption?.description}</p>
                                </div>
                            </section>
                        )}

                        {entity === 'studies' && (
                            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Modalidad</p>
                                <div className="mt-2 grid gap-2">
                                    <Label className="text-[13px]">Filtra por modalidad</Label>
                                    <Select value={modality} onValueChange={value => setModality(value)} disabled={loading}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Todas las modalidades" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Todas</SelectItem>
                                            {Modalities.map(mod => (
                                                <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-neutral-500">Solo aplica cuando los estudios tienen modalidad registrada.</p>
                                </div>
                            </section>
                        )}

                        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Estrategia</p>
                            <div className="mt-2 grid gap-2">
                                <Label className="text-[13px]">Modo de escritura</Label>
                                <Select value={replaceStrategy} onValueChange={value => setReplaceStrategy(value as 'merge' | 'replace')} disabled={loading}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Selecciona un modo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="merge">Añadir sin borrar</SelectItem>
                                        <SelectItem value="replace">Reemplazar filas coincidentes</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-neutral-500">{REPLACE_COPY[replaceStrategy]}</p>
                            </div>
                        </section>

                    </div>
                </div>

                <DialogFooter className="sticky bottom-0 left-0 right-0 z-10 mt-4 border-t border-neutral-200 bg-white py-3">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                        {result ? 'Cerrar' : 'Cancelar'}
                    </Button>
                    <Button type="button" onClick={handleSync} disabled={loading || !fromDate} className="bg-amber-600 text-white hover:bg-amber-700">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sincronizando
                            </>
                        ) : (
                            'Sincronizar con Sheets'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
