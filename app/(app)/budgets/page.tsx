// app/(app)/budgets/page.tsx

// 1. Pindahkan 'use client' ke komponen internal
// "use client"; // <-- HAPUS DARI SINI

// 2. Impor Suspense di sini
import { Suspense } from "react";
import { Loader2 } from "lucide-react"; // Impor Loader2 untuk fallback

// --- Komponen Internal (yang berisi semua logika klien) ---
import BudgetsClientContent from "./BudgetsClientContent";

// --- Komponen Halaman Wrapper (yang diekspor) ---
export default function BudgetsPage() {
  // Komponen ini (wrapper) bisa jadi Server Component (tidak ada 'use client')
  // atau Client Component, tapi intinya adalah membungkus dengan Suspense

  // Tentukan fallback yang akan tampil saat Suspense aktif
  const fallbackUI = (
    <div className="space-y-6">
      {/* Skeleton untuk tombol kembali */}
      <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
      {/* Skeleton untuk kartu utama */}
      <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    </div>
  );

  return (
    // 3. Bungkus komponen internal dengan Suspense
    <Suspense fallback={fallbackUI}>
      <BudgetsClientContent />
    </Suspense>
  );
}
