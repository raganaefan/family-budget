// app/(app)/dashboard/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth, parseISO, addMonths } from "date-fns";
import { id } from "date-fns/locale";
import {
  Wallet,
  PiggyBank,
  ShoppingBag,
  PlusCircle,
  Settings,
  LogOut,
  Edit2,
  CalendarDays,
  ListChecks, // NEW
  ArrowRight, // NEW
} from "lucide-react";
import MonthSelector from "../components/MonthSelector";

export const dynamic = "force-dynamic";

// NEW: tipe untuk recent expenses (raw & normalized)
type ExpenseRowRaw = {
  id: string;
  txn_date: string;
  amount: number;
  merchant: string | null;
  notes: string | null;
  category: { name: string }[] | { name: string } | null;
  payment_source: { name: string }[] | { name: string } | null;
};
type ExpenseListItem = {
  id: string;
  txn_date: string;
  amount: number;
  merchant: string | null;
  notes: string | null;
  category: { name: string } | null;
  payment_source: { name: string } | null;
};

// --- Helpers ---
function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function BudgetBar({ percentage }: { percentage: number | null }) {
  const pct = Math.max(0, Math.min(100, percentage || 0));
  let barColor = "bg-green-500";
  if (pct > 75) barColor = "bg-yellow-500";
  if (pct > 90) barColor = "bg-red-500";

  return (
    <div className="h-2 w-full rounded-full bg-gray-200">
      <div
        className={`h-2 rounded-full ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// --- Server Action Logout ---
async function LogoutButton() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/login");
}

// --- Page (Server Component) ---
export default async function DashboardPage({
  searchParams,
}: {
  // ⬇⬇⬇ sesuai permintaan: TIDAK diubah
  searchParams: Promise<{ month?: string }>;
}) {
  // Unwrap dulu
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("households(id, name, payday_start)")
    .eq("user_id", user.id)
    .single();

  if (membershipErr || !membership || !membership.households) {
    return (
      <div className="p-8 text-red-500">
        Gagal memuat data household. Silakan coba login ulang.
        <form action={LogoutButton} className="mt-4">
          <button
            type="submit"
            className="rounded bg-red-500 px-4 py-2 text-white"
          >
            Logout
          </button>
        </form>
      </div>
    );
  }

  // --- FIX utama: households bisa berupa array ATAU objek tergantung relasi
  const raw = membership.households as any;
  const household = Array.isArray(raw) ? raw[0] : raw;

  if (!household) {
    return (
      <div className="p-8 text-red-500">
        Household tidak ditemukan untuk user ini.
        <form action={LogoutButton} className="mt-4">
          <button
            type="submit"
            className="rounded bg-red-500 px-4 py-2 text-white"
          >
            Logout
          </button>
        </form>
      </div>
    );
  }

  const householdId = household.id as string;

  // --- Tentukan bulan default berbasis payday ---
  let defaultMonthISO: string;

  // Normalisasi input ?month (boleh "YYYY-MM" atau "YYYY-MM-01")
  const normalizeMonth = (raw?: string) => {
    if (!raw) return undefined;
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7) + "-01";
    if (/^\d{4}-\d{2}$/.test(s)) return s + "-01";
    return undefined;
  };

  const monthFromQuery = normalizeMonth(params?.month);

  if (monthFromQuery) {
    defaultMonthISO = monthFromQuery;
  } else {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const paydayStart = (household.payday_start as number | null) || 1;
    const calendarMonthStart = startOfMonth(today);

    const defaultMonthDate =
      dayOfMonth >= paydayStart
        ? addMonths(calendarMonthStart, 1)
        : calendarMonthStart;

    defaultMonthISO = format(defaultMonthDate, "yyyy-MM-01");
  }

  const selectedMonthISO = defaultMonthISO;
  const selectedMonthDate = parseISO(selectedMonthISO);
  const formattedMonth = format(selectedMonthDate, "MMMM yyyy", { locale: id });

  const { data: rollupData = [], error: rpcError } = await supabase.rpc(
    "get_budget_rollup",
    {
      p_household_id: householdId,
      p_month: selectedMonthISO,
    }
  );

  if (rpcError) {
    return (
      <div className="text-red-500">
        Gagal memuat data rollup: {rpcError.message}
      </div>
    );
  }

  const totals = (rollupData as any[]).reduce(
    (acc: { budget: number; actual: number }, row: any) => {
      acc.budget += row.budget_amount || 0;
      acc.actual += row.actual_amount || 0;
      return acc;
    },
    { budget: 0, actual: 0 }
  );
  const totalRemaining = totals.budget - totals.actual;

  // NEW: ambil 7 transaksi terbaru untuk widget ringkas
  const { data: recentRaw, error: recentErr } = await supabase
    .from("expenses")
    .select(
      `
      id,
      txn_date,
      amount,
      merchant,
      notes,
      category:category_id ( name ),
      payment_source:payment_source_id ( name )
    `
    )
    .eq("household_id", householdId)
    .eq("month", selectedMonthISO)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(7)
    .returns<ExpenseRowRaw[]>();

  if (recentErr) {
    console.error("Fail get recent expenses:", recentErr);
  }

  const recentExpenses: ExpenseListItem[] = (recentRaw ?? []).map((r) => ({
    id: r.id,
    txn_date: r.txn_date,
    amount: r.amount,
    merchant: r.merchant,
    notes: r.notes,
    category: Array.isArray(r.category) ? r.category[0] ?? null : r.category,
    payment_source: Array.isArray(r.payment_source)
      ? r.payment_source[0] ?? null
      : r.payment_source,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-lg text-gray-600">{household.name}</p>
        </div>

        <MonthSelector fallbackMonthISO={selectedMonthISO} />

        <form action={LogoutButton}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
          >
            <LogOut size={16} />
            Logout
          </button>
        </form>
      </header>

      {/* Ringkasan Total */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white p-5 shadow-lg">
          <div className="flex items-center">
            <div className="shrink-0">
              <Wallet className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="truncate text-sm font-medium text-gray-500">
                Sisa Anggaran
              </dt>
              <dd
                className={`text-3xl font-semibold ${
                  totalRemaining < 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {formatCurrency(totalRemaining)}
              </dd>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white p-5 shadow-lg">
          <div className="flex items-center">
            <div className="shrink-0">
              <PiggyBank className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="truncate text-sm font-medium text-gray-500">
                Total Anggaran
              </dt>
              <dd className="text-3xl font-semibold text-gray-900">
                {formatCurrency(totals.budget)}
              </dd>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white p-5 shadow-lg">
          <div className="flex items-center">
            <div className="shrink-0">
              <ShoppingBag className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="truncate text-sm font-medium text-gray-500">
                Total Pengeluaran
              </dt>
              <dd className="text-3xl font-semibold text-gray-900">
                {formatCurrency(totals.actual)}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Aksi */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href={`/expenses/new?month=${selectedMonthISO}`} // NEW: bawa month
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-center font-bold text-white shadow transition-all hover:bg-green-700"
        >
          <PlusCircle size={20} />
          Tambah Pengeluaran
        </Link>

        {/* NEW: Button ke halaman daftar pengeluaran */}
        <Link
          href={`/expenses?month=${selectedMonthISO}&page=1`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-center font-bold text-white shadow transition-all hover:bg-indigo-700"
        >
          <ListChecks size={20} />
          Lihat Pengeluaran
        </Link>

        <Link
          href={`/budgets?month=${selectedMonthISO}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-center font-bold text-white shadow transition-all hover:bg-blue-700"
        >
          <Settings size={20} />
          Atur Anggaran
        </Link>

        <Link
          href="/savings"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-3 text-center font-bold text-white shadow transition-all hover:bg-teal-700"
        >
          <PiggyBank size={20} />
          Tabungan
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href={`/reports?month=${selectedMonthISO}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-center font-bold text-white shadow transition-all hover:bg-purple-700"
        >
          <CalendarDays size={20} />
          Laporan Mingguan
        </Link>
        <Link
          href="/settings"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-700 px-6 py-3 text-center font-bold text-white shadow transition-all hover:bg-gray-800"
        >
          <Edit2 size={20} />
          Kelola Kategori
        </Link>
      </div>

      {/* NEW: Widget Transaksi Terbaru */}
      <div className="overflow-hidden rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Transaksi Terbaru –{" "}
            {format(selectedMonthDate, "MMMM yyyy", { locale: id })}
          </h2>
          <Link
            href={`/expenses?month=${selectedMonthISO}&page=1`}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Lihat semua
            <ArrowRight size={14} />
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="p-5 text-center text-gray-500">
            Belum ada transaksi bulan ini.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {recentExpenses.map((exp) => (
              <li key={exp.id} className="group hover:bg-gray-50">
                <Link href={`/expenses/${exp.id}`} className="block px-5 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-gray-900"
                        title={exp.merchant || "Tanpa Merchant"}
                      >
                        {exp.merchant || "-"}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {format(parseISO(exp.txn_date), "d MMM", {
                          locale: id,
                        })}
                        {exp.category?.name && ` • ${exp.category.name}`}
                        {exp.payment_source?.name &&
                          ` • ${exp.payment_source.name}`}
                      </p>
                      {exp.notes && (
                        <p
                          className="mt-0.5 line-clamp-2 text-xs text-gray-500"
                          title={exp.notes}
                        >
                          📝 {exp.notes}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-red-600">
                      -{formatCurrency(exp.amount)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rincian per Kategori */}
      <div className="overflow-hidden rounded-lg bg-white shadow-lg">
        <h2 className="border-b border-gray-200 p-5 text-xl font-semibold text-gray-900">
          Rincian Kategori - {formattedMonth}
        </h2>
        <ul className="divide-y divide-gray-200">
          {(rollupData as any[]).length === 0 && (
            <li className="p-5 text-center text-gray-500">
              Belum ada data untuk bulan ini.
            </li>
          )}
          {(rollupData as any[]).map((row: any) => (
            <li key={row.category_id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-medium text-gray-800">
                  {row.category_name}
                </span>
                <span
                  className={`font-semibold ${
                    row.remaining_amount < 0 ? "text-red-500" : "text-gray-800"
                  }`}
                >
                  {formatCurrency(row.actual_amount)}
                  <span className="text-sm font-normal text-gray-500">
                    {" "}
                    / {formatCurrency(row.budget_amount)}
                  </span>
                </span>
              </div>
              <BudgetBar percentage={row.pct_used} />
              <div className="text-right text-sm text-gray-600">
                Sisa: {formatCurrency(row.remaining_amount)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
