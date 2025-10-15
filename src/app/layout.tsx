import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { theme } from './theme';

const inter = Inter({ subsets: ['latin'] });

const horas = localFont({
  src: [
    {
      path: '../../public/fonts/Horas-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Horas-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Horas-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Horas-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Horas-Black.ttf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-horas',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Searching The Fox - Job Search Platform",
  description: "Find your perfect job with Searching The Fox - a comprehensive platform to lookup job postings from different job boards including LinkedIn, Indeed, and Glassdoor all in one place. Advanced search and filtering capabilities.",
  keywords: "job search, job board, linkedin jobs, indeed jobs, glassdoor jobs, job aggregator, job finder, career search, employment",
  authors: [{ name: "Searching The Fox" }],
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
    ],
    apple: [
      { url: '/favicon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
  },
  openGraph: {
    title: "Searching The Fox - Job Search Platform",
    description: "Find your perfect job with Searching The Fox - a comprehensive platform to lookup job postings from different job boards all in one place.",
    type: "website",
    images: [
      {
        url: '/favicon.png',
        width: 512,
        height: 512,
        alt: 'Searching The Fox Logo',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#37352f" />
      </head>
      <body className={`${inter.className} ${horas.variable}`} suppressHydrationWarning>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <AuthProvider>
            <Notifications />
            {children}
          </AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
