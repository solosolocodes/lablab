import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from '@/components/AuthProvider';
import { Toaster } from 'react-hot-toast';
import DebugMonitor from '@/components/DebugMonitor';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LabLab App",
  description: "A secure Next.js application with MongoDB integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased`}
      >
        <AuthProvider>
          <Toaster position="top-right" />
          {children}
          <DebugMonitor />
        </AuthProvider>
      </body>
    </html>
  );
}
