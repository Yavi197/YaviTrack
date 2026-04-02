
'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study } from '@/lib/types';
import { ConsentTemplate } from '@/app/documents/templates/consent-template';
import { ChecklistTemplate } from '@/app/documents/templates/checklist-template';
import { AuthorizationTemplate } from '@/app/documents/templates/authorization-template';
import { SurveyTemplate } from '@/app/documents/templates/survey-template';
import { OwnAuthorizationTemplate } from '@/app/documents/templates/own-authorization-template';
import { ImagingOrderTemplate } from '@/app/documents/templates/imaging-order-template';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PROVIDERS, Provider } from '@/lib/providers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const documentComponents = {
  consent: ConsentTemplate,
  checklist: ChecklistTemplate,
  authorization: AuthorizationTemplate,
  survey: SurveyTemplate,
  'own-authorization': OwnAuthorizationTemplate,
  'imaging-order': ImagingOrderTemplate,
};

const docTypeAbbreviations: Record<string, string> = {
  consent: 'CONSENTIMIENTO',
  checklist: 'CHECKLIST',
  authorization: 'AUTORIZACION',
  survey: 'ENCUESTA',
  'own-authorization': 'AUT_PROPIA',
  'imaging-order': 'ORD_IMAGEN',
};


export default function DocumentPage() {
  // All hooks must be declared before any early returns
  const params = useParams();
  const searchParams = useSearchParams();

  const studyId = params?.studyId as string | undefined;
  const documentType = params?.documentType as keyof typeof documentComponents | undefined;
  const source = searchParams?.get('source');

  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider>(PROVIDERS[0]);

  useEffect(() => {
    if (!studyId || !documentType) return;
    const fetchStudy = async () => {
      const collectionName = source === 'remissions' ? 'remissions' : 'studies';
      const docRef = doc(db, collectionName, studyId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const studyData = { id: docSnap.id, ...docSnap.data() } as Study;
        setStudy(studyData);

        // Set document title for PDF saving
        const patientName = (studyData.patient.fullName || 'paciente').toUpperCase().replace(/ /g, '_');
        const patientIdNum = studyData.patient.id || 'ID';
        const docTypeAbbr = docTypeAbbreviations[documentType] || 'DOCUMENTO';
        document.title = `${patientName}_${patientIdNum}_${docTypeAbbr}`;

      } else {
        console.error('No such document!');
      }
      setLoading(false);
    };
    fetchStudy();
  }, [studyId, documentType, source]);

  // Early returns AFTER all hooks
  if (!params || !studyId || !documentType) return null;

  if (!documentComponents[documentType]) {
    notFound();
  }

  if (loading) {
    return (
      <div className="p-8 bg-white text-black min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-16 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!study) {
    notFound();
  }

  const DocumentTemplate = documentComponents[documentType];

  return (
    <div className="bg-gray-100 print:bg-white">
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none min-h-screen">
        <main>
          {documentType === 'authorization' ? (
            <AuthorizationTemplate study={study} provider={selectedProvider} onProviderChange={setSelectedProvider} />
          ) : (
            <DocumentTemplate study={study} />
          )}
        </main>
      </div>
       <div className="fixed bottom-5 right-5 print:hidden">
        <Button onClick={() => window.print()} size="lg" className="rounded-full shadow-lg">
          <Printer className="mr-2 h-5 w-5" />
          Imprimir o Guardar PDF
        </Button>
      </div>
    </div>
  );
}
