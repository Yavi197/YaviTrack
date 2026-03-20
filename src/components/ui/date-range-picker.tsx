"use client"

import * as React from "react"
import { CalendarIcon, ChevronRight, X, Check } from "lucide-react"
import { format } from "date-fns"
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps extends React.ComponentProps<"div"> {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    onApply?: (date: DateRange | undefined) => void;
    triggerClassName?: string;
    align?: "start" | "center" | "end";
    showMonths?: 1 | 2;
}

export function DateRangePicker({ className, date, setDate, onApply, triggerClassName, align = "center", showMonths = 2 }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [localDate, setLocalDate] = React.useState<DateRange | undefined>(date);
    
    React.useEffect(() => {
        setLocalDate(date);
    }, [date]);

    const handleApply = () => {
        setDate(localDate);
        if (onApply) {
            onApply(localDate);
        }
        setIsOpen(false);
    };

    const handleCancel = () => {
        setLocalDate(date);
        setIsOpen(false);
    };

   const displayDate = React.useMemo(() => {
     if (!date?.from) return "FECHA";
     if (!date.to) return format(date.from, "PPP", { locale: es });
     return `${format(date.from, "dd MMM", { locale: es })} - ${format(date.to, "dd MMM, yyyy", { locale: es })}`;
   }, [date]);

  return (
    <div className={cn("inline-block", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "h-11 px-6 justify-start text-left font-black text-xs uppercase tracking-widest bg-white border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/10 rounded-xl transition-all shadow-sm group text-zinc-900 group-hover:text-emerald-700",
              !date && "text-zinc-400 group-hover:text-emerald-600",
              isOpen && "border-emerald-500 ring-4 ring-emerald-500/10 text-emerald-700",
              triggerClassName
            )}

          >
            <CalendarIcon className={cn(
              "mr-3 h-4 w-4 transition-colors",
              date?.from ? "text-emerald-600" : "text-zinc-400",
              "group-hover:text-emerald-600"
            )} />
            <span className="truncate">{displayDate}</span>
            <ChevronRight className="ml-4 h-3 w-3 opacity-20 group-hover:opacity-100 transition-all rotate-90" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 border-none shadow-2xl rounded-[1.5rem] overflow-hidden bg-white/95 backdrop-blur-md" 
          align={align}
          sideOffset={8}
        >
          <div className="bg-zinc-900 p-4 text-white flex items-center justify-between border-b border-white/5">
              <div>
                  <h4 className="text-sm font-black uppercase tracking-tighter">Selector de Intervalo</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{localDate?.from ? "Personalizado" : "Elegir origen"}</p>
              </div>
              <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">BI Intelligence</span>
              </div>
          </div>
          
          <div className="p-3 bg-white">
            <Calendar
                initialFocus
                mode="range"
                defaultMonth={localDate?.from}
                selected={localDate}
                onSelect={setLocalDate}
                numberOfMonths={showMonths}
                locale={es}
                classNames={{
                   day_range_middle: "aria-selected:bg-emerald-100 aria-selected:text-emerald-900 rounded-none",
                   day_selected: "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white rounded-xl shadow-lg shadow-emerald-200",
                   day_today: "border-2 border-emerald-500 text-emerald-600 font-black",
                   head_cell: "text-zinc-400 font-black text-[10px] uppercase w-10",
                   cell: "h-10 w-10 text-center text-sm p-0 flex items-center justify-center",
                   day: "h-9 w-9 p-0 font-bold rounded-xl transition-all hover:bg-zinc-100",
                }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-4 bg-zinc-50 border-t border-zinc-100">
              <div className="flex-1 text-[10px] font-bold text-zinc-400 px-2 italic truncate">
                  {localDate?.from && localDate?.to 
                    ? `Seleccionado: ${format(localDate.from, 'd MMM')} - ${format(localDate.to, 'd MMM')}`
                    : "Selecciona el rango deseado..."}
              </div>
              <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleCancel}
                    className="font-bold text-xs text-zinc-500 hover:text-zinc-900 rounded-lg h-9 px-4"
                  >
                      <X className="mr-2 h-3 w-3" />
                      Cerrar
                  </Button>
                  <Button 
                    onClick={handleApply} 
                    disabled={!localDate?.from}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl h-9 px-6 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                  >
                      <Check className="mr-2 h-3 w-3" />
                      Aplicar Filtro
                  </Button>
              </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
