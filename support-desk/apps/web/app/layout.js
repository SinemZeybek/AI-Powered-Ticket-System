import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavbarWrapper from '@/app/components/NavbarWrapper';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Zeybek Hukuk Bürosu — AI Assistant",
  description: "AI-assisted customer support for Zeybek Hukuk Bürosu",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <NavbarWrapper />
        <main className="p-8">{children}</main>
      </body>
    </html>
  )
}