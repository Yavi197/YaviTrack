
'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { generateReportFromTemplateAction } from '@/app/actions';
import type { StudyWithCompletedBy } from '@/lib/types';
import { ReportTemplate } from '@/app/documents/templates/report-template';

type LoadedReportData = {
    study: StudyWithCompletedBy;
    reportText: string;
    radiologist: { name: string; specialty: string; register: string; };
};

// This is a client component responsible for fetching data and handling user interaction (printing)
function ReportPageClient({ studyId }: { studyId: string }) {
    const [data, setData] = useState<LoadedReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (studyId) {
            generateReportFromTemplateAction(studyId)
                .then(result => {
                    if (result.success && result.data) {
                        const rawStudy = result.data.study;
                        
                        // Robust date parsing function that handles different formats
                        const parseDate = (dateValue: string | null | undefined): Date | null => {
                            if (!dateValue) return null;

                            // First, try direct parsing (for ISO strings from server)
                            const isoDate = new Date(dateValue);
                            if (!isNaN(isoDate.getTime())) {
                                return isoDate;
                            }

                            // If direct parsing fails, try DD/MM/YYYY format
                            const parts = dateValue.split(/[/ -]/);
                            if (parts.length === 3) {
                                const day = parseInt(parts[0], 10);
                                const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
                                const year = parseInt(parts[2], 10);
                                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                                    const manualDate = new Date(year, month, day);
                                    if (!isNaN(manualDate.getTime())) {
                                        return manualDate;
                                    }
                                }
                            }
                            return null; // Return null if all parsing fails
                        };
                        
                        const studyData: StudyWithCompletedBy = {
                            ...rawStudy,
                            patient: {
                                ...rawStudy.patient,
                                birthDate: parseDate(rawStudy.patient.birthDate) as any,
                            },
                            requestDate: parseDate(rawStudy.requestDate as any),
                            completionDate: parseDate(rawStudy.completionDate as any),
                            readingDate: parseDate(rawStudy.readingDate as any),
                            orderDate: parseDate(rawStudy.orderDate as any),
                        } as StudyWithCompletedBy;


                        setData({
                            study: studyData,
                            reportText: result.data.reportText,
                            radiologist: result.data.radiologist,
                        });
                        
                        // Set document title for PDF saving
                        const patientName = (studyData.patient.fullName || 'paciente').toUpperCase().replace(/ /g, '_');
                        const patientIdNum = studyData.patient.id || 'ID';
                        document.title = `${patientName}_${patientIdNum}_INFORME`;
                    } else {
                        setError(result.error || 'No se pudo generar el informe.');
                    }
                })
                .catch(err => {
                    console.error("Error fetching report data:", err);
                    setError('Ocurrió un error inesperado al cargar los datos.');
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [studyId]);

    if (loading) {
        return (
            <div className="p-8 bg-white text-black min-h-screen">
                <div className="w-[8.5in] mx-auto space-y-6">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-5/6" />
                        <Skeleton className="h-96 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
             <div className="p-8 bg-white text-black min-h-screen text-center">
                <h2 className="text-xl font-bold text-destructive">Error al Cargar el Informe</h2>
                <p>{error || 'No se encontraron datos para este estudio.'}</p>
            </div>
        )
    }

    return (
        <div className="bg-gray-100 print:bg-white py-8">
            <main>
                <ReportTemplate 
                    study={data.study} 
                    reportText={data.reportText} 
                    radiologist={data.radiologist} 
                />
            </main>
            <div className="fixed bottom-5 right-5 print:hidden">
                <Button onClick={() => window.print()} size="lg" className="rounded-full shadow-lg">
                    <Printer className="mr-2 h-5 w-5" />
                    Imprimir o Guardar PDF
                </Button>
            </div>
        </div>
    );
}


// This is the main page component, which is a Server Component
export default function GeneratedReportPage() {
    const params = useParams();
    const studyId = params.studyId as string;

    if (!studyId) {
        notFound();
    }

    return <ReportPageClient studyId={studyId} />;
}
