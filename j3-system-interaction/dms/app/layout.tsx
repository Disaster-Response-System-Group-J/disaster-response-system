import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SocketProvider } from '@/context/SocketContext';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DMC Sri Lanka — Disaster Management System',
  description:
    'Real-time flood and landslide monitoring, incident reporting, and emergency coordination platform for Sri Lanka.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0f16] text-white`}>
        <AuthProvider> 
          <SocketProvider>
            {children}
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}