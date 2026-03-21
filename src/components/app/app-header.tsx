
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
import { LogOut, User as UserIcon, UserPlus, Download, Users, LifeBuoy, Package, Beaker, ShieldPlus, FileText, FileBarChart, HardDrive, DollarSign, Eye, Tv, VolumeX, Loader2, Stethoscope, Briefcase, FileSpreadsheet, MessageSquare, LogOutIcon, CalendarClock, AlertTriangle } from "lucide-react";
import { ModalityIcon } from "@/components/icons/modality-icon";
import Link from 'next/link';
import { AppLogoIcon } from "@/components/icons/app-logo-icon";
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
import { ShiftHandoverDialog } from "./shift-handover-dialog";
import { QualityReportDialog } from "./quality-report-dialog";

function HeaderContrastIndicator() {
    const { inventoryItems, inventoryLoading: authInventoryLoading } = useAuth();
    const [isContrastDialogOpen, setIsContrastDialogOpen] = useState(false);
    const [rawTotalMl, setRawTotalMl] = useState(0);
    const [offsetMl, setOffsetMl] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authInventoryLoading) return;

        const contrastItems = inventoryItems.filter(item => item.isContrast);
        if (contrastItems.length === 0) {
            setRawTotalMl(0);
            setLoading(false);
            return;
        }

        const contrastItemIds = contrastItems.map(item => item.id);
        const itemsMap = new Map(contrastItems.map(item => [item.id, item]));

        const entriesQuery = query(
            collection(db, 'inventoryEntries'),
            where('itemId', 'in', contrastItemIds)
        );

        const consumptionsQuery = query(
            collection(db, 'inventoryConsumptions'),
            where('itemId', 'in', contrastItemIds)
        );

        const unsubEntries = onSnapshot(entriesQuery, (entrySnapshot) => {
            const unsubConsumptions = onSnapshot(consumptionsQuery, (consumptionSnapshot) => {
                let currentTotalMl = 0;
                entrySnapshot.forEach(doc => {
                    const entry = doc.data() as InventoryStockEntry;
                    const itemDetails = itemsMap.get(entry.itemId);
                    if (itemDetails) {
                        currentTotalMl += entry.amountAdded * itemDetails.content;
                    }
                });

                consumptionSnapshot.forEach(doc => {
                    const consumption = doc.data() as InventoryConsumption;
                    currentTotalMl -= consumption.amountConsumed;
                });
                
                setRawTotalMl(currentTotalMl);
                setLoading(false);
            });
            return () => unsubConsumptions();
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error("Error fetching contrast entries for header:", error);
            }
            setLoading(false);
        });

        return () => unsubEntries();

    }, [inventoryItems, authInventoryLoading]);

      useEffect(() => {
        const metaRef = doc(db, 'inventorySettings', 'contrastStock');
        const unsubscribe = onSnapshot(metaRef, (snapshot) => {
          const data = snapshot.data();
          setOffsetMl(typeof data?.offsetMl === 'number' ? data.offsetMl : 0);
        });
        return () => unsubscribe();
      }, []);

      const netTotalMl = rawTotalMl - offsetMl;

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


function AdverseEventReporter({ onQualityReport }: { onQualityReport: () => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="destructive" size="icon" className="h-10 w-10 rounded-full bg-red-600 text-white shadow-lg shadow-red-200 hover:-translate-y-0.5 hover:bg-red-700 transition-all border-none group">
                    <ShieldPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="sr-only">Reportar Evento Adverso o Novedad</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Seguridad y Calidad</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onQualityReport} className="cursor-pointer">
                    <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                    <span className="font-semibold">Reportar Novedad / Sugerencia</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                    <a href="https://docs.google.com/forms/d/1l-Pi7tMeUa9cfjIcBoZo5sFlkglutOKuxLKYQyM5azU/viewform?edit_requested=true" target="_blank" rel="noopener noreferrer">
                        <FileBarChart className="mr-2 h-4 w-4" />
                        <span>Evento Adverso (Formulario)</span>
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                    <a href="/docs/formato_farmacovigilancia.docx" download>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Fármacovigilancia (Documento)</span>
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
      <header className="theme-yellow sticky top-0 z-40 w-full border-b border-zinc-200/50 bg-white/70 backdrop-blur-3xl shadow-sm" role="banner" aria-label="Barra de navegación principal">
        <div className="w-full h-20 px-4 sm:px-6 xl:px-10 flex items-center justify-between" role="navigation" aria-label="Navegación principal">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 px-1 py-1 transition-all group" aria-label="Ir al inicio">
              <div className="group-hover:scale-105 transition-transform">
                <AppLogoIcon className="h-7 w-7" />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black font-headline tracking-tighter text-zinc-900 leading-none">Med-iTrack</h1>
              </div>
            </Link>
          </div>
          
          {user && currentProfile && (
            <div className="flex items-center gap-2">
              {/* Navegación - Módulos principales (solo muestra los otros dos) */}
              {currentProfile?.rol === 'administrador' && (
                (() => {
                  const buttons = [
                    {
                      href: "/remissions",
                      icon: <FileSpreadsheet className="h-5 w-5" />,
                      color: "bg-emerald-400 hover:bg-emerald-500",
                      label: "Abrir Remisiones",
                      show: pathname ? !pathname.startsWith("/remissions") : true,
                    },
                    {
                      href: "/imaging",
                      icon: <ModalityIcon style={{ width: 20, height: 20, color: '#000' }} />,
                      color: "bg-yellow-400 hover:bg-yellow-500",
                      label: "Abrir Imágenes",
                      show: pathname ? !pathname.startsWith("/imaging") : true,
                    },
                    {
                      href: "/consultations",
                      icon: <Stethoscope className="h-5 w-5" />,
                      color: "bg-blue-400 hover:bg-blue-500",
                      label: "Abrir Consultas",
                      show: pathname ? !pathname.startsWith("/consultations") : true,
                    },
                  ];
                  return (
                    <div className="flex items-center gap-1.5 bg-zinc-50/80 p-1.5 rounded-full border border-zinc-200 shadow-sm">
                      {buttons.filter(b => b.show).map(b => (
                        <Button
                          key={b.href}
                          variant="ghost"
                          size="icon"
                          className={`h-9 w-9 rounded-full text-zinc-950 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${b.color}`}
                          asChild
                        >
                          <Link href={b.href} aria-label={b.label}>
                            {b.icon}
                            <span className="sr-only">{b.label}</span>
                          </Link>
                        </Button>
                      ))}
                    </div>
                  );
                })()
              )}

              {/* Herramientas y Operacionales */}
              <div className="flex items-center gap-2 bg-zinc-50/80 p-1.5 rounded-full border-2 border-zinc-100 shadow-sm ml-2">
                {currentProfile?.rol === 'administrador' && <HeaderContrastIndicator />}
                
                {isTechnologist && (
                  <Button 
                    style={{ backgroundColor: '#FFD600', color: '#222', fontWeight: 'bold' }}
                    className="gap-2 border-none shadow-sm"
                    onClick={() => setIsShiftHandoverOpen(true)}
                    title="Registrar entrega de turno de equipos"
                  >
                    <LogOutIcon className="h-4 w-4" />
                    Entregar Turno
                  </Button>
                )}
                
                {hasTutorial && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsHelpOpen(true)} title="Ayuda">
                      <LifeBuoy className="h-5 w-5" />
                  </Button>
                )}

                <AdverseEventReporter onQualityReport={() => setIsQualityDialogOpen(true)} />
              </div>
              
              <Separator orientation="vertical" className="h-8" />

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
