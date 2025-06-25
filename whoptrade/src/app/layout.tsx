'use client';

import './globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from 'sonner'
import { SupabaseProvider } from '@/hooks/use-supabase'
import { WhopAutoAuth } from '@/components/whop-auto-auth'

// Load Inter font
const inter = Inter({ subsets: ['latin'] })

// Prevent caching at the layout level
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Add cache control meta tags */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, max-age=0, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <title>WhopTrade</title>
        <meta name="description" content="Trading platform powered by Whop" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <SupabaseProvider>
            <WhopAutoAuth />
            <main className="min-h-screen">
              {children}
            </main>
            <Toaster />
            <SonnerToaster position="top-right" />
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
