'use client';

import type { StudyWithCompletedBy } from '@/lib/types';
import { format, intervalToDuration } from 'date-fns';
import { FACILITY_INFO } from './facility-info';

const SECTION_LABELS: Record<'tecnica' | 'informe' | 'conclusion', string[]> = {
    tecnica: ['TÉCNICA', 'TECNICA'],
    informe: ['INFORME', 'HALLAZGOS', 'DESCRIPCIÓN', 'DESCRIPCION'],
    conclusion: ['CONCLUSIÓN', 'CONCLUSION', 'IMPRESIÓN DIAGNÓSTICA', 'IMPRESION DIAGNOSTICA', 'IMPRESIÓN DX', 'IMPRESION DX']
};

const CRANIAL_CT_TECHNIQUE_TEXT =
    'Se realizó tomografía computarizada en equipo multidetector obteniéndose cortes axiales simples desde la base del cráneo hasta el vértex, con reconstrucciones multiplanares en ventana para parénquima y hueso, sin la administración de medio de contraste intravenoso.';

const normalizeForComparison = (value?: string) =>
    value ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isValidDate = (date: any): date is Date => date instanceof Date && !isNaN(date.getTime());

const getAgeString = (birthDate?: Date | null): string => {
    if (!isValidDate(birthDate)) return 'N/A';
    try {
        const duration = intervalToDuration({ start: birthDate, end: new Date() });

        const parts: string[] = [];
        if (duration.years && duration.years > 0) parts.push(`${duration.years} años`);
        if (duration.months && duration.months > 0) parts.push(`${duration.months} meses`);
        if (duration.days && duration.days > 0) parts.push(`${duration.days} días`);

        return parts.join(', ') || 'Recién nacido';
    } catch {
        return 'N/A';
    }
};

const toDate = (value?: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date && isValidDate(value)) return value;
    if (typeof (value as any)?.toDate === 'function') {
        const converted = (value as any).toDate();
        return isValidDate(converted) ? converted : null;
    }
    if (typeof value === 'string') {
        const isoDate = new Date(value);
        if (!isNaN(isoDate.getTime())) return isoDate;

        const parts = value.split(/[-/ ]/).map((part) => parseInt(part, 10));
        if (parts.length === 3 && parts.every((num) => !isNaN(num))) {
            let [a, b, c] = parts;
            if (a > 1900) {
                const parsed = new Date(a, (b || 1) - 1, c || 1);
                if (!isNaN(parsed.getTime())) return parsed;
            } else {
                const parsed = new Date(c || a, (b || 1) - 1, a > 12 ? b : a);
                if (!isNaN(parsed.getTime())) return parsed;
            }
        }
    }
    return null;
};

const getFormattedDateParts = (dateValue: Date | null) => ({
    date: dateValue ? format(dateValue, 'dd/MM/yyyy') : '---',
    time: dateValue ? format(dateValue, 'HH:mm') : '---'
});

const extractReportSections = (text: string) => {
    const sections: Record<'tecnica' | 'informe' | 'conclusion', string> = {
        tecnica: '',
        informe: '',
        conclusion: ''
    };

    if (!text || !text.trim()) {
        return sections;
    }

    const markers: Array<{ key: keyof typeof sections; index: number; length: number }> = [];

    (Object.entries(SECTION_LABELS) as Array<[keyof typeof sections, string[]]>).forEach(([key, labels]) => {
        for (const label of labels) {
            const regex = new RegExp(`${escapeRegExp(label)}\\s*[:\\n-]`, 'i');
            const match = regex.exec(text);
            if (match && typeof match.index === 'number') {
                markers.push({ key, index: match.index, length: match[0].length });
                break;
            }
        }
    });

    if (markers.length === 0) {
        sections.informe = text.trim();
        return sections;
    }

    markers.sort((a, b) => a.index - b.index);

    markers.forEach((marker, idx) => {
        const start = marker.index + marker.length;
        const end = idx + 1 < markers.length ? markers[idx + 1].index : text.length;
        sections[marker.key] = text.slice(start, end).trim();
    });

    if (!sections.informe) {
        const fallback = markers.find((marker) => marker.key === 'informe');
        if (fallback) {
            const start = fallback.index + fallback.length;
            const nextMarker = markers[markers.indexOf(fallback) + 1];
            sections.informe = text.slice(start, nextMarker?.index ?? text.length).trim();
        } else {
            sections.informe = text.trim();
        }
    }

    return sections;
};

const looksLikeHtml = (value: string) => /<[^>]+>/.test(value.trim());

const renderSectionContent = (content: string, fallback: string) => {
    if (!content || !content.trim()) {
        return <p className="text-gray-500 italic">{fallback}</p>;
    }

    if (looksLikeHtml(content)) {
        return <div className="space-y-2" dangerouslySetInnerHTML={{ __html: content }} />;
    }

    return content
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, idx) => (
            <p key={`${line}-${idx}`} className="text-justify">
                {line}
            </p>
        ));
};

type SectionBlockProps = {
    title: string;
    content: string;
    fallback: string;
};

const SectionBlock = ({ title, content, fallback }: SectionBlockProps) => (
    <div className="print-avoid-break text-[10pt] leading-relaxed" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <p className="font-bold uppercase tracking-wide mb-0 text-[10pt]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            {title}
        </p>
        <div className="mt-0.5">
            {renderSectionContent(content, fallback)}
        </div>
    </div>
);

interface ReportTemplateProps {
    study: StudyWithCompletedBy;
    reportText: string;
    radiologist: { name: string; specialty: string; register: string };
}

export function ReportTemplate({ study, reportText, radiologist }: ReportTemplateProps) {
    const patient = study.patient;
    const effectiveDate = toDate(study.readingDate) ?? toDate(study.completionDate) ?? toDate(study.requestDate) ?? new Date();
    const { date: formattedDate, time: formattedTime } = getFormattedDateParts(effectiveDate);

    const birthDate = toDate(patient.birthDate);
    const age = getAgeString(birthDate);
    const formattedBirthDate = birthDate ? format(birthDate, 'dd/MM/yyyy') : patient.birthDate || 'N/A';
    const studyNames = study.studies?.map((s) => s.nombre).filter(Boolean).join(', ') || 'SIN ESTUDIO REGISTRADO';
    const primaryStudyName = study.studies?.[0]?.nombre || '';
    const normalizedPrimaryStudy = normalizeForComparison(primaryStudyName);
    const isSimpleCranialCt =
        normalizedPrimaryStudy.includes('craneo') &&
        normalizedPrimaryStudy.includes('simple') &&
        (normalizedPrimaryStudy.includes('tomografia') || normalizedPrimaryStudy.includes('tac'));
    const insurer = patient.entidad || 'N/A';
    const documentId = [patient.idType, patient.id].filter(Boolean).join(' ').trim() || 'N/A';
    const patientSex = patient.sex || 'N/A';

    const headerMetaRows = [
        { label: 'Fecha', value: formattedDate },
        { label: 'Hora', value: formattedTime }
    ];

    const sections = extractReportSections(reportText || '');
    const techniqueContent = isSimpleCranialCt ? CRANIAL_CT_TECHNIQUE_TEXT : sections.tecnica;
    const techniqueFallback = isSimpleCranialCt ? CRANIAL_CT_TECHNIQUE_TEXT : 'No se registró la técnica del estudio.';
    const diagnosisCode = study.diagnosis?.code || 'N/A';
    const diagnosisDescription = study.diagnosis?.description || 'Sin descripción disponible';
    const reportSections: Array<{ key: string; title: string; content: string; fallback: string }> = [
        { key: 'technique', title: 'Técnica', content: techniqueContent, fallback: techniqueFallback },
        { key: 'report', title: 'Informe', content: sections.informe, fallback: 'Sin información del informe.' },
        { key: 'conclusion', title: 'Conclusión', content: sections.conclusion, fallback: 'Sin conclusión registrada.' }
    ];
    const patientInfoSection = (
        <section>
            <div className="bg-[#ECECEC] py-0.5 text-center font-semibold tracking-wide uppercase text-[8pt]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                Datos básicos del paciente
            </div>
            <div className="px-2.5 py-1.5 text-[7.5pt] leading-tight" style={{ fontFamily: 'Helvetica, "Trebuchet MS", Arial, sans-serif' }}>
                <div className="mt-1 mb-1 grid grid-cols-[1fr_2.1fr_1.2fr_0.9fr] gap-y-1 gap-x-2.5">
                    <div className="flex items-baseline">
                        <span className="font-semibold underline">Documento:</span>
                        <span className="ml-1">{documentId}</span>
                    </div>
                    <div className="flex items-baseline">
                        <span className="font-semibold underline">Nombre:</span>
                        <span className="ml-1">{patient.fullName || 'N/A'}</span>
                    </div>
                    <div className="flex items-baseline">
                        <span className="font-semibold underline">Fecha Nac.:</span>
                        <span className="ml-1">{formattedBirthDate}</span>
                    </div>
                    <div className="flex items-baseline">
                        <span className="font-semibold underline">Sexo:</span>
                        <span className="ml-1">{patientSex}</span>
                    </div>
                    <div className="flex items-baseline col-span-2">
                        <span className="font-semibold underline">Edad:</span>
                        <span className="ml-1">{age}</span>
                    </div>
                    <div className="flex items-baseline col-span-2">
                        <span className="font-semibold underline">Aseguradora:</span>
                        <span className="ml-1">{insurer}</span>
                    </div>
                </div>
            </div>
        </section>
    );

    return (
        <>
            <style jsx global>{`
                @page {
                    size: 8.5in 11in;
                    margin: 0.25in;
                }
                .report-wrapper {
                    background: #e2e8f0;
                }
                .report-container-shell {
                    background: #ffffff;
                    width: 8.5in;
                    min-height: 11in;
                    margin-left: auto;
                    margin-right: auto;
                    padding: 1.75rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    color: #1a1a1a;
                }
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .report-table td {
                    padding: 0;
                    vertical-align: top;
                }
                .print-avoid-break {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                @media print {
                    body {
                        background: #ffffff;
                    }
                    .report-wrapper {
                        background: transparent;
                        padding: 0;
                    }
                    .report-container-shell {
                        box-shadow: none;
                        padding: 0.2in;
                        width: 100%;
                        min-height: auto;
                    }
                    .report-table {
                        width: 100%;
                    }
                    .report-table thead {
                        display: table-header-group;
                    }
                    .report-table tbody {
                        display: table-row-group;
                    }
                    .report-table tfoot {
                        display: table-footer-group;
                    }
                }
            `}</style>
            <div className="report-wrapper bg-slate-200 print:bg-white py-5">
                <div className="report-container-shell" contentEditable suppressContentEditableWarning>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <td>
                                    <div className="report-header space-y-2">
                                        <section className="border border-black/70 px-3.5 py-1.75 space-y-1.55" style={{ borderTopWidth: '0.5px' }}>
                                            <div
                                                className="text-center font-bold tracking-wide uppercase"
                                                style={{ fontFamily: '"Times New Roman", serif', fontSize: '15pt', whiteSpace: 'nowrap', lineHeight: 1.38, letterSpacing: '0.06em' }}
                                            >
                                                {FACILITY_INFO.name}
                                            </div>
                                            <div className="grid grid-cols-[95px_1fr_180px] items-center gap-2.7">
                                                <div className="flex items-center justify-center">
                                                    <img src="/templates/mercado-logo.jpeg" alt="Logotipo Instituto del Sistema Nervioso de Córdoba" className="max-h-[95px] object-contain" />
                                                </div>
                                                <div className="text-center px-3 flex flex-col justify-center gap-0.9" style={{ fontFamily: '"Trebuchet MS", sans-serif', lineHeight: 1.35, letterSpacing: '0.02em' }}>
                                                    <p className="font-bold tracking-wide" style={{ fontSize: '11.3pt', paddingLeft: '13ch' }}>{FACILITY_INFO.reportTitle}</p>
                                                    <p className="text-[8.5pt] font-bold" style={{ paddingLeft: '13ch' }}>Código Prestador {FACILITY_INFO.providerCode}</p>
                                                    <p className="text-[8pt] leading-snug font-normal" style={{ textTransform: 'none', paddingLeft: '13ch', whiteSpace: 'nowrap' }}>{FACILITY_INFO.address}</p>
                                                    <p className="text-[8pt] font-normal" style={{ marginTop: '1px', textTransform: 'none', paddingLeft: '13ch' }}>{FACILITY_INFO.nit}</p>
                                                </div>
                                                <div
                                                    className="text-sm overflow-hidden border border-white/40 max-w-[150px] ml-auto self-end mr-0.5"
                                                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: '10pt' }}
                                                >
                                                    {headerMetaRows.map((row) => (
                                                        <div key={row.label} className="flex items-stretch border-b border-white last:border-b-0">
                                                            <span className="font-semibold uppercase text-[8.5pt] min-w-[60px] pr-1.5 flex items-end justify-end">{row.label}</span>
                                                            <span className="font-semibold text-left bg-[#f5f5f5] flex-none w-[90px] px-1.5 py-0.5 flex items-end">{row.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>

                                    </div>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="print-avoid-break align-top" style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem' }}>
                                    {patientInfoSection}
                                </td>
                            </tr>
                            <tr>
                                <td className="print-avoid-break" style={{ paddingTop: '0.15rem', paddingBottom: '0.35rem' }}>
                                    <section>
                                        <div className="bg-[#ECECEC] px-3.5 py-0.5 font-semibold uppercase tracking-wide text-center text-[8pt]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                            Descripción del servicio o procedimiento
                                        </div>
                                        <div className="px-3.5 py-1 text-justify leading-snug text-[7.5pt]" style={{ fontFamily: 'Helvetica, "Trebuchet MS", Arial, sans-serif' }}>
                                            <p>
                                                Apreciado doctor(a), envío a usted el resultado del presente estudio para su conocimiento y continuidad en el manejo clínico del paciente.
                                            </p>
                                        </div>
                                    </section>
                                </td>
                            </tr>
                            <tr>
                                <td className="print-avoid-break" style={{ paddingTop: '0.15rem', paddingBottom: '0.35rem' }}>
                                    <section>
        <div className="bg-[#d9d9ff] px-3.5 py-0.5 text-center font-bold uppercase tracking-wide text-[11pt]" style={{ fontFamily: '"Times New Roman", serif' }}>
            {studyNames}
        </div>
    </section>
                                </td>
                            </tr>
                            {reportSections.map((section, index) => (
                                <tr key={section.key}>
                                    <td
                                        style={{
                                            paddingTop: index === 0 ? '0.85rem' : '0.75rem',
                                            paddingBottom: index === reportSections.length - 1 ? '1.25rem' : '0.75rem'
                                        }}
                                        className="align-top"
                                    >
                                        <SectionBlock title={section.title} content={section.content} fallback={section.fallback} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>
                                    <section className="report-footer mt-8 text-[9pt] pb-4 space-y-3" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                        <div className="bg-[#ECECEC] px-4 py-0.75 font-semibold uppercase tracking-wide text-center text-[9pt]">
                                            Impresión diagnóstica
                                        </div>
                                        <div className="px-3 py-2 text-[8pt] leading-tight">
                                            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                                                <span className="font-semibold underline">Dx Principal:</span>
                                                <span>
                                                    {diagnosisCode} — {diagnosisDescription}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-[1fr_1fr_1fr] gap-8 items-end">
                                            <div className="flex flex-col items-center text-center">
                                                <p className="font-semibold uppercase tracking-wide">{radiologist.name}</p>
                                                <p>{radiologist.specialty || 'Especialista'}</p>
                                            </div>
                                            <div className="flex flex-col items-center text-center">
                                                <p className="font-semibold uppercase tracking-wide">{radiologist.register || 'N/A'}</p>
                                                <p>No. Registro</p>
                                            </div>
                                            <div className="flex flex-col items-center text-center">
                                                <div className="w-3/4 border-b border-black mb-2" />
                                                <p className="font-semibold uppercase tracking-wide">Firma del profesional</p>
                                            </div>
                                        </div>
                                    </section>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
    );
}
