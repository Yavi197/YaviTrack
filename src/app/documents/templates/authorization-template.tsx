
'use client';
import type { Study } from '@/lib/types';
import { format } from 'date-fns';
import { DocumentHeader } from '@/components/app/document-header';

export function AuthorizationTemplate({ study }: { study: Study }) {
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
            <td style={{ border: '1px solid black', padding: '4px' }} {...editableProps}>RESONANCIA DE ALTA TECNOLOGÍA DEL CARIBE S.A.S.</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px' }}>DIRECCIÓN:</td>
            <td style={{ border: '1px solid black', padding: '4px' }} {...editableProps}>CRA.12 No 27 - 43</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px' }}>TELÉFONO:</td>
            <td style={{ border: '1px solid black', padding: '4px' }} {...editableProps}>789-44-79</td>
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
