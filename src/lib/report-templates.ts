
/**
 * @fileOverview Contiene las plantillas de texto para la generación de informes radiológicos.
 * 
 * Cada clave en el objeto `reportTemplates` corresponde a un código CUPS de un estudio.
 * El valor es un string de plantilla que se centra únicamente en los hallazgos médicos.
 * Los datos del paciente y del médico se añaden por separado en la plantilla del PDF.
 */

export const reportTemplates: Record<string, string> = {
	'879111': `TÉCNICA:
Se realizó tomografía computarizada en equipo multidetector obteniéndose cortes axiales simples desde la base del cráneo hasta el vértex, con reconstrucciones multiplanares en ventana para parénquima y hueso, sin la administración de medio de contraste intravenoso.

INFORME:
Parénquima cerebral de morfología y densidad conservadas.

No se identifican colecciones extraaxiales, hemorragia aguda, ni áreas de hipodensidad que sugieran infarto establecido.

Sistema ventricular y espacios subaracnoideos de tamaño acorde para la edad. Hueso calvario y base craneal sin fracturas evidentes.

Senos paranasales y celdillas mastoideas permeables.

CONCLUSIÓN:
Tomografía axial computada de cráneo simple sin hallazgos agudos.

Correlacionar clínicamente.

Continuar vigilancia según evolución.`
};
