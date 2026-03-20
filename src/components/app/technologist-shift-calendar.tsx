"use client";

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
};

const SHIFT_TYPE_STYLES: Record<ShiftType, { bg: string; border: string; text: string }> = {
    CORRIDO: { bg: "bg-emerald-400", border: "border-emerald-500", text: "text-black" },
    NOCHE: { bg: "bg-indigo-400", border: "border-indigo-500", text: "text-black" },
    POSTURNO: { bg: "bg-fuchsia-400", border: "border-fuchsia-500", text: "text-black" },
    LIBRE: { bg: "bg-slate-300", border: "border-slate-400", text: "text-black" },
    MANANA_TARDE: { bg: "bg-amber-400", border: "border-amber-500", text: "text-black" },
    MANANA: { bg: "bg-sky-400", border: "border-sky-500", text: "text-black" },
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

        return (
            <button
                key={`${index}-${date ?? "empty"}`}
                type="button"
                className={`min-h-[120px] w-full border border-border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isCurrentMonth ? "bg-background" : "bg-muted/40 text-muted-foreground"
                } ${isWeekend && isCurrentMonth ? "bg-muted/20" : ""} ${
                    (isHoliday || (highlightSundays && isSunday)) && isCurrentMonth ? "bg-rose-50" : ""
                }`}
                disabled={!isCurrentMonth}
                onClick={() => date && onDayClick?.(date)}
            >
                <div className="flex items-start justify-between">
                    <span className={`text-sm font-semibold ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                        {isCurrentMonth ? dayNumber : ""}
                    </span>
                    {isHoliday && isCurrentMonth && (
                        <span className="text-[10px] font-semibold uppercase text-rose-500">Festivo</span>
                    )}
                </div>
                {dayAssignments.length > 0 && (
                    <div className="mt-3 space-y-2 text-xs">
                        {dayAssignments.map((assignment) => {
                            const shiftStyle = SHIFT_TYPE_STYLES[assignment.shiftType] ?? SHIFT_TYPE_STYLES.CORRIDO;
                            const shiftLabel = getShiftLabel(assignment.shiftType);
                            return (
                            <Tooltip key={assignment.id} delayDuration={200} disableHoverableContent>
                                <TooltipTrigger asChild>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className={`rounded-lg border px-2 py-1 text-left uppercase transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${shiftStyle.bg} ${shiftStyle.border} ${shiftStyle.text}`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (date) {
                                                onAssignmentClick?.(assignment.id, date);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                                            <span
                                                className={`h-2 w-2 rounded-full ${CALENDAR_MODALITY_COLORS[assignment.modality].dot}`}
                                                aria-hidden="true"
                                            />
                                            <span>{shiftLabel}</span>
                                        </div>
                                        <p className="mt-1 text-[11px] font-medium">
                                            {assignment.personLabel ?? "Sin asignar"}
                                        </p>
                                        {assignment.note && (
                                            <p className="text-[11px] leading-tight opacity-80">{assignment.note}</p>
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
