
'use client';
import type { Study } from '@/lib/types';
import { DocumentHeader } from '@/components/app/document-header';

const ChecklistItem = ({ label, subLabel, noOptionText = "No" }: { label: string; subLabel?: React.ReactNode; noOptionText?: string }) => (
    <tr className="border-b">
        <td className="py-1 pr-4">
            {label}
            {subLabel && <div className="pl-4">{subLabel}</div>}
        </td>
        <td className="py-1 text-center">
            <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border border-gray-400 rounded-sm"></div>
                <span>Sí</span>
            </div>
        </td>
        <td className="py-1 text-center">
            <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border border-gray-400 rounded-sm"></div>
                <span>{noOptionText}</span>
            </div>
        </td>
    </tr>
);

export function ChecklistTemplate({ study }: { study: Study }) {
   const editableProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    className: "focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
  };

  return (
    <div className="p-8" style={{ fontFamily: 'Arial', fontSize: '11pt' }}>
      <DocumentHeader 
        study={study} 
        title="LISTA DE CHEQUEO DE SEGURIDAD"
        code="CI-GME-40"
        version="01"
        totalPages={1}
      />
      
      <div className="space-y-1 mt-4">
        <table className="w-full">
            <thead>
                <tr>
                    <th className="text-left font-bold text-base pb-1 w-4/6">Verificación del Paciente y Estudio</th>
                    <th className="w-1/6 text-center">Sí</th>
                    <th className="w-1/6 text-center">No</th>
                </tr>
            </thead>
            <tbody>
                <ChecklistItem label="¿Se confirmó la identidad del paciente (nombre completo y documento)?" />
                <ChecklistItem label="¿El estudio solicitado en la orden médica coincide con el programado?" />
            </tbody>
        </table>

        <table className="w-full">
            <thead>
                <tr>
                    <th className="text-left font-bold text-base pt-2 pb-1 w-4/6">Riesgos y Alergias</th>
                    <th className="w-1/6"></th>
                    <th className="w-1/6"></th>
                </tr>
            </thead>
            <tbody>
                <ChecklistItem 
                    label="¿El paciente ha informado sobre alergias conocidas (medicamentos, contraste, etc.)?" 
                    subLabel={
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-xs font-semibold">¿Cuál?:</span>
                            <div className="flex-1 border-b border-dotted border-gray-400" {...editableProps}></div>
                        </div>
                    }
                />
                <ChecklistItem label="¿Se ha confirmado que no hay posibilidad de embarazo en paciente de sexo femenino?" noOptionText='N/A' />
                <ChecklistItem label="Si se usa contraste, ¿se verificó el valor de creatinina y está dentro de los límites seguros?" />
            </tbody>
        </table>
        
        <table className="w-full">
            <thead>
                <tr>
                    <th className="text-left font-bold text-base pt-2 pb-1 w-4/6">Preparación del Paciente y Sala</th>
                    <th className="w-1/6"></th>
                    <th className="w-1/6"></th>
                </tr>
            </thead>
            <tbody>
                <ChecklistItem label="¿El paciente está en ayunas si el procedimiento lo requiere?" />
                <ChecklistItem label="¿El equipo y la sala están preparados y verificados para el procedimiento?" />
            </tbody>
        </table>

        <table className="w-full">
            <thead>
                <tr>
                    <th className="text-left font-bold text-base pt-2 pb-1 w-4/6">Consentimiento</th>
                    <th className="w-1/6"></th>
                    <th className="w-1/6"></th>
                </tr>
            </thead>
            <tbody>
                <ChecklistItem label="¿Se ha obtenido el consentimiento informado firmado por el paciente o acudiente?" />
            </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-8 pt-12">
        <div className="border-t border-gray-400 text-center pt-2">
          <p className="font-bold">Firma del Tecnólogo/Profesional Responsable</p>
          <p className="text-xs" {...editableProps}>(Nombre y C.C.)</p>
        </div>
         <div className="border-t border-gray-400 text-center pt-2">
          <p className="font-bold">Firma del Paciente (o Acudiente)</p>
           <p className="text-xs" {...editableProps}>(Nombre y C.C.)</p>
        </div>
      </div>
    </div>
  );
}
