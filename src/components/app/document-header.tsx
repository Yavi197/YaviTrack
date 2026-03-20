
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
    currentPage?: number;
    totalPages?: number;
    showPatientData?: boolean;
}

export function DocumentHeader({ study, title, code, version, currentPage = 1, totalPages = 1, showPatientData = true }: DocumentHeaderProps) {
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
}

