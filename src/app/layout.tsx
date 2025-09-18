import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
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
  openGraph: {
    title: "Searching The Fox - Job Search Platform",
    description: "Find your perfect job with Searching The Fox - a comprehensive platform to lookup job postings from different job boards all in one place.",
    type: "website",
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
      </head>
      <body className={`${inter.className} ${horas.variable}`} suppressHydrationWarning>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
