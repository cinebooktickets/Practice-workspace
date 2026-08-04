import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { Providers } from "@/components/providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "PrimeAssist",
  description: "AI-powered customer support platform",
}

type Props = {
  children: React.ReactNode
}

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
