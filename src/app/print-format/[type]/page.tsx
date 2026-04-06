"use client";

import { AppLogoIcon } from "@/components/icons/app-logo-icon";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";

export default function PrintFormatPage({ params }: { params: { type: string } }) {
    const { currentProfile } = useAuth();
    const [currentDate, setCurrentDate] = useState("");
    const defaultServiceRef = useRef("");

    useEffect(() => {
        setCurrentDate(format(new Date(), 'dd/MM/yyyy HH:mm'));
        
        // Define default service based on profile
        if (currentProfile?.rol === 'tecnologo') {
            defaultServiceRef.current = "IMAGENES DIAGNOSTICAS (RAYOS X)";
        } else if (currentProfile?.rol === 'transcriptora') {
            defaultServiceRef.current = "IMAGENES DIAGNOSTICAS (ECOGRAFIA)";
        } else if (currentProfile?.rol === 'administrador') {
            defaultServiceRef.current = "IMAGENES DIAGNOSTICAS (TOMOGRAFIA)";
        } else {
            defaultServiceRef.current = "IMAGENES DIAGNOSTICAS";
        }
    }, [currentProfile]);

    const type = params.type;

    if (type !== 'cambio' && type !== 'permiso') {
        return <div className="p-8">Formato no encontrado</div>;
    }

    return (
        <div className="bg-white min-h-screen p-4 sm:p-8 text-black font-sans print:p-0 relative">
            <div className="absolute top-4 right-4 print:hidden">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow-md hover:bg-blue-700 transition font-bold text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimir Formato
                </button>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                @page { margin: 1cm; size: letter portrait; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            `}} />
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                
                {/* HEADERS */}
                <div style={{ clear: "both", textAlign: "center", fontFamily: 'Arial, sans-serif', fontSize: '8pt' }}>
                    <table cellSpacing="0" cellPadding="0" style={{ width: "100%", marginRight: "auto", marginLeft: "auto", border: "1px solid #000000", borderCollapse: "collapse" }}>
                        <tbody>
                            <tr style={{ height: "12.25pt" }}>
                                <td rowSpan={4} style={{ width: "20%", borderRight: "1px solid", borderBottom: "1px solid", padding: "4px", verticalAlign: "middle", textAlign: "center" }}>
                                    <div className="w-24 h-auto mx-auto pb-1 flex flex-col items-center justify-center">
                                        <Image src="/logo-clinica.png" alt="Logo Clínica San Sebastián" width={100} height={100} className="object-contain" />
                                    </div>
                                </td>
                                <td style={{ width: "55%", borderRight: "1px solid", borderBottom: "1px solid", padding: "1px", verticalAlign: "middle", textAlign: "center" }}>
                                    <p className="m-0 text-[8pt] font-bold">SISTEMA DE GESTIÓN DE CALIDAD</p>
                                </td>
                                <td style={{ width: "25%", borderBottom: "1px solid", padding: "1px 4px", verticalAlign: "middle" }}>
                                    <p className="m-0 text-[8pt]"><span className="font-bold">Código:</span> {type === 'cambio' ? 'FO-GTH-43' : 'FO-GTH-42'}</p>
                                </td>
                            </tr>
                            <tr style={{ height: "12.95pt" }}>
                                <td style={{ borderBottom: "1px solid", borderRight: "1px solid", padding: "1px 4px", verticalAlign: "middle", textAlign: "center" }}>
                                    <p className="m-0 text-[8pt]"><span className="font-bold">PROCESO DE ORIGEN:</span> GESTIÓN DE TALENTO HUMANO</p>
                                </td>
                                <td style={{ borderBottom: "1px solid", padding: "1px 4px", verticalAlign: "middle" }}>
                                    <p className="m-0 text-[8pt]"><span className="font-bold">Versión:</span> {type === 'cambio' ? '01' : '03'}</p>
                                </td>
                            </tr>
                            <tr style={{ height: "12.95pt" }}>
                                <td rowSpan={2} style={{ borderRight: "1px solid", borderBottom: "1px solid", padding: "4px", verticalAlign: "middle", textAlign: "center" }}>
                                    <p className="m-0 text-[10pt] font-bold">
                                        {type === 'cambio' ? 'FORMATO DE SOLICITUD DE CAMBIO DE TURNO' : 'FORMATO DE SOLICITUD DE PERMISO'}
                                    </p>
                                </td>
                                <td style={{ borderBottom: "1px solid", padding: "1px 4px", verticalAlign: "middle" }}>
                                    <p className="m-0 text-[7pt]"><span className="font-bold">Fecha de Emisión:</span><br/>{type === 'cambio' ? '27-08-2025' : '20-11-2020'}</p>
                                    <p className="m-0 text-[7pt] mt-0.5"><span className="font-bold">Fecha de Actualización:</span><br/>{type === 'cambio' ? '27-08-2025' : '05-09-2025'}</p>
                                </td>
                            </tr>
                            <tr style={{ height: "12.25pt" }}>
                                <td style={{ padding: "1px 4px", verticalAlign: "middle" }}>
                                    <p className="m-0 text-[8pt]"><span className="font-bold">Páginas:</span> 1 de 1</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                 </div>

                {type === 'cambio' && (
                    <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-4 mb-3">
                            <span className="font-bold font-sans text-[9pt] whitespace-nowrap min-w-[60px]">Fecha</span>
                            <span className="font-bold font-sans text-[9pt]">:</span>
                            <div 
                                className="border border-black h-6 w-48 px-2 flex items-center outline-none hover:bg-zinc-50 focus:bg-blue-50 focus:ring-1 focus:ring-blue-500 cursor-text overflow-hidden whitespace-nowrap print:border-black font-sans text-[9pt] print:bg-transparent"
                                contentEditable 
                                suppressContentEditableWarning
                            >
                                {currentDate}
                            </div>
                            
                            <span className="font-bold font-sans text-[9pt] whitespace-nowrap min-w-[60px] ml-auto">Servicio</span>
                            <span className="font-bold font-sans text-[9pt]">:</span>
                            <div 
                                className="border border-black h-6 flex-1 px-2 flex items-center outline-none hover:bg-zinc-50 focus:bg-blue-50 focus:ring-1 focus:ring-blue-500 cursor-text overflow-hidden whitespace-nowrap print:border-black font-sans text-[9pt] print:bg-transparent"
                                contentEditable 
                                suppressContentEditableWarning
                            >
                                {defaultServiceRef.current}
                            </div>
                        </div>

                        {[
                            "Nombre de Quien Solicita el Cambio de Turno",
                            "Cargo",
                            "Nombre de Quién Cubrirá el Turno",
                            "Cargo",
                            "Fecha del Turno que Será Cubierto",
                            "Horario en Qué Será Cubierto el Turno",
                            "Fecha en qué Será Devuelto el Turno Cambiado",
                            "Horario en qué Será Devuelto el Turno"
                        ].map((label, idx) => (
                            <div key={idx} className="flex items-center gap-4">
                                <span className="font-bold font-sans text-[9pt] min-w-[300px]">{label}</span>
                                <span className="font-bold font-sans text-[9pt]">:</span>
                                <div 
                                    className="flex-1 border border-black h-6 px-2 py-0.5 outline-none hover:bg-zinc-50 focus:bg-blue-50 focus:ring-1 focus:ring-blue-500 transition-colors cursor-text overflow-hidden whitespace-nowrap font-sans text-[9pt] print:border-black print:bg-transparent"
                                    contentEditable 
                                    suppressContentEditableWarning
                                ></div>
                            </div>
                        ))}

                        <div className="pt-4">
                            <p className="font-bold font-sans text-[9pt] leading-loose text-justify">
                                Yo, <span contentEditable suppressContentEditableWarning className="inline-block border-b border-black w-72 ml-1 mr-1 relative top-2 px-1 outline-none hover:bg-zinc-50 focus:bg-blue-50 cursor-text print:bg-transparent overflow-hidden whitespace-nowrap"></span>, expreso libremente mí voluntad de cubrir el turno de mí compañero <span contentEditable suppressContentEditableWarning className="inline-block border-b border-black w-80 ml-1 mr-1 relative top-2 px-1 outline-none hover:bg-zinc-50 focus:bg-blue-50 cursor-text print:bg-transparent overflow-hidden whitespace-nowrap"></span>, en la fecha y hora señaladas, con el compromiso de que este cubra el turno relacionado en la fecha y hora señalada.
                            </p>
                        </div>

                        <div className="flex justify-between items-end pt-12 pb-2 space-x-8">
                            <div className="text-center flex-1 border-t border-black pt-1">
                                <span className="font-bold font-sans text-[9pt]">Firma Trabajador que Solicita:</span>
                            </div>
                            <div className="text-center flex-1 border-t border-black pt-1">
                                <span className="font-bold font-sans text-[9pt]">Firma Trabajador que Cubre Turno:</span>
                            </div>
                            <div className="text-center flex-1 border-t border-black pt-1">
                                <span className="font-bold font-sans text-[9pt]">Firma Jefe Inmediato:</span>
                            </div>
                        </div>

                        <div className="flex justify-center pt-8 pb-2">
                            <div className="text-center w-64 border-t border-black pt-1">
                                <span className="font-bold font-sans text-[9pt]">Firma Talento Humano</span>
                            </div>
                        </div>

                        <div className="pt-2 pb-0">
                            <p className="font-bold font-sans text-[9pt] text-justify leading-relaxed">
                                Nota: Todo cambio de turno debe ser radicado con 24 horas de anticipación, y tener el Visto Bueno de la Coordinación de Talento Humano.
                            </p>
                        </div>
                    </div>
                )}
                
                {type === 'permiso' && (
                    <div className="mt-6">
                        <table className="w-full border-collapse border border-black text-[10pt] text-left font-sans">
                            <thead>
                                <tr>
                                    <th colSpan={4} className="bg-[#d9eff5] border border-black p-1 text-center font-bold">
                                        DATOS DEL SOLICITANTE
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="w-[20%] bg-zinc-200 border border-black p-1">Nombres y Apellidos:</td>
                                    <td className="w-[45%] border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>{currentProfile?.nombre}</td>
                                    <td className="w-[10%] bg-zinc-200 border border-black p-1">Cargo:</td>
                                    <td className="w-[25%] border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>{currentProfile?.rol}</td>
                                </tr>
                                <tr>
                                    <td className="bg-zinc-200 border border-black p-1">Cedula:</td>
                                    <td className="border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>{currentProfile?.documento}</td>
                                    <td className="bg-zinc-200 border border-black p-1">Area:</td>
                                    <td className="border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>IMAGENES DIAGNOSTICAS</td>
                                </tr>
                                <tr>
                                    <td className="bg-zinc-200 border border-black p-1">No. Celular:</td>
                                    <td className="border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>{currentProfile?.telefono}</td>
                                    <td className="bg-zinc-200 border border-black p-1"></td>
                                    <td className="border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border-collapse border border-black text-[10pt] text-left mt-4 font-sans">
                            <thead>
                                <tr>
                                    <th colSpan={6} className="bg-[#d9eff5] border border-black p-1 text-center font-bold">
                                        DATOS DEL PERMISO
                                    </th>
                                </tr>
                                <tr>
                                    <th className="w-[30%] bg-zinc-200 border border-black p-1 font-normal">Tipo de permiso</th>
                                    <th className="w-[10%] bg-zinc-200 border border-black p-1 font-normal text-center">N° Horas</th>
                                    <th className="w-[10%] bg-zinc-200 border border-black p-1 font-normal text-center">N° días</th>
                                    <th className="w-[30%] bg-zinc-200 border border-black p-1 font-normal">Tipo de Permiso</th>
                                    <th className="w-[10%] bg-zinc-200 border border-black p-1 font-normal text-center">N° Horas</th>
                                    <th className="w-[10%] bg-zinc-200 border border-black p-1 font-normal text-center">N° días</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ['Compensatorio', 'Diligencias Administrativas'],
                                    ['Para estudio', 'Evento deportivo'],
                                    ['Calamidad Domestica', 'Matrimonio'],
                                    ['Capacitación', 'Licencia por luto'],
                                    ['Cita médica personal', 'Lactancia'],
                                    ['Cita médica de un familiar', 'Otros'],
                                ].map((row, i) => (
                                    <tr key={i}>
                                        <td className="border border-black p-1">{row[0]}</td>
                                        <td className="border border-black p-1 outline-none text-center focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                        <td className="border border-black p-1 outline-none text-center focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                        <td className="border border-black p-1">{row[1]}</td>
                                        <td className="border border-black p-1 outline-none text-center focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                        <td className="border border-black p-1 outline-none text-center focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={3} className="bg-[#d9eff5] border border-black p-1 font-bold outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>Remunerado:</td>
                                    <td colSpan={3} className="bg-[#d9eff5] border border-black p-1 font-bold outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>No Remunerado:</td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border-collapse border border-black text-[10pt] text-left mt-[-1px] font-sans">
                            <tbody>
                                <tr>
                                    <td rowSpan={3} className="w-[20%] bg-zinc-200 border border-black p-1 text-center align-middle">
                                        FECHA DEL PERMISO
                                    </td>
                                    <td className="w-[10%] bg-zinc-200 border border-black p-1">DESDE:</td>
                                    <td className="w-[20%] border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>{format(new Date(), 'dd/MM/yyyy')}</td>
                                    <td className="w-[10%] bg-zinc-200 border border-black p-1">HASTA:</td>
                                    <td className="w-[20%] border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                    <td className="w-[10%] bg-zinc-200 border border-black p-1 text-center">TOTAL,<br/>DIAS:</td>
                                    <td className="w-[10%] border border-black p-1 outline-none text-center focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                </tr>
                                <tr>
                                    <td rowSpan={2} className="bg-zinc-200 border border-black p-1 align-middle">HORA:</td>
                                    <td className="bg-zinc-200 border border-black p-1">A partir de las</td>
                                    <td colSpan={2} className="border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                    <td rowSpan={2} className="bg-zinc-200 border border-black p-1 text-center align-middle">TOTAL,<br/>HORAS:</td>
                                    <td rowSpan={2} className="border border-black p-1 outline-none text-center align-middle focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                </tr>
                                <tr>
                                    <td className="bg-zinc-200 border border-black p-1">y hasta las</td>
                                    <td colSpan={2} className="border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border-collapse border border-black text-[10pt] text-left mt-[-1px] font-sans">
                            <tbody>
                                <tr>
                                    <td className="w-[20%] h-14 bg-zinc-200 border border-black p-1 text-center align-middle">
                                        DESCRIPCIÓN DEL<br/>PERMISO:
                                    </td>
                                    <td className="w-[80%] border border-black p-1 outline-none align-top focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border-collapse border border-black text-[10pt] text-left mt-[-1px] font-sans">
                            <tbody>
                                <tr>
                                    <td className="w-[20%] bg-zinc-200 border border-black p-1 text-center align-middle">
                                        SOPORTE ANEXO:
                                    </td>
                                    <td className="w-[80%] border border-black p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border-collapse border border-black text-[10pt] text-left mt-[-1px] font-sans">
                            <tbody>
                                <tr>
                                    <td className="w-[40%] border border-black p-1 align-top h-16">
                                        <strong>Firma solicitante:</strong>
                                    </td>
                                    <td className="w-[30%] border border-black p-0 align-top">
                                        <div className="h-10 p-1 border-b border-black"><strong>Firma de Vo.Bo. Jefe inmediato</strong></div>
                                        <table className="w-full h-6 border-collapse">
                                            <tbody>
                                                <tr>
                                                    <td className="w-[40%] border-r border-black p-1 bg-zinc-50/50">Nombre completo:</td>
                                                    <td className="w-[60%] p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    <td className="w-[30%] border border-black p-0 align-top">
                                        <div className="h-10 p-1 border-b border-black"><strong>Firma de Talento Humano:</strong></div>
                                        <table className="w-full h-6 border-collapse">
                                            <tbody>
                                                <tr>
                                                    <td className="w-[40%] border-r border-black p-1 bg-zinc-50/50">Nombre completo:</td>
                                                    <td className="w-[60%] p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-0">
                                        <table className="w-full h-6 border-collapse">
                                            <tbody>
                                                <tr>
                                                    <td className="w-[40%] border-r border-black p-1 bg-zinc-50/50 text-center">Fecha diligenciamiento:</td>
                                                    <td className="w-[60%] p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning>{currentDate}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    <td className="border border-black p-0">
                                        <table className="w-full h-6 border-collapse">
                                            <tbody>
                                                <tr>
                                                    <td className="w-[40%] border-r border-black p-1 bg-zinc-50/50 text-center">Fecha de recibido:</td>
                                                    <td className="w-[60%] p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    <td className="border border-black p-0">
                                        <table className="w-full h-6 border-collapse">
                                            <tbody>
                                                <tr>
                                                    <td className="w-[40%] border-r border-black p-1 bg-zinc-50/50 text-center">Fecha aprobación:</td>
                                                    <td className="w-[60%] p-1 outline-none focus:bg-blue-50" contentEditable suppressContentEditableWarning></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        </div>
    );
}
