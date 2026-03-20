
'use client';
import type { Study } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { getAgeFromBirthDate } from '@/lib/utils';

interface DocumentHeaderProps {
    study: Study;
    title: string;
    code: string;
    version: string;
    totalPages?: number;
}

export function DocumentHeader({ study, title, code, version, totalPages = 2 }: DocumentHeaderProps) {
    const studyDate = study.requestDate?.toDate();
    const age = getAgeFromBirthDate(study.patient.birthDate);
    const editableProps = {
      contentEditable: true,
      suppressContentEditableWarning: true,
      className: "focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
    };

    return (
        <div style={{fontFamily: 'Arial, sans-serif', fontSize: '10pt'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                    <tr>
                        <td style={{ width: '25%', border: '1px solid black', textAlign: 'center', padding: '2px' }} rowSpan={4}>
                           <Image src="/logo-clinica.png" alt="Logo Clínica San Sebastián" width={150} height={150} className="mx-auto" />
                        </td>
                        <td style={{ width: '50%', border: '1px solid black', textAlign: 'center', padding: '1px', fontSize: '8pt', fontWeight: 'bold' }}>
                            SISTEMA DE GESTIÓN DE CALIDAD
                        </td>
                        <td style={{ width: '25%', border: '1px solid black', padding: '1px 4px', fontSize: '8pt' }}>
                            <span style={{fontWeight: 'bold'}}>Código:</span> <span {...editableProps}>{code}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid black', textAlign: 'center', padding: '1px', fontSize: '8pt' }}>
                           <span style={{fontWeight: 'bold'}}>PROCESO DE ORIGEN:</span> <span {...editableProps}>GESTIÓN CLIENTE ASISTENCIAL</span>
                        </td>
                        <td style={{ border: '1px solid black', padding: '1px 4px', fontSize: '8pt' }}>
                           <span style={{fontWeight: 'bold'}}>Versión:</span> <span {...editableProps}>{version}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid black', textAlign: 'center', padding: '2px', fontWeight: 'bold' }} rowSpan={2}>
                            {title}
                        </td>
                        <td style={{ border: '1px solid black', padding: '1px 4px', fontSize: '7pt' }}>
                            <span style={{fontWeight: 'bold'}}>Fecha de Emisión:</span> <span {...editableProps}>12-09-2021</span><br/>
                            <span style={{fontWeight: 'bold'}}>Fecha de Actualización:</span> <span {...editableProps}>12-07-2023</span>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid black', padding: '1px 4px', fontSize: '8pt' }}>
                           <span style={{fontWeight: 'bold'}}>Páginas:</span> <span {...editableProps}>1 de {totalPages}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse', fontSize: '9pt' }}>
                 <tbody>
                    <tr>
                        <td style={{fontWeight: 'bold', width: '20%', padding: '2px'}}>NOMBRE:</td>
                        <td style={{width: '80%', padding: '2px'}} colSpan={3} {...editableProps}>{study.patient.fullName}</td>
                    </tr>
                    <tr>
                        <td style={{fontWeight: 'bold', padding: '2px'}}>IDENTIFICACIÓN:</td>
                        <td style={{padding: '2px'}} {...editableProps}>{study.patient.idType} {study.patient.id}</td>
                        <td style={{fontWeight: 'bold', padding: '2px'}}>F.NAC/EDAD:</td>
                        <td style={{padding: '2px'}} {...editableProps}>{study.patient.birthDate} {age !== null ? `(${age} años)`: ''}</td>
                    </tr>
                     <tr>
                        <td style={{fontWeight: 'bold', padding: '2px'}}>ENTIDAD (EPS):</td>
                        <td style={{padding: '2px'}} {...editableProps}>{study.patient.entidad}</td>
                        <td style={{fontWeight: 'bold', padding: '2px'}}>FECHA SOLICITUD:</td>
                        <td style={{padding: '2px'}} {...editableProps}>{studyDate ? format(studyDate, 'dd/MM/yyyy HH:mm') : 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style={{fontWeight: 'bold', padding: '2px'}}>ESTUDIO:</td>
                        <td style={{padding: '2px'}} colSpan={3} {...editableProps}>{study.studies.map(s => s.nombre).join(', ')}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
