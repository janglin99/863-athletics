import type { Metadata } from "next"
import { Barlow_Condensed, DM_Sans, Roboto_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
})

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
})

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: {
    default: "863 Athletics — Haines City's Premier Training Facility",
    template: "%s | 863 Athletics",
  },
  description:
    "Book your training session at 863 Athletics. Premium gym access, expert trainers, and seamless booking in Haines City, FL.",
  metadataBase: new URL("https://863athletics.com"),
  openGraph: {
    title: "863 Athletics",
    description: "Train Harder. Book Smarter.",
    siteName: "863 Athletics",
    type: "website",
    url: "https://863athletics.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "863 Athletics",
    description: "Train Harder. Book Smarter.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${barlowCondensed.variable} ${robotoMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-sans">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#111113",
              border: "1px solid #2A2A32",
              color: "#F5F5F7",
            },
          }}
        />
      </body>
    </html>
  )
}
