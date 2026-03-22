"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitQualityReportAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/lib/types";
import { QualityReportTypes, QualityReportCategories, QualityReportInvolvedRoles, QualityReportAreas } from "@/lib/types";
import { Loader2, Send } from "lucide-react";
import { handleServerActionError } from "@/lib/client-safe-action";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const formSchema = z.object({
  reportType: z.enum(QualityReportTypes),
  category: z.enum(QualityReportCategories),
  modality: z.enum(QualityReportAreas),
  involvedRole: z.enum(QualityReportInvolvedRoles),
  involvedUserId: z.string().trim().max(120).optional(),
  involvedUserName: z.string().trim().max(120).optional(),
  otherPersonName: z.string().trim().max(120).optional(),
  referenceId: z.string().trim().max(80).optional(),
  patientId: z.string().trim().max(80).optional(),
  patientName: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10, "Describe brevemente la novedad.").max(2000),
}).superRefine((data, ctx) => {
  if (data.involvedRole === "Tecnólogo") {
    if (!data.involvedUserId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["involvedUserId"], message: "Selecciona un tecnólogo." });
    }
    if (!data.involvedUserName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["involvedUserName"], message: "Nombre no disponible." });
    }
  } else if (data.involvedRole !== "N/A" && !data.otherPersonName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherPersonName"], message: "Indica el nombre del personal." });
  }
});

type QualityReportFormValues = z.infer<typeof formSchema>;

const formatNow = () =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());

interface QualityReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile: UserProfile | null;
}

export function QualityReportDialog({ open, onOpenChange, userProfile }: QualityReportDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timestampLabel, setTimestampLabel] = useState(() => formatNow());

  const form = useForm<QualityReportFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportType: undefined as unknown as typeof QualityReportTypes[number],
      category: undefined as unknown as typeof QualityReportCategories[number],
      modality: undefined as unknown as typeof QualityReportAreas[number],
      involvedRole: undefined as unknown as typeof QualityReportInvolvedRoles[number],
      involvedUserId: "",
      involvedUserName: "",
      otherPersonName: "",
      referenceId: "",
      patientId: "",
      patientName: "",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      setTimestampLabel(formatNow());
    }
  }, [open]);

  const requiresAuth = !userProfile;
  const [technologists, setTechnologists] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("rol", "==", "tecnologo"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, name: (doc.data() as any).nombre || "Tecnólogo" }));
      setTechnologists(list);
    });
    return () => unsub();
  }, []);

  const onSubmit = async (values: QualityReportFormValues) => {
    if (requiresAuth) {
      toast({ variant: "destructive", title: "Sesión requerida", description: "Debes iniciar sesión para reportar novedades." });
      return;
    }

    setIsSubmitting(true);
    const payload = {
      ...values,
      involvedUserName: values.involvedUserName?.trim() || undefined,
      otherPersonName: values.otherPersonName?.trim() || undefined,
      referenceId: values.referenceId?.trim() || undefined,
      patientId: values.patientId?.trim() || undefined,
      patientName: values.patientName?.trim() || undefined,
    };

    try {
      const result = await submitQualityReportAction(payload, userProfile);
      if (!result.success) {
        toast({ variant: "destructive", title: "No se pudo enviar", description: result.error || "Intenta nuevamente." });
        return;
      }

      toast({ title: "Reporte enviado", description: "Registramos la novedad como Pendiente." });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      const handled = handleServerActionError({ error, toast, actionLabel: "el reporte" });
      if (!handled) {
        toast({ variant: "destructive", title: "Error", description: "Ocurrió un error al guardar el reporte." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeCategoryMap: Record<(typeof QualityReportTypes)[number], (typeof QualityReportCategories)[number][]> = useMemo(
    () => ({
      "Problema con un estudio": ["Calidad de imagen", "Estudio incompleto", "Estudio no realizado"],
      Queja: ["Atención al paciente", "Tiempos de espera"],
      Sugerencia: ["Atención al paciente", "Calidad de imagen", "Tiempos de espera"],
      "Evento Adverso": ["Atención al paciente", "Calidad de imagen", "Tiempos de espera", "Equipo médico", "Medio de contraste"],
      Farmacovigilancia: ["Medio de contraste", "Reacción adversa", "Falla terapéutica"],
    }),
    []
  );

  const filteredReportTypes = useMemo(() => {
    if (!userProfile) return [];
    
    // Admin, Tecnólogo and Transcriptora can see everything
    if (["administrador", "tecnologo", "transcriptora"].includes(userProfile.rol)) {
        return QualityReportTypes;
    }
    
    // Others (Admissionist, Nurse) can only see the first 3
    return QualityReportTypes.filter(type => 
        type === 'Problema con un estudio' || 
        type === 'Queja' || 
        type === 'Sugerencia'
    );
  }, [userProfile]);

  const selectItems = useMemo(
    () => ({
      reportTypes: filteredReportTypes.map((type) => ({ value: type, label: type })),
      modalities: QualityReportAreas.map((area) => ({ value: area, label: area })),
      roles: QualityReportInvolvedRoles.map((role) => ({ value: role, label: role })),
    }),
    [filteredReportTypes]
  );

  const watchedType = form.watch("reportType");
  const watchedCategory = form.watch("category");
  const watchedModality = form.watch("modality");
  const watchedRole = form.watch("involvedRole");

  useEffect(() => {
    if (!watchedType) {
      form.setValue("category", undefined as any);
      return;
    }
    const allowed = typeCategoryMap[watchedType];
    if (!allowed.includes(watchedCategory as any)) {
      form.setValue("category", allowed[0] as any);
    }
  }, [watchedType, watchedCategory, form, typeCategoryMap]);

  useEffect(() => {
    if (watchedRole !== "Tecnólogo") {
      form.setValue("involvedUserId", "");
      form.setValue("involvedUserName", "");
    }
    if (watchedRole === "Tecnólogo" && technologists.length === 1) {
      const solo = technologists[0];
      form.setValue("involvedUserId", solo.id);
      form.setValue("involvedUserName", solo.name);
    }
  }, [watchedRole, form, technologists]);

  const typeSelected = !!watchedType;
  const categorySelected = !!watchedCategory;
  const modalitySelected = !!watchedModality;
  const roleSelected = !!watchedRole;

  const filteredCategories = watchedType ? typeCategoryMap[watchedType] : [];

  return (
    <Dialog open={open} onOpenChange={(value) => !isSubmitting && onOpenChange(value)}>
      <DialogContent className="max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-hidden">
        <div className="flex flex-col gap-4 max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Reportar novedad o sugerencia</DialogTitle>
            <DialogDescription>
              Cuéntanos qué sucedió; enviaremos el registro al equipo de calidad con estado inicial &quot;Pendiente&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Fecha y hora de captura</p>
            <p>{timestampLabel}</p>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="reportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de novedad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectItems.reportTypes.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!typeSelected}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área / Modalidad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!categorySelected}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Modalidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectItems.modalities.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="involvedRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol involucrado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!modalitySelected}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectItems.roles.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchedRole === "Tecnólogo" ? (
                <FormField
                  control={form.control}
                  name="involvedUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tecnólogo involucrado</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const selected = technologists.find((t) => t.id === value);
                          form.setValue("involvedUserName", selected?.name || "");
                        }}
                        value={field.value ?? ""}
                        disabled={!roleSelected || technologists.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tecnólogo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technologists.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : watchedRole && watchedRole !== "N/A" ? (
                <FormField
                  control={form.control}
                  name="otherPersonName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del personal</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Auxiliar María" {...field} disabled={!roleSelected} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="h-0" />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="referenceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID paciente / estudio (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 1090 o EST-123" {...field} disabled={!roleSelected} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID interno paciente (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="HC o turno" {...field} disabled={!roleSelected} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="patientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del paciente (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Juan Pérez" {...field} disabled={!roleSelected} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Describe qué sucedió, equipos implicados y acciones tomadas." {...field} disabled={!roleSelected} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || requiresAuth}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Enviar reporte
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
