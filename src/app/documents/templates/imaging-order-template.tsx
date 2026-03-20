'use client';

import type { StudyWithCompletedBy } from '@/lib/types';
import { format, intervalToDuration } from 'date-fns';
import { FACILITY_INFO } from './facility-info';

const isValidDate = (date: any): date is Date => date instanceof Date && !isNaN(date.getTime());

const toDate = (value?: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date && isValidDate(value)) return value;
    if (typeof (value as any)?.toDate === 'function') {
        const converted = (value as any).toDate();
        return isValidDate(converted) ? converted : null;
    }
    if (typeof value === 'string') {
        const isoDate = new Date(value);
        if (isValidDate(isoDate)) return isoDate;

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

const getAgeString = (birthDate?: Date | null): string => {
    if (!isValidDate(birthDate)) return 'N/A';
    try {
        const duration = intervalToDuration({ start: birthDate, end: new Date() });
        const years = duration.years ?? 0;
        const months = duration.months ?? 0;
        const days = duration.days ?? 0;

        if (years === 0 && months === 0 && days === 0) {
            return 'Recién nacido';
        }

        return [`${years} Años`, `${months} Meses`, `${days} Días`].join(', ');
    } catch {
        return 'N/A';
    }
};

const formatId = (type?: string, value?: string) => [type, value].filter(Boolean).join(' ') || '---';

interface ImagingOrderTemplateProps {
    study: StudyWithCompletedBy;
    specialist?: { name: string; register?: string; specialty?: string };
}

export function ImagingOrderTemplate({ study, specialist }: ImagingOrderTemplateProps) {
    const patient = study.patient;
    const documentDate = toDate(study.readingDate) ?? toDate(study.completionDate) ?? toDate(study.requestDate) ?? new Date();
    const { date: formattedDate, time: formattedTime } = getFormattedDateParts(documentDate);

    const birthDate = toDate(patient.birthDate);
    const patientAge = getAgeString(birthDate);
    const formattedBirth = birthDate ? format(birthDate, 'dd/MM/yyyy') : patient.birthDate || '---';
    const documentId = formatId(patient.idType, patient.id);

    const diagnosisPrimary = study.diagnosis
        ? `${study.diagnosis.code || ''}${study.diagnosis.code ? ' - ' : ''}${study.diagnosis.description || ''}`.trim()
        : '---';

    const studiesList = study.studies?.length
        ? study.studies.map((item) => ({
              code: item.cups || '---',
              name: item.nombre || 'Procedimiento sin nombre',
              details: item.details || ''
          }))
        : [];

    const administrator = patient.entidad || '---';
    const sex = patient.sex || '---';

    const headerMetaRows = [
        { label: 'Fecha', value: formattedDate },
        { label: 'Hora', value: formattedTime }
    ];

    return (
        <div className="order-wrapper bg-white print:bg-white py-5">
            <style jsx global>{`
                @page {
                    size: 8.5in 11in;
                    margin: 0.25in;
                }
                .order-wrapper {
                    background: #fff;
                    min-height: 100vh;
                    padding: 1.5rem 0;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                }
                .order-container {
                    background: #fff;
                    width: 8.5in;
                    min-height: 11in;
                    margin-left: auto;
                    margin-right: auto;
                    padding: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    border-radius: 6px;
                    color: #1a1a1a;
                    box-sizing: border-box;
                }
                .order-content {
                    max-width: 100%;
                    margin: 0;
                }
                @media print {
                    body {
                        background: #fff !important;
                    }
                    .order-wrapper {
                        background: #fff;
                        min-height: unset;
                        padding: 0;
                        display: block;
                    }
                    .order-container {
                        width: 100%;
                        padding: 0.2in;
                        min-height: auto;
                        box-shadow: none;
                        border-radius: 0;
                        box-sizing: border-box;
                    }
                    .order-content {
                        max-width: 100%;
                    }
                }
                .order-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .order-table td {
                    vertical-align: top;
                }
                .patient-info-table,
                .patient-info-table td {
                    border: 1px solid #a3a3a3;
                    border-collapse: collapse;
                }
                .patient-info-table {
                    width: 100%;
                    font-size: 10pt;
                }
                .patient-info-table td {
                    padding: 6px 8px;
                }
                .patient-info-label {
                    font-weight: 600;
                    font-family: 'Helvetica', 'Arial', sans-serif;
                }
                .label-space {
                    white-space: pre;
                    display: inline-block;
                }
                .label-align {
                    position: relative;
                    display: inline-block;
                }
                .label-align__ghost {
                    visibility: hidden;
                    display: block;
                    white-space: pre;
                }
                .label-align__content {
                    position: absolute;
                    left: 0;
                    top: 0;
                    white-space: nowrap;
                }
                .study-row {
                    font-family: 'Helvetica', 'Arial', sans-serif;
                    font-size: 8pt;
                    padding: 2px 12px 10px;
                }
                .study-grid {
                    display: grid;
                    grid-template-columns: 95px minmax(0, 1fr) 190px;
                    gap: 0;
                    align-items: stretch;
                }
                .study-cups {
                    padding: 4px 2px 4px 0;
                    font-weight: 500;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    font-size: 8pt;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                }
                .study-name {
                    padding: 4px 4px 4px 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    font-size: 8pt;
                    line-height: 1.35;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                }
                .study-observation {
                    padding: 4px 8px;
                    text-transform: uppercase;
                    font-size: 8pt;
                    letter-spacing: 0.03em;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                }
                @media print {
                    body {
                        background: #fff;
                    }
                    .order-wrapper {
                        background: transparent;
                        padding: 0;
                    }
                    .order-container {
                        box-shadow: none;
                        padding: 0.3in 0.4in;
                        width: 100%;
                        min-height: auto;
                    }
                    .order-table thead {
                        display: table-header-group;
                    }
                    .order-table tfoot {
                        display: table-footer-group;
                    }
                }
            `}</style>
            <div className="order-container" contentEditable suppressContentEditableWarning>
                <div className="order-content">
                <table className="order-table">
                    <thead>
                        <tr>
                            <td>
                                <div className="order-header space-y-2">
                                    <section className="border border-black/70 px-3.5 py-1.75 space-y-1.55" style={{ borderTopWidth: '0.5px' }}>
                                        <div
                                            className="text-center font-bold tracking-wide uppercase"
                                            style={{ fontFamily: '"Times New Roman", serif', fontSize: '15pt', whiteSpace: 'nowrap', lineHeight: 1.38, letterSpacing: '0.06em' }}
                                        >
                                            {FACILITY_INFO.name}
                                        </div>
                                        <div className="grid grid-cols-[95px_1fr_180px] items-center gap-2.7">
                                            <div className="flex items-center justify-center">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/templates/mercado-logo.jpeg" alt="Logotipo Instituto del Sistema Nervioso de Córdoba" className="max-h-[95px] object-contain" />
                                            </div>
                                            <div className="text-center px-3 flex flex-col justify-center gap-0.9" style={{ fontFamily: '"Trebuchet MS", sans-serif', lineHeight: 1.35, letterSpacing: '0.02em' }}>
                                                <p className="font-bold tracking-wide" style={{ fontSize: '11.3pt', paddingLeft: '13ch' }}>{FACILITY_INFO.orderTitle}</p>
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
                            <td className="pt-1.5">
                                <section>
                                    <div className="px-3 py-2 text-[8pt] leading-tight space-y-1" style={{ fontFamily: 'Helvetica, "Trebuchet MS", Arial, sans-serif' }}>
                                        <div className="grid grid-cols-[200px_1fr] gap-x-6 pb-1">
                                            <div className="grid grid-cols-[auto_1fr] items-baseline gap-0">
                                                <span className="label-align">
                                                    <span className="label-align__ghost" aria-hidden="true">Fecha Nac     </span>
                                                    <span className="label-align__content">
                                                        <span className="font-semibold underline">Documento</span>
                                                        <span className="label-space" aria-hidden="true">{'   '}</span>
                                                    </span>
                                                </span>
                                                <span className="font-semibold">{documentId}</span>
                                            </div>
                                            <div className="grid grid-cols-[auto_1fr] items-baseline gap-0">
                                                <span>
                                                    <span className="font-semibold underline">Nombre</span>
                                                    <span className="label-space" aria-hidden="true">{'   '}</span>
                                                </span>
                                                <span className="font-semibold">{patient.fullName || '---'}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-[200px_minmax(0,1fr)_150px] gap-x-6 pb-1 justify-items-start">
                                            <div className="grid grid-cols-[auto_1fr] items-baseline gap-0">
                                                <span>
                                                    <span className="font-semibold underline">Fecha Nacimiento</span>
                                                    <span className="label-space" aria-hidden="true">{'   '}</span>
                                                </span>
                                                <span className="font-semibold">{formattedBirth}</span>
                                            </div>
                                            <div className="grid grid-cols-[auto_1fr] items-baseline gap-0">
                                                <span className="label-align">
                                                    <span className="label-align__ghost" aria-hidden="true">Nombre   </span>
                                                    <span className="label-align__content">
                                                        <span className="font-semibold underline">Edad</span>
                                                        <span className="label-space" aria-hidden="true">{'   '}</span>
                                                    </span>
                                                </span>
                                                <span className="font-semibold">{patientAge}</span>
                                            </div>
                                            <div className="flex items-baseline gap-2 justify-self-start">
                                                <span className="font-semibold underline tracking-wide">Sexo</span>
                                                <span className="font-semibold">{sex}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-baseline pb-1">
                                            <span>
                                                <span className="font-semibold underline">Administradora</span>
                                                <span className="label-space" aria-hidden="true">{'   '}</span>
                                            </span>
                                            <span className="uppercase font-semibold">{administrator}</span>
                                        </div>
                                        <div className="flex items-baseline">
                                            <span>
                                                <span className="font-semibold underline">Diagnóstico Ppal</span>
                                                <span className="label-space" aria-hidden="true">{'          '}</span>
                                            </span>
                                            <span className="uppercase font-semibold">{diagnosisPrimary || '---'}</span>
                                        </div>
                                            <div className="flex items-baseline">
                                                <span>
                                                    <span className="font-semibold underline">Diagnóstico 1</span>
                                                    <span className="label-space" aria-hidden="true">{'          '}</span>
                                                </span>
                                                <span className="font-semibold">&nbsp;</span>
                                            </div>
                                            <div className="flex items-baseline">
                                                <span>
                                                    <span className="font-semibold underline">Diagnóstico 2</span>
                                                    <span className="label-space" aria-hidden="true">{'          '}</span>
                                                </span>
                                                <span className="font-semibold">&nbsp;</span>
                                            </div>
                                    </div>
                                </section>
                            </td>
                        </tr>
                        {studiesList.map((item, idx) => (
                            <tr key={`${item.code}-${idx}`}>
                                <td className="pt-1">
                                    <div className="study-row">
                                        <div className="study-grid">
                                            <div className="study-cups">{item.code}</div>
                                            <div className="study-name">{item.name}</div>
                                            <div className="study-observation">
                                                {item.details || study.observaciones || ''}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="pt-12">
                                <section className="grid grid-cols-3 gap-8 text-center text-[10pt]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                    <div className="space-y-2">
                                        <p className="text-[9pt] uppercase">{specialist?.name || study.orderingPhysician?.name || '---'}</p>
                                        <div className="border-t border-gray-500" />
                                        <p className="text-[9pt]">Especialista</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[9pt] uppercase">{specialist?.register || study.orderingPhysician?.register || '---'}</p>
                                        <div className="border-t border-gray-500" />
                                        <p className="text-[9pt]">N° registro</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="border-t border-gray-500" style={{ marginTop: '18px' }} />
                                        <p className="text-[9pt]">Firma del profesional</p>
                                    </div>
                                </section>
                            </td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            </div>
        </div>
    );
}
