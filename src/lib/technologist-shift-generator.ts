import { Timestamp } from 'firebase/firestore';
import { CalendarModality, ShiftType, ShiftTypes, TechnologistShift } from './types';

const COLOMBIA_TZ_OFFSET = '-05:00';
const HOURS_IN_MS = 60 * 60 * 1000;

const SHIFT_SEQUENCE: ShiftType[] = ['CORRIDO', 'NOCHE', 'POSTURNO', 'LIBRE'];

const SHIFT_CONFIG: Record<ShiftType, { startHour: number; durationHours: number; countedHours: number }> = {
    CORRIDO: { startHour: 7, durationHours: 12, countedHours: 12 },
    NOCHE: { startHour: 19, durationHours: 12, countedHours: 12 },
    POSTURNO: { startHour: 7, durationHours: 24, countedHours: 0 },
    LIBRE: { startHour: 7, durationHours: 24, countedHours: 0 },
    MANANA_TARDE: { startHour: 7, durationHours: 10, countedHours: 8 },
    MANANA: { startHour: 8, durationHours: 4, countedHours: 4 },
    VACACIONES: { startHour: 7, durationHours: 0, countedHours: 0 },
    LICENCIA: { startHour: 7, durationHours: 0, countedHours: 0 },
    CALAMIDAD: { startHour: 7, durationHours: 0, countedHours: 0 },
    PERMISO: { startHour: 7, durationHours: 0, countedHours: 0 },
};

export type ManualShiftOverride = {
    date: string;
    shiftType: ShiftType;
    modality: CalendarModality;
    note?: string;
};

export type GenerateTechnologistShiftsOptions = {
    technologistId: string;
    startDate: string; // ISO YYYY-MM-DD
    endDate: string; // ISO YYYY-MM-DD
    startSequenceIndex?: number; // 0-3
    holidays?: Iterable<string>; // fechas YYYY-MM-DD
    notesByDate?: Record<string, string>;
    manualOverrides?: ManualShiftOverride[];
    baseModality?: CalendarModality;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const buildLocalIso = (dateStr: string, hour: number) => {
    return `${dateStr}T${pad(hour)}:00:00${COLOMBIA_TZ_OFFSET}`;
};

const addHours = (date: Date, hours: number) => {
    return new Date(date.getTime() + hours * HOURS_IN_MS);
};

const toTimestamp = (dateStr: string, hour: number, durationHours: number) => {
    const start = new Date(buildLocalIso(dateStr, hour));
    const end = addHours(start, durationHours);
    return {
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
    };
};

export const getShiftTimingForDate = (dateStr: string, shiftType: ShiftType) => {
    const config = SHIFT_CONFIG[shiftType] ?? SHIFT_CONFIG.CORRIDO;
    const { startTime, endTime } = toTimestamp(dateStr, config.startHour, config.durationHours);
    return {
        startTime,
        endTime,
        hours: config.countedHours,
    };
};

export const generateTechnologistShiftsInRange = (options: GenerateTechnologistShiftsOptions): TechnologistShift[] => {
    const { 
        technologistId, 
        startDate, 
        endDate, 
        startSequenceIndex = 0, 
        holidays, 
        notesByDate, 
        manualOverrides, 
        baseModality = 'RX' 
    } = options;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Fechas inválidas');
    }

    const totalDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (totalDays <= 0) return [];

    const holidaySet = new Set(holidays ?? []);
    const manualOverrideMap = new Map<string, ManualShiftOverride>();
    for (const override of manualOverrides ?? []) {
        manualOverrideMap.set(override.date, override);
    }

    const shifts: TechnologistShift[] = [];
    let sequenceIndex = startSequenceIndex % SHIFT_SEQUENCE.length;

    for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const baseShiftType = SHIFT_SEQUENCE[sequenceIndex];
        const manualOverride = manualOverrideMap.get(dateStr);
        const finalShiftType = manualOverride?.shiftType ?? baseShiftType;
        const { startTime, endTime, hours } = getShiftTimingForDate(dateStr, finalShiftType);
        const noteFromForm = notesByDate?.[dateStr];
        const finalModality = manualOverride?.modality;

        const shift: TechnologistShift = {
            technologistId,
            date: dateStr,
            shiftType: finalShiftType,
            sequenceOrder: sequenceIndex + 1,
            startTime,
            endTime,
            hours,
            holiday: holidaySet.has(dateStr),
            status: 'assigned',
            modality: finalModality || baseModality,
        };

        const finalNote = (manualOverride?.note ?? noteFromForm)?.trim();
        if (finalNote) {
            shift.notes = finalNote;
        }

        if (manualOverride) {
            shift.metadata = {
                modality: manualOverride.modality,
                manualOverride: true,
            };
        }

        shifts.push(shift);
        sequenceIndex = (sequenceIndex + 1) % SHIFT_SEQUENCE.length;
    }

    return shifts;
};

export const rotateShiftSequence = (currentShift: ShiftType): ShiftType => {
    const idx = SHIFT_SEQUENCE.indexOf(currentShift);
    const nextIdx = (idx + 1) % SHIFT_SEQUENCE.length;
    return SHIFT_SEQUENCE[nextIdx];
};

export const isValidShiftType = (value: string): value is ShiftType => {
    return ShiftTypes.includes(value as ShiftType);
};
