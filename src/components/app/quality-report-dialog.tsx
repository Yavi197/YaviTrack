"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitQualityReportAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/lib/types";
import {
  QualityReportCategories, QualityReportSubcategories,
  QualityReportPriorities, QualityReportShifts, QualityReportImpacts,
  QualityReportAreas, QualityReportInvolvedRoles,
} from "@/lib/types";
import { Loader2, Send, AlertTriangle, Clock, CheckCircle2, X, Zap } from "lucide-react";
import { handleServerActionError } from "@/lib/client-safe-action";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  category: z.enum(QualityReportCategories),
  subcategory: z.string().min(1, "Selecciona una subcategoría."),
  priority: z.enum(QualityReportPriorities),
  shift: z.enum(QualityReportShifts),
  impact: z.enum(QualityReportImpacts).optional(),
  modality: z.enum(QualityReportAreas),
  involvedRole: z.enum(QualityReportInvolvedRoles),
  involvedUserId: z.string().trim().max(120).optional(),
  involvedUserName: z.string().trim().max(120).optional(),
  otherPersonName: z.string().trim().max(120).optional(),
  referenceId: z.string().trim().max(80).optional(),
  patientId: z.string().trim().max(80).optional(),
  patientName: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10, "Describe brevemente la novedad.").max(2000),
  immediateAction: z.string().trim().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.involvedRole === "Tecnólogo") {
    if (!data.involvedUserId)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["involvedUserId"], message: "Selecciona un tecnólogo." });
  } else if (data.involvedRole !== "N/A" && !data.otherPersonName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherPersonName"], message: "Indica el nombre del personal." });
  }
});

type FormValues = z.infer<typeof formSchema>;

const formatNow = () =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short" }).format(new Date());

interface QualityReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile: UserProfile | null;
}

const categoryDot: Record<string, string> = {
  'Asistencial':         'bg-blue-500',
  'Técnica / Equipos':   'bg-orange-500',
  'Infraestructura':     'bg-yellow-500',
  'Administrativa':      'bg-purple-500',
  'Talento Humano':      'bg-emerald-500',
};

const priorityStyle: Record<string, { bg: string; text: string; label: string }> = {
  'P1 · Crítica':           { bg: 'bg-red-100 border-red-200',      text: 'text-red-700',     label: '🔴 P1 · Crítica' },
  'P2 · Alta':              { bg: 'bg-orange-100 border-orange-200', text: 'text-orange-700',  label: '🟠 P2 · Alta' },
  'P3 · Media':             { bg: 'bg-amber-100 border-amber-200',   text: 'text-amber-700',   label: '🟡 P3 · Media' },
  'P4 · Baja / Informativa':{ bg: 'bg-zinc-100 border-zinc-200',     text: 'text-zinc-500',    label: '⚪ P4 · Baja' },
};

function StyledSelect({ placeholder, value, onValueChange, items, disabled }: {
  placeholder: string; value: string; onValueChange: (v: string) => void;
  items: { value: string; label?: string }[]; disabled?: boolean;
}) {
  return (
    <Select onValueChange={onValueChange} value={value} disabled={disabled}>
      <SelectTrigger className="h-11 bg-zinc-50 border-transparent focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl font-medium text-zinc-900 transition-all data-[disabled]:opacity-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>{item.label ?? item.value}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QualityReportDialog({ open, onOpenChange, userProfile }: QualityReportDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timestampLabel, setTimestampLabel] = useState(() => formatNow());
  const [submitted, setSubmitted] = useState(false);
  const [technologists, setTechnologists] = useState<Array<{ id: string; name: string }>>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: undefined as any, subcategory: "", priority: undefined as any,
      shift: undefined as any, impact: undefined, modality: undefined as any,
      involvedRole: undefined as any, involvedUserId: "", involvedUserName: "",
      otherPersonName: "", referenceId: "", patientId: "", patientName: "",
      description: "", immediateAction: "",
    },
  });

  useEffect(() => { if (open) { setTimestampLabel(formatNow()); setSubmitted(false); } }, [open]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("rol", "==", "tecnologo"));
    const unsub = onSnapshot(q, (snap) => {
      setTechnologists(snap.docs.map((doc) => ({ id: doc.id, name: (doc.data() as any).nombre || "Tecnólogo" })));
    });
    return () => unsub();
  }, []);

  const watchedCategory  = form.watch("category");
  const watchedRole      = form.watch("involvedRole");
  const watchedPriority  = form.watch("priority");

  // Reset subcategory when category changes
  useEffect(() => { form.setValue("subcategory", ""); }, [watchedCategory, form]);

  useEffect(() => {
    if (watchedRole !== "Tecnólogo") { form.setValue("involvedUserId", ""); form.setValue("involvedUserName", ""); }
    if (watchedRole === "Tecnólogo" && technologists.length === 1) {
      const solo = technologists[0];
      form.setValue("involvedUserId", solo.id);
      form.setValue("involvedUserName", solo.name);
    }
  }, [watchedRole, form, technologists]);

  const subcategoryItems = useMemo(() =>
    watchedCategory ? QualityReportSubcategories[watchedCategory].map(s => ({ value: s })) : [],
  [watchedCategory]);

  // Step progress (0..4)
  const cat = form.watch("category");
  const sub = form.watch("subcategory");
  const pri = form.watch("priority");
  const shi = form.watch("shift");
  const rol = form.watch("involvedRole");
  const step = !cat ? 0 : !sub ? 1 : !pri || !shi ? 2 : !rol ? 3 : 4;

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) {
      toast({ variant: "destructive", title: "Sesión requerida" });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitQualityReportAction(values as any, userProfile);
      if (!result.success) {
        toast({ variant: "destructive", title: "No se pudo enviar", description: result.error });
        return;
      }
      setSubmitted(true);
      setTimeout(() => { form.reset(); onOpenChange(false); setSubmitted(false); }, 2200);
    } catch (error) {
      const handled = handleServerActionError({ error, toast, actionLabel: "el reporte" });
      if (!handled) toast({ variant: "destructive", title: "Error", description: "Ocurrió un error." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.14)]">

        {/* ── Success ────────────────────────────────────────────────────── */}
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-20 px-10 bg-white text-center">
            <div className="bg-emerald-50 rounded-full p-6 mb-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 mb-2">Reporte enviado</h2>
            <p className="text-zinc-500 font-medium">Novedad registrada como <span className="font-bold text-zinc-700">Pendiente</span>. El equipo de calidad lo revisará pronto.</p>
          </div>
        ) : (
          <>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="relative bg-zinc-900 px-8 pt-7 pb-5">
              <button onClick={() => !isSubmitting && onOpenChange(false)}
                className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-400/20 rounded-xl">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white leading-none">Reportar Novedad</h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Sistema de Calidad Med-iTrack</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium mb-4">
                <Clock className="h-3.5 w-3.5" /><span>{timestampLabel}</span>
              </div>
              {/* Step progress */}
              <div className="flex items-center gap-1.5">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className={cn("h-1 rounded-full flex-1 transition-all duration-500", i <= step ? "bg-amber-400" : "bg-zinc-700")} />
                ))}
              </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="bg-white max-h-[75vh] overflow-y-auto">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-7 space-y-6">

                  {/* § 1 — Clasificación */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">1 · ¿Qué categoría de novedad?</p>

                    {/* Category pills */}
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {QualityReportCategories.map(cat => (
                              <button type="button" key={cat}
                                onClick={() => field.onChange(cat)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all",
                                  field.value === cat
                                    ? "bg-zinc-900 text-white border-zinc-900"
                                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"
                                )}>
                                <span className={cn("h-2 w-2 rounded-full shrink-0", categoryDot[cat] || "bg-zinc-400")} />
                                {cat}
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Subcategory */}
                    <FormField control={form.control} name="subcategory" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Subcategoría específica</FormLabel>
                        <FormControl>
                          <StyledSelect placeholder="Selecciona subcategoría..."
                            value={field.value ?? ""} onValueChange={field.onChange}
                            items={subcategoryItems} disabled={!watchedCategory} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* § 2 — Prioridad + Turno + Impacto */}
                  <div className={cn("space-y-3 transition-opacity duration-300", !sub ? "opacity-30 pointer-events-none" : "")}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">2 · Prioridad, Turno e Impacto</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField control={form.control} name="priority" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Prioridad</FormLabel>
                          <FormControl>
                            <StyledSelect placeholder="Prioridad" value={field.value ?? ""}
                              onValueChange={field.onChange}
                              items={QualityReportPriorities.map(p => ({ value: p }))} disabled={!sub} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="shift" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Turno</FormLabel>
                          <FormControl>
                            <StyledSelect placeholder="Turno" value={field.value ?? ""}
                              onValueChange={field.onChange}
                              items={QualityReportShifts.map(s => ({ value: s }))} disabled={!sub} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="impact" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Impacto (auditoría)</FormLabel>
                          <FormControl>
                            <StyledSelect placeholder="Impacto (opc.)" value={field.value ?? ""}
                              onValueChange={field.onChange}
                              items={QualityReportImpacts.map(i => ({ value: i }))} disabled={!sub} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Priority badge preview */}
                    {watchedPriority && (
                      <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black", priorityStyle[watchedPriority]?.bg, priorityStyle[watchedPriority]?.text)}>
                        {watchedPriority}
                      </div>
                    )}
                  </div>

                  {/* § 3 — Área y Personal */}
                  <div className={cn("space-y-3 transition-opacity duration-300", !pri || !shi ? "opacity-30 pointer-events-none" : "")}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">3 · Área y Personal</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField control={form.control} name="modality" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Área / Modalidad</FormLabel>
                          <FormControl>
                            <StyledSelect placeholder="Área" value={field.value ?? ""}
                              onValueChange={field.onChange}
                              items={QualityReportAreas.map(a => ({ value: a }))} disabled={!pri || !shi} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="involvedRole" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Rol involucrado</FormLabel>
                          <FormControl>
                            <StyledSelect placeholder="Rol" value={field.value ?? ""}
                              onValueChange={field.onChange}
                              items={QualityReportInvolvedRoles.map(r => ({ value: r }))} disabled={!pri || !shi} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    {watchedRole === "Tecnólogo" ? (
                      <FormField control={form.control} name="involvedUserId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Tecnólogo involucrado</FormLabel>
                          <FormControl>
                            <StyledSelect placeholder="Selecciona tecnólogo" value={field.value ?? ""}
                              onValueChange={(val) => {
                                field.onChange(val);
                                const sel = technologists.find(t => t.id === val);
                                form.setValue("involvedUserName", sel?.name || "");
                              }}
                              items={technologists.map(t => ({ value: t.id, label: t.name }))}
                              disabled={technologists.length === 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    ) : watchedRole && watchedRole !== "N/A" ? (
                      <FormField control={form.control} name="otherPersonName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Nombre del personal</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Auxiliar María" {...field}
                              className="h-11 bg-zinc-50 border-transparent rounded-xl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    ) : null}
                  </div>

                  {/* § 4 — Referencia (opcional) */}
                  <div className={cn("space-y-3 transition-opacity duration-300", !rol ? "opacity-30 pointer-events-none" : "")}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">4 · Referencia del Paciente (opcional)</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField control={form.control} name="patientName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Nombre paciente</FormLabel>
                          <FormControl><Input placeholder="Juan Pérez" {...field} disabled={!rol} className="h-11 bg-zinc-50 border-transparent rounded-xl" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="referenceId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">ID / Cédula paciente</FormLabel>
                          <FormControl><Input placeholder="1063..." {...field} disabled={!rol} className="h-11 bg-zinc-50 border-transparent rounded-xl font-mono" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="patientId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-zinc-600">Historia Clínica / Turno</FormLabel>
                          <FormControl><Input placeholder="HC-00123" {...field} disabled={!rol} className="h-11 bg-zinc-50 border-transparent rounded-xl font-mono" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  {/* § 5 — Descripción + Acción inmediata */}
                  <div className={cn("space-y-3 transition-opacity duration-300", !rol ? "opacity-30 pointer-events-none" : "")}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">5 · Descripción y Acción Tomada</p>
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-zinc-600">Descripción de la novedad</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Describe qué sucedió, equipos implicados, protocolo seguido..."
                            {...field} disabled={!rol}
                            className="bg-zinc-50 border-transparent focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl resize-none font-medium text-zinc-900" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="immediateAction" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-zinc-600 flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-amber-500" />
                          Acción inmediata tomada (opcional)
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Se llamó a soporte técnico, se informó al jefe de turno..." {...field} disabled={!rol}
                            className="h-11 bg-amber-50 border-amber-200/50 focus:ring-amber-200/50 rounded-xl text-zinc-800" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}
                      className="flex-1 rounded-xl font-bold text-zinc-500">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !userProfile || !rol}
                      className="flex-[2] h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-tight shadow-xl transition-all active:scale-95 disabled:opacity-40">
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <div className="flex items-center gap-2">Enviar Reporte <Send className="h-4 w-4" /></div>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
