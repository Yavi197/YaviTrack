"use client";

import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, Stethoscope, FileSpreadsheet, Activity, LayoutGrid, ShieldCheck, ChevronRight } from "lucide-react";
import Link from 'next/link';
import { ModalityIcon } from "@/components/icons/modality-icon";
import { AppLogoIcon } from "@/components/icons/app-logo-icon";
import React, { useEffect } from 'react';
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { AuthLoader } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const modules = [
    {
        href: "/imaging",
        icon: ModalityIcon,
        title: "Imágenes Diagnósticas",
        description: "Gestión avanzada de Rayos X, Tomografías, Ecografías y Resonancias.",
        color: "amber",
        theme: "bg-amber-500",
        shadow: "shadow-amber-100",
        iconColor: "text-amber-600",
        hoverBg: "hover:bg-amber-50",
        borderColor: "hover:border-amber-200"
    },
    {
        href: "/consultations",
        icon: Stethoscope,
        title: "Interconsultas",
        description: "Seguimiento especializado de solicitudes y diagnósticos médicos.",
        color: "indigo",
        theme: "bg-indigo-600",
        shadow: "shadow-indigo-100",
        iconColor: "text-indigo-600",
        hoverBg: "hover:bg-indigo-50",
        borderColor: "hover:border-indigo-200"
    },
    {
        href: "/remissions",
        icon: FileSpreadsheet,
        title: "Remisiones Externas",
        description: "Control logístico y administrativo de pacientes en tránsito externo.",
        color: "emerald",
        theme: "bg-emerald-600",
        shadow: "shadow-emerald-100",
        iconColor: "text-emerald-600",
        hoverBg: "hover:bg-emerald-50",
        borderColor: "hover:border-emerald-200"
    }

];

function ModuleSelectionContent() {
    const { user, loading, currentProfile } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (currentProfile?.rol === 'tecnologo' || currentProfile?.rol === 'transcriptora') {
                router.push('/imaging');
            } else if (currentProfile?.rol === 'enfermero' && currentProfile?.servicioAsignado === 'URG') {
                router.push('/clinical-assistant-view');
            }
        }
    }, [user, loading, router, currentProfile]);
    
    if (loading || !user || currentProfile?.rol === 'tecnologo' || currentProfile?.rol === 'transcriptora' || (currentProfile?.rol === 'enfermero' && currentProfile?.servicioAsignado === 'URG')) {
        return null;
    }


    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen p-6 bg-white overflow-hidden">
            {/* Background Aesthetic Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-50 blur-[120px] rounded-full" />
            </div>

            {/* Header / Logo */}
            <div className="absolute top-10 left-10 animate-in fade-in slide-in-from-top-4 duration-1000">
                <Link href="/" className="flex items-center gap-4 group">
                    <div className="p-2.5 bg-white rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100 transition-transform group-hover:scale-110">
                        <AppLogoIcon className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-normal text-zinc-900 leading-none">Med-iTrack</h1>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] leading-none mt-1">Intelligence Hub</p>
                    </div>
                </Link>

                <div className="absolute -bottom-4 left-0 w-32 h-0.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 animate-progress w-[40%]" />
                </div>
            </div>

            {/* Welcome Section */}
            <div className="text-center mb-16 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full mb-6 border border-zinc-200/50 shadow-sm">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Acceso Autenticado</span>
                </div>
                <h1 className="text-5xl font-black text-zinc-900 tracking-tight leading-tight mb-4">
                    Bienvenido de nuevo, <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 tracking-normal">{currentProfile?.nombre}</span>
                </h1>
                <p className="text-lg text-zinc-500 font-medium">Gestiona tu flujo de trabajo seleccionando un centro de operaciones.</p>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl px-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                {modules.map((module, idx) => (
                    <Link href={module.href} key={module.title} className="group outline-none">
                        <Card className={cn(
                            "relative p-10 h-full flex flex-col justify-between border-2 border-zinc-100 rounded-[2.5rem] overflow-hidden transition-all duration-500",
                            "hover:border-transparent hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] hover:-translate-y-2",
                            module.hoverBg
                        )}>
                            {/* Decorative Background Pattern */}
                            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 scale-150 group-hover:scale-100 transition-all duration-700 pointer-events-none">
                                <module.icon className="h-32 w-32 rotate-12" />
                            </div>

                            <div>
                                <div className={cn(
                                    "p-4 rounded-3xl w-fit mb-8 shadow-xl transition-all duration-500 group-hover:scale-110",
                                    module.theme,
                                    "bg-opacity-10",
                                    module.iconColor
                                )}>
                                    <module.icon className="h-10 w-10" />
                                </div>
                                <CardTitle className="text-2xl font-black text-zinc-900 mb-4 tracking-tight leading-none group-hover:translate-x-1 transition-transform">{module.title}</CardTitle>
                                <CardDescription className="text-zinc-500 font-medium text-base leading-relaxed">{module.description}</CardDescription>
                            </div>

                            <div className="mt-12 flex items-center justify-between">
                                <div className={cn(
                                    "flex items-center gap-2 font-black text-xs uppercase tracking-widest transition-all duration-500 group-hover:translate-x-2",
                                    module.iconColor
                                )}>
                                    <span>Entrar ahora</span>
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                                <div className="p-2 bg-zinc-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                                </div>
                            </div>

                            {/* Hover Border Glow */}
                            <div className={cn(
                                "absolute bottom-0 left-0 h-1.5 w-0 transition-all duration-500 group-hover:w-full",
                                module.theme
                            )} />
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Footer / Meta */}
            <div className="mt-20 text-center opacity-40 animate-in fade-in duration-1000 delay-700">
                 <div className="flex items-center justify-center gap-6 mb-4 grayscale">
                     <div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-widest">Multi-módulo</span></div>
                     <div className="flex items-center gap-2"><Activity className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-widest">Tiempo Real</span></div>
                 </div>
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">© 2026 Med-iTrack Systems - Advanced Medical Intelligence.</p>
            </div>
        </div>
    );
}

export default function ModuleSelectionPage() {
    return (
        <AuthLoader>
            <ModuleSelectionContent />
        </AuthLoader>
    );
}
