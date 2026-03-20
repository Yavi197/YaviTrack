import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

// Icon SVGs (puedes reemplazar por tus propios componentes o SVGs)
const RemissionIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#16a34a"/><path d="M8 12h8M8 16h8M8 8h8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
);
const ImagingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#2563eb"/><path d="M7 12h10M7 16h10M7 8h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
);
const ConsultIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#22c55e"/><path d="M8 12h8M8 16h8M8 8h8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
);

const modules = [
  { name: "Remisiones", href: "/remissions", icon: <RemissionIcon /> },
  { name: "Imágenes", href: "/dashboard/imaging", icon: <ImagingIcon /> },
  { name: "Consultas", href: "/dashboard/consultations", icon: <ConsultIcon /> },
];

export function AppHeader() {
  const pathname = usePathname();
  // Detectar módulo actual
  const currentModule = pathname ? modules.find(m => pathname.startsWith(m.href)) : null;
  // Mostrar solo los otros módulos
  const visibleModules = modules.filter(m => m.href !== currentModule?.href);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b">
      <div className="flex items-center gap-2">
        <Image src="/icons/logo.svg" alt="Med-iTrack" width={32} height={32} />
        <span className="font-bold text-xl text-gray-900">Med-iTrack</span>
      </div>
      <nav className="flex items-center gap-3">
        {visibleModules.map(m => (
          <Link key={m.name} href={m.href} className="rounded-full bg-white shadow flex items-center px-2 py-1 gap-2 hover:bg-gray-100 transition">
            <span className="w-8 h-8 flex items-center justify-center">{m.icon}</span>
            <span className="font-semibold text-sm text-gray-700">{m.name}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
