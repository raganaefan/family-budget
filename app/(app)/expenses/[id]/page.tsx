// app/(app)/expenses/[id]/page.tsx
import ExpenseForm from "./ExpenseForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function EditExpensePage({
  params,
}: {
  // ⬇️ Next.js 15: params is Promise now
  params: Promise<{ id: string }>;
}) {
  // ⬇️ Unwrap dulu
  const { id } = await params;

  if (id === "new") {
    // Lebih baik redirect langsung ke halaman tambah
    return redirect("/expenses/new");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">
        Detail / Edit Pengeluaran
      </h1>

      <ExpenseForm expenseId={id} />
    </div>
  );
}
