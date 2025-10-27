import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SyncProvider from "@/app/(app)/components/SyncProvider"; // Kita akan buat ini

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Anggaran Keluarga",
  description: "Aplikasi budgeting keluarga bulanan",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        <SyncProvider /> {/* Tambahkan ini */}
      </body>
    </html>
  );
}
