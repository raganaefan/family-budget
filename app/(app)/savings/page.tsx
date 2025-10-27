// app/(app)/savings/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowLeft, Target, PlusCircle, TrendingUp } from "lucide-react";

// Helper (Anda bisa pindahkan ini ke file terpisah /lib/utils.ts)
function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Komponen Progress Bar (mirip BudgetBar tapi lebih fleksibel)
function ProgressBar({
  percentage,
}: {
  percentage: number | null | undefined;
}) {
  const pct = Math.max(0, Math.min(100, percentage || 0));
  const barColor = pct >= 100 ? "bg-green-500" : "bg-blue-500";

  return (
    <div className="h-4 w-full rounded-full bg-gray-200">
      <div
        className={`flex h-4 items-center justify-center rounded-full text-xs font-medium text-white ${barColor}`}
        style={{ width: `${pct}%` }}
      >
        {pct.toFixed(0)}%
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic"; // Perlu karena kita akan tambah fitur edit/add nanti

export default async function SavingsPage() {
  const supabase = await createClient(); // Gunakan versi async

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // 1. Ambil Household ID
  const { data: membership } = await supabase
    .from("memberships")
    .select("household_id") // Hanya perlu ID
    .eq("user_id", user.id)
    .single();

  if (!membership) return <div>Gagal memuat data household.</div>;
  const householdId = membership.household_id;

  // 2. Panggil RPC Savings Rollup
  const { data: savingsData, error: rpcError } = await supabase.rpc(
    "get_savings_rollup",
    { p_household_id: householdId }
  );

  if (rpcError) {
    return (
      <div className="text-red-500">
        Gagal memuat data tabungan: {rpcError.message}
      </div>
    );
  }

  // Hitung total tabungan keseluruhan
  const totalSavedAcrossGoals = savingsData.reduce(
    (sum, goal) => sum + (goal.current_amount || 0),
    0
  );

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

      {/* Header Halaman Tabungan */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Tabungan</h1>
          <p className="mt-1 text-lg text-gray-600">
            Lihat progres target tabungan Anda. Total tersimpan:
            <span className="font-semibold text-green-600">
              {" "}
              {formatCurrency(totalSavedAcrossGoals)}
            </span>
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          {/* TODO: Ganti Link ke Halaman Form */}
          <Link
            href="/savings/goals/new" // Halaman Tambah Goal Baru
            className="ml-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Target size={18} />
            Buat Target Baru
          </Link>
          <Link
            href="/savings/transactions/new" // Halaman Tambah Transaksi
            className="ml-3 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
          >
            <PlusCircle size={18} />
            Catat Transaksi
          </Link>
        </div>
      </div>

      {/* Daftar Target Tabungan */}
      <div className="space-y-5">
        {savingsData.length === 0 && (
          <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow-lg">
            Belum ada target tabungan. Ayo buat satu!
          </div>
        )}
        {savingsData.map((goal) => (
          <div
            key={goal.goal_id}
            className={`overflow-hidden rounded-lg bg-white shadow-lg ${
              !goal.active ? "opacity-60" : ""
            }`}
          >
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h3
                  className={`text-xl font-bold ${
                    !goal.active
                      ? "text-gray-500 line-through"
                      : "text-gray-900"
                  }`}
                >
                  {goal.goal_name}
                </h3>
                {!goal.active && (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    Nonaktif
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Terkumpul:{" "}
                <span className="font-medium text-gray-700">
                  {formatCurrency(goal.current_amount)}
                </span>
                {goal.target_amount > 0 && (
                  <span> / {formatCurrency(goal.target_amount)}</span>
                )}
              </p>
              {goal.target_date && (
                <p className="text-sm text-gray-500">
                  Target:{" "}
                  {format(parseISO(goal.target_date), "d MMMM yyyy", {
                    locale: id,
                  })}
                </p>
              )}
            </div>
            {goal.target_amount > 0 && (
              <div className="border-t border-gray-200 px-5 py-4">
                <ProgressBar percentage={goal.pct_achieved} />
                {goal.target_amount > 0 && goal.remaining_amount !== null && (
                  <p className="mt-2 text-right text-sm text-gray-600">
                    Kurang: {formatCurrency(goal.remaining_amount)}
                  </p>
                )}
              </div>
            )}
            {/* TODO: Tambahkan tombol Edit/Detail di sini */}
          </div>
        ))}
      </div>
    </div>
  );
}
