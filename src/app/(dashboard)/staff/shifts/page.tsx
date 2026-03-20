
"use client";

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TechnologistShiftCalendar, CALENDAR_MODALITY_COLORS } from '@/components/app/technologist-shift-calendar';
import { type CalendarShiftAssignment } from '@/components/app/technologist-shift-calendar';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { CalendarModalities, type CalendarModality, type ShiftAssignableRole, type ShiftType, ShiftTypes, type TechnologistShift } from '@/lib/types';
import { deleteCalendarShiftAction, generateTechnologistShiftsAction, upsertCalendarShiftAction } from '@/app/actions';

const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const calendarModalities = CalendarModalities;

type StaffOption = {
    uid: string;
    nombre: string;
    rol: ShiftAssignableRole;
};

type CalendarShiftDoc = TechnologistShift & { id: string };

const pad = (value: number) => value.toString().padStart(2, '0');
const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const formatDateKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

const computeSundayDates = (year: number, month: number) => {
    const totalDays = getDaysInMonth(year, month);
    const sundays: string[] = [];
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(`${formatDateKey(year, month, day)}T00:00:00`);
        if (date.getDay() === 0) {
            sundays.push(formatDateKey(year, month, day));
        }
    }
    return sundays;
};

const shiftSortOrder: ShiftType[] = ['CORRIDO', 'NOCHE', 'POSTURNO', 'LIBRE'];
const modalitySortOrder: CalendarModality[] = ['RX', 'ECO', 'TAC'];

const PERSON_PRIORITY_SEQUENCE = ['gabriel', 'onasis', 'hernan', 'nora'];
const normalizePersonName = (value?: string) =>
    value ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';
const getPriorityForValue = (value?: string) => {
    const normalized = normalizePersonName(value);
    if (!normalized) return Number.MAX_SAFE_INTEGER;
    const matchIndex = PERSON_PRIORITY_SEQUENCE.findIndex((target) => normalized.startsWith(target));
    return matchIndex === -1 ? Number.MAX_SAFE_INTEGER : matchIndex;
};

const sortAssignmentsForUi = (assignments: CalendarShiftAssignment[]) => {
    return [...assignments].sort((a, b) => {
        const modalityDiff = modalitySortOrder.indexOf(a.modality) - modalitySortOrder.indexOf(b.modality);
        if (modalityDiff !== 0) return modalityDiff;
        const shiftDiff = shiftSortOrder.indexOf(a.shiftType) - shiftSortOrder.indexOf(b.shiftType);
        if (shiftDiff !== 0) return shiftDiff;
        return (a.personLabel ?? '').localeCompare(b.personLabel ?? '');
    });
};

export default function TechnologistShiftPage() {
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    // Generador automático (aún disponible para plantillas rápidas)
    const [technologistId, setTechnologistId] = useState('');
    const [offset, setOffset] = useState(0);
    const [notes, setNotes] = useState('');
    const [loadingGeneration, setLoadingGeneration] = useState(false);

    // Festivos visuales
    const [customHolidayDates, setCustomHolidayDates] = useState<Set<string>>(() => new Set<string>());
    const [isHolidayPanelOpen, setIsHolidayPanelOpen] = useState(false);

    const sundayDates = useMemo(() => computeSundayDates(year, month), [year, month]);
    const sundaySet = useMemo(() => new Set(sundayDates), [sundayDates]);
    const holidayDatesSet = useMemo(() => {
        const combined = new Set<string>(sundayDates);
        customHolidayDates.forEach((date) => combined.add(date));
        return combined;
    }, [sundayDates, customHolidayDates]);

    useEffect(() => {
        setCustomHolidayDates(new Set<string>());
    }, [year, month]);

    // Datos de personal y turnos existentes
    const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
    const [staffLoading, setStaffLoading] = useState(true);
    const staffNameById = useMemo(() => {
        const map = new Map<string, string>();
        staffOptions.forEach((staff) => {
            map.set(staff.uid, staff.nombre);
        });
        return map;
    }, [staffOptions]);
    const [monthShifts, setMonthShifts] = useState<CalendarShiftDoc[]>([]);
    const [shiftsLoading, setShiftsLoading] = useState(true);

    const technologistOptions = useMemo(() => staffOptions.filter((staff) => staff.rol === 'tecnologo'), [staffOptions]);
    const selectedTechnologist = useMemo(() => technologistOptions.find((staff) => staff.uid === technologistId) || null, [technologistId, technologistOptions]);
    const personDisplayOrder = useMemo(() => {
        type OrderEntry = { key: string; priority: number; seq: number };
        const entries: OrderEntry[] = [];
        let seq = 0;
        const registerKey = (key?: string, priority = Number.MAX_SAFE_INTEGER) => {
            if (!key) return;
            entries.push({ key, priority, seq: seq++ });
        };

        technologistOptions.forEach((staff) => {
            const priority = getPriorityForValue(staff.nombre);
            registerKey(staff.uid, priority);
            registerKey(staff.nombre, priority);
        });

        monthShifts.forEach((shift) => {
            const resolvedUserId = shift.assignedUserId || shift.technologistId;
            const metadataName = typeof shift.metadata?.assignedUserName === 'string' ? shift.metadata?.assignedUserName : undefined;
            const label = shift.assignedUserName || metadataName;
            const resolvedName = resolvedUserId ? staffNameById.get(resolvedUserId) : undefined;
            const priority = Math.min(getPriorityForValue(resolvedName), getPriorityForValue(label));
            registerKey(resolvedUserId, priority);
            registerKey(label, priority);
        });

        entries.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.seq - b.seq;
        });

        const order = new Map<string, number>();
        entries.forEach((entry) => {
            if (!order.has(entry.key)) {
                order.set(entry.key, order.size);
            }
        });
        return order;
    }, [technologistOptions, monthShifts, staffNameById]);

    // Modal del calendario
    const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [selectedModality, setSelectedModality] = useState<CalendarModality>('RX');
    const [selectedShiftType, setSelectedShiftType] = useState<ShiftType>('CORRIDO');
    const [selectedNote, setSelectedNote] = useState('');
    const [savingShift, setSavingShift] = useState(false);
    const [deletingShift, setDeletingShift] = useState(false);

    useEffect(() => {
        const rolesFilter: ShiftAssignableRole[] = ['tecnologo', 'transcriptora'];
        const staffQuery = query(
            collection(db, 'users'),
            where('rol', 'in', rolesFilter)
        );

        const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
            const data: StaffOption[] = snapshot.docs.map((doc) => {
                const staffData = doc.data() as Partial<StaffOption> & { nombre?: string; rol?: ShiftAssignableRole };
                return {
                    uid: doc.id,
                    nombre: staffData.nombre || 'Sin nombre',
                    rol: (staffData.rol || 'tecnologo') as ShiftAssignableRole,
                };
            }).sort((a, b) => a.nombre.localeCompare(b.nombre));
            setStaffOptions(data);
            setStaffLoading(false);
        }, (error) => {
            console.error('Error cargando personal:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar la lista de usuarios.' });
            setStaffLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    useEffect(() => {
        if (technologistId && !technologistOptions.find((staff) => staff.uid === technologistId)) {
            setTechnologistId('');
        }
    }, [technologistId, technologistOptions]);

    useEffect(() => {
        const start = `${year}-${pad(month)}-01`;
        const end = `${year}-${pad(month)}-${pad(getDaysInMonth(year, month))}`;
        const monthQuery = query(
            collection(db, 'technologistShifts'),
            where('date', '>=', start),
            where('date', '<=', end),
            orderBy('date', 'asc')
        );

        setShiftsLoading(true);
        const unsubscribe = onSnapshot(monthQuery, (snapshot) => {
            const data: CalendarShiftDoc[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as TechnologistShift),
            }));
            setMonthShifts(data);
            setShiftsLoading(false);
        }, (error) => {
            console.error('Error cargando turnos:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el calendario.' });
            setShiftsLoading(false);
        });

        return () => unsubscribe();
    }, [year, month, toast]);

    const assignmentsMap = useMemo(() => {
        const map = monthShifts.reduce<Record<string, CalendarShiftAssignment[]>>((acc, shift) => {
            if (!shift.date || !shift.id) {
                return acc;
            }
            const derivedModality = (shift.modality as CalendarModality) ?? (shift.metadata?.modality as CalendarModality) ?? 'RX';
            const resolvedUserId = shift.assignedUserId || shift.technologistId;
            const personLabel = (resolvedUserId ? staffNameById.get(resolvedUserId) : undefined)
                || shift.assignedUserName
                || (typeof shift.metadata?.assignedUserName === 'string' ? String(shift.metadata?.assignedUserName) : undefined)
                || resolvedUserId
                || 'Sin nombre';
            const personKey = resolvedUserId || personLabel;
            const entry: CalendarShiftAssignment = {
                id: shift.id,
                shiftType: shift.shiftType,
                modality: derivedModality,
                personLabel,
                note: shift.notes,
                sortIndex: personKey ? personDisplayOrder.get(personKey) ?? personDisplayOrder.size : personDisplayOrder.size,
            };
            if (!acc[shift.date]) {
                acc[shift.date] = [];
            }
            acc[shift.date].push(entry);
            return acc;
        }, {});

        Object.keys(map).forEach((dateKey) => {
            map[dateKey] = sortAssignmentsForUi(map[dateKey]);
        });

        return map;
    }, [monthShifts, personDisplayOrder, staffNameById]);

    const selectedDayAssignments = useMemo(() => {
        if (!selectedDate) return [];
        return assignmentsMap[selectedDate] ?? [];
    }, [assignmentsMap, selectedDate]);

    const formatDialogDate = (date: string | null) => {
        if (!date) return '';
        return new Date(`${date}T00:00:00`).toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const resetFormForDate = (date: string) => {
        setSelectedDate(date);
        setSelectedShiftId(null);
        setSelectedStaffId('');
        setSelectedModality('RX');
        setSelectedShiftType('CORRIDO');
        setSelectedNote('');
        setIsDayDialogOpen(true);
    };

    const toggleCustomHoliday = (day: number) => {
        const dateKey = formatDateKey(year, month, day);
        if (sundaySet.has(dateKey)) {
            return; // Los domingos siempre quedan marcados
        }
        setCustomHolidayDates((prev) => {
            const next = new Set(prev);
            if (next.has(dateKey)) {
                next.delete(dateKey);
            } else {
                next.add(dateKey);
            }
            return next;
        });
    };

    const handleDaySelect = (date: string) => {
        resetFormForDate(date);
    };

    const loadShiftIntoForm = (shift: CalendarShiftDoc) => {
        const derivedModality = (shift.modality as CalendarModality) ?? (shift.metadata?.modality as CalendarModality) ?? 'RX';
        setSelectedDate(shift.date);
        setSelectedShiftId(shift.id);
        setSelectedStaffId(shift.assignedUserId || shift.technologistId || '');
        setSelectedModality(derivedModality);
        setSelectedShiftType(shift.shiftType);
        setSelectedNote(shift.notes ?? '');
        setIsDayDialogOpen(true);
    };

    const handleAssignmentClick = (assignmentId: string) => {
        const target = monthShifts.find((shift) => shift.id === assignmentId);
        if (target) {
            loadShiftIntoForm(target);
        }
    };

    const handleDialogOpenChange = (open: boolean) => {
        setIsDayDialogOpen(open);
        if (!open) {
            setSelectedShiftId(null);
            setSelectedStaffId('');
            setSelectedNote('');
            setSelectedDate(null);
        }
    };

    const handleSaveShift = async () => {
        if (!selectedDate) {
            toast({ variant: 'destructive', title: 'Falta fecha', description: 'Selecciona un día del calendario.' });
            return;
        }
        const staff = staffOptions.find((option) => option.uid === selectedStaffId);
        if (!staff) {
            toast({ variant: 'destructive', title: 'Falta responsable', description: 'Selecciona el tecnólogo o transcriptora para este turno.' });
            return;
        }
        setSavingShift(true);
        try {
            const result = await upsertCalendarShiftAction({
                shiftId: selectedShiftId ?? undefined,
                date: selectedDate,
                shiftType: selectedShiftType,
                modality: selectedModality,
                assignedUserId: staff.uid,
                assignedUserName: staff.nombre,
                assignedRole: staff.rol,
                notes: selectedNote.trim() || undefined,
            });
            if (result.success) {
                toast({ title: 'Turno guardado', description: selectedShiftId ? 'Se actualizó el turno existente.' : 'Se registró el nuevo turno.' });
                handleDialogOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudo guardar el turno.' });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setSavingShift(false);
        }
    };

    const handleDeleteShift = async () => {
        if (!selectedShiftId) return;
        setDeletingShift(true);
        try {
            const result = await deleteCalendarShiftAction({ shiftId: selectedShiftId });
            if (result.success) {
                toast({ title: 'Turno eliminado', description: 'El turno fue eliminado de este día.' });
                handleDialogOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudo eliminar el turno.' });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setDeletingShift(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedTechnologist) {
            toast({ variant: 'destructive', title: 'Falta tecnólogo', description: 'Selecciona el tecnólogo al que deseas asignar la secuencia.' });
            return;
        }
        setLoadingGeneration(true);
        try {
            const holidayList = Array.from(holidayDatesSet);
            const notesByDate = notes
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .reduce<Record<string, string>>((acc, entry) => {
                    const [date, text] = entry.split(':');
                    if (date && text) {
                        acc[date.trim()] = text.trim();
                    }
                    return acc;
                }, {});

            const result = await generateTechnologistShiftsAction({
                technologistId: selectedTechnologist.uid,
                year,
                month,
                startSequenceIndex: Number(offset) || 0,
                holidays: holidayList,
                notesByDate,
                assignedUserName: selectedTechnologist.nombre,
                assignedRole: selectedTechnologist.rol,
            });

            if (result.success) {
                toast({ title: 'Turnos generados', description: `Se generaron ${result.inserted} turnos para ${months[month - 1]} ${year}.` });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudieron crear los turnos.' });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoadingGeneration(false);
        }
    };

    const monthLabel = `${months[month - 1]} ${year}`;
    const totalDaysInMonth = getDaysInMonth(year, month);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Calendario maestro de turnos</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Haz clic en un día para crear o editar turnos, asigna tecnólogos o transcriptoras y colorea según modalidad (RX azul · ECO rojo · TAC verde).
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                            <Label>Año</Label>
                            <Input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Mes</Label>
                            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona mes" />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((label, index) => (
                                        <SelectItem key={label} value={String(index + 1)}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                            <p className="font-semibold text-foreground">{monthLabel}</p>
                            <p>{shiftsLoading ? 'Cargando turnos del mes…' : `${monthShifts.length} turno(s) registrados.`}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-dashed bg-muted/40">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/50"
                            aria-expanded={isHolidayPanelOpen}
                            onClick={() => setIsHolidayPanelOpen((prev) => !prev)}
                        >
                            <div>
                                <p className="text-sm font-semibold text-foreground">Festivos del mes</p>
                                <p className="text-xs text-muted-foreground">
                                    {customHolidayDates.size > 0 ? `${customHolidayDates.size} festivo(s) extra seleccionado(s).` : 'Sin festivos adicionales.'}
                                </p>
                            </div>
                            <span className="text-xs font-semibold text-primary">
                                {isHolidayPanelOpen ? 'Ocultar' : 'Configurar'}
                            </span>
                        </button>
                        {isHolidayPanelOpen && (
                            <div className="space-y-3 border-t px-4 py-3 text-xs text-muted-foreground">
                                <p>Los domingos se bloquean automáticamente; haz clic en otros días para marcarlos como festivos.</p>
                                <div className="grid grid-cols-7 gap-1">
                                    {Array.from({ length: totalDaysInMonth }, (_, index) => {
                                        const day = index + 1;
                                        const dateKey = formatDateKey(year, month, day);
                                        const isSunday = sundaySet.has(dateKey);
                                        const isCustom = customHolidayDates.has(dateKey);
                                        const buttonStateClass = isSunday
                                            ? 'border-rose-400 bg-rose-100 text-rose-700 cursor-not-allowed'
                                            : isCustom
                                                ? 'border-rose-400 bg-rose-50 text-rose-700'
                                                : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary';
                                        return (
                                            <button
                                                key={dateKey}
                                                type="button"
                                                disabled={isSunday}
                                                className={`rounded-md border px-2 py-1.5 text-center font-semibold transition ${buttonStateClass}`}
                                                onClick={() => toggleCustomHoliday(day)}
                                            >
                                                <span className="text-sm">{day}</span>
                                                {isSunday && <span className="block text-[9px] font-medium uppercase text-rose-700">Domingo</span>}
                                                {!isSunday && isCustom && (
                                                    <span className="block text-[9px] font-medium uppercase text-rose-500">Festivo</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <TechnologistShiftCalendar
                        year={year}
                        month={month}
                        assignments={assignmentsMap}
                        onDayClick={handleDaySelect}
                            onAssignmentClick={handleAssignmentClick}
                            holidayDates={holidayDatesSet}
                    />

                    <div className="flex flex-wrap gap-4 text-sm">
                        {calendarModalities.map((modality) => (
                            <div key={modality} className="flex items-center gap-2">
                                <span className={`h-3 w-3 rounded-full ${CALENDAR_MODALITY_COLORS[modality].dot}`} aria-hidden="true" />
                                <span>Turnos {modality}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Generar secuencia automática (opcional)</CardTitle>
                    <p className="text-sm text-muted-foreground">Mantuvimos la herramienta de generación masiva para crear plantillas rápidas y luego ajustar en el calendario.</p>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="grid gap-2">
                        <Label>Tecnólogo</Label>
                        <Select value={technologistId} onValueChange={setTechnologistId} disabled={staffLoading}>
                            <SelectTrigger>
                                <SelectValue placeholder={staffLoading ? 'Cargando personal...' : 'Selecciona al tecnólogo'} />
                            </SelectTrigger>
                            <SelectContent>
                                {technologistOptions.map((staff) => (
                                    <SelectItem key={staff.uid} value={staff.uid}>
                                        {staff.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Offset inicial (0-3)</Label>
                        <Input type="number" min={0} max={3} value={offset} onChange={(event) => setOffset(Number(event.target.value))} />
                        <p className="text-xs text-muted-foreground">0: Corrido · 1: Noche · 2: Posturno · 3: Libre</p>
                    </div>
                    <div className="grid gap-2 md:col-span-2 lg:col-span-3">
                        <Label>Notas por fecha (YYYY-MM-DD: texto)</Label>
                        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="2025-01-15: cubrir turno RX" rows={3} />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                        <Button onClick={handleGenerate} disabled={loadingGeneration} className="w-full md:w-auto">
                            {loadingGeneration ? 'Generando...' : 'Generar turnos'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDayDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedDate ? `Turno para ${formatDialogDate(selectedDate)}` : 'Turno manual'}</DialogTitle>
                        {selectedDate && selectedDayAssignments.length > 0 && (
                            <div className="mt-2 rounded-lg border bg-muted/30 p-3">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Turnos existentes</p>
                                <div className="mt-2 flex flex-col gap-2">
                                    {selectedDayAssignments.map((assignment) => (
                                        <button
                                            key={assignment.id}
                                            type="button"
                                            className={`rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary ${selectedShiftId === assignment.id ? 'border-primary bg-primary/5' : ''}`}
                                            onClick={() => handleAssignmentClick(assignment.id)}
                                        >
                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase">
                                                <span className={`h-2 w-2 rounded-full ${CALENDAR_MODALITY_COLORS[assignment.modality].dot}`} />
                                                <span>{assignment.shiftType}</span>
                                            </div>
                                            <p className="text-sm font-medium">{assignment.personLabel ?? 'Sin asignar'}</p>
                                            {assignment.note && <p className="text-xs text-muted-foreground">{assignment.note}</p>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>Responsable</Label>
                            <Select value={selectedStaffId} onValueChange={setSelectedStaffId} disabled={staffLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder={staffLoading ? 'Cargando personal...' : 'Selecciona a quién asignar'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {staffOptions.map((staff) => (
                                        <SelectItem key={staff.uid} value={staff.uid}>
                                            {staff.nombre} · {staff.rol === 'tecnologo' ? 'Tecnólogo' : 'Transcriptora'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Modalidad</Label>
                            <Select value={selectedModality} onValueChange={(value) => setSelectedModality(value as CalendarModality)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona modalidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    {calendarModalities.map((modality) => (
                                        <SelectItem key={modality} value={modality}>
                                            {modality}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Tipo de turno</Label>
                            <Select value={selectedShiftType} onValueChange={(value) => setSelectedShiftType(value as ShiftType)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona tipo de turno" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ShiftTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Nota (opcional)</Label>
                            <Textarea value={selectedNote} onChange={(event) => setSelectedNote(event.target.value)} placeholder="Cobertura especial, recordatorios, etc." rows={3} />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={!selectedShiftId || deletingShift}
                            onClick={handleDeleteShift}
                        >
                            {deletingShift ? 'Eliminando...' : 'Eliminar turno'}
                        </Button>
                        <Button type="button" onClick={handleSaveShift} disabled={savingShift}>
                            {savingShift ? 'Guardando...' : 'Guardar turno'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
