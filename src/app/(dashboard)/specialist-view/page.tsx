
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study, GeneralService } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ALL_CONSULTATIONS } from '@/lib/consultations-data';
import { updateStudyStatusAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, User, MapPin, Stethoscope, Briefcase, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type PendingConsultationsByService = {
  service: GeneralService;
  count: number;
  studies: Study[];
};

const serviceDisplayNames: Record<GeneralService, string> = {
  "URG": "Urgencias",
  "HOSP": "Hospitalización",
  "UCI": "Unidad de Cuidados Intensivos",
  "C.EXT": "Consulta Externa",
};

const uniqueSpecialties = new Set(ALL_CONSULTATIONS.map(c => c.especialidad));

export default function SpecialistViewPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [pendingStudies, setPendingStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const normalizeString = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : '';

  useEffect(() => {
    if (!authLoading && !userProfile) {
      router.push('/login');
    }
  }, [userProfile, authLoading, router]);

  useEffect(() => {
    if (!userProfile) {
        setPendingStudies([]);
        setLoading(false);
        return;
    }

    setLoading(true);
    const normalizedSpecialty = normalizeString(userProfile.servicioAsignado);
    
    const studiesQuery = query(
      collection(db, "studies"), 
      where('status', '==', 'Pendiente'),
      orderBy('requestDate', 'asc')
    );

    const unsubscribe = onSnapshot(studiesQuery, (snapshot) => {
      const allPendingStudies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Study));
      
      let relevantStudies;
      if (userProfile.rol === 'administrador') {
          // Admin sees all consultations
          relevantStudies = allPendingStudies.filter(study => {
              const modality = study.studies[0]?.modality;
              return modality && uniqueSpecialties.has(modality);
          });
      } else {
          // Specialists see only their assigned specialty
          relevantStudies = allPendingStudies.filter(study => {
              const modality = study.studies[0]?.modality;
              return modality && uniqueSpecialties.has(modality) && normalizeString(modality) === normalizedSpecialty;
          });
      }

      setPendingStudies(relevantStudies);
      setLoading(false);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error("Error fetching specialist studies:", error);
        }
        setLoading(false);
    });
    
    return () => unsubscribe();
  }, [userProfile]);

  const groupedStudies = useMemo<PendingConsultationsByService[]>(() => {
    if (pendingStudies.length === 0) return [];

    const serviceMap: Record<string, Study[]> = {
      "URG": [], "HOSP": [], "UCI": [], "C.EXT": []
    };

    pendingStudies.forEach(study => {
      if (serviceMap[study.service]) {
        serviceMap[study.service].push(study);
      }
    });

    return Object.entries(serviceMap)
      .map(([service, studies]) => ({
        service: service as GeneralService,
        count: studies.length,
        studies: studies,
      }))
      .filter(group => group.count > 0)
      .sort((a, b) => b.count - a.count);

  }, [pendingStudies]);
  
  const handleComplete = async (studyId: string) => {
    if (!userProfile) return;
    setUpdatingId(studyId);
    const result = await updateStudyStatusAction(studyId, 'Completado', userProfile, undefined, userProfile.nombre);
    if (result.success) {
      toast({
        title: "Interconsulta Completada",
        description: "El estudio ha sido marcado como completado.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "No se pudo completar la interconsulta.",
      });
    }
    setUpdatingId(null);
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando interconsultas...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">Interconsultas Pendientes</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-2">
          {userProfile?.rol === 'administrador' 
              ? 'Vista global de todas las interconsultas pendientes por servicio.' 
              : `Resumen de las solicitudes asignadas para ${userProfile?.servicioAsignado}.`
          }
        </p>
      </div>

      {groupedStudies.length === 0 ? (
        <Card className="text-center py-20 bg-muted/50">
          <CardHeader>
            <CardTitle className="font-headline text-3xl">¡Todo al día!</CardTitle>
            <CardDescription className="text-lg">No hay interconsultas pendientes en este momento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/consultations">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {groupedStudies.map(({ service, count, studies }) => (
            <Card key={service} className="flex flex-col rounded-[2rem] border-none shadow-2xl bg-white/50 backdrop-blur-xl overflow-hidden">
              <CardHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 bg-white/50 border-b border-zinc-100/50">
                  <CardTitle className="font-black text-2xl tracking-tighter uppercase text-zinc-900">{serviceDisplayNames[service]}</CardTitle>
                  <Badge className="text-lg px-4 py-1 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 border-none font-black">{count}</Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 p-6">
                {studies.map(study => (
                    <AlertDialog key={study.id}>
                        <AlertDialogTrigger asChild>
                             <button className="relative text-left p-6 border-2 border-transparent rounded-[1.5rem] bg-zinc-900 text-white transition-all group hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl focus:outline-none overflow-hidden block w-full">
                                {updatingId === study.id ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-[1.5rem] backdrop-blur-sm z-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                    </div>
                                ) : (
                                   <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 rounded-[1.5rem] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                       <CheckCircle className="h-12 w-12 text-white/50"/>
                                   </div>
                                )}
                                <div className="flex items-start justify-between mb-4 relative z-0">
                                    <div>
                                        <p className="font-black text-2xl tracking-tight leading-none mb-1 text-white">{study.patient.fullName}</p>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{study.patient.idType} {study.patient.id}</p>
                                    </div>
                                    <Badge variant="secondary" className="uppercase bg-white/10 text-white border-none font-black text-xs tracking-widest">{study.studies[0]?.modality}</Badge>
                                </div>
                                <Separator className="my-4 bg-white/10"/>
                                <div className="text-xs font-bold text-zinc-300 space-y-2 uppercase tracking-wide relative z-0">
                                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                    <MapPin className="h-4 w-4 text-orange-400" />
                                    <span>Ubicación: <span className="font-black text-white">{study.subService}{study.bedNumber && ` - Cama ${study.bedNumber}`}</span></span>
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                    <Stethoscope className="h-4 w-4 text-emerald-400" />
                                    <span>Diagnóstico: <span className="font-black text-white">{study.diagnosis.description}</span></span>
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                    <Briefcase className="h-4 w-4 text-blue-400" />
                                    <span>Entidad: <span className="font-black text-white">{study.patient.entidad}</span></span>
                                </div>
                                </div>
                            </button>
                        </AlertDialogTrigger>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Marcar esta interconsulta como completada?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción cambiará el estado del estudio a &quot;Completado&quot; y lo moverá fuera de la lista de pendientes. No se puede deshacer fácilmente.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleComplete(study.id)}>Confirmar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
