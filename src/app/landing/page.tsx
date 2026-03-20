
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AppLogoIcon } from '@/components/icons/app-logo-icon';
import { UploadCloud, FileText, Bell, Workflow, Cpu, ClipboardList, Mic } from 'lucide-react';
import Image from 'next/image';
import ScrollFloat from '../../components/app/scroll-float';
import ScrollFadeIn from '../../components/app/scroll-fade-in';

const features = [
  {
    icon: UploadCloud,
    title: 'Extracción Inteligente con IA',
    description: 'Carga o arrastra una orden médica y nuestra IA extraerá los datos del paciente y los estudios solicitados en segundos, minimizando errores manuales.',
    img: "https://picsum.photos/seed/feature-ai/1200/900",
    imgHint: "AI data extraction interface"
  },
  {
    icon: Workflow,
    title: 'Gestión y Flujo de Trabajo Unificado',
    description: 'Administra estudios de imagen e interconsultas desde un único panel, con flujos de trabajo claros, filtros potentes y estados personalizables para seguir cada solicitud de principio a fin.',
    img: "https://picsum.photos/seed/feature-dashboard/1200/900",
    imgHint: "dashboard data workflow"
  },
  {
    icon: ClipboardList,
    title: 'Administración y Auditoría Integral',
    description: 'Además de optimizar el flujo, Med-iTrack sirve como un sistema de registro robusto, facilitando la gestión de inventario de insumos y la generación de reportes detallados para auditoría y facturación.',
    img: "https://picsum.photos/seed/feature-admin/1200/900",
    imgHint: "medical audit inventory"
  },
  {
    icon: Mic,
    title: 'Informes Inteligentes y Visualización DICOM',
    description: 'Genera informes radiológicos usando plantillas, dictando con tu voz en tiempo real, o subiendo un audio para su transcripción automática. Además, nos preparamos para integrar visores DICOM como OHIF para un análisis clínico completo.',
    img: "https://picsum.photos/seed/feature-dicom/1200/900",
    imgHint: "DICOM viewer report"
  },
  {
    icon: Bell,
    title: 'Comunicación Instantánea',
    description: 'Notifica a los especialistas sobre interconsultas pendientes directamente a su WhatsApp y utiliza el centro de mensajes internos para comunicados urgentes, manteniendo a todo el equipo sincronizado.',
    img: "https://picsum.photos/seed/feature-comms/1200/900",
    imgHint: "notification bell message"
  },
];

const howItWorksSteps = [
    {
        icon: UploadCloud,
        title: "1. Carga la Orden",
        description: "Arrastra, pega o selecciona el archivo de la orden médica (imagen o PDF) en el panel de control. El sistema está listo para procesarla al instante."
    },
    {
        icon: Cpu,
        title: "2. La IA Procesa",
        description: "Nuestra inteligencia artificial especializada analiza el documento, identifica y extrae toda la información relevante: datos del paciente, diagnóstico y estudios solicitados."
    },
    {
        icon: FileText,
        title: "3. Gestiona y Actualiza",
        description: "La solicitud aparece automáticamente en tu tabla de trabajo. Desde ahí, actualiza su estado, añade notas, gestiona el contraste y sigue su progreso hasta completarla."
    }
];


export default function LandingPage() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/landing" className="flex items-center gap-3">
                        <AppLogoIcon className="h-8 w-8 text-primary" />
                        <h1 className="text-xl font-bold font-headline tracking-tight">
                            Med-iTrack Solutions<sup className="text-xs">&reg;</sup>
                        </h1>
                    </Link>
                    <Button asChild>
                        <Link href="/login">Acceder</Link>
                    </Button>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="container grid lg:grid-cols-2 gap-12 items-center py-20 md:py-32">
                    <div className="space-y-6">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-headline tracking-tighter">
                            Optimiza tu Flujo de Trabajo Clínico. <span className="text-primary">Inteligente y Eficaz.</span>
                        </h1>
                        <p className="max-w-2xl text-lg text-muted-foreground">
                            Med-iTrack es la plataforma definitiva para gestionar solicitudes de estudios de diagnóstico por imágenes e interconsultas médicas. Centraliza, agiliza y reduce errores.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button asChild size="lg" className="text-lg">
                                <Link href="/login">Acceder a Med-iTrack</Link>
                            </Button>
                        </div>
                    </div>
                    <div className="relative w-full h-80 lg:h-96 rounded-xl overflow-hidden shadow-2xl">
                         <Image
                            src="https://picsum.photos/seed/landing-hero/1200/800"
                            alt="Dashboard de Med-iTrack"
                            fill
                            style={{ objectFit: 'cover' }}
                            priority
                            data-ai-hint="medical dashboard interface"
                        />
                         <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent" />
                    </div>
                </section>

                {/* How it Works Section */}
                 <section className="bg-muted py-16 lg:py-20">
                    <div className="container">
                        <div className="text-center space-y-4 mb-16">
                             <ScrollFloat containerClassName="font-bold font-headline text-3xl md:text-4xl">Un Flujo de Trabajo Simplificado</ScrollFloat>
                            <p className="max-w-3xl mx-auto text-muted-foreground text-lg">
                                En solo tres pasos, transforma una orden médica en una solicitud gestionada.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                            {howItWorksSteps.map((step, index) => (
                                <ScrollFadeIn key={index}>
                                    <div className="text-center p-6 space-y-4">
                                        <div className="bg-background inline-block p-4 rounded-full mb-4 border shadow-sm">
                                            <step.icon className="h-10 w-10 text-primary" />
                                        </div>
                                        <h3 className="font-headline text-2xl font-semibold">{step.title}</h3>
                                        <p className="text-muted-foreground">{step.description}</p>
                                    </div>
                                </ScrollFadeIn>
                            ))}
                        </div>
                    </div>
                </section>


                {/* Features Spotlight Section */}
                <section className="py-20 lg:py-24">
                   <div className="container space-y-24">
                        {features.map((feature, index) => (
                             <ScrollFadeIn key={index}>
                                <div className="grid lg:grid-cols-2 gap-12 items-center">
                                   <div className={`space-y-6 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                                        <div className="inline-block bg-primary/10 p-3 rounded-full text-primary">
                                            <feature.icon className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-3xl md:text-4xl font-bold font-headline">{feature.title}</h3>
                                        <p className="text-lg text-muted-foreground">
                                            {feature.description}
                                        </p>
                                    </div>
                                    <div className={`relative w-full h-80 lg:h-96 rounded-xl overflow-hidden shadow-xl ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                                        <Image
                                            src={feature.img}
                                            alt={feature.title}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                            data-ai-hint={feature.imgHint}
                                        />
                                    </div>
                               </div>
                            </ScrollFadeIn>
                        ))}
                   </div>
                </section>
                
                {/* Call to Action Section */}
                <section className="py-20 lg:py-24">
                    <div className="container">
                        <ScrollFadeIn>
                            <div className="bg-muted rounded-xl p-12 text-center shadow-lg">
                                <ScrollFloat containerClassName="font-bold font-headline text-3xl md:text-4xl">¿Listo para Transformar tu Gestión Clínica?</ScrollFloat>
                                <p className="max-w-2xl mx-auto text-muted-foreground mt-4 mb-8 text-lg">
                                    Únete a la revolución digital en la gestión de salud. Accede ahora y descubre una forma más inteligente de trabajar.
                                </p>
                                <Button asChild size="lg" className="text-lg">
                                    <Link href="/login">Acceder a Med-iTrack</Link>
                                </Button>
                            </div>
                        </ScrollFadeIn>
                    </div>
                </section>
            </main>

            <footer className="border-t">
                <div className="container flex items-center justify-center h-16">
                    <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Med-iTrack. Todos los derechos reservados.</p>
                </div>
            </footer>
        </div>
    );
}
