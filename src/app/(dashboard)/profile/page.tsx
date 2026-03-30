"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { KeyRound, Moon, Sun, UserCircle, Shield, Mail, Briefcase, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { sendPasswordResetEmailAction } from "@/app/actions";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const rolLabels: Record<string, string> = {
  administrador: "Administrador",
  tecnologo: "Tecnólogo",
  transcriptora: "Transcriptora",
  enfermero: "Enfermero/a",
  admisionista: "Admisionista",
};

const rolColors: Record<string, string> = {
  administrador: "bg-purple-100 text-purple-700 border-purple-200",
  tecnologo:     "bg-blue-100 text-blue-700 border-blue-200",
  transcriptora: "bg-sky-100 text-sky-700 border-sky-200",
  enfermero:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  admisionista:  "bg-orange-100 text-orange-700 border-orange-200",
};

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-5 bg-zinc-50 rounded-2xl">
      <div>
        <p className="font-bold text-zinc-800">{label}</p>
        <p className="text-xs text-zinc-400 font-medium mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useAuth();
  return (
    <SettingRow label="Tema de la interfaz" description="Alterna entre modo claro y oscuro.">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="h-10 w-10 rounded-xl border-zinc-200"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Cambiar tema</span>
      </Button>
    </SettingRow>
  );
}

export default function ProfilePage() {
  const { currentProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const handlePasswordReset = async () => {
    if (!currentProfile?.email) return;
    setLoading(true);
    const result = await sendPasswordResetEmailAction(currentProfile.email);
    if (result.success) {
      toast({ title: "Correo Enviado", description: "Revisa tu bandeja de entrada para restablecer tu contraseña." });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-6">

      {/* Profile Card */}
      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-zinc-900 to-zinc-700 relative">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-400 to-transparent" />
        </div>

        {/* Avatar + Info */}
        <div className="px-8 pb-8">
          <div className="flex items-end gap-5 -mt-10 mb-6">
            <Avatar className="h-20 w-20 border-4 border-white shadow-xl ring-2 ring-zinc-100">
              {currentProfile?.rol === 'administrador' ? (
                <AvatarImage src="/avatar-admin.png" alt="Admin Avatar" />
              ) : (
                <AvatarFallback className="text-2xl font-black bg-zinc-900 text-white">
                  {currentProfile ? getInitials(currentProfile.nombre) : <UserCircle />}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="pb-1">
              {currentProfile?.rol && (
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-2", rolColors[currentProfile.rol] || "bg-zinc-100 text-zinc-600 border-zinc-200")}>
                  <Shield className="h-2.5 w-2.5" />
                  {rolLabels[currentProfile.rol] || currentProfile.rol}
                </span>
              )}
              <h1 className="text-2xl font-black text-zinc-900">{currentProfile?.nombre}</h1>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Correo</p>
              </div>
              <p className="text-sm font-bold text-zinc-800 truncate">{currentProfile?.email}</p>
            </div>
            <div className="bg-zinc-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="h-3.5 w-3.5 text-zinc-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Servicio Asignado</p>
              </div>
              <p className="text-sm font-bold text-zinc-800">{currentProfile?.servicioAsignado || "General"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 space-y-5">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-1.5 bg-zinc-100 rounded-lg">
            <Settings className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Configuración de la cuenta</p>
        </div>

        <SettingRow label="Contraseña" description="Envía un correo de restablecimiento a tu email.">
          <Button
            variant="outline"
            onClick={handlePasswordReset}
            disabled={loading || currentProfile?.rol === 'administrador'}
            className="rounded-xl h-10 font-bold border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Cambiar Contraseña
          </Button>
        </SettingRow>

        <ThemeToggle />
      </div>
    </div>
  );
}
