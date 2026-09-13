import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'The Library of Babel — A Walking Exploration', icons: { icon: '/favicon.svg' }, description: 'An independent first-person exploration of a vast procedural library containing every possible book of a fixed format.' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
