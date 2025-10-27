// app/(app)/budgets/BudgetsClientContent.tsx
"use client"; // Marks this as a Client Component

import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation"; // useSearchParams is safe here
import { format, startOfMonth, parseISO, addMonths } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import MonthSelector from "../components/MonthSelector"; // Import MonthSelector

// --- TYPES ---
// (You can move these to a separate types file later if preferred)
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
// --- END TYPES ---

export default function BudgetsClientContent() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams(); // Safe to call here

  // State Hooks
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<HouseholdWithCategories | null>(
    null
  );
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [budgets, setBudgets] = useState<Map<string, number>>(new Map());
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(""); // State for error messages

  // --- Data Loading Logic ---
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(""); // Reset error on load
    setMessage(""); // Reset message on load

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Fetch household and categories
    const { data: membership, error: memberError } = await supabase
      .from("memberships")
      .select(
        "households(id, name, payday_start, categories(id, name, active))"
      )
      .eq("user_id", user.id)
      .single<MembershipData>();

    if (memberError || !membership || !membership.households) {
      setError("Gagal memuat data household."); // Use setError
      setLoading(false);
      return;
    }

    const currentHousehold = membership.households;
    currentHousehold.categories = currentHousehold.categories.filter(
      (c) => c.active
    );
    setHousehold(currentHousehold);

    // --- Determine Month based on URL or payday ---
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

    // Fetch existing budgets for the determined month
    const monthString = format(monthToLoad, "yyyy-MM-01");
    const { data: existingBudgets, error: budgetError } = await supabase
      .from("budgets")
      .select("id, category_id, amount")
      .eq("household_id", currentHousehold.id)
      .eq("month", monthString)
      .returns<ExistingBudget[]>();

    if (budgetError) {
      setError(`Gagal memuat anggaran: ${budgetError.message}`); // Use setError
      setLoading(false);
      return;
    }

    // Populate the budget map
    const budgetMap = new Map<string, number>();
    currentHousehold.categories.forEach((cat) => {
      const existing = existingBudgets?.find((b) => b.category_id === cat.id);
      budgetMap.set(cat.id, existing?.amount ?? 0);
    });
    setBudgets(budgetMap);
    setLoading(false); // Loading finished
  }, [supabase, router, searchParams]); // Dependencies for useCallback

  // --- Effect Hook to load data on mount or when loadData changes ---
  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Event Handlers ---
  const handleAmountChange = (categoryId: string, value: string) => {
    const newAmount = parseFloat(value) || 0;
    setBudgets((prevMap) => new Map(prevMap).set(categoryId, newAmount));
  };

  const handleSaveBudgets = async () => {
    setIsSubmitting(true);
    setMessage("");
    setError(""); // Clear previous errors

    if (!household || !currentMonth) {
      setError("Household atau bulan tidak ditemukan."); // Use setError
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
        carry_over: false, // Defaulting to false as per MVP
      })
    );

    const { error: saveError } = await supabase
      .from("budgets")
      .upsert(dataToUpsert, {
        onConflict: "household_id, category_id, month",
      });

    if (saveError) {
      setError(`Gagal menyimpan: ${saveError.message}`); // Use setError
    } else {
      setMessage("Anggaran berhasil disimpan!");
    }
    setIsSubmitting(false);
  };

  // --- Render Logic ---

  // Display error message if loading failed
  if (error && !loading) {
    return (
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
        <div className="rounded-md bg-red-50 p-4 shadow">
          <h3 className="text-sm font-medium text-red-800">
            Terjadi Kesalahan
          </h3>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  // Display loading indicator if data isn't ready
  if (loading || !household || !currentMonth) {
    return (
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
    );
  }

  // --- Main Render (Data ready, no errors) ---
  return (
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
        {/* Card Header */}
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900">Atur Anggaran</h1>
          <div className="mt-4">
            {/* MonthSelector doesn't need Suspense here, needs the month value */}
            {currentMonth && (
              <MonthSelector
                fallbackMonthISO={format(currentMonth, "yyyy-MM-01")}
              />
            )}
          </div>
        </div>

        {/* Category List */}
        <ul className="divide-y divide-gray-200">
          {household.categories.map((category) => (
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

        {/* Card Footer (Save Button) */}
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
              {/* Display submission errors here too */}
              {error && !loading && (
                <p className="text-sm text-red-600">{error}</p>
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
  );
}
