
'use client';
import type { Study } from '@/lib/types';
import { DocumentHeader } from '@/components/app/document-header';

const SurveyQuestion = ({ question, options }: { question: string, options: string[] }) => (
    <div className="py-2 border-b">
        <p className="font-semibold mb-2 text-base">{question}</p>
        <div className="flex justify-around">
            {options.map(opt => (
                 <div key={opt} className="flex flex-col items-center gap-1.5">
                    <div className="w-6 h-6 border border-gray-400 rounded-full"></div>
                    <label className="text-sm">{opt}</label>
                </div>
            ))}
        </div>
    </div>
);


export function SurveyTemplate({ study }: { study: Study }) {
  const editableProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    className: "focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
  };

  return (
    <div className="p-8" style={{ fontFamily: 'Arial', fontSize: '11pt' }}>
      <DocumentHeader 
        study={study}
        title="ENCUESTA DE SATISFACCIÓN DEL USUARIO"
        code="CI-GME-41"
        version="01"
        totalPages={1}
      />
      
      <div className="space-y-2 pt-4 mt-4">
        <SurveyQuestion 
            question="1. ¿Cómo calificaría la amabilidad y el trato del personal que lo atendió?"
            options={['Excelente', 'Bueno', 'Regular', 'Malo']}
        />
         <SurveyQuestion 
            question="2. El tiempo que esperó para ser atendido fue:"
            options={['Muy corto', 'Adecuado', 'Largo', 'Excesivo']}
        />
        <SurveyQuestion 
            question="3. La información que recibió sobre su procedimiento fue clara y suficiente:"
            options={['Muy clara', 'Clara', 'Poco Clara', 'Confusa']}
        />
        <SurveyQuestion 
            question="4. ¿Cómo calificaría la limpieza y comodidad de nuestras instalaciones?"
            options={['Excelente', 'Buena', 'Regular', 'Deficiente']}
        />
         <SurveyQuestion 
            question="5. En general, ¿qué tan satisfecho está con el servicio recibido?"
            options={['Muy Satisfecho', 'Satisfecho', 'Insatisfecho', 'Muy Insatisfecho']}
        />
      </div>

      <div className="grid grid-cols-2 gap-8 pt-8">
        <div className="border-t border-gray-400 text-center pt-2">
          <p className="font-bold">Firma del Paciente (o Acudiente)</p>
          <p className="text-xs" {...editableProps}>(Nombre y C.C.)</p>
        </div>
        <div className="border-t border-gray-400 text-center pt-2">
          <p className="font-bold">Firma del Funcionario que Recibe</p>
           <p className="text-xs" {...editableProps}>(Nombre y C.C.)</p>
        </div>
      </div>
    </div>
  );
}
