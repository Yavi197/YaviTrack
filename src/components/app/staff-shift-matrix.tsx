"use client";
import { cn } from "@/lib/utils";
import { type CalendarModality, type ShiftType, type UserProfile } from "@/lib/types";
import React, { memo, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type MatrixShiftAssignment = {
    id: string;
    shiftType: ShiftType;
    modality: CalendarModality;
    personLabel?: string;
    personId: string;
    note?: string;
};

type StaffShiftMatrixProps = {
    year: number;
    month: number;
    staff: UserProfile[];
    assignments: Record<string, MatrixShiftAssignment[]>;
    onCellClick: (date: string, staffId: string, assignmentId?: string) => void;
};

const SHIFT_CODES: Record<ShiftType, string> = {
    CORRIDO: "C",
    NOCHE: "N",
    POSTURNO: "P",
    LIBRE: "L",
    MANANA_TARDE: "M/T",
    MANANA: "M",
    VACACIONES: "V",
    LICENCIA: "Lic",
    CALAMIDAD: "Cal",
    PERMISO: "Per",
};

const SHIFT_COLORS: Record<ShiftType, string> = {
    CORRIDO: "bg-emerald-500 text-white",
    NOCHE: "bg-indigo-500 text-white",
    POSTURNO: "bg-rose-500 text-white",
    LIBRE: "bg-zinc-100 text-zinc-400",
    MANANA_TARDE: "bg-amber-500 text-white",
    MANANA: "bg-sky-500 text-white",
    VACACIONES: "bg-yellow-400 text-yellow-900 border-yellow-500",
    LICENCIA: "bg-orange-400 text-white",
    CALAMIDAD: "bg-purple-300 text-purple-900",
    PERMISO: "bg-cyan-500 text-white",
};

const pad = (v: number) => v.toString().padStart(2, "0");

export const StaffShiftMatrix = memo(function StaffShiftMatrix({
    year,
    month,
    staff,
    assignments,
    onCellClick,
}: StaffShiftMatrixProps) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const groupedStaff = useMemo(() => {
        return {
            tecnologo: staff.filter(s => s.rol === 'tecnologo'),
            transcriptora: staff.filter(s => s.rol === 'transcriptora'),
            enfermero: staff.filter(s => s.rol === 'enfermero'),
        };
    }, [staff]);

    const getAssignment = (staffId: string, day: number) => {
        const dateStr = `${year}-${pad(month)}-${pad(day)}`;
        const dayAssignments = assignments[dateStr] || [];
        return dayAssignments.find(a => a.personId === staffId);
    };

    return (
        <TooltipProvider delayDuration={150}>
            <div className="w-full overflow-x-auto rounded-xl border bg-white shadow-sm scrollbar-thin scrollbar-thumb-zinc-200">
                <table className="w-full border-collapse text-left text-[10px]">
                    <thead className="sticky top-0 z-20 bg-zinc-50 border-b">
                        <tr>
                            <th className="sticky left-0 z-30 bg-zinc-50 p-3 min-w-[180px] font-black uppercase text-zinc-500 border-r">Personal</th>
                            {days.map(day => {
                                const date = new Date(year, month - 1, day);
                                const isSunday = date.getDay() === 0;
                                return (
                                    <th key={day} className={cn(
                                        "p-2 text-center min-w-[35px] font-black border-r border-zinc-100",
                                        isSunday ? "bg-rose-50 text-rose-600" : "text-zinc-600"
                                    )}>
                                        <div className="text-[8px] opacity-60 uppercase">{new Intl.DateTimeFormat('es', { weekday: 'short' }).format(date)}</div>
                                        <div>{day}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {(['tecnologo', 'transcriptora', 'enfermero'] as const).map(role => {
                            const group = groupedStaff[role];
                            if (group.length === 0) return null;

                            return (
                                <React.Fragment key={role}>
                                    <tr className="bg-zinc-100/50">
                                        <td colSpan={daysInMonth + 1} className="px-3 py-1.5 font-black text-[9px] uppercase tracking-widest text-zinc-500 border-b">
                                            {role === 'tecnologo' ? 'Tecnólogos de RX' : role === 'transcriptora' ? 'Transcriptores' : 'Enfermería'}
                                        </td>
                                    </tr>
                                    {group.map(person => (
                                        <tr key={person.uid} className="hover:bg-zinc-50 group border-b">
                                            <td className="sticky left-0 z-10 bg-white group-hover:bg-zinc-50 p-3 font-bold text-zinc-700 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                {person.nombre}
                                            </td>
                                            {days.map(day => {
                                                const assignment = getAssignment(person.uid, day);
                                                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                                                
                                                return (
                                                    <td key={day} className="p-0 border-r border-zinc-50">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    onClick={() => onCellClick(dateStr, person.uid, assignment?.id)}
                                                                    className={cn(
                                                                        "w-full h-10 flex items-center justify-center transition-all active:scale-95",
                                                                        assignment ? SHIFT_COLORS[assignment.shiftType] : "hover:bg-zinc-100/50"
                                                                    )}
                                                                >
                                                                    <span className="font-black text-xs">
                                                                        {assignment ? SHIFT_CODES[assignment.shiftType] : ""}
                                                                    </span>
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                <div className="text-xs">
                                                                    <p className="font-bold">{person.nombre}</p>
                                                                    <p>{day} de {new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date(year, month - 1, 1))}</p>
                                                                    {assignment && (
                                                                        <div className="mt-1 flex items-center gap-2">
                                                                            <div className={cn("h-2 w-2 rounded-full", 
                                                                                assignment.modality === 'RX' ? "bg-blue-500" : 
                                                                                assignment.modality === 'ECO' ? "bg-red-500" : "bg-green-500"
                                                                            )} />
                                                                            <span className="font-bold">{assignment.shiftType}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </TooltipProvider>
    );
});
