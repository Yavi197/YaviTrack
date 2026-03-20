
'use client';
import type { Study } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { getAgeFromBirthDate, cn } from '@/lib/utils';


const ConsentHeader = ({ study, currentPage, totalPages, showPatientData }: { study: Study, currentPage: number, totalPages: number, showPatientData: boolean }) => {
    let studyDate: Date | null = null;
    if (study.requestDate) {
        if (typeof (study.requestDate as any).toDate === 'function') {
            studyDate = (study.requestDate as any).toDate();
        } else if (study.requestDate instanceof Date) {
            studyDate = study.requestDate;
        } else if (typeof study.requestDate === 'string' || typeof study.requestDate === 'number') {
            studyDate = new Date(study.requestDate);
        }
    }
    
    const age = getAgeFromBirthDate(study.patient.birthDate);
    const editableProps = {
      contentEditable: true,
      suppressContentEditableWarning: true,
      className: "focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
    };

    return (
        <div style={{fontFamily: 'Arial, sans-serif', fontSize: '9pt'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                    <tr>
                        <td style={{ width: '20%', border: '1px solid black', textAlign: 'center', padding: '2px' }} rowSpan={4}>
                           <div className="w-24 h-auto mx-auto">
                             <Image src="/logo-clinica.png" alt="Logo Clínica San Sebastián" width={100} height={100} />
                           </div>
                        </td>
                        <td style={{ width: '55%', border: '1px solid black', textAlign: 'center', padding: '1px', fontSize: '8pt', fontWeight: 'bold' }}>
                            SISTEMA DE GESTIÓN DE CALIDAD
                        </td>
                        <td style={{ width: '25%', border: '1px solid black', padding: '1px 4px', fontSize: '8pt' }}>
                            <span style={{fontWeight: 'bold'}}>Código:</span> <span {...editableProps}>CI-GME-38</span>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid black', textAlign: 'center', padding: '1px', fontSize: '8pt' }}>
                           <span style={{fontWeight: 'bold'}}>PROCESO DE ORIGEN:</span> <span {...editableProps}>GESTIÓN CLIENTE ASISTENCIAL</span>
                        </td>
                        <td style={{ border: '1px solid black', padding: '1px 4px', fontSize: '8pt' }}>
                           <span style={{fontWeight: 'bold'}}>Versión:</span> <span {...editableProps}>03</span>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid black', textAlign: 'center', padding: '2px', fontWeight: 'bold' }} rowSpan={2}>
                            CONSENTIMIENTO INFORMADO ESTUDIO CONTRASTADO
                        </td>
                        <td style={{ border: '1px solid black', padding: '1px 4px', fontSize: '7pt' }}>
                            <span style={{fontWeight: 'bold'}}>Fecha de Emisión:</span> <span {...editableProps}>06-11-2025</span><br/>
                            <span style={{fontWeight: 'bold'}}>Fecha de Actualización:</span> <span {...editableProps}></span>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid black', padding: '1px 4px', fontSize: '8pt' }}>
                           <span style={{fontWeight: 'bold'}}>Páginas:</span> <span {...editableProps}>{currentPage} de {totalPages}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            {showPatientData && (
                <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse', fontSize: '9pt' }}>
                    <tbody>
                        <tr>
                            <td style={{fontWeight: 'bold', width: '20%', padding: '4px', border: '1px solid black'}}>NOMBRE:</td>
                            <td style={{width: '45%', padding: '4px', border: '1px solid black'}} {...editableProps}>{study.patient.fullName}</td>
                            <td style={{fontWeight: 'bold', width: '15%', padding: '4px', border: '1px solid black'}}>F.NAC/EDAD:</td>
                            <td style={{width: '20%', padding: '4px', border: '1px solid black'}} {...editableProps}>{study.patient.birthDate} {age !== null ? `(${age} años)`: ''}</td>
                        </tr>
                        <tr>
                            <td style={{fontWeight: 'bold', padding: '4px', border: '1px solid black'}}>IDENTIFICACIÓN:</td>
                            <td style={{padding: '4px', border: '1px solid black'}} {...editableProps}>{study.patient.idType} {study.patient.id}</td>
                            <td style={{fontWeight: 'bold', padding: '4px', border: '1px solid black'}}>CIE-10:</td>
                            <td style={{padding: '4px', border: '1px solid black'}} {...editableProps}>{study.diagnosis.code}</td>
                        </tr>
                        <tr>
                            <td style={{fontWeight: 'bold', padding: '4px', border: '1px solid black'}}>ENTIDAD (EPS):</td>
                            <td style={{padding: '4px', border: '1px solid black'}} {...editableProps}>{study.patient.entidad}</td>
                            <td style={{fontWeight: 'bold', padding: '4px', border: '1px solid black'}}>FECHA:</td>
                            <td style={{padding: '4px', border: '1px solid black'}} {...editableProps}>{studyDate ? format(studyDate, 'dd/MM/yyyy HH:mm') : 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style={{fontWeight: 'bold', padding: '4px', border: '1px solid black'}}>ESTUDIO:</td>
                            <td style={{padding: '4px', border: '1px solid black'}} colSpan={3} {...editableProps}>{study.studies.map(s => s.nombre).join(', ')}</td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
};


export function ConsentTemplate({ study }: { study: Study }) {
  const editableProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    className: "focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
  };

  const lineStyle: React.CSSProperties = {
    display: 'inline-block',
    borderBottom: '1px dotted black',
    minWidth: '150px',
    padding: '0 2px',
  };

  const longLineStyle: React.CSSProperties = { ...lineStyle, width: '100%'};

  return (
    <div className="p-8 bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt' }}>
      
      <ConsentHeader study={study} currentPage={1} totalPages={2} showPatientData={true} />
      
      <div className="text-xs text-justify mt-2 space-y-1">
        <p>
          Por medio del presente documento, en uso de mis facultades mentales otorgo en forma libre mi consentimiento al <strong>INSTITUTO DE SISTEMA NERVIOSO DE CORDOBA IPS S.A.S - CLINICA SAN SEBASTIAN</strong> para que con el concurso de su personal aplique los métodos y realice los exámenes diagnósticos que a continuación se describen:
        </p>
        <div style={longLineStyle} {...editableProps}>&nbsp;{study.studies.map(s => s.nombre).join(', ')}</div>

        <h2 className="text-center font-bold text-sm pt-1">RIESGOS DE LA PRUEBA</h2>
        <p>
          Los riesgos de los estudios imagenológicos con administración de un medio de contraste yodado por vía intravenosa incluyen: <strong>EXPOSICIÓN A LA RADIACIÓN, URTICARIA, MAREO, NÁUSEAS, VÓMITO, SÍNDROME CONVULSIVO, FALLA RENAL, SHOCK ANAFILACTICO, PARO CARDIOPULMONAR y/o MUERTE</strong>. Tenga en cuenta que realizarse muchas radiografías o tomografías con el tiempo puede aumentar el riesgo de cáncer. Sin embargo, una sola tomografía en la mayoría de las ocasiones supera positivamente la relación riesgo/beneficio.
        </p>

        <h2 className="text-center font-bold text-sm pt-1">DECLARACIONES Y FIRMAS</h2>
        <p className="leading-snug">
          Yo, <span style={lineStyle} {...editableProps}></span> o en su nombre, su tutor legal o familiar, identificado con documento: <span style={{...lineStyle, minWidth: '100px'}} {...editableProps}></span> con plenas facultades, declaro de manera libre y espontánea que se ha informado y explicado verbalmente, y en esta hoja informativa, y he comprendido el significado del procedimiento con la oportunidad de aclarar mis dudas. Así doy mi consentimiento <strong>ACEPTANDO</strong> <strong>[ &nbsp; ]</strong> <strong>DENEGANDO [ &nbsp; ]</strong>; que se realice el(los) estudio(s) de: <span style={{...lineStyle, minWidth: '180px'}} {...editableProps}></span> en caso de denegar el motivo es: <span style={longLineStyle} {...editableProps}></span>
        </p>
        <p className="mt-1">
          Así mismo eximo de toda responsabilidad civil o penal al <strong>INSTITUTO DE SISTEMA NERVIOSO DE CORDOBA IPS S.A.S - CLINICA SAN SEBASTIAN</strong>, a los radiólogos y al personal de tecnólogos y enfermeras del Dpto. de radiología en caso de presentarse cualquier complicación.
        </p>
        
        <div className="pt-4">
            <div className="border-t border-black pt-1 w-3/5">
                <p className="font-bold m-0">Firma del paciente, tutor legal o familiar.</p>
                <div className="flex"><strong>C.C. N°:</strong> <span {...editableProps} className={cn("flex-1 border-b border-dotted border-black ml-2", editableProps.className)}></span></div>
            </div>
        </div>

        <p className="pt-2 leading-snug">
          <strong>Tutor legal o familiar:</strong> s&eacute; que el paciente <strong {...editableProps} className={cn("px-2", editableProps.className)}>{study.patient.fullName}</strong> ha sido considerado por ahora incapaz de tomar por sí mismo la decisión de aceptar o rechazar el procedimiento descrito arriba. El equipo de salud de la institución me ha explicado de forma clara que es, como se hace y para qué sirve este procedimiento. También se han explicado sus riesgos y complicaciones. He comprendido todo lo anterior perfectamente y por ello <strong>YO:</strong> <span style={lineStyle} {...editableProps}></span>, con documento de identidad: <span style={{...lineStyle, minWidth: '120px'}} {...editableProps}></span>, <strong>doy mi consentimiento</strong> para que el personal asistencial que atiende al paciente le realicen este procedimiento.
        </p>

        <div className="flex justify-between pt-4">
            <div className="border-t border-black pt-1 w-3/5">
                <p className="m-0">Firma del Tutor legal o Familiar</p>
                <div className="flex">Parentesco: <span {...editableProps} className={cn("flex-1 border-b border-dotted border-black ml-2", editableProps.className)}></span></div>
                <div className="flex">C.C. N°: <span {...editableProps} className={cn("flex-1 border-b border-dotted border-black ml-2", editableProps.className)}></span></div>
            </div>
        </div>
      </div>

      <div style={{ pageBreakBefore: 'always' }} className="pt-8">
        
        <ConsentHeader study={study} currentPage={2} totalPages={2} showPatientData={false} />

        <div className="text-xs text-justify mt-4 space-y-2">
            <p><strong>Personal encargado de realizar el estudio:</strong> Certifico que he explicado la naturaleza, propósitos, ventajas, riesgos y alternativas del estudio y he contestado todas las preguntas. Considero que el paciente, comprende completamente lo explicado.</p>
            <div className="pt-12">
                <div className="border-t border-black pt-1 w-3/5">
                    <p>Firma y sello del personal encargado</p>
                    <div className="flex">Nombre: <span {...editableProps} className={cn("flex-1 border-b border-dotted border-black ml-2", editableProps.className)}></span></div>
                    <div className="flex">Tarjeta Profesional N°: <span {...editableProps} className={cn("flex-1 border-b border-dotted border-black ml-2", editableProps.className)}></span></div>
                </div>
            </div>

            <h2 className="text-center font-bold text-sm pt-8">REVOCACIÓN DEL CONSENTIMIENTO</h2>
            <p>
                Revoco el consentimiento presentado a pesar de haber sido informado de las consecuencias de mi decisión y no deseo proseguir el tratamiento que doy con esta fecha por finalizado.
            </p>

            <div className="pt-12">
                <div className="border-t border-black pt-1 w-3/5">
                    <p>Firma del Paciente, Tutor Legal o Familiar</p>
                    <div className="flex">C.C. N°: <span {...editableProps} className={cn("flex-1 border-b border-dotted border-black ml-2", editableProps.className)}></span></div>
                </div>
            </div>

            <div className="pt-8">
                <strong>Firmado en la fecha:</strong> <span {...editableProps} className={cn("p-2 border border-dotted border-black min-w-[120px] inline-block", editableProps.className)}>&nbsp;</span>
            </div>
        </div>
      </div>
    </div>
  );
}
