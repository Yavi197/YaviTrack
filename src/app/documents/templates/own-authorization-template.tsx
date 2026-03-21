
'use client';
import type { Study } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { getAgeFromBirthDate } from '@/lib/utils';

export function OwnAuthorizationTemplate({ study }: { study: Study }) {
    const studyDate = study.requestDate?.toDate();
    const age = getAgeFromBirthDate(study.patient.birthDate);
    const mainStudy = study.studies[0] || { cups: '', nombre: '' };
    const editableProps = {
      contentEditable: true,
      suppressContentEditableWarning: true,
      className: "focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
    };

    return (
        <div className="relative bg-white w-[8.5in] h-[11in] p-8 text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="text-center mb-10">
                <Image src="/logo-clinica.png" alt="Logo Clínica" width={120} height={120} className="mx-auto" />
                <h1 className="text-2xl font-bold mt-4">INSTITUTO DE SISTEMA NERVIOSO DE CORDOBA IPS S.A.S</h1>
                <h2 className="text-xl">CLINICA SAN SEBASTIAN</h2>
                <p className="text-sm">NIT: 900.250.763-1</p>
                <p className="text-sm">CRA. 12 No 27-43 TEL: 7894479</p>
            </div>

            {/* Title */}
            <h3 className="text-center font-bold text-lg mb-6">AUTORIZACIÓN DE SERVICIOS DE SALUD</h3>

            {/* Patient and Service Info */}
            <div className="border border-black">
                <div className="grid grid-cols-2">
                    <div className="p-2 border-r border-b border-black">
                        <p className="font-bold text-xs">PRESTADOR:</p>
                        <p>CLINICA SAN SEBASTIAN SAS</p>
                    </div>
                    <div className="p-2 border-b border-black">
                        <p className="font-bold text-xs">NÚMERO DE AUTORIZACIÓN:</p>
                        <p>{study.id.slice(-10).toUpperCase()}</p>
                    </div>
                </div>
                <div className="p-2 border-b border-black">
                    <p className="font-bold text-xs">PACIENTE:</p>
                    <p>{study.patient.fullName}</p>
                </div>
                <div className="grid grid-cols-4">
                    <div className="p-2 border-r border-b border-black">
                        <p className="font-bold text-xs">DOCUMENTO:</p>
                        <p>{study.patient.idType} {study.patient.id}</p>
                    </div>
                    <div className="p-2 border-r border-b border-black">
                        <p className="font-bold text-xs">FECHA NACIMIENTO:</p>
                        <p>{study.patient.birthDate}</p>
                    </div>
                     <div className="p-2 border-r border-b border-black">
                        <p className="font-bold text-xs">EDAD:</p>
                        <p>{age} años</p>
                    </div>
                    <div className="p-2 border-b border-black">
                        <p className="font-bold text-xs">SEXO:</p>
                        <p>{study.patient.sex}</p>
                    </div>
                </div>
                 <div className="p-2">
                    <p className="font-bold text-xs">ASEGURADORA:</p>
                    <p>{study.patient.entidad}</p>
                </div>
            </div>

            {/* Service Details */}
            <div className="mt-4 border border-black">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-black font-bold text-left">
                            <th className="p-2 w-1/4 border-r border-black">CÓDIGO (CUPS)</th>
                            <th className="p-2 w-1/2 border-r border-black">DESCRIPCIÓN DEL SERVICIO</th>
                            <th className="p-2 w-1/4">CANTIDAD</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="p-2 border-r border-black">{mainStudy.cups}</td>
                            <td className="p-2 border-r border-black">{mainStudy.nombre}</td>
                            <td className="p-2">1</td>
                        </tr>
                    </tbody>
                </table>
                 <div className="p-2 border-t border-black">
                    <p className="font-bold text-xs">DIAGNÓSTICO:</p>
                    <p>{study.diagnosis.code} - {study.diagnosis.description}</p>
                </div>
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-10 left-10 right-10 text-xs text-center">
                 <p className="font-bold">FECHA DE EMISIÓN: {studyDate ? format(studyDate, 'dd/MM/yyyy') : 'N/A'}</p>
                 <p className="mt-1">Esta autorización es válida por 30 días a partir de la fecha de emisión.</p>
                 <p className="mt-4 border-t border-dotted border-black pt-1">GENERADO POR: DPTO IMAGENES DIAGNOSTICAS - MEDI-TRACK</p>
            </div>
        </div>
    );
}
