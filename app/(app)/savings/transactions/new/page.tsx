// app/(app)/savings/transactions/new/page.tsx
import SavingsTransactionForm from "./SavingTransactionForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewSavingsTransactionPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/savings" // Kembali ke daftar tabungan
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Kembali ke Daftar Tabungan
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">
        Catat Transaksi Tabungan
      </h1>

      <SavingsTransactionForm />
    </div>
  );
}
