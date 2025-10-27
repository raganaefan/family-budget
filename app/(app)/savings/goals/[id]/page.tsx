// app/(app)/savings/goals/[id]/page.tsx
import SavingsGoalForm from "./SavingsGoalForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// ✅ params sekarang Promise, jadi fungsi harus async
export default async function SavingsGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ Unwrap promise sebelum digunakan
  const resolvedParams = await params;
  const isNew = resolvedParams.id === "new";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/savings"
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Kembali ke Daftar Tabungan
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">
        {isNew ? "Buat Target Tabungan Baru" : "Edit Target Tabungan"}
      </h1>

      <SavingsGoalForm goalId={isNew ? null : resolvedParams.id} />
    </div>
  );
}
