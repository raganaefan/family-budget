// app/(app)/reports/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth, parseISO, addMonths } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowLeft, BarChart2 } from "lucide-react";
import MonthSelector from "../components/MonthSelector";

export const dynamic = "force-dynamic";

// Helper untuk format mata uang IDR
function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Komponen Bar Sederhana
function ReportBar({ value, maxValue }: { value: number; maxValue: number }) {
  const safeMax = Math.max(1, maxValue); // hindari div by zero
  const percentage = safeMax > 0 ? (value / safeMax) * 100 : 0;
  return (
    <div className="w-full rounded-full bg-gray-200">
      <div
        className="h-6 rounded-full bg-blue-600 transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}

// Normalisasi query ?month agar selalu "YYYY-MM-01"
function normalizeMonth(raw?: string) {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7) + "-01";
  if (/^\d{4}-\d{2}$/.test(s)) return s + "-01";
  return undefined;
}

export default async function ReportsPage({
  searchParams,
}: {
  // ⬇⬇⬇ Perubahan utama: searchParams adalah Promise di App Router terbaru
  searchParams: Promise<{ month?: string }>;
}) {
  // Unwrap Promise dulu
  const params = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // 1. Ambil Household ID DAN payday_start
  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("households(id, name, payday_start)")
    .eq("user_id", user.id)
    .single();

  if (membershipErr || !membership?.households) {
    return <div>Gagal memuat data household.</div>;
  }

  const household = membership.households;
  const householdId = household.id;

  // 2. LOGIKA BARU - Tentukan bulan default berbasis payday
  let defaultMonthISO: string;

  const monthFromQuery = normalizeMonth(params?.month);
  if (monthFromQuery) {
    defaultMonthISO = monthFromQuery;
  } else {
    // Jika tidak ada, hitung default berdasarkan payday
    const today = new Date();
    const dayOfMonth = today.getDate();
    const paydayStart = household.payday_start || 1;
    const calendarMonthStart = startOfMonth(today);

    const defaultMonthDate =
      dayOfMonth >= paydayStart
        ? addMonths(calendarMonthStart, 1)
        : calendarMonthStart;

    defaultMonthISO = format(defaultMonthDate, "yyyy-MM-01");
  }

  const selectedMonthISO = defaultMonthISO;

  // 3. Panggil RPC Laporan Mingguan dengan bulan yang benar
  const { data: weeklyData = [], error: rpcError } = await supabase.rpc(
    "get_weekly_rollup",
    {
      p_household_id: householdId,
      p_month: selectedMonthISO,
    }
  );

  if (rpcError) {
    return (
      <div className="text-red-500">
        Gagal memuat laporan mingguan: {rpcError.message}
      </div>
    );
  }

  // Hitung total/max untuk visualisasi bar (aman saat kosong)
  const maxAmount =
    weeklyData.length > 0
      ? Math.max(...weeklyData.map((w: any) => w.total_amount || 0))
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard?month=${selectedMonthISO}`}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-lg">
        {/* Header Kartu */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Laporan Mingguan
              </h1>
              <p className="mt-1 text-lg text-gray-600">
                Total Pengeluaran per Minggu
              </p>
            </div>
          </div>

          <div className="mt-4">
            <MonthSelector fallbackMonthISO={selectedMonthISO} />
          </div>
        </div>

        {/* Daftar Laporan Mingguan */}
        <ul className="divide-y divide-gray-200">
          {weeklyData.length === 0 && (
            <li className="p-6 text-center text-gray-500">
              Belum ada pengeluaran di bulan ini.
            </li>
          )}
          {weeklyData.map((row: any) => (
            <li key={row.week_start_date} className="space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-medium text-gray-800">
                  {/* Postgres mengembalikan 'YYYY-MM-DD' */}
                  Minggu (mulai{" "}
                  {format(parseISO(row.week_start_date), "d MMM", {
                    locale: id,
                  })}
                  )
                </span>
                <span className="text-xl font-semibold text-gray-900">
                  {formatCurrency(row.total_amount)}
                </span>
              </div>
              <ReportBar value={row.total_amount || 0} maxValue={maxAmount} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
