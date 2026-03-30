"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study, GeneralService } from '@/lib/types';
import { Loader2, Bed, Stethoscope, Clock } from 'lucide-react';
import { ModalityIcon } from '@/components/icons/modality-icon';
import { cn } from '@/lib/utils';

type PendingStudiesByService = { service: GeneralService; count: number; studies: Study[]; };

const serviceConfig: Record<GeneralService, { label: string; color: string; dot: string; bg: string }> = {
  "URG":   { label: "Urgencias",        color: "text-red-600",    dot: "bg-red-500",    bg: "bg-red-50 border-red-200" },
  "HOSP":  { label: "Hospitalización",  color: "text-blue-600",   dot: "bg-blue-500",   bg: "bg-blue-50 border-blue-200" },
  "UCI":   { label: "UCI",              color: "text-purple-600", dot: "bg-purple-500", bg: "bg-purple-50 border-purple-200" },
  "C.EXT": { label: "Consulta Externa", color: "text-emerald-600",dot: "bg-emerald-500",bg: "bg-emerald-50 border-emerald-200" },
};

export default function ClinicalAssistantViewPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pendingStudies, setPendingStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !userProfile) router.push('/login');
  }, [userProfile, authLoading, router]);

  useEffect(() => {
    if (!userProfile) { setPendingStudies([]); setLoading(false); return; }
    setLoading(true);
    const studiesQuery = query(
      collection(db, "studies"),
      where('status', '==', 'Pendiente'),
      where('service', 'in', ['URG', 'HOSP', 'UCI']),
      orderBy('service'),
      orderBy('requestDate', 'asc')
    );
    const unsub = onSnapshot(studiesQuery, (snap) => {
      setPendingStudies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Study)));
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [userProfile]);

  const groupedStudies = useMemo<PendingStudiesByService[]>(() => {
    const serviceMap: Record<string, Study[]> = { "URG": [], "HOSP": [], "UCI": [] };
    pendingStudies.forEach(study => {
      if (serviceMap[study.service]) serviceMap[study.service].push(study);
    });
    return Object.entries(serviceMap)
      .map(([service, studies]) => ({ service: service as GeneralService, count: studies.length, studies }))
      .filter(g => g.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [pendingStudies]);

  if (authLoading || loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
        <p className="text-xs font-medium text-zinc-400">Cargando estudios intrahospitalarios...</p>
      </div>
    );
  }

  const totalPending = pendingStudies.length;

  return (
    <div className="py-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-red-100 rounded-lg"><Stethoscope className="h-4 w-4 text-red-600" /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Vista Auxiliar Clínica</span>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Pendientes Intrahospitalarios</h1>
          <p className="text-zinc-500 font-medium mt-1">Urgencias · Hospitalización · UCI — Tiempo real</p>
        </div>

        {totalPending > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl">
            <Clock className="h-4 w-4" />
            <p className="text-sm font-black">{totalPending} pendiente{totalPending !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {groupedStudies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-zinc-100 rounded-3xl text-center shadow-sm">
          <div className="p-5 bg-emerald-50 rounded-2xl mb-5">
            <Stethoscope className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900">¡Sin pendientes!</h2>
          <p className="text-zinc-400 font-medium mt-2">No hay estudios intrahospitalarios pendientes en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {groupedStudies.map(({ service, count, studies }) => {
            const config = serviceConfig[service];
            return (
              <div key={service} className="bg-white border border-zinc-100 rounded-3xl shadow-sm overflow-hidden">
                {/* Service Header */}
                <div className="px-6 pt-6 pb-4 border-b border-zinc-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
                      <h2 className={cn("font-black text-lg tracking-tight", config.color)}>{config.label}</h2>
                    </div>
                    <span className={cn("px-3 py-1 rounded-full text-xs font-black border", config.bg, config.color)}>
                      {count} pend.
                    </span>
                  </div>
                </div>

                {/* Studies */}
                <div className="p-4 space-y-3">
                  {studies.map(study => (
                    <div key={study.id} className="bg-zinc-900 rounded-2xl p-5 text-white">
                      {/* Patient */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="font-black text-xl leading-tight text-white">{study.patient.fullName}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">
                            {study.patient.idType} · {study.patient.id}
                          </p>
                        </div>
                        <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/20 shrink-0">
                          <ModalityIcon className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="h-px bg-white/10 mb-4" />

                      {/* Study details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
                          <ModalityIcon className="h-4 w-4 text-zinc-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Estudio</span>
                            <span className="text-xs font-bold text-white truncate block">{study.studies[0]?.nombre}</span>
                          </div>
                          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-zinc-500 shrink-0 border border-zinc-700 rounded-full px-2 py-0.5">
                            {study.studies[0]?.modality}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
                          <Bed className="h-4 w-4 text-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Ubicación</span>
                            <span className="text-xs font-bold text-white">
                              {study.subService}{study.bedNumber && ` · Cama ${study.bedNumber}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
