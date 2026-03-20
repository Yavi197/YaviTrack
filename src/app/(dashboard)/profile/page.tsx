

"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, KeyRound, Moon, Sun, UserCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { sendPasswordResetEmailAction } from "@/app/actions";
import { useState } from "react";
import { Loader2 } from "lucide-react";


function ThemeToggle() {
  const { theme, setTheme } = useAuth();

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
            <h3 className="font-medium">Tema de la Interfaz</h3>
            <p className="text-sm text-muted-foreground">
                Selecciona entre el tema claro u oscuro.
            </p>
        </div>
        <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
        </Button>
    </div>
  );
}


export default function ProfilePage() {
    const { currentProfile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const getInitials = (name: string) => {
        if (!name) return "U";
        return name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();
    };

    const handlePasswordReset = async () => {
        if (!currentProfile?.email) return;
        setLoading(true);
        const result = await sendPasswordResetEmailAction(currentProfile.email);
        if (result.success) {
            toast({
                title: "Correo Enviado",
                description: "Revisa tu bandeja de entrada para restablecer tu contraseña.",
            });
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: result.error,
            });
        }
        setLoading(false);
    };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-20 w-20">
                 {currentProfile?.rol === 'administrador' ? (
                    <AvatarImage src="/avatar-admin.png" alt="Admin Avatar" />
                ) : (
                    <AvatarFallback className="text-3xl bg-muted">
                        {currentProfile ? getInitials(currentProfile.nombre) : <UserCircle />}
                    </AvatarFallback>
                )}
            </Avatar>
            <div className="grid gap-1">
                <CardTitle className="font-headline text-3xl">{currentProfile?.nombre}</CardTitle>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <span>{currentProfile?.email}</span>
                    {currentProfile?.rol && <Badge variant="outline">{currentProfile.rol}</Badge>}
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
            {/* Botón 'Entregar Turno' removido temporalmente por solicitud */}
            
            <Separator />
            
            <div className="space-y-4">
                <h3 className="font-headline text-xl">Configuración de la Cuenta</h3>
                 <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <h3 className="font-medium">Contraseña</h3>
                        <p className="text-sm text-muted-foreground">
                           Haz clic para enviar un correo de restablecimiento.
                        </p>
                    </div>
                    <Button variant="outline" onClick={handlePasswordReset} disabled={loading || currentProfile?.rol === 'administrador'}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <KeyRound className="mr-2 h-4 w-4"/>}
                        Cambiar Contraseña
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-headline text-xl">Preferencias</h3>
                <ThemeToggle />
            </div>

        </CardContent>
      </Card>
    </div>
  );
}
