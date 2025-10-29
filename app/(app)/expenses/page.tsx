// app/(app)/expenses/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth, parseISO, addMonths } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowLeft, ListChecks, ArrowRight, Plus } from "lucide-react";
import MonthSelector from "../components/MonthSelector";

// --- TYPES ---
type HouseholdData = { id: string; name: string; payday_start: number };
type MembershipWithHousehold = { households: HouseholdData[] | null };
// Bentuk mentah dari Supabase: relasi bisa array ATAU object
type ExpenseRowRaw = {
  id: string;
  txn_date: string;
  amount: number;
  merchant: string | null;
  notes: string | null;
  category: { name: string }[] | { name: string } | null;
  payment_source: { name: string }[] | { name: string } | null;
};

// Bentuk final yang dipakai render (seperti definisi kamu)
type ExpenseListItem = {
  id: string;
  txn_date: string;
  amount: number;
  merchant: string | null;
  notes: string | null;
  category: { name: string } | null;
  payment_source: { name: string } | null;
};

export const dynamic = "force-dynamic";

// --- Helpers ---
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeMonth(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7) + "-01";
  if (/^\d{4}-\d{2}$/.test(s)) return s + "-01";
  console.warn(`Invalid month format found: "${raw}". Falling back.`);
  return undefined;
}

const PAGE_SIZE = 20; // NEW: ukuran halaman

// --- Page Component ---
export default async function ExpensesListPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; page?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Fetch household
  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("households(id, name, payday_start)")
    .eq("user_id", user.id)
    .single<MembershipWithHousehold>();

  if (membershipErr || !membership?.households) {
    console.error("Error fetching membership/household:", membershipErr);
    return <div>Gagal memuat data household. Silakan login ulang.</div>;
  }

  const household = Array.isArray(membership.households)
    ? membership.households[0]
    : membership.households;

  if (!household) {
    console.error("Household data is null after normalization.");
    return <div>Gagal memuat data household (data null).</div>;
  }

  const householdId = household.id as string;

  // --- Determine Month ---
  let defaultMonthISO: string;
  const monthFromQuery = normalizeMonth(params?.month);

  if (monthFromQuery) {
    defaultMonthISO = monthFromQuery;
  } else {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const paydayStart = household.payday_start || 1;
    const calendarMonthStart = startOfMonth(today);

    const defaultMonthDate =
      dayOfMonth >= paydayStart
        ? addMonths(calendarMonthStart, 1)
        : calendarMonthStart;

    defaultMonthISO = format(defaultMonthDate, "yyyy-MM-01");

    if (!params?.month) {
      return redirect(`/expenses?month=${defaultMonthISO}`);
    }
  }

  const selectedMonthISO = defaultMonthISO;

  // --- Pagination ---
  const pageRaw = params?.page ?? "1";
  const pageParsed = Number.parseInt(pageRaw, 10);
  const currentPage =
    Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1; // NEW
  const from = (currentPage - 1) * PAGE_SIZE; // NEW
  const to = from + PAGE_SIZE - 1; // NEW

  // --- Fetch Expenses (with count & range) ---
  const {
    data: expenses,
    error: expensesError,
    count,
  } = await supabase
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
  `,
      { count: "exact" }
    )
    .eq("household_id", householdId)
    .eq("month", selectedMonthISO)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<ExpenseRowRaw[]>(); // ⬅️ penting

  if (expensesError) {
    console.error("Error fetching expenses:", expensesError);
    return (
      <div className="text-red-500">
        Gagal memuat daftar pengeluaran: {expensesError.message}
      </div>
    );
  }

  const totalItems = count ?? 0; // NEW
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE)); // NEW

  // Jika user minta page lebih besar dari totalPages, arahkan ke halaman terakhir
  if (currentPage > totalPages && totalItems > 0) {
    return redirect(`/expenses?month=${selectedMonthISO}&page=${totalPages}`); // NEW
  }

  const rawRows = expenses ?? [];

  const validExpenses: ExpenseListItem[] = rawRows.map((r) => ({
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

  // Helpers untuk link pagination (preserve bulan)
  const buildPageHref = (p: number) =>
    `/expenses?month=${encodeURIComponent(selectedMonthISO)}&page=${p}`; // NEW

  const hasPrev = currentPage > 1; // NEW
  const hasNext = currentPage < totalPages; // NEW

  // --- Render JSX ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard?month=${selectedMonthISO}`}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>

        {/* NEW: Tombol Tambah Pengeluaran */}
        <Link
          href={`/expenses/new?month=${selectedMonthISO}`}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
        >
          <Plus size={16} />
          Tambah Pengeluaran
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-lg">
        {/* Card Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ListChecks className="h-8 w-8 text-gray-700" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Daftar Pengeluaran
                </h1>
                <p className="mt-1 text-lg text-gray-600">
                  Semua transaksi tercatat
                </p>
              </div>
            </div>

            {/* NEW: Info ringkas halaman */}
            <div className="text-right text-sm text-gray-500">
              <div>Total item: {totalItems}</div>
              <div>
                Halaman {currentPage} / {totalPages}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <MonthSelector fallbackMonthISO={selectedMonthISO} />
          </div>
        </div>

        {/* Expense List */}
        <ul className="divide-y divide-gray-200">
          {validExpenses.length === 0 && (
            <li className="p-6 text-center text-gray-500">
              Belum ada pengeluaran tercatat di bulan ini.
            </li>
          )}
          {validExpenses.map((exp: ExpenseListItem) => (
            <li key={exp.id} className="group relative hover:bg-gray-50">
              <Link href={`/expenses/${exp.id}`} className="block px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  {/* Left */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-600 shrink-0">
                      <span>
                        {format(parseISO(exp.txn_date), "d", { locale: id })}
                      </span>
                      <span className="-mt-1">
                        {format(parseISO(exp.txn_date), "MMM", { locale: id })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-base font-medium text-gray-800"
                        title={exp.merchant || "Tanpa Merchant"}
                      >
                        {exp.merchant || "-"}
                      </p>
                      <p className="truncate text-sm text-gray-500">
                        {exp.category?.name || (
                          <span className="italic text-gray-400">
                            Tanpa Kategori
                          </span>
                        )}
                        {exp.payment_source?.name &&
                          ` • ${exp.payment_source.name}`}
                      </p>
                      {exp.notes && (
                        <p
                          className="mt-0.5 truncate text-xs text-gray-500"
                          title={exp.notes}
                        >
                          📝 {exp.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Right */}
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap text-base font-semibold text-red-600">
                      -{formatCurrency(exp.amount)}
                    </span>
                    <ArrowRight
                      size={16}
                      className="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* NEW: Pagination Controls */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <Link
              href={hasPrev ? buildPageHref(currentPage - 1) : "#"}
              aria-disabled={!hasPrev}
              className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                hasPrev
                  ? "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Sebelumnya
            </Link>
            <Link
              href={hasNext ? buildPageHref(currentPage + 1) : "#"}
              aria-disabled={!hasNext}
              className={`relative ml-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                hasNext
                  ? "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Selanjutnya
            </Link>
          </div>

          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">
              Menampilkan{" "}
              <span className="font-medium">
                {totalItems === 0 ? 0 : from + 1}
              </span>{" "}
              -{" "}
              <span className="font-medium">
                {Math.min(to + 1, totalItems)}
              </span>{" "}
              dari <span className="font-medium">{totalItems}</span> item
            </p>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
              {/* Prev */}
              <Link
                href={hasPrev ? buildPageHref(currentPage - 1) : "#"}
                aria-disabled={!hasPrev}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-sm ring-1 ring-inset ring-gray-300 ${
                  hasPrev
                    ? "text-gray-700 hover:bg-gray-50"
                    : "text-gray-300 cursor-not-allowed bg-gray-100"
                }`}
              >
                ←
              </Link>

              {/* Page numbers (ringkas): current-1, current, current+1 */}
              {Array.from(
                new Set(
                  [
                    1,
                    currentPage - 1,
                    currentPage,
                    currentPage + 1,
                    totalPages,
                  ].filter((n) => n >= 1 && n <= totalPages)
                )
              ).map((p, idx, arr) => {
                // Tambah elipsis jika lompat jauh
                const prev = arr[idx - 1];
                const needDots = prev && p - prev > 1;
                return (
                  <span key={`p-${p}`} className="inline-flex">
                    {needDots && (
                      <span className="relative inline-flex select-none items-center px-3 py-2 text-sm text-gray-400">
                        …
                      </span>
                    )}
                    <Link
                      href={buildPageHref(p)}
                      aria-current={p === currentPage ? "page" : undefined}
                      className={`relative inline-flex items-center px-4 py-2 text-sm ring-1 ring-inset ring-gray-300 ${
                        p === currentPage
                          ? "z-10 bg-gray-900 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </Link>
                  </span>
                );
              })}

              {/* Next */}
              <Link
                href={hasNext ? buildPageHref(currentPage + 1) : "#"}
                aria-disabled={!hasNext}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-sm ring-1 ring-inset ring-gray-300 ${
                  hasNext
                    ? "text-gray-700 hover:bg-gray-50"
                    : "text-gray-300 cursor-not-allowed bg-gray-100"
                }`}
              >
                →
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
