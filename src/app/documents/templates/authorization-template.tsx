
'use client';
import type { Study } from '@/lib/types';
import { format } from 'date-fns';
import { DocumentHeader } from '@/components/app/document-header';
import { Provider, PROVIDERS } from '@/lib/providers';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';

export function AuthorizationTemplate({ study, provider = PROVIDERS[0], onProviderChange }: { study: Study, provider?: Provider, onProviderChange?: (p: Provider) => void }) {
  // Ensure studyDate is a valid Date object before formatting
  let studyDate: Date | null = null;
  if (study.requestDate) {
    if (typeof (study.requestDate as any).toDate === 'function') {
      studyDate = (study.requestDate as any).toDate();
    } else if (study.requestDate instanceof Date) {
      studyDate = study.requestDate;
    } else if (typeof study.requestDate === 'string') {
      studyDate = new Date(study.requestDate);
    }
  }

  const editableProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    className: "focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
  };

  return (
    <div className="p-8" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }}>
      
      <DocumentHeader 
        study={study}
        title="AUTORIZACIÓN PARA LA PRESTACIÓN DE SERVICIO EXTERNO"
        code="FO-GSI-03"
        version="01"
        totalPages={1}
      />

      <div style={{ fontWeight: 'bold', marginTop: '1rem' }}>
        N° AUTORIZACIÓN: <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', minWidth: '200px', display: 'inline-block'}} {...editableProps}>&nbsp;{study.id.slice(-8).toUpperCase()}</span>
      </div>
      
      <p style={{ textAlign: 'center', fontWeight: 'bold', margin: '1rem 0' }}>DATOS DEL PRESTADOR</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px', width: '15%' }}>NOMBRE:</td>
            <td style={{ border: '1px solid black', padding: '0px' }} className="relative bg-zinc-50/30 group hover:bg-zinc-100/50 transition-colors">
              <div className="print:hidden">
                <Select 
                  value={provider.id} 
                  onValueChange={(id) => {
                    const p = PROVIDERS.find(x => x.id === id);
                    if (p && onProviderChange) onProviderChange(p);
                  }}
                >
                  <SelectTrigger className="h-full w-full rounded-none border-none font-bold text-[9pt] shadow-none bg-transparent focus:ring-0 px-1 py-1">
                    <SelectValue placeholder="Elegir Prestador" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-zinc-100">
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-bold py-2.5">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden print:block px-1 py-1 font-bold">
                {provider.name}
              </div>
            </td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px' }}>DIRECCIÓN:</td>
            <td style={{ border: '1px solid black', padding: '4px' }} {...editableProps}>{provider.address}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px' }}>TELÉFONO:</td>
            <td style={{ border: '1px solid black', padding: '4px' }} {...editableProps}>{provider.phone}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ textAlign: 'center', fontWeight: 'bold', margin: '1rem 0' }}>ESTUDIOS ORDENADOS</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px', width: '15%' }}>CUPS:</td>
            <td style={{ border: '1px solid black', padding: '4px', width: '35%' }} {...editableProps}>{study.studies[0]?.cups}</td>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px', width: '20%' }}>OBS. ADICIONAL:</td>
            <td style={{ border: '1px solid black', padding: '4px', width: '30%' }} {...editableProps}>{study.studies[0]?.details}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px' }}>ESTUDIO:</td>
            <td colSpan={3} style={{ border: '1px solid black', padding: '4px', height: '40px' }} {...editableProps}>{study.studies[0]?.nombre}</td>
          </tr>
           <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px' }}>ESPECIALISTA:</td>
            <td style={{ border: '1px solid black', padding: '4px' }} {...editableProps}>{study.orderingPhysician?.name}</td>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px' }}>N° REGISTRO:</td>
            <td style={{ border: '1px solid black', padding: '4px' }} {...editableProps}>{study.orderingPhysician?.register}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '6rem', width: '350px', borderTop: '1px solid black', paddingTop: '0.5rem', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
          <p style={{ fontWeight: 'bold', margin: 0 }} {...editableProps}>AUTORIZADO POR:</p>
          <p style={{ margin: 0 }} {...editableProps}>COORDINACIÓN IMÁGENES DIAGNOSTICAS</p>
          <p style={{ margin: 0 }} {...editableProps}>INSNECOR-CLINICA SAN SEBASTIAN</p>
      </div>
    </div>
  );
}
