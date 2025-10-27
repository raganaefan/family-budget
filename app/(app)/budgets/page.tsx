// app/(app)/budgets/page.tsx
"use client";

import {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
  Suspense, // ✅ tambahkan Suspense
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { format, startOfMonth, parseISO, addMonths } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import MonthSelector from "../components/MonthSelector";

// --- TYPES ---

type Category = {
  id: string;
  name: string;
  active: boolean;
};

type HouseholdWithCategories = {
  id: string;
  name: string;
  payday_start: number;
  categories: Category[];
};

type MembershipData = {
  households: HouseholdWithCategories | null;
};

type ExistingBudget = {
  id: string;
  category_id: string;
  amount: number;
};

export const dynamic = "force-dynamic";
// --- COMPONENT ---

export default function BudgetsPage() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<HouseholdWithCategories | null>(
    null
  );
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [budgets, setBudgets] = useState<Map<string, number>>(new Map());
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: membership, error: memberError } = await supabase
      .from("memberships")
      .select(
        "households(id, name, payday_start, categories(id, name, active))"
      )
      .eq("user_id", user.id)
      .single<MembershipData>();

    if (memberError || !membership || !membership.households) {
      setMessage("Gagal memuat data household.");
      setLoading(false);
      return;
    }

    const currentHousehold = membership.households;
    currentHousehold.categories = currentHousehold.categories.filter(
      (c) => c.active
    );
    setHousehold(currentHousehold);

    // --- Determine Month ---
    const monthParam = searchParams.get("month");
    let monthToLoad: Date;
    if (monthParam) {
      try {
        monthToLoad = parseISO(monthParam);
      } catch (e) {
        console.error("Invalid month format in URL, using default.", e);
        const today = new Date();
        const dayOfMonth = today.getDate();
        const paydayStart = currentHousehold.payday_start || 1;
        const calendarMonthStart = startOfMonth(today);
        monthToLoad =
          dayOfMonth >= paydayStart
            ? addMonths(calendarMonthStart, 1)
            : calendarMonthStart;
      }
    } else {
      const today = new Date();
      const dayOfMonth = today.getDate();
      const paydayStart = currentHousehold.payday_start || 1;
      const calendarMonthStart = startOfMonth(today);
      monthToLoad =
        dayOfMonth >= paydayStart
          ? addMonths(calendarMonthStart, 1)
          : calendarMonthStart;
    }
    setCurrentMonth(monthToLoad);
    // --- End Determine Month ---

    const monthString = format(monthToLoad, "yyyy-MM-01");

    const { data: existingBudgets, error: budgetError } = await supabase
      .from("budgets")
      .select("id, category_id, amount")
      .eq("household_id", currentHousehold.id)
      .eq("month", monthString)
      .returns<ExistingBudget[]>();

    if (budgetError) {
      setMessage(`Gagal memuat anggaran: ${budgetError.message}`);
      setLoading(false);
      return;
    }

    const budgetMap = new Map<string, number>();
    currentHousehold.categories.forEach((cat) => {
      const existing = existingBudgets?.find((b) => b.category_id === cat.id);
      budgetMap.set(cat.id, existing?.amount ?? 0);
    });
    setBudgets(budgetMap);
    setLoading(false);
  }, [supabase, router, searchParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAmountChange = (categoryId: string, value: string) => {
    const newAmount = parseFloat(value) || 0;
    setBudgets((prevMap) => new Map(prevMap).set(categoryId, newAmount));
  };

  const handleSaveBudgets = async () => {
    setIsSubmitting(true);
    setMessage("");

    if (!household || !currentMonth) {
      setMessage("Household atau bulan tidak ditemukan.");
      setIsSubmitting(false);
      return;
    }

    const monthString = format(currentMonth, "yyyy-MM-01");

    type BudgetUpsert = {
      household_id: string;
      category_id: string;
      month: string;
      amount: number;
      carry_over: boolean;
    };

    const dataToUpsert: BudgetUpsert[] = Array.from(budgets.entries()).map(
      ([catId, amount]) => ({
        household_id: household.id,
        category_id: catId,
        month: monthString,
        amount: amount,
        carry_over: false,
      })
    );

    const { error } = await supabase.from("budgets").upsert(dataToUpsert, {
      onConflict: "household_id, category_id, month",
    });

    if (error) {
      setMessage(`Gagal menyimpan: ${error.message}`);
    } else {
      setMessage("Anggaran berhasil disimpan!");
    }
    setIsSubmitting(false);
  };

  // ✅ Selalu kembalikan Suspense di level page
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      }
    >
      {/* Semua cabang render ada DI DALAM Suspense */}
      {!currentMonth || (loading && !household) ? (
        <div className="space-y-6">
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Kembali ke Dashboard
            </button>
          </div>
          <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      ) : !household && !loading ? (
        <div className="p-8 text-red-500">
          {message || "Gagal memuat data."}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Kembali ke Dashboard
            </button>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow-lg">
            {/* Header Kartu */}
            <div className="border-b border-gray-200 p-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Atur Anggaran
              </h1>
              <div className="mt-4">
                {currentMonth && (
                  <MonthSelector
                    fallbackMonthISO={format(currentMonth, "yyyy-MM-01")}
                  />
                )}
              </div>
            </div>

            {/* Daftar Kategori */}
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {household?.categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex flex-col items-start gap-2 p-6 md:flex-row md:items-center md:justify-between"
                  >
                    <label
                      htmlFor={category.id}
                      className="text-lg font-medium text-gray-800"
                    >
                      {category.name}
                    </label>
                    <div className="flex w-full items-center space-x-2 md:w-auto md:justify-end">
                      <span className="text-gray-500">Rp</span>
                      <input
                        type="number"
                        id={category.id}
                        value={budgets.get(category.id) ?? 0}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleAmountChange(category.id, e.target.value)
                        }
                        className="w-full rounded-md border-gray-300 text-right shadow-sm focus:border-blue-500 focus:ring-blue-500 md:w-40"
                        placeholder="0"
                        step="10000"
                        min="0"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Footer Kartu (Tombol Simpan) */}
            <div className="border-t border-gray-200 bg-gray-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  {message && (
                    <p
                      className={`text-sm ${
                        message.startsWith("Gagal")
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {message}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSaveBudgets}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white shadow transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {isSubmitting ? "Menyimpan..." : "Simpan Anggaran"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Suspense>
  );
}
