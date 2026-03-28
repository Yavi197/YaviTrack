"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { OrderData, UserProfile, GeneralService } from '@/lib/types';
import { GeneralServices, SubServiceAreas } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Plus, Info, Droplets, Bed, Thermometer, UserCheck, ChevronDown, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { Switch } from '../ui/switch';

const formSchema = z.object({
  selectedStudies: z.array(z.string()).refine(value => value.length > 0, {
    message: "Debes seleccionar al menos un estudio.",
  }),
  service: z.enum(GeneralServices),
  subService: z.string().min(1, "Selecciona una sub-área."),
  bedNumber: z.string().optional(),
  bajoSedacion: z.boolean().default(false),
  requiresContrast: z.boolean().default(false),
  creatinine: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.requiresContrast && (!data.creatinine || parseFloat(data.creatinine) <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['creatinine'],
            message: 'Si el estudio es contrastado, debes ingresar un valor de Creatinina válido.'
        });
    }
});

export type TargetModule = 'imagenes' | 'consultas' | 'remisiones';

interface SelectStudiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderData: OrderData | null;
  userProfile: UserProfile | null;
  onConfirm: (processedData: OrderData, targetModule: TargetModule) => void;
  onCancel: () => void;
}

export function SelectStudiesDialog({ open, onOpenChange, orderData, userProfile, onConfirm, onCancel }: SelectStudiesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [targetModule, setTargetModule] = useState<TargetModule>('imagenes');

  const getSubmitButtonText = () => {
     if (targetModule === 'consultas') return 'Crear Consulta';
     if (targetModule === 'remisiones') return 'Crear Remisión';
     return 'Crear Solicitud';
  }

  const isAdmissionist = userProfile?.rol === 'admisionista';
  const isNurse = userProfile?.rol === 'enfermero';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedStudies: [],
      service: isNurse 
        ? (userProfile?.servicioAsignado as GeneralService || 'HOSP') 
        : (isAdmissionist ? 'C.EXT' : (orderData?.service || 'HOSP')),
      subService: isNurse
        ? (userProfile?.subServicioAsignado || 'HOSPITALIZACION 1')
        : (isAdmissionist ? 'AMB' : (orderData?.subService || 'HOSPITALIZACION 2')),
      bedNumber: orderData?.bedNumber || '',
      bajoSedacion: orderData?.bajoSedacion || false,
      requiresContrast: orderData?.requiresCreatinine || false,
      creatinine: '',
    },
  });

  const watchService = form.watch('service');
  const watchContrast = form.watch('requiresContrast');

  useEffect(() => {
    if (orderData) {
      form.reset({
        selectedStudies: orderData.studies.map(s => s.cups),
        service: isNurse 
            ? (userProfile?.servicioAsignado as GeneralService || 'HOSP') 
            : (isAdmissionist ? 'C.EXT' : (orderData.service || 'HOSP')),
        subService: isNurse
            ? (userProfile?.subServicioAsignado || 'HOSPITALIZACION 1')
            : (isAdmissionist ? 'AMB' : (orderData.subService || (orderData.service ? SubServiceAreas[orderData.service as GeneralService][0] : 'HOSPITALIZACION 2'))),
        bedNumber: orderData.bedNumber || '',
        bajoSedacion: orderData.bajoSedacion || false,
        requiresContrast: orderData.requiresCreatinine || false,
        creatinine: '',
      });
    }
  }, [orderData, form, isAdmissionist, isNurse, userProfile]);

  // When service changes, update subservice options
  useEffect(() => {
    if (watchService && !isAdmissionist && !isNurse) {
        const availableSubServices = SubServiceAreas[watchService];
        if (availableSubServices && !availableSubServices.includes(form.getValues('subService'))) {
            form.setValue('subService', availableSubServices[0]);
        }
    }
  }, [watchService, form, isAdmissionist, isNurse]);

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setLoading(true);
    if (!orderData) return;

    const selected = orderData.studies.filter(s => data.selectedStudies.includes(s.cups));
    
    const processedData: OrderData = {
        ...orderData,
        studies: selected,
        service: data.service,
        subService: data.subService,
        bedNumber: data.bedNumber,
        bajoSedacion: data.bajoSedacion,
        requiresCreatinine: data.requiresContrast,
        // We might want to pass creatinine too if we add it to OrderData output
        // but for now we'll handle it in the remission creation action in the page
    };
    
    // @ts-ignore - Temporary until we update OrderData schema if needed
    processedData.creatinineValue = data.creatinine ? parseFloat(data.creatinine) : undefined;

    onConfirm(processedData, targetModule);
    setLoading(false);
  };
  
  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-[2.5rem] bg-white/95 backdrop-blur-xl shadow-2xl" onEscapeKeyDown={handleCancel} onPointerDownOutside={handleCancel}>
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-black p-6 text-white">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-2">
                    <Plus className="h-6 w-6 text-amber-500" />
                    Procesar Nueva Solicitud
                </DialogTitle>
                <DialogDescription className="text-zinc-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                    Verifica los estudios detectados y completa la información clínica.
                </DialogDescription>
            </DialogHeader>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
                
                {/* Left Column: Studies Selection */}
                <div className="space-y-4">
                    <label className="text-[11px] font-black text-zinc-900 uppercase tracking-widest px-1 block flex items-center gap-2">
                        <Info className="h-4 w-4 text-sky-600" />
                        Estudios Detectados
                    </label>
                    <ScrollArea className="h-[180px] w-full rounded-2xl border-2 border-zinc-100 bg-zinc-50/30 p-4">
                        <FormField
                            control={form.control}
                            name="selectedStudies"
                            render={() => (
                            <FormItem className="space-y-3">
                                {orderData?.studies.map((study) => (
                                <FormField
                                    key={study.cups}
                                    control={form.control}
                                    name="selectedStudies"
                                    render={({ field }) => {
                                    return (
                                        <FormItem key={study.cups} className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-xl transition-colors hover:bg-white border-b border-zinc-100 last:border-0">
                                            <FormControl>
                                                <Checkbox
                                                checked={field.value?.includes(study.cups)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                    ? field.onChange([...field.value, study.cups])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                            (value) => value !== study.cups
                                                            )
                                                        )
                                                }}
                                                className="rounded-md border-zinc-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal cursor-pointer w-full text-xs">
                                                <div className="font-black text-zinc-900 leading-tight">{study.nombre}</div>
                                                <div className="font-bold text-[10px] text-zinc-400 tracking-tighter uppercase">{study.modality} • {study.cups}</div>
                                            </FormLabel>
                                        </FormItem>
                                    )
                                    }}
                                />
                                ))}
                            </FormItem>
                            )}
                        />
                    </ScrollArea>
                </div>

                {/* Right Column: Service & Clinical Data */}
                <div className="space-y-4">
                    <label className="text-[11px] font-black text-zinc-900 uppercase tracking-widest px-1 block flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-amber-600" />
                        Información de Origen
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-zinc-50/50 rounded-2xl border-2 border-zinc-100">
                        {!isNurse && (
                            <>
                                <FormField
                                    control={form.control}
                                    name="service"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[9px] font-bold uppercase text-zinc-500">Servicio</FormLabel>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                defaultValue={field.value}
                                                disabled={isAdmissionist}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-9 rounded-xl border-zinc-200 bg-white font-bold text-xs uppercase tracking-tight shadow-none focus:ring-amber-500">
                                                        <SelectValue placeholder="Servicio" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {GeneralServices.map(s => <SelectItem key={s} value={s} className="text-xs font-bold uppercase">{s}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="subService"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[9px] font-bold uppercase text-zinc-500">Subservicio</FormLabel>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                value={field.value}
                                                disabled={isAdmissionist}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-9 rounded-xl border-zinc-200 bg-white font-bold text-xs uppercase tracking-tight shadow-none focus:ring-amber-500">
                                                        <SelectValue placeholder="Subservicio" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {SubServiceAreas[watchService as GeneralService]?.map(ss => <SelectItem key={ss} value={ss} className="text-xs font-bold uppercase">{ss}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}

                        <FormField
                            control={form.control}
                            name="bedNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[9px] font-bold uppercase text-zinc-500">N° de Cama (Opcional)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Bed className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                            <Input {...field} placeholder="Piso / Cama" className="h-9 pl-9 rounded-xl border-zinc-200 bg-white font-bold text-xs shadow-none focus-visible:ring-amber-500" />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <FormField
                            control={form.control}
                            name="bajoSedacion"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 border-zinc-100 bg-zinc-50/50 p-2 space-y-0 h-14">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-[9px] font-black uppercase text-zinc-900 leading-none">Sedación</FormLabel>
                                        <div className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">Bajo sedación</div>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="data-[state=checked]:bg-violet-600"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="requiresContrast"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 border-zinc-100 bg-zinc-50/50 p-2 space-y-0 h-14">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-[9px] font-black uppercase text-zinc-900 leading-none">Contraste</FormLabel>
                                        <div className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">Contrastada</div>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="data-[state=checked]:bg-emerald-600"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    {watchContrast && (
                        <FormField
                            control={form.control}
                            name="creatinine"
                            render={({ field }) => (
                                <FormItem className="animate-in slide-in-from-top-2 duration-300">
                                    <FormLabel className="text-[9px] font-black uppercase text-red-600">Creatinina (MG/DL) *</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                                            <Input {...field} type="number" step="0.01" placeholder="Ej: 1.25" className="h-9 pl-9 rounded-xl border-red-200 bg-red-50/30 font-black text-red-700 text-xs shadow-none focus-visible:ring-red-500" />
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-[9px] font-bold" />
                                </FormItem>
                            )}
                        />
                    )}
                </div>
            </div>

            <DialogFooter className="pt-2 border-t border-zinc-100 flex-col sm:flex-row gap-3">
              <Button type="button" variant="ghost" onClick={handleCancel} className="text-zinc-500 font-bold hover:bg-zinc-100 rounded-2xl h-11 px-6 uppercase text-[10px] tracking-widest">
                Cancelar Procesamiento
              </Button>
              <div className="flex rounded-2xl shadow-xl shadow-zinc-200">
                  <Button type="submit" disabled={loading} className={cn("bg-zinc-900 hover:bg-black text-white h-11 px-8 uppercase font-black text-[10px] tracking-widest transition-all min-w-[200px]", userProfile?.rol === 'administrador' ? "rounded-l-2xl rounded-r-none" : "rounded-2xl")}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : (
                        <span className="flex items-center gap-2">
                             <UserCheck className="h-4 w-4 text-amber-500" />
                             {getSubmitButtonText()} ({form.watch('selectedStudies').length})
                        </span>
                    )}
                  </Button>
                  {userProfile?.rol === 'administrador' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" disabled={loading} className="bg-zinc-900 hover:bg-zinc-800 text-white border-l border-zinc-700/50 rounded-l-none rounded-r-2xl h-11 px-3">
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 font-bold uppercase tracking-tight text-[11px]">
                           <DropdownMenuItem onClick={() => setTargetModule('imagenes')} className={cn("rounded-xl justify-between p-2 cursor-pointer", targetModule === 'imagenes' && "bg-amber-50 text-amber-700")}>
                              Imágenes
                              {targetModule === 'imagenes' && <Check className="h-4 w-4" />}
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => setTargetModule('consultas')} className={cn("rounded-xl justify-between p-2 cursor-pointer", targetModule === 'consultas' && "bg-amber-50 text-amber-700")}>
                              Consultas
                              {targetModule === 'consultas' && <Check className="h-4 w-4" />}
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => setTargetModule('remisiones')} className={cn("rounded-xl justify-between p-2 cursor-pointer", targetModule === 'remisiones' && "bg-amber-50 text-amber-700")}>
                              Remisiones
                              {targetModule === 'remisiones' && <Check className="h-4 w-4" />}
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
