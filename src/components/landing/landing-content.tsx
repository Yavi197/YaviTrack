"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  BrainCircuit, 
  ArrowRight,
  Database,
  Stethoscope,
  Microscope,
  ShieldCheck,
  Zap,
  Globe,
  Layout
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AppLogoIcon } from '@/components/icons/app-logo-icon';

export function LandingContent() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Navbar Minimalista */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-zinc-100">
              <AppLogoIcon className="h-8 w-8 text-blue-600" />
            </div>
            <span className="text-2xl font-black text-zinc-900">
              Med-<span className="text-amber-500 lowercase mr-[0.05em]">i</span>Track
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 mr-8">
            <a href="#features" className="text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors">Características</a>
            <a href="#ia" className="text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors">Inteligencia Artificial</a>
          </div>
          <Link href="/login">
            <Button className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-8 font-bold tracking-tight transition-all hover:scale-105 active:scale-95 shadow-lg shadow-zinc-200">
              Acceder al Sistema
            </Button>
          </Link>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-40 pb-20 px-6 relative">
          {/* Fondo Decorativo Avanzado */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] -z-10 overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-50 blur-[120px] rounded-full opacity-60" />
            <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] bg-indigo-50 blur-[120px] rounded-full opacity-60" />
          </div>
          
          <div className="max-w-6xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 shadow-sm"
            >
              <BrainCircuit className="h-4 w-4" />
              Potenciado por Inteligencia Artificial de Vanguardia
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl md:text-9xl font-black tracking-tighter text-zinc-900 mb-8 leading-[0.85]"
            >
              Gestión Médica <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Redefinida.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-zinc-500 max-w-3xl mx-auto mb-12 font-medium leading-relaxed"
            >
              Centralice su flujo operativo con extracción automática de datos, 
              seguimiento en tiempo real y una experiencia de usuario diseñada para la excelencia.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Link href="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-12 py-8 text-xl font-black tracking-tight flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-200 group">
                  Entrar a Med-iTrack <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 border-y border-zinc-100 my-10 bg-zinc-50/30 rounded-[3rem]">
           <StatItem value="99.9%" label="Precisión IA" />
           <StatItem value="< 2s" label="Procesamiento" />
           <StatItem value="24/7" label="Operatividad" />
           <StatItem value="100%" label="Seguridad" />
        </section>

        {/* Features Preview */}
        <section id="features" className="py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-4">Módulos Inteligentes</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Todo lo que su clínica necesita en un solo lugar</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Microscope} 
              title="Imagenología" 
              description="Control total de RX, Ecografías y TAC. Gestión de turnos y lectura de informes centralizada."
              color="blue"
            />
            <FeatureCard 
              icon={Stethoscope} 
              title="Interconsultas" 
              description="Gestión fluida de especialidades médicas con notificaciones automáticas vía WhatsApp."
              color="indigo"
            />
            <FeatureCard 
              icon={BrainCircuit} 
              title="Extracción por IA" 
              description="Capture datos de órdenes físicas al instante. Nuestra IA procesa diagnósticos y estudios automáticamente."
              color="emerald"
            />
          </div>
        </section>

        {/* IA Section - Showcase */}
        <section id="ia" className="py-32 bg-zinc-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 blur-[150px] rounded-full" />
            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-white/10">
                        <Zap className="h-4 w-4 text-blue-400" />
                        Next-Gen Intelligence
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black tracking-tighter italic mb-8 leading-none">IA que Lee <br/> <span className="text-blue-500">como un experto.</span></h2>
                    <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-10 max-w-lg">
                        Olvídese del ingreso manual de datos. Med-iTrack utiliza modelos avanzados de Gemini para procesar órdenes manuscritas y digitales con precisión quirúrgica.
                    </p>
                    <div className="space-y-6 text-zinc-300 font-bold uppercase tracking-[0.05em] text-sm">
                        <div className="flex items-center gap-4"><ShieldCheck className="h-6 w-6 text-blue-500" /> Validación de Códigos CUPS automática</div>
                        <div className="flex items-center gap-4"><Globe className="h-6 w-6 text-blue-500" /> Clasificación de especialidades multicanal</div>
                        <div className="flex items-center gap-4"><Layout className="h-6 w-6 text-blue-500" /> Integración directa con Google Sheets</div>
                    </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="relative"
                >
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 aspect-square rounded-[3.5rem] p-1 shadow-2xl overflow-hidden group">
                        <div className="bg-zinc-900 h-full w-full rounded-[3.2rem] flex flex-col p-10 relative overflow-hidden">
                             {/* Mockup de IA */}
                             <div className="flex-grow flex flex-col items-center justify-center gap-6">
                                <div className="h-2 w-48 bg-blue-500/20 rounded-full overflow-hidden">
                                    <motion.div 
                                      animate={{ x: [-200, 200] }}
                                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                      className="h-full w-24 bg-blue-500 shadow-[0_0_15px_blue]"
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-blue-400 font-black text-xs uppercase tracking-widest mb-1">Escaneando Orden...</p>
                                    <p className="text-zinc-500 text-[10px] font-bold">Inferencia Gemini-Pro-Vision 2.5</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <div className="h-10 bg-white/5 rounded-xl border border-white/5 animate-pulse" />
                                    <div className="h-10 bg-white/5 rounded-xl border border-white/5 animate-pulse delay-75" />
                                    <div className="h-10 bg-white/5 rounded-xl border border-white/5 animate-pulse delay-150" />
                                    <div className="h-10 bg-white/5 rounded-xl border border-white/5 animate-pulse delay-200" />
                                </div>
                             </div>
                        </div>
                    </div>
                    {/* Floating badges */}
                    <div className="absolute -top-10 -right-10 bg-white text-zinc-900 p-6 rounded-3xl shadow-2xl rotate-12 hidden md:block border border-zinc-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Accuracy</p>
                        <p className="text-3xl font-black tracking-tight leading-none italic">99.8%</p>
                    </div>
                </motion.div>
            </div>
        </section>

        {/* CTA Section */}
        <section className="py-40 px-6 text-center">
            <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-10 leading-none">¿Listo para <span className="text-blue-600">evolucionar?</span></h2>
            <Link href="/login">
                <Button className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-16 py-10 text-2xl font-black tracking-tight flex items-center gap-4 mx-auto transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-zinc-200">
                  Comienza Ahora <ArrowRight className="h-8 w-8" />
                </Button>
            </Link>
        </section>
      </main>

      <footer className="py-20 text-center border-t border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center justify-center gap-3 mb-8 grayscale opacity-50">
           <span className="text-2xl font-black text-zinc-900">Med-<span className="text-amber-500 lowercase mr-[0.05em]">i</span>Track</span>
        </div>
        <div className="flex justify-center gap-10 mb-10 text-xs font-black uppercase tracking-widest text-zinc-400">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Términos</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Soporte</a>
        </div>
        <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">© 2026 Med-iTrack Systems - Designed for Modern Healthcare.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 group-hover:bg-blue-600 shadow-blue-100',
    indigo: 'text-indigo-600 group-hover:bg-indigo-600 shadow-indigo-100',
    emerald: 'text-emerald-600 group-hover:bg-emerald-600 shadow-emerald-100',
  };

  return (
    <div className="p-12 rounded-[3.5rem] bg-zinc-50/50 border border-zinc-100 hover:bg-white hover:shadow-2xl hover:shadow-zinc-200/50 transition-all duration-700 group flex flex-col items-center text-center">
      <div className={cn("bg-white h-20 w-20 rounded-3xl flex items-center justify-center shadow-sm mb-10 group-hover:scale-110 transition-all duration-700", colorMap[color])}>
        <Icon className={cn("h-10 w-10 transition-colors duration-700 group-hover:text-white")} />
      </div>
      <h3 className="text-3xl font-black tracking-tight text-zinc-900 mb-6 uppercase leading-tight">{title}</h3>
      <p className="text-zinc-500 font-medium text-lg leading-relaxed">{description}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string, label: string }) {
    return (
        <div className="text-center py-6">
            <p className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 italic mb-2">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{label}</p>
        </div>
    )
}
