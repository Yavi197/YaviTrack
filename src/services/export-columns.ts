/**
 * Definición unificada de columnas para exportación a Excel y Google Sheets
 * Garantiza que ambos formatos tengan la misma estructura
 */

export const EXPORT_COLUMNS = [
    'FECHA/HORA',
    'TIPO DE DOCUMENTO',
    'N° ID',
    'NOMBRE COMPLETO DEL PACIENTE',
    'SEXO',
    'ENTIDAD EPS',
    'FECHA DE NACIMIENTO',
    'EDAD',
    'CUPS',
    'NOMBRE DEL ESTUDIO REALIZADO',
    'CIE10',
    'DIAGNOSTICO',
    'SERVICIO',
    '# DE EXPOSICIONES',
    'T DE EXPOSICIÓN',
    'KV',
    'MA',
    'CTDI',
    'DLP',
    '# IMAG RECHAZADAS',
    'CAUSAS RECHAZO',
    '# ESTUDIOS REPETIDOS',
    'CAUSAS REPETIDOS',
    'RESPONSABLE DEL ESTUDIO',
    'CONTRASTE',
    'mL ADMINISTRADOS',
    'OBSERVACIONES',
    'ID FIRESTORE',
    'ESTADO ESTUDIO',
];

export const REMISSION_EXPORT_COLUMNS = [
    'FECHA/HORA', 'TIPO DE DOCUMENTO', 'N° ID', 'NOMBRE COMPLETO DEL PACIENTE', 'SEXO', 'ENTIDAD EPS', 'FECHA DE NACIMIENTO', 'EDAD',
    'CUPS', 'NOMBRE DEL ESTUDIO REALIZADO', 'CIE10', 'DIAGNOSTICO', 'OBSERVACIONES', 'ESPECIALISTA', 'REGISTRO MEDICO', 'CONTRASTADO',
    'SEDACION', 'NOTA DE CARGO', 'ORDEN MEDICA', 'EVOLUCION', 'AUTORIZACION', 'INFORMES', 'ESTADO REMISION', 'FECHA ESTADO', 'ID FIRESTORE'
];

export const INVENTORY_EXPORT_COLUMNS = [
    'FECHA/HORA', 'ID INSUMO', 'NOMBRE INSUMO', 'PRESENTACIÓN', 'SERVICIO', 'CANTIDAD', 'LOTE', 'PRECIO', 'UNIDAD', 'FECHA VENCIMIENTO', 'PROVEEDOR', 'OBSERVACIONES', 'USUARIO', 'UID'
];

export const EXCEL_HEADERS = [
    { header: 'FECHA/HORA', key: 'fecha', width: 20 },
    { header: 'TIPO DE DOCUMENTO', key: 'idType', width: 10 },
    { header: 'N° ID', key: 'id', width: 15 },
    { header: 'NOMBRE COMPLETO DEL PACIENTE', key: 'fullName', width: 30 },
    { header: 'SEXO', key: 'sex', width: 10 },
    { header: 'ENTIDAD EPS', key: 'entidad', width: 25 },
    { header: 'FECHA DE NACIMIENTO', key: 'birthDate', width: 15 },
    { header: 'EDAD', key: 'age', width: 10 },
    { header: 'CUPS', key: 'cups', width: 15 },
    { header: 'NOMBRE DEL ESTUDIO REALIZADO', key: 'studyName', width: 40 },
    { header: 'CIE10', key: 'diagCode', width: 10 },
    { header: 'DIAGNOSTICO', key: 'diagDesc', width: 30 },
    { header: 'SERVICIO', key: 'service', width: 15 },
    { header: '# DE EXPOSICIONES', key: 'numExposiciones', width: 20 },
    { header: 'T DE EXPOSICIÓN', key: 'tiempoExposicion', width: 20 },
    { header: 'DOSIS', key: 'dosis', width: 20 },
    { header: 'KV', key: 'kV', width: 10 },
    { header: 'MA', key: 'mA', width: 10 },
    { header: 'CTDI', key: 'ctdi', width: 10 },
    { header: 'DLP', key: 'dlp', width: 10 },
    { header: '# IMAG RECHAZADAS', key: 'numImagRechazadas', width: 25 },
    { header: 'CAUSAS RECHAZO', key: 'causasRechazo', width: 25 },
    { header: '# ESTUDIOS REPETIDOS', key: 'numEstudiosRepetidos', width: 25 },
    { header: 'CAUSAS REPETIDOS', key: 'causasRepetidos', width: 25 },
    { header: 'RESPONSABLE DEL ESTUDIO', key: 'responsable', width: 40 },
    { header: 'CONTRASTE', key: 'contraste', width: 15 },
    { header: 'mL ADMINISTRADOS', key: 'mlAdmin', width: 20 },
    { header: 'OBSERVACIONES', key: 'observaciones', width: 30 }
];
