
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study, GeneralService } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Bed, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ModalityIcon } from '@/components/icons/modality-icon';

type PendingStudiesByService = {
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


export default function ClinicalAssistantViewPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pendingStudies, setPendingStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);

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
    
    const studiesQuery = query(
      collection(db, "studies"), 
      where('status', '==', 'Pendiente'),
      where('service', 'in', ['URG', 'HOSP', 'UCI']),
      orderBy('service'),
      orderBy('requestDate', 'asc')
    );

    const unsubscribe = onSnapshot(studiesQuery, (snapshot) => {
      const allPendingStudies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Study));
      setPendingStudies(allPendingStudies);
      setLoading(false);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error("Error fetching clinical assistant studies:", error);
        }
        setLoading(false);
    });
    
    return () => unsubscribe();
  }, [userProfile]);

  const groupedStudies = useMemo<PendingStudiesByService[]>(() => {
    if (pendingStudies.length === 0) return [];

    const serviceMap: Record<string, Study[]> = {
      "URG": [], "HOSP": [], "UCI": []
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
  
  if (authLoading || loading) {
    return (
      <div className="container mx-auto py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando estudios intrahospitalarios...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">Pendientes Intrahospitalarios</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-2">
          Vista de todos los estudios de imagen pendientes en Urgencias, Hospitalización y UCI.
        </p>
      </div>

      {groupedStudies.length === 0 ? (
        <Card className="text-center py-20 bg-muted/50">
          <CardHeader>
            <CardTitle className="font-headline text-3xl">¡Sin pendientes!</CardTitle>
            <CardDescription className="text-lg">No hay estudios intrahospitalarios pendientes en este momento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {groupedStudies.map(({ service, count, studies }) => (
            <Card key={service} className="flex flex-col rounded-[2rem] border-none shadow-2xl bg-white/50 backdrop-blur-xl overflow-hidden">
              <CardHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 bg-white/50 border-b border-zinc-100/50">
                  <CardTitle className="font-black text-2xl tracking-tighter uppercase text-zinc-900">{serviceDisplayNames[service]}</CardTitle>
                  <Badge className="text-lg px-4 py-1 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 border-none font-black">{count}</Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 p-6">
                {studies.map(study => (
                  <div key={study.id} className="relative text-left p-6 border-2 border-transparent rounded-[1.5rem] bg-zinc-900 text-white transition-all overflow-hidden block w-full">
                    <div className="flex items-start justify-between mb-4 relative z-0">
                      <div>
                          <p className="font-black text-2xl tracking-tight leading-none mb-1 text-white">{study.patient.fullName}</p>
                          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{study.patient.idType} {study.patient.id}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-red-500/20 text-red-500 border border-red-500/30">
                        <ModalityIcon className="h-6 w-6" />
                      </div>
                    </div>
                    <Separator className="my-4 bg-white/10"/>
                    <div className="text-xs font-bold text-zinc-300 space-y-2 uppercase tracking-wide relative z-0">
                      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                        <Badge variant="secondary" className="bg-transparent text-white border-white/20 p-0 hover:bg-transparent mr-2 font-black tracking-widest">{study.studies[0]?.modality}</Badge>
                        <span>Estudio: <span className="font-black text-white">{study.studies[0]?.nombre}</span></span>
                      </div>
                       <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                        <Bed className="h-4 w-4 text-orange-400" />
                        <span>Ubicación: <span className="font-black text-white">{study.subService}{study.bedNumber && ` - Cama ${study.bedNumber}`}</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
