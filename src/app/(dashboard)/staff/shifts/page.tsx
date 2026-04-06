
"use client";

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TechnologistShiftCalendar, CALENDAR_MODALITY_COLORS } from '@/components/app/technologist-shift-calendar';
import { StaffShiftMatrix } from '@/components/app/staff-shift-matrix';
import { db } from '@/lib/firebase';
import { CalendarModalities, type CalendarModality, type ShiftAssignableRole, type ShiftType, ShiftTypes, type TechnologistShift, type UserProfile, type CalendarShiftAssignment, type MatrixShiftAssignment } from '@/lib/types';
import { deleteCalendarShiftAction, generateTechnologistShiftsAction, upsertCalendarShiftAction, syncStaffShiftsToSheetAction, clearTechnologistShiftsAction } from '@/app/actions';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, CloudUpload, LayoutGrid, Table, Plus, Printer, BarChart2 } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import Holidays from 'date-holidays';
import { useToast } from '@/hooks/use-toast';

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
    const [startSequenceIndex, setStartSequenceIndex] = useState(0);
    const [notes, setNotes] = useState('');
    const [loadingGeneration, setLoadingGeneration] = useState(false);
    const [generationModality, setGenerationModality] = useState<CalendarModality>('RX');
    const [generationDateRange, setGenerationDateRange] = useState<DateRange | undefined>(undefined);
    const [syncingToDrive, setSyncingToDrive] = useState(false);
    const [viewMode, setViewMode] = useState<'calendar' | 'matrix'>('matrix');

    // Festivos visuales
    const [customHolidayDates, setCustomHolidayDates] = useState<Set<string>>(() => new Set<string>());
    const [isHolidayPanelOpen, setIsHolidayPanelOpen] = useState(false);

    const sundayDates = useMemo(() => computeSundayDates(year, month), [year, month]);
    const sundaySet = useMemo(() => new Set(sundayDates), [sundayDates]);

    // Calcular dinámicamente los festivos de Colombia
    const { colombiaHolidayDates, colombiaHolidayDetails } = useMemo(() => {
        try {
            const hd = new Holidays('CO');
            const hols = hd.getHolidays(year);
            // date-holidays devuelve 'YYYY-MM-DD HH:MM:SS', nos quedamos con la fecha
            const details = hols.filter(h => h.date.startsWith(`${year}-${pad(month)}`)).map(h => ({ name: h.name, date: h.date.split(' ')[0] }));
            const dates = hols.map(h => h.date.split(' ')[0]);
            return { colombiaHolidayDates: dates, colombiaHolidayDetails: details };
        } catch (e) {
            console.error('Error calculando festivos:', e);
            return { colombiaHolidayDates: [], colombiaHolidayDetails: [] };
        }
    }, [year, month]);

    const holidayDatesSet = useMemo(() => {
        const combined = new Set<string>(sundayDates);
        colombiaHolidayDates.forEach((date) => combined.add(date));
        customHolidayDates.forEach((date) => combined.add(date));
        return combined;
    }, [sundayDates, customHolidayDates, colombiaHolidayDates]);

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

    const technologistOptions = useMemo(() => staffOptions, [staffOptions]);
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
    const [showNoteField, setShowNoteField] = useState(false);
    const [savingShift, setSavingShift] = useState(false);
    const [deletingShift, setDeletingShift] = useState(false);

    useEffect(() => {
        const rolesFilter: string[] = ['tecnologo', 'transcriptora'];
        const staffQuery = query(
            collection(db, 'users'),
            where('rol', 'in', rolesFilter)
        );

        const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
            const data: StaffOption[] = snapshot.docs.map((doc) => {
                const staffData = doc.data() as Partial<StaffOption> & { nombre?: string; rol?: ShiftAssignableRole; servicioAsignado?: string };
                return {
                    uid: doc.id,
                    nombre: staffData.nombre || 'Sin nombre',
                    rol: (staffData.rol || 'tecnologo') as ShiftAssignableRole,
                    servicioAsignado: staffData.servicioAsignado,
                } as any;
            }).filter((staff: any) => {
                if (staff.rol === 'tecnologo' && staff.servicioAsignado === 'RX') return true;
                if (staff.rol === 'transcriptora' && staff.servicioAsignado === 'ECO') return true;
                return false;
            }).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
            setStaffOptions(data);
            setStaffLoading(false);
        }, (error) => {
            console.error('Error cargando personal:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar la lista de usuarios.' });
            setStaffLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    const staffRoleById = useMemo(() => {
        const map = new Map<string, string>();
        staffOptions.forEach((staff) => {
            map.set(staff.uid, staff.rol);
        });
        return map;
    }, [staffOptions]);

    useEffect(() => {
        const staff = technologistOptions.find((staff) => staff.uid === technologistId);
        if (technologistId && !staff) {
            setTechnologistId('');
        } else if (staff) {
            if ((staff as any).servicioAsignado === 'RX') setGenerationModality('RX');
            else if ((staff as any).servicioAsignado === 'ECO') setGenerationModality('ECO');
            else {
                if (staff.rol === 'tecnologo') setGenerationModality('RX');
                if (staff.rol === 'transcriptora') setGenerationModality('ECO');
            }
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
            const role = (resolvedUserId ? staffRoleById.get(resolvedUserId) : undefined)
                || (shift.assignedRole as string)
                || 'tecnologo';

            const entry: CalendarShiftAssignment = {
                id: shift.id,
                shiftType: shift.shiftType,
                modality: derivedModality,
                personLabel,
                note: shift.notes,
                sortIndex: personKey ? personDisplayOrder.get(personKey) ?? personDisplayOrder.size : personDisplayOrder.size,
                role,
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
    }, [monthShifts, personDisplayOrder, staffNameById, staffRoleById]);

    const workloadStats = useMemo(() => {
        const stats: Record<string, { total: number, name: string, diurno: number, nocturno: number, festivoDiurno: number, festivoNocturno: number }> = {};
        staffOptions.forEach(s => {
            stats[s.uid] = { total: 0, name: s.nombre, diurno: 0, nocturno: 0, festivoDiurno: 0, festivoNocturno: 0 };
        });
        const workTypes = ['CORRIDO', 'NOCHE', 'MANANA_TARDE', 'MANANA'];
        monthShifts.forEach(shift => {
            if (workTypes.includes(shift.shiftType)) {
                const resId = shift.assignedUserId || shift.technologistId;
                if (resId && stats[resId]) {
                    stats[resId].total += 1;
                    const dateObj = new Date(shift.date + 'T00:00:00');
                    const isHoliday = holidayDatesSet.has(shift.date) || dateObj.getDay() === 0;
                    const isNight = shift.shiftType === 'NOCHE';
                    
                    if (isHoliday && isNight) stats[resId].festivoNocturno += 1;
                    else if (isHoliday && !isNight) stats[resId].festivoDiurno += 1;
                    else if (!isHoliday && isNight) stats[resId].nocturno += 1;
                    else stats[resId].diurno += 1;
                }
            }
        });
        return Object.values(stats).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
    }, [monthShifts, staffOptions, holidayDatesSet]);

    const matrixAssignmentsMap = useMemo(() => {
        const map: Record<string, MatrixShiftAssignment[]> = {};
        monthShifts.forEach(shift => {
            if (!shift.date || !shift.id) return;
            const resId = shift.assignedUserId || shift.technologistId;
            if (!resId) return;

            if (!map[shift.date]) map[shift.date] = [];

            map[shift.date].push({
                id: shift.id,
                shiftType: shift.shiftType,
                modality: (shift.modality as CalendarModality) ?? 'RX',
                personId: resId,
                personLabel: shift.assignedUserName || staffNameById.get(resId),
                note: shift.notes
            });
        });
        return map;
    }, [monthShifts, staffNameById]);

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
        setShowNoteField(false);
        setIsDayDialogOpen(true);
    };

    const handleDialogStaffChange = (staffId: string) => {
        setSelectedStaffId(staffId);
        const staff = staffOptions.find(s => s.uid === staffId);
        if (staff) {
            if ((staff as any).servicioAsignado === 'RX') setSelectedModality('RX');
            else if ((staff as any).servicioAsignado === 'ECO') setSelectedModality('ECO');
            else {
                if (staff.rol === 'tecnologo') setSelectedModality('RX');
                if (staff.rol === 'transcriptora') setSelectedModality('ECO');
            }
            if (!selectedShiftId) {
                if (staff.rol === 'transcriptora') setSelectedShiftType('MANANA_TARDE');
                else setSelectedShiftType('CORRIDO');
            }
        }
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
        setShowNoteField(!!shift.notes);
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
            setShowNoteField(false);
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
        const selectedTech = technologistOptions.find(s => s.uid === technologistId);
        if (!selectedTech) {
            toast({ variant: 'destructive', title: 'Falta información', description: 'Selecciona al tecnólogo para asignar la secuencia.' });
            return;
        }

        if (!generationDateRange?.from || !generationDateRange?.to) {
            toast({ variant: 'destructive', title: 'Falta rango', description: 'Selecciona un rango de fechas para generar los turnos.' });
            return;
        }

        setLoadingGeneration(true);
        try {
            const holidayDatesList = Array.from(holidayDatesSet);
            const notesByDateMap = notes
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
                technologistId: selectedTech.uid,
                startDate: format(generationDateRange.from, 'yyyy-MM-dd'),
                endDate: format(generationDateRange.to, 'yyyy-MM-dd'),
                startSequenceIndex,
                holidays: holidayDatesList,
                notesByDate: notesByDateMap,
                assignedUserName: selectedTech.nombre,
                assignedRole: selectedTech.rol,
                baseModality: generationModality,
            });

            if (result.success) {
                toast({ title: 'Secuencia Aplicada', description: `Se configuraron ${result.inserted} turnos en el rango seleccionado.` });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudo aplicar la secuencia.' });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoadingGeneration(false);
        }
    };

    const handleClearShifts = async () => {
        if (!technologistId) {
            toast({ variant: 'destructive', title: 'Aviso', description: 'Selecciona al tecnólogo/a primero.' });
            return;
        }
        if (!generationDateRange?.from || !generationDateRange?.to) {
            toast({ variant: 'destructive', title: 'Aviso', description: 'Selecciona un rango de fechas válido.' });
            return;
        }
        setLoadingGeneration(true);
        try {
            const startStr = format(generationDateRange.from, 'yyyy-MM-dd');
            const endStr = format(generationDateRange.to, 'yyyy-MM-dd');
            const result = await clearTechnologistShiftsAction(technologistId, startStr, endStr);
            if (result.success) {
                toast({ title: 'Limpieza exitosa', description: `Se eliminaron turnos existentes en ese rango para el personal seleccionado.` });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error interno', description: error.message });
        } finally {
            setLoadingGeneration(false);
        }
    };

    const handleSyncToDrive = async () => {
        if (monthShifts.length === 0) {
            toast({ variant: 'destructive', title: 'No hay datos', description: 'No hay turnos registrados en este mes para sincronizar.' });
            return;
        }

        setSyncingToDrive(true);
        try {
            const currentMonthName = months[month - 1];
            // Asegurarnos de que todos los turnos tengan el nombre resuelto del personal
            const enrichedShifts = monthShifts.map(s => ({
                ...s,
                assignedUserName: s.assignedUserName || staffNameById.get(s.assignedUserId || s.technologistId) || 'Desconocido'
            }));

            const result = await syncStaffShiftsToSheetAction(enrichedShifts, currentMonthName, year);
            if (result.success) {
                toast({ title: 'Sincronización exitosa', description: `Se han actualizado los turnos en el Excel de Drive.` });
            } else {
                toast({ variant: 'destructive', title: 'Error de sincronización', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setSyncingToDrive(false);
        }
    };

    const nextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
    };

    const prevMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
    };

    const goToToday = () => {
        const today = new Date();
        setYear(today.getFullYear());
        setMonth(today.getMonth() + 1);
    };

    const monthLabel = `${months[month - 1]} ${year}`;
    const totalDaysInMonth = getDaysInMonth(year, month);

    return (
        <div className="space-y-6">
            <Card className="print:border-0 print:shadow-none print:bg-transparent">
                <CardHeader className="print:hidden">
                    <CardTitle>Calendario maestro de turnos</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Haz clic en un día para crear o editar turnos, asigna tecnólogos o transcriptoras y colorea según modalidad (RX azul · ECO rojo · TAC verde).
                    </p>
                </CardHeader>
                <CardContent className="space-y-6 print:space-y-2 print:p-0">
                    <h2 className="text-2xl font-black text-center mb-6 hidden print:block uppercase tracking-widest text-zinc-900 border-b-2 border-zinc-900 pb-2">
                        Cuadrante de Turnos - {monthLabel}
                    </h2>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={goToToday} className="font-bold text-xs uppercase tracking-widest rounded-xl px-4">
                                Hoy
                            </Button>
                            <div className="flex items-center bg-zinc-100 rounded-xl p-1 shrink-0">
                                <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <h2 className="text-xl font-black text-zinc-900 ml-2 uppercase tracking-tight">{monthLabel}</h2>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                                <SelectTrigger className="w-[140px] h-10 border-0 bg-zinc-100 rounded-xl font-bold text-xs uppercase hover:bg-zinc-200 transition-all">
                                    <SelectValue placeholder="Mes" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-0 shadow-2xl">
                                    {months.map((label, index) => (
                                        <SelectItem key={label} value={String(index + 1)} className="text-xs font-bold uppercase">{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                type="number"
                                value={year}
                                onChange={(event) => setYear(Number(event.target.value))}
                                className="w-[100px] h-10 border-0 bg-zinc-100 rounded-xl font-bold text-xs text-center"
                            />
                            <Button
                                variant="outline"
                                onClick={handleSyncToDrive}
                                disabled={syncingToDrive}
                                className="h-10 border-zinc-100 shadow-sm font-black text-[10px] uppercase hover:bg-zinc-50 transition-all rounded-xl gap-2 active:scale-95 print:hidden"
                            >
                                {syncingToDrive ? <Loader2 className="h-3 w-3 animate-spin text-blue-600" /> : <CloudUpload className="h-3 w-3 text-blue-600" />}
                                Sincronizar
                            </Button>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-10 border-zinc-100 shadow-sm font-black text-[10px] uppercase hover:bg-zinc-50 transition-all rounded-xl gap-2 active:scale-95 ml-2 print:hidden">
                                        <BarChart2 className="h-3 w-3 text-emerald-600" />
                                        Cargos
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-4 rounded-xl shadow-xl border-zinc-100 mr-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Detalle de Carga Laboral</h4>
                                    <ScrollArea className="max-h-[350px] pr-3">
                                        <div className="space-y-4">
                                            {workloadStats.map(stat => (
                                                <div key={stat.name} className="flex flex-col gap-2 group border-b border-zinc-50 pb-3 last:border-0 last:pb-0">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-zinc-900 text-[11px] truncate pr-3">{stat.name}</span>
                                                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] font-black border border-emerald-100 shadow-sm">Total: {stat.total}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1.5 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
                                                        <div className="bg-zinc-50 rounded px-2 py-1.5 flex justify-between items-center"><span>D. Ord:</span> <span className="text-zinc-900 font-black">{stat.diurno}</span></div>
                                                        <div className="bg-zinc-50 rounded px-2 py-1.5 flex justify-between items-center"><span>N. Ord:</span> <span className="text-zinc-900 font-black">{stat.nocturno}</span></div>
                                                        <div className="bg-rose-50/50 text-rose-600 rounded px-2 py-1.5 flex justify-between items-center"><span>D. Fest:</span> <span className="font-black">{stat.festivoDiurno}</span></div>
                                                        <div className="bg-rose-50/50 text-rose-600 rounded px-2 py-1.5 flex justify-between items-center"><span>N. Fest:</span> <span className="font-black">{stat.festivoNocturno}</span></div>
                                                    </div>
                                                </div>
                                            ))}
                                            {workloadStats.length === 0 && <p className="text-[10px] text-zinc-400 font-bold text-center py-2">Sin turnos activos</p>}
                                        </div>
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>

                            <Button
                                variant="outline"
                                onClick={() => window.print()}
                                className="h-10 border-zinc-100 shadow-sm font-black text-[10px] uppercase hover:bg-zinc-50 transition-all rounded-xl gap-2 active:scale-95 ml-2 print:hidden"
                            >
                                <Printer className="h-3 w-3 text-zinc-600" />
                                Imprimir
                            </Button>

                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="ml-2">
                                <TabsList className="bg-zinc-100/80 rounded-xl p-1 h-10 border-0">
                                    <TabsTrigger value="matrix" className="rounded-lg px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        <Table className="h-4 w-4 mr-2 text-zinc-500" />
                                        <span className="text-[10px] font-black uppercase">Matriz</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="calendar" className="rounded-lg px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        <LayoutGrid className="h-4 w-4 mr-2 text-zinc-500" />
                                        <span className="text-[10px] font-black uppercase">Mes</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    <div className="rounded-xl border border-dashed bg-muted/40 print:hidden">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/50"
                            aria-expanded={isHolidayPanelOpen}
                            onClick={() => setIsHolidayPanelOpen((prev) => !prev)}
                        >
                            <div>
                                <p className="text-sm font-semibold text-foreground">Festivos del mes</p>
                                <p className="text-xs text-muted-foreground">
                                    {colombiaHolidayDetails.length > 0 ? (
                                        <span className="text-orange-600 font-bold mr-2">
                                            {colombiaHolidayDetails.map(h => h.name).join(', ')}
                                        </span>
                                    ) : (
                                        'Ningún festivo fijo.'
                                    )}
                                    {customHolidayDates.size > 0 && ` + ${customHolidayDates.size} extra.`}
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

                    {viewMode === 'calendar' ? (
                        <TechnologistShiftCalendar
                            year={year}
                            month={month}
                            assignments={assignmentsMap}
                            onDayClick={(date) => resetFormForDate(date)}
                            onAssignmentClick={(id, date) => {
                                const shift = monthShifts.find((s) => s.id === id);
                                if (shift) {
                                    setSelectedDate(date);
                                    setSelectedShiftId(id);
                                    setSelectedStaffId(shift.assignedUserId || shift.technologistId || '');
                                    setSelectedModality((shift.modality as CalendarModality) ?? 'RX');
                                    setSelectedShiftType(shift.shiftType);
                                    setSelectedNote(shift.notes || '');
                                    setIsDayDialogOpen(true);
                                }
                            }}
                            holidayDates={holidayDatesSet}
                        />
                    ) : (
                        <StaffShiftMatrix
                            year={year}
                            month={month}
                            staff={staffOptions as any[]}
                            assignments={matrixAssignmentsMap}
                            holidays={holidayDatesSet}
                            onCellClick={(date, staffId, assignmentId) => {
                                if (assignmentId) {
                                    const shift = monthShifts.find((s) => s.id === assignmentId);
                                    if (shift) {
                                        setSelectedDate(date);
                                        setSelectedShiftId(assignmentId);
                                        setSelectedStaffId(staffId);
                                        setSelectedModality((shift.modality as CalendarModality) ?? 'RX');
                                        setSelectedShiftType(shift.shiftType);
                                        setSelectedNote(shift.notes || '');
                                        setIsDayDialogOpen(true);
                                    }
                                } else {
                                    setSelectedDate(date);
                                    setSelectedShiftId(null);
                                    setSelectedStaffId(staffId);
                                    setSelectedModality('RX');
                                    setSelectedShiftType('CORRIDO');
                                    setSelectedNote('');
                                    setIsDayDialogOpen(true);
                                }
                            }}
                        />
                    )}

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

            <Card className="print:hidden">
                <CardHeader>
                    <CardTitle>Generar secuencia automática (opcional)</CardTitle>
                    <p className="text-sm text-muted-foreground">Mantuvimos la herramienta de generación masiva para crear plantillas rápidas y luego ajustar en el calendario.</p>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Personal Responsable</Label>
                            <Select value={technologistId} onValueChange={setTechnologistId} disabled={staffLoading}>
                                <SelectTrigger className="h-12 bg-white border-zinc-100 rounded-xl focus:ring-zinc-900 transition-all font-bold shadow-sm">
                                    <SelectValue placeholder={staffLoading ? 'Cargando...' : 'Selecciona...'} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-zinc-100 shadow-2xl">
                                    {technologistOptions.map((staff) => (
                                        <SelectItem key={staff.uid} value={staff.uid} className="font-bold">
                                            {staff.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Modalidad de Equipos</Label>
                            <Select value={generationModality} onValueChange={(v) => setGenerationModality(v as CalendarModality)}>
                                <SelectTrigger className="h-12 bg-white border-zinc-100 rounded-xl focus:ring-zinc-900 transition-all font-bold shadow-sm">
                                    <SelectValue placeholder="Modalidad..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-zinc-100 shadow-2xl">
                                    {calendarModalities.map((mod) => (
                                        <SelectItem key={mod} value={mod} className="font-bold">{mod}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Rango de Generación</Label>
                            <div className="flex items-center gap-2 bg-white border border-zinc-100 rounded-xl px-3 h-12 shadow-sm">
                                <CalendarIcon className="h-4 w-4 text-zinc-400 shrink-0" />
                                <DateRangePicker
                                    date={generationDateRange}
                                    setDate={setGenerationDateRange}
                                    onApply={() => { }}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">
                                {selectedTechnologist?.rol === 'transcriptora' ? 'Finde 1 (De la Secuencia)' : 'Iniciar Ciclo con'}
                            </Label>
                            <div className="grid grid-cols-2 gap-1 bg-zinc-100 p-1 rounded-xl h-12">
                                {['CORRIDO', 'NOCHE', 'POSTURNO', 'LIBRE'].map((type, index) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setStartSequenceIndex(index)}
                                        className={cn(
                                            "rounded-lg text-[9px] font-black uppercase transition-all",
                                            startSequenceIndex === index
                                                ? "bg-white text-zinc-900 shadow-sm"
                                                : "text-zinc-400 hover:text-zinc-600"
                                        )}
                                        disabled={selectedTechnologist?.rol === 'transcriptora' && index > 1}
                                    >
                                        {selectedTechnologist?.rol === 'transcriptora'
                                            ? (index === 0 ? 'TRAB' : index === 1 ? 'DESC' : '-')
                                            : (type === 'CORRIDO' ? 'C' : type === 'NOCHE' ? 'N' : type === 'POSTURNO' ? 'P' : 'L')}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between px-1">
                                {selectedTechnologist?.rol === 'transcriptora' ? (
                                    <span className="text-[8px] font-bold uppercase text-zinc-400 text-center w-full">Mañana/Tarde L-V. Fines de Semana Alternados</span>
                                ) : (
                                    ['Corrido', 'Noche', 'Pos', 'Libre'].map((label, i) => (
                                        <span key={label} className={cn("text-[8px] font-bold uppercase", startSequenceIndex === i ? "text-zinc-900" : "text-zinc-300")}>{label}</span>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-6 pt-4 border-t border-zinc-50">
                        <div className="grid gap-2 flex-1 w-full">
                            <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Notas y Ajustes Rápidos (YYYY-MM-DD: texto)</Label>
                            <Textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                placeholder="Ej: 2025-01-15: cubrir turno especial"
                                rows={1}
                                className="bg-zinc-50 border-zinc-100 rounded-xl resize-none focus:ring-zinc-900 transition-all font-medium min-h-[48px]"
                            />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto shrink-0">
                            <Button
                                variant="outline"
                                onClick={handleClearShifts}
                                disabled={loadingGeneration}
                                className="w-full md:w-[140px] h-12 rounded-xl text-rose-500 border-rose-100 hover:bg-rose-50 hover:text-rose-600 font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                Limpiar Rango
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={loadingGeneration}
                                className="w-full md:w-[200px] h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest shadow-xl shadow-zinc-200 transition-all active:scale-95 shrink-0"
                            >
                                {loadingGeneration ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {loadingGeneration ? 'Procesando...' : 'Aplicar Secuencia'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDayDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl overflow-hidden max-w-lg">
                    <div className="bg-zinc-900 px-6 py-5">
                        <DialogTitle className="text-white font-black text-lg">
                            {selectedDate ? `Turno para ${formatDialogDate(selectedDate)}` : 'Gestionar Turno'}
                        </DialogTitle>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Asigna personal y modalidad</p>
                    </div>

                    <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
                        {selectedDate && selectedDayAssignments.length > 0 && !selectedShiftId && (
                            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-4">
                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-3">Turnos ya registrados hoy</p>
                                <ScrollArea className="max-h-[160px] pr-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedDayAssignments.map((assignment) => (
                                            <button
                                                key={assignment.id}
                                                type="button"
                                                className="flex items-center justify-between bg-white border border-zinc-100 rounded-xl px-3 py-2 text-left transition-all hover:border-zinc-300 hover:shadow-sm"
                                                onClick={() => handleAssignmentClick(assignment.id)}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CALENDAR_MODALITY_COLORS[assignment.modality].dot}`} />
                                                    <div className="flex flex-col overflow-hidden">
                                                        <p className="text-[9px] font-black text-zinc-900 uppercase leading-none mb-0.5 truncate">{assignment.personLabel}</p>
                                                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter truncate">{assignment.shiftType} · {assignment.modality}</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-2.5 w-2.5 text-zinc-300 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}
                        <div className="grid gap-4 py-2">
                            <div className="grid gap-2">
                                <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Responsable</Label>
                                <Select value={selectedStaffId} onValueChange={handleDialogStaffChange} disabled={staffLoading}>
                                    <SelectTrigger className="h-11 bg-zinc-50 border-0 rounded-xl focus:ring-zinc-900 transition-all font-bold">
                                        <SelectValue placeholder={staffLoading ? 'Cargando...' : 'Selecciona a quién asignar'} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-0 shadow-2xl">
                                        {staffOptions.map((staff) => (
                                            <SelectItem key={staff.uid} value={staff.uid} className="font-bold">
                                                {staff.nombre} · <span className="opacity-50 font-normal">{staff.rol === 'tecnologo' ? 'Tec' : 'Trs'}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Modalidad</Label>
                                    <Select value={selectedModality} onValueChange={(value) => setSelectedModality(value as CalendarModality)}>
                                        <SelectTrigger className="h-11 bg-zinc-50 border-0 rounded-xl focus:ring-zinc-900 transition-all font-bold">
                                            <SelectValue placeholder="Modalidad" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-0 shadow-2xl">
                                            {calendarModalities.map((modality) => (
                                                <SelectItem key={modality} value={modality} className="font-bold">{modality}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Tipo de turno</Label>
                                    <Select value={selectedShiftType} onValueChange={(value) => setSelectedShiftType(value as ShiftType)}>
                                        <SelectTrigger className="h-11 bg-zinc-50 border-0 rounded-xl focus:ring-zinc-900 transition-all font-bold uppercase text-xs">
                                            <SelectValue placeholder="Tipo de turno" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-0 shadow-2xl">
                                            {ShiftTypes.map((type) => (
                                                <SelectItem key={type} value={type} className="uppercase text-xs font-bold">{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                {!showNoteField ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowNoteField(true)}
                                        className="w-fit text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-900 h-7 px-2 rounded-lg gap-1.5"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Agregar nota
                                    </Button>
                                ) : (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-[10px] font-black uppercase text-zinc-500">Nota (opcional)</Label>
                                            <button
                                                type="button"
                                                onClick={() => { setShowNoteField(false); setSelectedNote(''); }}
                                                className="text-[9px] font-bold text-red-400 hover:text-red-600 transition-colors uppercase"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                        <Textarea
                                            value={selectedNote}
                                            onChange={(event) => setSelectedNote(event.target.value)}
                                            placeholder="Cobertura especial, recordatorios, etc."
                                            rows={2}
                                            className="bg-zinc-50 border-0 rounded-xl resize-none focus:ring-zinc-900 transition-all text-xs font-medium"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pb-8 pt-2 flex flex-col gap-3">
                        <Button
                            type="button"
                            onClick={handleSaveShift}
                            disabled={savingShift}
                            className="h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-zinc-900 font-black uppercase tracking-widest shadow-lg shadow-amber-100 transition-all active:scale-95"
                        >
                            {savingShift ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar turno'}
                        </Button>

                        {selectedShiftId && (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={deletingShift}
                                onClick={handleDeleteShift}
                                className="h-10 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 font-bold text-xs uppercase"
                            >
                                {deletingShift ? 'Eliminando...' : 'Eliminar el turno seleccionado'}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
