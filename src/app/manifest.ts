import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Jobfile',
    short_name: 'Jobfile',
    description: 'A shared record for home improvement projects.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf8f4',
    theme_color: '#c4813f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
