"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { signupUserAction } from "@/app/actions";
import { UserRole, GeneralServices, SubServiceAreas, Modalities } from "@/lib/types";
import { AppLogoIcon } from "@/components/icons/app-logo-icon";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import Link from "next/link";

const roles: UserRole[] = ["administrador", "enfermero", "tecnologo", "transcriptora", "admisionista"];

const signupSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("Correo electrónico inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  rol: z.enum(roles as [UserRole, ...UserRole[]]),
  servicioAsignado: z.string().min(1, "Debe seleccionar un servicio."),
  subServicioAsignado: z.string().optional(),
});

type SignupFormData = z.infer<typeof signupSchema>;

function StyledSelect({ placeholder, value, onValueChange, items, disabled }: {
  placeholder: string; value: string; onValueChange: (v: string) => void;
  items: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <Select onValueChange={onValueChange} value={value} disabled={disabled}>
      <SelectTrigger className="h-12 bg-zinc-50 border-transparent focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl font-medium text-zinc-900 transition-all">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { nombre: "", email: "", password: "", servicioAsignado: "", subServicioAsignado: "" },
  });

  const watchedRol = form.watch("rol");
  const watchedService = form.watch("servicioAsignado");

  const availableServices = useMemo(() => {
    if (watchedRol === 'tecnologo' || watchedRol === 'transcriptora') return [...Modalities];
    if (watchedRol === 'enfermero' || watchedRol === 'admisionista') return [...GeneralServices];
    if (watchedRol === 'administrador') return ["General", ...GeneralServices, ...Modalities];
    return [];
  }, [watchedRol]);

  const isGeneralService = GeneralServices.includes(watchedService as any);

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true);
    const result = await signupUserAction(data);
    if (result.success) {
      toast({ title: "Usuario Creado", description: "El nuevo usuario ha sido registrado exitosamente." });
      router.push("/");
    } else {
      toast({ variant: "destructive", title: "Error en el registro", description: result.error || "Ocurrió un error inesperado." });
    }
    setLoading(false);
  };

  const onRoleChange = (value: string) => {
    form.setValue('rol', value as UserRole);
    form.setValue('servicioAsignado', '');
    form.setValue('subServicioAsignado', '');
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-900 font-bold uppercase tracking-widest text-[10px] transition-colors group mb-6">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Volver
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm">
            <AppLogoIcon className="h-10 w-10" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Administración · Usuarios</p>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Crear Nuevo Usuario</h1>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-8 py-3 bg-zinc-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Completa todos los campos requeridos</p>
        </div>
        <div className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-zinc-600">Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del usuario" {...field}
                        className="h-12 bg-zinc-50 border-transparent focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-zinc-600">Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@email.com" {...field}
                        className="h-12 bg-zinc-50 border-transparent focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-zinc-600">Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field}
                      className="h-12 bg-zinc-50 border-transparent focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="rol" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-zinc-600">Rol</FormLabel>
                    <FormControl>
                      <StyledSelect
                        placeholder="Selecciona un rol"
                        value={field.value ?? ""}
                        onValueChange={onRoleChange}
                        items={roles.map(r => ({ value: r, label: r }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {watchedRol && availableServices.length > 0 && (
                  <FormField control={form.control} name="servicioAsignado" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-zinc-600">Servicio Asignado</FormLabel>
                      <FormControl>
                        <StyledSelect
                          placeholder="Selecciona un servicio"
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          items={availableServices.map(s => ({ value: s, label: s }))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              {isGeneralService && (
                <FormField control={form.control} name="subServicioAsignado" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-zinc-600">Sub-Servicio Asignado</FormLabel>
                    <FormControl>
                      <StyledSelect
                        placeholder="Selecciona un sub-servicio"
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        items={SubServiceAreas[watchedService as keyof typeof SubServiceAreas].map(s => ({ value: s, label: s }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-tight shadow-xl transition-all active:scale-95"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <div className="flex items-center gap-2">
                      Crear Usuario <UserPlus className="h-5 w-5" />
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
