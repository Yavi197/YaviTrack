
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { signupUserAction } from "@/app/actions";
import { UserRole, GeneralServices, SubServiceAreas, Modalities } from "@/lib/types";
import { AppLogoIcon } from "@/components/icons/app-logo-icon";
import { ArrowLeft } from "lucide-react";

const roles: UserRole[] = ["administrador", "enfermero", "tecnologo", "transcriptora", "adminisonista"];

const signupSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("Correo electrónico inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  rol: z.enum(roles as [UserRole, ...UserRole[]]),
  servicioAsignado: z.string().min(1, "Debe seleccionar un servicio."),
  subServicioAsignado: z.string().optional(),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      nombre: "",
      email: "",
      password: "",
      servicioAsignado: "",
      subServicioAsignado: "",
    }
  });

  const watchedRol = form.watch("rol");
  const watchedService = form.watch("servicioAsignado");
  
  const availableServices = useMemo(() => {
    if (watchedRol === 'tecnologo' || watchedRol === 'transcriptora') {
      return [...Modalities];
    }
    if (watchedRol === 'enfermero' || watchedRol === 'adminisonista') {
      return [...GeneralServices];
    }
    if (watchedRol === 'administrador') {
      return ["General", ...GeneralServices, ...Modalities];
    }
    return [];
  }, [watchedRol]);

  const isGeneralService = GeneralServices.includes(watchedService as any);

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true);
    const result = await signupUserAction(data);
    if (result.success) {
      toast({
        title: "Usuario Creado",
        description: "El nuevo usuario ha sido registrado exitosamente.",
      });
      router.push("/");
    } else {
      toast({
        variant: "destructive",
        title: "Error en el registro",
        description: result.error || "Ocurrió un error inesperado.",
      });
    }
    setLoading(false);
  };
  
  // Reset service when role changes
  const onRoleChange = (value: string) => {
    form.setValue('rol', value as UserRole);
    form.setValue('servicioAsignado', '');
    form.setValue('subServicioAsignado', '');
  };

  return (
    <div className="container mx-auto py-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
                <AppLogoIcon className="h-12 w-12 text-primary" />
            </div>
          <CardTitle className="text-3xl font-headline">Crear Nuevo Usuario</CardTitle>
          <CardDescription>
            Completa los datos para registrar un nuevo usuario en Med-iTrack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="nombre" render={({ field }) => ( <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Nombre del usuario" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input placeholder="usuario@email.com" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="rol" render={({ field }) => ( <FormItem><FormLabel>Rol</FormLabel><Select onValueChange={onRoleChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl><SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                
                {watchedRol && availableServices.length > 0 && (
                  <FormField control={form.control} name="servicioAsignado" render={({ field }) => ( <FormItem><FormLabel>Servicio Asignado</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un servicio" /></SelectTrigger></FormControl><SelectContent>{availableServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                )}

                {isGeneralService && (
                  <FormField control={form.control} name="subServicioAsignado" render={({ field }) => ( <FormItem><FormLabel>Sub-Servicio Asignado</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un sub-servicio" /></SelectTrigger></FormControl><SelectContent>{SubServiceAreas[watchedService as keyof typeof SubServiceAreas].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creando usuario..." : "Crear Usuario"}
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
