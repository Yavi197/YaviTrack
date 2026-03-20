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
};

export type ManualShiftOverride = {
    date: string;
    shiftType: ShiftType;
    modality: CalendarModality;
    note?: string;
};

export type GenerateTechnologistShiftsOptions = {
    technologistId: string;
    year: number; // e.g. 2025
    month: number; // 1-12
    startSequenceIndex?: number; // 0-3
    holidays?: Iterable<string>; // fechas YYYY-MM-DD
    notesByDate?: Record<string, string>;
    manualOverrides?: ManualShiftOverride[];
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

const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
};

const formatDate = (year: number, monthIndex: number, day: number) => {
    return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
};

export const generateTechnologistMonthlyShifts = (options: GenerateTechnologistShiftsOptions): TechnologistShift[] => {
    const { technologistId, year, month, startSequenceIndex = 0, holidays, notesByDate, manualOverrides } = options;
    if (month < 1 || month > 12) {
        throw new Error('month must be between 1 and 12');
    }
    const monthIndex = month - 1;
    const totalDays = getDaysInMonth(year, month);
    const holidaySet = new Set(holidays ?? []);
    const manualOverrideMap = new Map<string, ManualShiftOverride>();
    for (const override of manualOverrides ?? []) {
        manualOverrideMap.set(override.date, override);
    }
    const shifts: TechnologistShift[] = [];
    let sequenceIndex = startSequenceIndex % SHIFT_SEQUENCE.length;

    for (let day = 1; day <= totalDays; day++) {
        const dateStr = formatDate(year, monthIndex, day);
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
        };

        const finalNote = (manualOverride?.note ?? noteFromForm)?.trim();
        if (finalNote) {
            shift.notes = finalNote;
        }

        if (finalModality) {
            shift.modality = finalModality;
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
