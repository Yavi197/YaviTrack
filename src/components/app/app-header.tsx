
"use client";

import { useAuth } from "@/context/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, UserPlus, Download, Users, LifeBuoy, Package, Beaker, ShieldPlus, FileText, FileBarChart, HardDrive, DollarSign, Eye, Tv, VolumeX, Loader2, Stethoscope, Briefcase, FileSpreadsheet, MessageSquare, LogOutIcon, CalendarClock, AlertTriangle, RefreshCw } from "lucide-react";
import { ModalityIcon } from "@/components/icons/modality-icon";
import Link from 'next/link';
import { AppLogoIcon } from "@/components/icons/app-logo-icon";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { ExportDialog } from "./export-dialog";
import { MessagingDrawer } from "./messaging-drawer";
import { HelpTutorialDialog } from "./help-tutorial-dialog";
import { tutorialData } from "@/lib/tutorial-data";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";
import { ContrastStockDialog } from "./contrast-stock-dialog";
import { ImpersonationDialog } from "./impersonation-dialog";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InventoryItem, InventoryStockEntry, InventoryConsumption, UserProfile } from "@/lib/types";
import { AssignOperatorDialog } from "./assign-operator-dialog";
import { setActiveOperatorAction } from "@/app/actions";
import { useContrast } from '@/context/contrast-context';
import { ShiftHandoverDialog } from "./shift-handover-dialog";
import { QualityReportDialog } from "./quality-report-dialog";

function HeaderContrastIndicator() {
    const { netTotalMl, loading } = useContrast();
    const [isContrastDialogOpen, setIsContrastDialogOpen] = useState(false);


    if (loading) {
        return <Skeleton className="h-9 w-24 rounded-full" />;
    }

    return (
        <>
            <button 
              onClick={() => setIsContrastDialogOpen(true)} 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400 text-amber-950 shadow-md shadow-amber-200/50 transition-all hover:-translate-y-0.5"
              aria-label="Ver stock de contraste"
            >
              <div className="bg-amber-950/10 p-1.5 rounded-full">
                <Beaker className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="text-xs font-black tracking-tight">{Math.round(netTotalMl)} ml</span>
            </button>
            <ContrastStockDialog open={isContrastDialogOpen} onOpenChange={setIsContrastDialogOpen} />
        </>
    );
}


function AdverseEventReporter({ onQualityReport, currentProfile }: { onQualityReport: () => void, currentProfile: UserProfile }) {
    const isTechnicalRole = ['administrador', 'tecnologo', 'transcriptora'].includes(currentProfile.rol);
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-10 w-10 rounded-full border border-red-100 shadow-sm shadow-red-500/10 hover:-translate-y-0.5 hover:shadow-md hover:shadow-red-500/20 hover:bg-red-50 transition-all group bg-white/50 backdrop-blur-sm"
                    title="Seguridad y Calidad"
                >
                    <ShieldPlus className="h-5 w-5 text-red-600 group-hover:scale-110 transition-transform" />
                    <span className="sr-only">Reportar Evento Adverso o Novedad</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-2 rounded-xl border-zinc-200 shadow-xl backdrop-blur-xl bg-white/90">
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">Seguridad y Calidad</DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 opacity-50" />
                <DropdownMenuItem onClick={onQualityReport} className="cursor-pointer rounded-lg focus:bg-amber-50 focus:text-amber-700 transition-colors p-2">
                    <div className="flex items-center w-full">
                        <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center mr-3 group-hover:bg-amber-200 transition-colors">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight">Reportar Novedad / Sugerencia</span>
                        </div>
                    </div>
                </DropdownMenuItem>
                
                {isTechnicalRole && (
                    <>
                        <DropdownMenuSeparator className="my-1 opacity-50" />
                        <DropdownMenuItem asChild className="cursor-pointer rounded-lg focus:bg-violet-50 focus:text-violet-700 transition-colors p-2 mt-1">
                            <a href="/docs/formato_farmacovigilancia.docx" download className="flex items-center w-full">
                                <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center mr-3 group-hover:bg-violet-200 transition-colors">
                                    <FileText className="h-5 w-5 text-violet-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm leading-tight">Fármacovigilancia</span>
                                    <span className="text-[10px] text-zinc-500">Formato FO-GSF-12</span>
                                </div>
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer rounded-lg focus:bg-rose-50 focus:text-rose-700 transition-colors p-2 mt-1">
                            <a href="https://docs.google.com/forms/d/1l-Pi7tMeUa9cfjIcBoZo5sFlkglutOKuxLKYQyM5azU/viewform?edit_requested=true" target="_blank" rel="noopener noreferrer" className="flex items-center w-full">
                                <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center mr-3 group-hover:bg-rose-200 transition-colors">
                                    <FileBarChart className="h-5 w-5 text-rose-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm leading-tight">Evento Adverso</span>
                                    <span className="text-[10px] text-zinc-500">Formato GSP-FT-06</span>
                                </div>
                            </a>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ShiftRequestsMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-10 w-10 rounded-full border border-blue-100 shadow-sm shadow-blue-500/10 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/20 hover:bg-blue-50 transition-all group bg-white/50 backdrop-blur-sm"
                    title="Trámites y Solicitudes Operativas"
                >
                    <CalendarClock className="h-5 w-5 text-blue-600 group-hover:scale-110 transition-transform" />
                    <span className="sr-only">Solicitudes Operativas</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-2 rounded-xl border-zinc-200 shadow-xl backdrop-blur-xl bg-white/90">
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">Operaciones Manuales</DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 opacity-50" />
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg focus:bg-blue-50 focus:text-blue-700 transition-colors p-2">
                    <a href="/print-format/cambio" target="_blank" rel="noopener noreferrer" className="flex items-center w-full">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3 group-hover:bg-blue-200 transition-colors">
                            <CalendarClock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight">Cambio de Turno</span>
                            <span className="text-[10px] text-zinc-500">Formato FO-GTH-43</span>
                        </div>
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg focus:bg-emerald-50 focus:text-emerald-700 transition-colors p-2 mt-1">
                    <a href="/print-format/permiso" target="_blank" rel="noopener noreferrer" className="flex items-center w-full">
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center mr-3 group-hover:bg-emerald-200 transition-colors">
                            <LogOutIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight">Solicitud de Permiso</span>
                            <span className="text-[10px] text-zinc-500">Formato FO-GTH-42</span>
                        </div>
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function AppHeader() {
  const { user, userProfile, currentProfile, selectedOperator, signOut, isImpersonating, stopImpersonating, startImpersonating } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isImpersonationDialogOpen, setIsImpersonationDialogOpen] = useState(false);
  const [isAssignRadiologistOpen, setIsAssignRadiologistOpen] = useState(false);
  const [isShiftHandoverOpen, setIsShiftHandoverOpen] = useState(false);
  const [isQualityDialogOpen, setIsQualityDialogOpen] = useState(false);
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  
  const shouldShowOperatorView = selectedOperator && (currentProfile?.rol === 'tecnologo' || currentProfile?.rol === 'transcriptora');
  const canChangeOperator = currentProfile?.rol === 'transcriptora';
  const isTechnologist = currentProfile?.rol === 'tecnologo';
  
  const handleAssignOperator = async (operatorName: string) => {
    if (!userProfile) return;
    setLoadingAssignment(true);
    const result = await setActiveOperatorAction(userProfile.uid, operatorName);
    if (result.success) {
      toast({ title: "Operador Asignado", description: `${operatorName} ahora está de turno.` });
       if(isImpersonating){
           startImpersonating({ ...currentProfile, operadorActivo: operatorName } as any);
       }
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
    setLoadingAssignment(false);
    setIsAssignRadiologistOpen(false);
  };

  const hasTutorial = currentProfile && tutorialData[currentProfile.rol] && tutorialData[currentProfile.rol].length > 0;
  
  return (
    <>
      <header className="theme-yellow sticky top-0 z-40 w-full border-b border-zinc-200/40 bg-white/60 backdrop-blur-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_4px_6px_-2px_rgba(0,0,0,0.05)]" role="banner" aria-label="Barra de navegación principal">
        <div className="w-full h-16 px-4 sm:px-6 xl:px-12 flex items-center justify-between" role="navigation" aria-label="Navegación principal">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 px-1 py-1 transition-all group" aria-label="Ir al inicio">
              <div className="group-hover:scale-110 transition-all duration-500 bg-white p-2 rounded-xl shadow-lg shadow-zinc-100 ring-1 ring-zinc-50 translate-y-0 group-hover:-translate-y-0.5">
                <AppLogoIcon className="h-7 w-7" />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-2xl font-black tracking-tighter text-zinc-900 leading-none italic italic-title">
                  Med-<span className="text-amber-500 lowercase mr-[0.05em]">i</span>Track
                </h1>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-1">Intelligence Hub</span>
              </div>
            </Link>

          {user && currentProfile && (
            (() => {
              const allModules = [
                {
                  href: "/imaging",
                  icon: <ModalityIcon style={{ width: 22, height: 22, color: 'inherit' }} />,
                  color: "text-amber-950 bg-amber-400 hover:bg-amber-500 shadow-amber-100 border-amber-300/20",
                  label: "Imágenes",
                  active: pathname?.startsWith("/imaging")
                },
                {
                  href: "/remissions",
                  icon: <FileSpreadsheet className="h-5 w-5" />,
                  color: "text-white bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 border-emerald-500/20",
                  label: "Remisiones",
                  active: pathname?.startsWith("/remissions")
                },
                {
                  href: "/consultations",
                  icon: <Stethoscope className="h-5 w-5" />,
                  color: "text-white bg-indigo-500 hover:bg-indigo-600 shadow-indigo-100 border-indigo-400/20",
                  label: "Consultas",
                  active: pathname?.startsWith("/consultations")
                },
                {
                  href: "/inventory",
                  icon: <Package className="h-5 w-5" />,
                  color: "text-white bg-zinc-600 hover:bg-zinc-700 shadow-zinc-100 border-zinc-400/20",
                  label: "Inventario",
                  active: pathname?.startsWith("/inventory")
                },
              ];

              const currentModule = allModules.find(m => m.active);
              const otherModules = allModules.filter(m => !m.active && m.href !== "/inventory");

              return (
                <>
                  {currentModule && (
                    <div 
                      onClick={() => window.location.reload()}
                      className={cn(
                        "hidden md:flex items-center gap-2 h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95 border",
                        currentModule.color
                      )}
                      title="Refrescar módulo"
                    >
                      {currentModule.icon}
                      <span>{currentModule.label}</span>
                    </div>
                  )}
                  
                  {!currentModule && (
                    <div className="hidden md:flex items-center gap-2 h-10 px-5 bg-zinc-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg">
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      Panel Principal
                    </div>
                  )}
                </>
              );
            })()
          )}
          </div>
          
          {user && currentProfile && (
            <div className="flex items-center gap-3">
              {/* Navegación - Módulos principales */}
              {currentProfile?.rol === 'administrador' && (
                (() => {
                  const inactiveModules = [
                    {
                      href: "/imaging",
                      icon: <ModalityIcon style={{ width: 22, height: 22, color: 'inherit' }} />,
                      color: "text-amber-950 bg-amber-400 hover:bg-amber-500 shadow-amber-100 border-amber-300/20",
                      label: "Imágenes",
                      show: pathname ? !pathname.startsWith("/imaging") : true,
                    },
                    {
                      href: "/remissions",
                      icon: <FileSpreadsheet className="h-5 w-5" />,
                      color: "text-white bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 border-emerald-500/20",
                      label: "Remisiones",
                      show: pathname ? !pathname.startsWith("/remissions") : true,
                    },
                    {
                      href: "/consultations",
                      icon: <Stethoscope className="h-5 w-5" />,
                      color: "text-white bg-indigo-500 hover:bg-indigo-600 shadow-indigo-100 border-indigo-400/20",
                      label: "Consultas",
                      show: pathname ? !pathname.startsWith("/consultations") : true,
                    },
                  ];
                  return (
                    <div className="flex items-center gap-2 bg-white/40 p-1 rounded-2xl border border-zinc-200 shadow-sm backdrop-blur-xl">
                      {inactiveModules.filter(m => m.show).map(m => (
                        <Button
                          key={m.href}
                          variant="ghost"
                          className={cn(
                            "h-10 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95 border",
                            m.color
                          )}
                          asChild
                        >
                          <Link href={m.href} aria-label={m.label} className="flex items-center gap-2">
                            {m.icon}
                            <span className="hidden lg:inline">{m.label}</span>
                          </Link>
                        </Button>
                      ))}
                    </div>
                  );
                })()
              )}


              {/* Herramientas y Operacionales */}
              <div className="flex items-center gap-2 bg-zinc-100/30 p-1.5 rounded-full border border-zinc-200/50 shadow-inner backdrop-blur-md ml-1">
                {currentProfile?.rol === 'administrador' && <HeaderContrastIndicator />}
                
                {isTechnologist && (
                  <Button 
                    className="h-10 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-[10px] uppercase tracking-widest rounded-full shadow-lg shadow-amber-200/40 border-none transition-all hover:-translate-y-0.5 active:scale-95"
                    onClick={() => setIsShiftHandoverOpen(true)}
                    title="Registrar entrega de turno de equipos"
                  >
                    <LogOutIcon className="h-4 w-4 mr-2" />
                    Entregar Turno
                  </Button>
                )}
                
                {hasTutorial && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors" onClick={() => setIsHelpOpen(true)} title="Ayuda">
                      <LifeBuoy className="h-5 w-5" />
                  </Button>
                )}

                {(isTechnologist || canChangeOperator || userProfile?.rol === 'administrador') && (
                    <ShiftRequestsMenu />
                )}

                {(isTechnologist || canChangeOperator || ['administrador', 'enfermero', 'admisionista'].includes(currentProfile?.rol)) && (
                    <AdverseEventReporter onQualityReport={() => setIsQualityDialogOpen(true)} currentProfile={currentProfile} />
                )}
              </div>
              
              <div className="h-10 w-[2px] bg-zinc-200/30 mx-2" />

              <div className="flex items-center gap-2">
                 {userProfile?.rol === 'administrador' && (
                  <button onClick={() => setIsImpersonationDialogOpen(true)} className="hover:text-primary transition-colors" aria-label="Impersonar usuario">
                    <Eye className="h-5 w-5" />
                  </button>
                )}
                 {isImpersonating && (
                  <Button onClick={stopImpersonating} variant="destructive" size="sm" className="h-auto px-2 py-1 text-xs" aria-label="Salir de impersonación">
                    <LogOut className="mr-1 h-3 w-3" />
                    Salir
                  </Button>
                )}

                {shouldShowOperatorView && (
                  <button 
                    className="text-right text-sm disabled:cursor-not-allowed"
                    onClick={() => canChangeOperator && setIsAssignRadiologistOpen(true)}
                    disabled={!canChangeOperator || loadingAssignment}
                    aria-label="Cambiar operador activo"
                  >
                    <div className="font-bold">{selectedOperator}</div>
                    <div className="text-xs text-muted-foreground">Operando como {currentProfile.operadorActivo}</div>
                  </button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button aria-label="Abrir menú de usuario" className="hover:scale-105 transition-transform appearance-none rounded-full ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white shadow-xl ml-2 active:scale-95">
                      <Avatar className="h-11 w-11 shadow-sm">
                        {currentProfile.rol === 'administrador' ? (
                          <AvatarImage src="/avatar-admin.png" alt="Avatar de administrador" />
                        ) : (
                          <AvatarFallback className="font-bold text-muted-foreground" aria-label={`Avatar de ${currentProfile.nombre}`}>
                            {getInitials(currentProfile.nombre)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{currentProfile.nombre}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {currentProfile.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/profile">
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                       <div className="w-full">
                          <MessagingDrawer />
                       </div>
                    </DropdownMenuItem>

                    {userProfile?.rol === 'administrador' && (
                      <>
                        <DropdownMenuSub>
                           <DropdownMenuSubTrigger>
                                <HardDrive className="mr-2 h-4 w-4" />
                                <span>Administración</span>
                           </DropdownMenuSubTrigger>
                           <DropdownMenuPortal>
                               <DropdownMenuSubContent>
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href="/signup">
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            <span>Crear Usuario</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href="/users">
                                            <Users className="mr-2 h-4 w-4" />
                                            <span>Gestionar Usuarios</span>
                                        </Link>
                                    </DropdownMenuItem>
                                     <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href="/specialists">
                                            <Stethoscope className="mr-2 h-4 w-4" />
                                            <span>Gestionar Especialistas</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href="/inventory">
                                            <Package className="mr-2 h-4 w-4" />
                                            <span>Inventario General</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                      <Link href="/staff/shifts">
                                        <CalendarClock className="mr-2 h-4 w-4" />
                                        <span>Turnos Tecnólogos</span>
                                      </Link>
                                    </DropdownMenuItem>
                                     <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href="/statistics">
                                            <FileBarChart className="mr-2 h-4 w-4" />
                                            <span>Estadísticas</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href="/clinical-assistant-view">
                                            <Briefcase className="mr-2 h-4 w-4" />
                                            <span>Vista Aux. Clínica</span>
                                        </Link>
                                    </DropdownMenuItem>
                                     <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href="/turnero" target="_blank">
                                            <Tv className="mr-2 h-4 w-4" />
                                            <span>Turnero</span>
                                        </Link>
                                    </DropdownMenuItem>
                               </DropdownMenuSubContent>
                           </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/quality-reports">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            <span>Reportes de Calidad</span>
                          </Link>
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)} className="cursor-pointer">
                          <Download className="mr-2 h-4 w-4" />
                          <span>Exportar Datos</span>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </header>
      <ExportDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen} />
      {currentProfile && <HelpTutorialDialog open={isHelpOpen} onOpenChange={setIsHelpOpen} role={currentProfile.rol} />}
      <ImpersonationDialog open={isImpersonationDialogOpen} onOpenChange={setIsImpersonationDialogOpen} />
      {currentProfile && (
        <AssignOperatorDialog
            open={isAssignRadiologistOpen}
            onOpenChange={setIsAssignRadiologistOpen}
            title="Asignar Radiólogo de Turno"
            description="Seleccione el radiólogo que estará a cargo de las ecografías."
            operators={currentProfile.operadores || []}
            onAssign={handleAssignOperator}
         />
      )}
      {currentProfile && (
        <QualityReportDialog
          open={isQualityDialogOpen}
          onOpenChange={setIsQualityDialogOpen}
          userProfile={currentProfile}
        />
      )}
      {currentProfile && (
        <ShiftHandoverDialog
          open={isShiftHandoverOpen}
          onOpenChange={setIsShiftHandoverOpen}
          userProfile={currentProfile}
        />
      )}
    </>
  );
}
