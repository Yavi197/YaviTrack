
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StudyWithCompletedBy } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { getAgeFromBirthDate } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, User, Fingerprint, CalendarDays, Building, Plus, FilePlus } from 'lucide-react';
import Link from 'next/link';
import { StudyTable } from '@/components/app/study-table';
import { Skeleton } from '@/components/ui/skeleton';

export default function PatientProfilePage() {
    const params = useParams();
    const patientId = params.patientId as string;
    const router = useRouter();
    const { user, loading: authLoading, userProfile } = useAuth();
    
    const [studies, setStudies] = useState<StudyWithCompletedBy[]>([]);
    const [patientData, setPatientData] = useState<StudyWithCompletedBy['patient'] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        if (patientId) {
            const fetchPatientStudies = async () => {
                setLoading(true);
                const q = query(
                    collection(db, 'studies'),
                    where('patient.id', '==', patientId),
                    orderBy('requestDate', 'desc')
                );
                
                try {
                    const querySnapshot = await getDocs(q);
                    const studiesData: StudyWithCompletedBy[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyWithCompletedBy));
                    
                    setStudies(studiesData);

                    if (studiesData.length > 0) {
                        setPatientData(studiesData[0].patient);
                    }
                } catch (error) {
                    console.error("Error fetching patient studies:", error);
                } finally {
                    setLoading(false);
                }
            };

            fetchPatientStudies();
        }
    }, [patientId, user, authLoading, router]);

    if (loading || authLoading) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <Skeleton className="h-8 w-40" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-10 w-1/3" />
                        <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (!patientData) {
         return (
            <div className="container mx-auto py-6 text-center">
                <h2 className="text-2xl font-bold">Paciente no encontrado</h2>
                <p className="text-muted-foreground">No se encontraron estudios para el ID: {patientId}</p>
                <Button asChild variant="outline" className="mt-4">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Dashboard
                    </Link>
                </Button>
            </div>
         )
    }

    const age = getAgeFromBirthDate(patientData.birthDate);

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Button asChild variant="outline" size="sm">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Dashboard
                </Link>
            </Button>
            
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="font-headline text-3xl">{patientData.fullName}</CardTitle>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground pt-2">
                            <span className="flex items-center gap-2"><Fingerprint className="h-4 w-4" /> {patientData.idType} {patientData.id}</span>
                            {patientData.birthDate && <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {patientData.birthDate}</span>}
                            {age !== null && <span className="font-bold">{age} años</span>}
                            <span className="flex items-center gap-2"><Building className="h-4 w-4" /> {patientData.entidad}</span>
                        </div>
                    </div>
                    <Button variant="outline" disabled>
                        <FilePlus className="mr-2 h-4 w-4"/>
                        Agregar Antecedentes
                    </Button>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Historial de Solicitudes</CardTitle>
                        <CardDescription>Todos los estudios e interconsultas del paciente.</CardDescription>
                    </div>
                    <Button disabled><Plus className="mr-2 h-4 w-4"/> Nueva Solicitud</Button>
                </CardHeader>
                <CardContent>
                    <StudyTable 
                        studies={studies}
                        userProfile={userProfile}
                        isSummaryVisible={false}
                        // Pass empty/noop functions for props that are not needed here
                        dateRange={undefined}
                        setDateRange={() => {}}
                        activeStatusFilters={[]}
                        setActiveStatusFilters={() => {}}
                        searchTerm=""
                        setSearchTerm={() => {}}
                        onSearch={() => {}}
                        onClearSearch={() => {}}
                        isSearching={false}
                        isSearchActive={false}
                        setIsSummaryVisible={() => {}}
                        onEditStudy={() => {}}
                        hasMore={false}
                        onLoadMore={() => {}}
                        isLoadingMore={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
