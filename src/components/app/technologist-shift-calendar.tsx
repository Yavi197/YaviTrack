"use client";
import { cn } from "@/lib/utils";

import { type CalendarModality, type ShiftType } from "@/lib/types";
import { memo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type CalendarShiftAssignment = {
    id: string;
    shiftType: ShiftType;
    modality: CalendarModality;
    personLabel?: string;
    note?: string;
    sortIndex?: number;
    role?: string;
};

export type TechnologistShiftCalendarProps = {
    year: number;
    month: number; // 1-12
    assignments: Record<string, CalendarShiftAssignment[]>;
    onDayClick?: (date: string) => void;
    onAssignmentClick?: (assignmentId: string, date: string) => void;
    holidayDates?: Set<string>;
    highlightSundays?: boolean;
};

const weekdayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

const pad = (value: number) => value.toString().padStart(2, "0");

const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${pad(month)}-${pad(day)}`;
};

const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
};

const getTotalCells = (firstWeekday: number, totalDays: number) => {
    return Math.ceil((firstWeekday + totalDays) / 7) * 7;
};

export const CALENDAR_MODALITY_COLORS: Record<CalendarModality, { dot: string }> = {
    RX: {
        dot: "bg-blue-500 ring-2 ring-black/60",
    },
    ECO: {
        dot: "bg-red-500 ring-2 ring-black/60",
    },
    TAC: {
        dot: "bg-green-500 ring-2 ring-black/60",
    },
};

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
    CORRIDO: "CORRIDO",
    NOCHE: "NOCHE",
    POSTURNO: "POSTURNO",
    LIBRE: "LIBRE",
    MANANA_TARDE: "MAÑANA/TARDE",
    MANANA: "MAÑANA",
    VACACIONES: "VACACIONES",
    LICENCIA: "LICENCIA",
    CALAMIDAD: "CALAMIDAD",
    PERMISO: "PERMISO",
};

const SHIFT_TYPE_STYLES: Record<ShiftType, { bg: string; border: string; text: string; shadow: string }> = {
    CORRIDO: { bg: "bg-emerald-500", border: "border-emerald-600", text: "text-white", shadow: "shadow-emerald-100" },
    NOCHE: { bg: "bg-indigo-500", border: "border-indigo-600", text: "text-white", shadow: "shadow-indigo-100" },
    POSTURNO: { bg: "bg-rose-500", border: "border-rose-600", text: "text-white", shadow: "shadow-rose-100" },
    LIBRE: { bg: "bg-zinc-200", border: "border-zinc-300", text: "text-zinc-600", shadow: "shadow-zinc-50" },
    MANANA_TARDE: { bg: "bg-amber-500", border: "border-amber-600", text: "text-white", shadow: "shadow-amber-100" },
    MANANA: { bg: "bg-sky-500", border: "border-sky-600", text: "text-white", shadow: "shadow-sky-100" },
    VACACIONES: { bg: "bg-yellow-400", border: "border-yellow-500", text: "text-yellow-900", shadow: "shadow-yellow-50" },
    LICENCIA: { bg: "bg-orange-400", border: "border-orange-500", text: "text-white", shadow: "shadow-orange-50" },
    CALAMIDAD: { bg: "bg-purple-300", border: "border-purple-400", text: "text-purple-900", shadow: "shadow-purple-50" },
    PERMISO: { bg: "bg-cyan-500", border: "border-cyan-600", text: "text-white", shadow: "shadow-cyan-50" },
};

const getShiftLabel = (shiftType: ShiftType) => SHIFT_TYPE_LABELS[shiftType] ?? shiftType;

const shiftTypeOrder: ShiftType[] = ["CORRIDO", "NOCHE", "POSTURNO", "LIBRE", "MANANA_TARDE", "MANANA"];
const modalityOrder: CalendarModality[] = ["RX", "ECO", "TAC"];

const sortAssignments = (assignments: CalendarShiftAssignment[]) => {
    return [...assignments].sort((a, b) => {
        const orderDiff = (a.sortIndex ?? Number.MAX_SAFE_INTEGER) - (b.sortIndex ?? Number.MAX_SAFE_INTEGER);
        if (orderDiff !== 0) return orderDiff;
        const modalityDiff = modalityOrder.indexOf(a.modality) - modalityOrder.indexOf(b.modality);
        if (modalityDiff !== 0) return modalityDiff;
        const shiftDiff = shiftTypeOrder.indexOf(a.shiftType) - shiftTypeOrder.indexOf(b.shiftType);
        if (shiftDiff !== 0) return shiftDiff;
        return (a.personLabel ?? "").localeCompare(b.personLabel ?? "");
    });
};

export const TechnologistShiftCalendar = memo(function TechnologistShiftCalendar({
    year,
    month,
    assignments,
    onDayClick,
    onAssignmentClick,
    holidayDates,
    highlightSundays = true,
}: TechnologistShiftCalendarProps) {
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const totalDays = getDaysInMonth(year, month);
    const totalCells = getTotalCells(firstWeekday, totalDays);

    const cells = Array.from({ length: totalCells }, (_, index) => {
        const dayNumber = index - firstWeekday + 1;
        const isCurrentMonth = dayNumber >= 1 && dayNumber <= totalDays;
        const date = isCurrentMonth ? formatDate(year, month, dayNumber) : undefined;
        const dayAssignments = date ? sortAssignments(assignments[date] ?? []) : [];
        const columnIndex = index % 7;
        const isSunday = columnIndex === 0;
        const isWeekend = columnIndex === 0 || columnIndex === 6;
        const isHoliday = date ? holidayDates?.has(date) : false;
        
        const today = new Date();
        const isToday = isCurrentMonth && 
                        today.getFullYear() === year && 
                        (today.getMonth() + 1) === month && 
                        today.getDate() === dayNumber;

        return (
            <button
                key={`${index}-${date ?? "empty"}`}
                type="button"
                className={`min-h-[140px] w-full border-r border-b border-zinc-100 p-2 text-left transition relative group ${
                    isCurrentMonth ? "bg-white" : "bg-zinc-50/50 text-zinc-300"
                } ${isWeekend && isCurrentMonth ? "bg-zinc-50/30" : ""} ${
                    (isHoliday || (highlightSundays && isSunday)) && isCurrentMonth ? "bg-rose-50/30" : ""
                } hover:bg-zinc-50/80`}
                disabled={!isCurrentMonth}
                onClick={() => date && onDayClick?.(date)}
            >
                <div className="flex items-start justify-between mb-1">
                    <span className={cn(
                        "text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                        isCurrentMonth ? "text-zinc-900" : "text-zinc-300",
                        isToday ? "bg-blue-600 text-white shadow-md shadow-blue-100" : ""
                    )}>
                        {isCurrentMonth ? dayNumber : ""}
                    </span>
                    {isHoliday && isCurrentMonth && (
                        <span className="text-[10px] font-semibold uppercase text-rose-500">Festivo</span>
                    )}
                </div>
                {dayAssignments.length > 0 && (
                    <div className="mt-3 space-y-4">
                        {(['tecnologo', 'transcriptora', 'enfermero'] as const).map((roleGroup) => {
                            const groupAssignments = dayAssignments.filter(a => (a.role || 'tecnologo') === roleGroup);
                            if (groupAssignments.length === 0) return null;

                            return (
                                <div key={roleGroup} className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 mb-1 px-1">
                                        <div className={cn(
                                            "h-1 w-1 rounded-full",
                                            roleGroup === 'tecnologo' ? "bg-blue-600" : 
                                            roleGroup === 'transcriptora' ? "bg-purple-600" : "bg-emerald-600"
                                        )} />
                                        <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">
                                            {roleGroup === 'tecnologo' ? 'Tecnólogos' : 
                                             roleGroup === 'transcriptora' ? 'Transcriptores' : 'Enfermería'}
                                        </span>
                                    </div>
                                    <div className="grid gap-1.5">
                                        {groupAssignments.map((assignment) => {
                                            const shiftStyle = SHIFT_TYPE_STYLES[assignment.shiftType] ?? SHIFT_TYPE_STYLES.CORRIDO;
                                            const shiftLabel = getShiftLabel(assignment.shiftType);
                                            return (
                                                <Tooltip key={assignment.id} delayDuration={200} disableHoverableContent>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            role="button"
                                                            tabIndex={0}
                                                            className={cn(
                                                                "rounded-lg border px-2 py-1.5 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm",
                                                                shiftStyle.bg, shiftStyle.border, shiftStyle.text, shiftStyle.shadow
                                                            )}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                if (date) {
                                                                    onAssignmentClick?.(assignment.id, date);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest leading-none">
                                                                <span
                                                                    className={cn("h-1.5 w-1.5 rounded-full", CALENDAR_MODALITY_COLORS[assignment.modality].dot)}
                                                                    aria-hidden="true"
                                                                />
                                                                <span>{shiftLabel}</span>
                                                            </div>
                                                            <p className="mt-1 text-[10px] font-bold truncate leading-tight">
                                                                {assignment.personLabel ?? "Sin asignar"}
                                                            </p>
                                                            {assignment.note && (
                                                                <p className="text-[8px] leading-tight opacity-70 mt-0.5 truncate italic">{assignment.note}</p>
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs text-xs">
                                                        <p className="font-semibold">{assignment.personLabel ?? "Sin asignar"}</p>
                                                        <p>
                                                            {shiftLabel} · {assignment.modality}
                                                        </p>
                                                        {assignment.note && <p className="mt-1 text-muted-foreground">{assignment.note}</p>}
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </button>
        );
    });

    return (
        <TooltipProvider delayDuration={150}>
        <div className="rounded-xl border bg-card shadow-sm" role="group" aria-label="Calendario mensual de turnos">
            <div className="grid grid-cols-7 border-b bg-muted text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {weekdayLabels.map((label) => (
                    <div key={label} className="px-4 py-2">
                        {label}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7" role="grid">
                {cells}
            </div>
        </div>
        </TooltipProvider>
    );
});
