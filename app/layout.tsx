import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'The Babel Library — A Walking Exploration', icons: { icon: '/favicon.svg' }, description: 'A first-person exploration of the library in Steven L. Peck’s A Short Stay in Hell.' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
