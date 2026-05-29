import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ChatSupport } from "@/components/ChatSupport";
import { SecurityScript } from "@/components/SecurityScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const serifFont = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDF Summarize | Premium Document Intelligence",
  description: "Elevate your document workflow with luxury AI‑powered PDF summarization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${serifFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SecurityScript />
        <AuthProvider>
          {children}
          <ChatSupport />
        </AuthProvider>
      </body>
    </html>
  );
}
