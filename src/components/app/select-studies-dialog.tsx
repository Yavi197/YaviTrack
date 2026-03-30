"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { OrderData, UserProfile, GeneralService } from '@/lib/types';
import { GeneralServices, SubServiceAreas } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, Plus, Info, Droplets, Bed, Thermometer, UserCheck, Check, CheckCircle2 } from 'lucide-react';
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
  
  // Ref para evitar resets infinitos
  const lastResetId = useRef<string | null>(null);

  const isAdmissionist = userProfile?.rol === 'admisionista';
  const isNurse = userProfile?.rol === 'enfermero';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedStudies: [],
      service: 'HOSP',
      subService: 'HOSPITALIZACION 2',
      bedNumber: '',
      bajoSedacion: false,
      requiresContrast: false,
      creatinine: '',
    },
  });

  const watchService = form.watch('service');
  const watchContrast = form.watch('requiresContrast');

  // Reset destination every time the dialog opens
  useEffect(() => {
    if (open) {
      setTargetModule('imagenes');
      form.clearErrors();
    }
  }, [open, form]);

  // Sync form with orderData but ONLY if the patient/order actually changed
  useEffect(() => {
    if (orderData && open) {
      const currentId = `${orderData.patient.id}_${orderData.studies.length}`;
      if (lastResetId.current !== currentId) {
        lastResetId.current = currentId;
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
    }
  }, [orderData, open, form, isAdmissionist, isNurse, userProfile]);

  // Subservice options cleanup
  useEffect(() => {
    if (watchService && !isAdmissionist && !isNurse) {
      const availableSubServices = SubServiceAreas[watchService];
      const currentSub = form.getValues('subService');
      if (availableSubServices && !availableSubServices.includes(currentSub)) {
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
    };
    // @ts-ignore
    processedData.creatinineValue = data.creatinine ? parseFloat(data.creatinine) : undefined;
    onConfirm(processedData, targetModule);
    setLoading(false);
  };

  const handleCancel = () => { 
    lastResetId.current = null;
    onCancel(); 
    onOpenChange(false); 
  };

  const getSubmitButtonText = () => {
    if (targetModule === 'consultas') return 'Crear Consulta';
    if (targetModule === 'remisiones') return 'Crear Remisión';
    return 'Crear Solicitud';
  };

  const DESTINATIONS: { id: TargetModule; icon: string; label: string }[] = [
    { id: 'imagenes',   icon: '🩻', label: 'Imágenes' },
    { id: 'remisiones', icon: '🚑', label: 'Remisiones' },
    { id: 'consultas',  icon: '📋', label: 'Consultas' },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden border-none rounded-[2rem] bg-white shadow-2xl"
        onEscapeKeyDown={handleCancel}
        onPointerDownOutside={handleCancel}
      >
        <div className="bg-zinc-900 px-7 py-4 flex items-center gap-3">
          <div className="p-2 bg-amber-400/20 rounded-xl">
            <Plus className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <DialogTitle className="text-base font-black tracking-tight uppercase text-white leading-none">
              Procesar Nueva Solicitud
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] mt-0.5">
              Verifica los estudios y elige el destino antes de confirmar.
            </DialogDescription>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-[1fr_1.15fr] divide-x divide-zinc-100 min-h-0">
              {/* LEFT — Studies */}
              <div className="p-5 flex flex-col gap-3">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-sky-500" /> Estudios Detectados
                </p>
                <ScrollArea className="flex-1 max-h-[370px] pr-1">
                  <FormField
                    control={form.control}
                    name="selectedStudies"
                    render={({ field }) => (
                      <div className="space-y-1.5">
                        {orderData?.studies.map((study) => {
                          const isChecked = (field.value || []).includes(study.cups);
                          return (
                            <div
                              key={study.cups}
                              onClick={() => {
                                const newValue = isChecked
                                  ? field.value.filter((v: string) => v !== study.cups)
                                  : [...(field.value || []), study.cups];
                                field.onChange(newValue);
                              }}
                              className={cn(
                                "flex flex-row items-start gap-3 p-3 rounded-xl transition-all border cursor-pointer select-none",
                                isChecked
                                  ? "bg-amber-50 border-amber-300 shadow-sm"
                                  : "bg-white border-zinc-100 hover:bg-zinc-50"
                              )}
                            >
                              <div className={cn(
                                "h-5 w-5 rounded-md border flex items-center justify-center mt-0.5 transition-colors shrink-0",
                                isChecked ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-zinc-200"
                              )}>
                                {isChecked && <Check className="h-3.5 w-3.5 stroke-[4px]" />}
                              </div>
                              <div className="font-normal w-full leading-none">
                                <div className={cn("font-black text-xs leading-snug transition-colors", isChecked ? "text-amber-900" : "text-zinc-900")}>
                                  {study.nombre}
                                </div>
                                <div className="font-bold text-[10px] text-zinc-400 mt-0.5 uppercase tracking-tight">
                                  {study.modality} · {study.cups}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  />
                </ScrollArea>
                {form.formState.errors.selectedStudies && (
                  <p className="text-[10px] font-bold text-red-500">{form.formState.errors.selectedStudies.message}</p>
                )}
              </div>

              {/* RIGHT — Controls */}
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                    <Droplets className="h-3.5 w-3.5 text-amber-500" /> Información de Origen
                  </p>
                  {!isNurse && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <FormField control={form.control} name="service" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[9px] font-bold uppercase text-zinc-500">Servicio</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isAdmissionist}>
                            <FormControl>
                              <SelectTrigger className="h-9 rounded-xl border-zinc-200 bg-zinc-50 font-bold text-xs uppercase shadow-none focus-visible:ring-0">
                                <SelectValue placeholder="Servicio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {GeneralServices.map(s => <SelectItem key={s} value={s} className="text-xs font-bold uppercase">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="subService" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[9px] font-bold uppercase text-zinc-500">Subservicio</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isAdmissionist}>
                            <FormControl>
                              <SelectTrigger className="h-9 rounded-xl border-zinc-200 bg-zinc-50 font-bold text-xs uppercase shadow-none focus-visible:ring-0">
                                <SelectValue placeholder="Subservicio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SubServiceAreas[watchService as GeneralService]?.map(ss =>
                                <SelectItem key={ss} value={ss} className="text-xs font-bold uppercase">{ss}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                  )}
                  <FormField control={form.control} name="bedNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[9px] font-bold uppercase text-zinc-500">N° de Cama (Opcional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Bed className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                          <Input {...field} placeholder="Piso / Cama"
                            className="h-9 pl-9 rounded-xl border-zinc-200 bg-zinc-50 font-bold text-xs shadow-none focus-visible:ring-amber-500" />
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <FormField control={form.control} name="bajoSedacion" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 space-y-0">
                      <div>
                        <FormLabel className="text-[9px] font-black uppercase text-zinc-700 leading-none">Sedación</FormLabel>
                        <div className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">Bajo sedación</div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-violet-600 scale-90" />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="requiresContrast" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 space-y-0">
                      <div>
                        <FormLabel className="text-[9px] font-black uppercase text-zinc-700 leading-none">Contraste</FormLabel>
                        <div className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">Contrastada</div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-emerald-600 scale-90" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                {watchContrast && (
                  <FormField control={form.control} name="creatinine" render={({ field }) => (
                    <FormItem className="animate-in slide-in-from-top-2 duration-200">
                      <FormLabel className="text-[9px] font-black uppercase text-red-600">Creatinina (MG/DL) *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-400" />
                          <Input {...field} type="number" step="0.01" placeholder="Ej: 1.25"
                            className="h-9 pl-9 rounded-xl border-red-200 bg-red-50/40 font-black text-red-700 text-xs shadow-none focus-visible:ring-red-500" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[9px] font-bold" />
                    </FormItem>
                  )} />
                )}

                <div className="mt-auto pt-2">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">¿A dónde enviar esta solicitud?</p>
                  <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-zinc-200">
                    {DESTINATIONS.map(({ id, icon, label }) => {
                      const isActive = targetModule === id;
                      return (
                        <button key={id} type="button" onClick={() => setTargetModule(id)}
                          className={cn(
                            "flex flex-col items-center gap-0.5 py-3 text-[9px] font-black uppercase tracking-wider transition-all border-r border-zinc-100 last:border-0",
                            isActive ? "bg-zinc-900 text-white" : "bg-white text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                          )}>
                          <span className="text-lg leading-none">{icon}</span>
                          <span className="mt-0.5">{label}</span>
                          {isActive && <Check className="h-3 w-3 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/80">
              <Button type="button" variant="ghost" onClick={handleCancel}
                className="text-zinc-500 font-bold hover:bg-zinc-200 rounded-xl h-10 px-5 uppercase text-[10px] tracking-widest shrink-0">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}
                className="flex-1 bg-zinc-900 hover:bg-black text-white h-10 uppercase font-black text-[10px] tracking-widest rounded-xl shadow-lg transition-all active:scale-[0.98]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <span className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-amber-400" />
                    {getSubmitButtonText()} · {(form.watch('selectedStudies') || []).length} estudio{(form.watch('selectedStudies') || []).length !== 1 ? 's' : ''}
                  </span>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
