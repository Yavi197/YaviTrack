
import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Medi-Track',
    short_name: 'Medi-Track',
    description: 'Sistema de gestión y seguimiento para solicitudes de estudios de diagnóstico por imágenes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff',
    theme_color: '#fff',
    icons: [
      {
        src: '/icons/app-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/app-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
