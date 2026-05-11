import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import Navbar from '@/components/Navbar'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AIAII',
  description: 'AIアバター権利のオークション — 唯一無二のAIアバターを売買・依頼 / AI Avatar Auction',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={`${geist.className} bg-[#FAFAF8] text-[#2C2C2C] min-h-screen`}>
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-8">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
