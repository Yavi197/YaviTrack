import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import { AuthProvider } from '@/context/auth-context';
import { Toaster } from "@/components/ui/toaster";
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import { ServiceWorkerReset } from '@/components/app/service-worker-reset';

const APP_NAME = "Med-iTrack";
const APP_DESCRIPTION = "Sistema de gestión y seguimiento para solicitudes de estudios de diagnóstico por imágenes.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: "%s - " + APP_NAME,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};


const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <AuthProvider>
            <ServiceWorkerReset />
            {children}
            <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
