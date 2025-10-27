// app/(app)/savings/transactions/new/SavingsTransactionForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Save, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

type SavingsGoalOption = {
  id: string;
  name: string;
};

export default function SavingsTransactionForm() {
  const router = useRouter();
  const supabase = createClient();

  // State
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<SavingsGoalOption[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [goalId, setGoalId] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit"); // Tipe transaksi

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Muat daftar goal aktif
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUserId(user.id);

    const { data: membership } = await supabase
      .from("memberships")
      .select("household_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      setError("Household not found");
      setLoading(false);
      return;
    }
    setHouseholdId(membership.household_id);

    // Ambil hanya goal yang AKTIF
    const { data: activeGoals, error: goalsError } = await supabase
      .from("savings_goals")
      .select("id, name")
      .eq("household_id", membership.household_id)
      .eq("active", true)
      .order("name");

    if (goalsError) {
      setError(`Gagal memuat target: ${goalsError.message}`);
    } else if (activeGoals && activeGoals.length > 0) {
      setGoals(activeGoals);
      setGoalId(activeGoals[0].id); // Pilih goal pertama sebagai default
    } else {
      setError("Tidak ada target tabungan aktif ditemukan. Buat target dulu!");
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalId || !amount || !householdId || !userId) {
      setError("Tanggal, Jumlah, dan Target wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setError("");

    // Pastikan jumlah positif, lalu sesuaikan tanda berdasarkan tipe
    let finalAmount = parseFloat(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError("Jumlah harus angka positif.");
      setIsSubmitting(false);
      return;
    }
    if (type === "withdrawal") {
      finalAmount *= -1; // Jadikan negatif jika penarikan
    }

    const transactionData = {
      household_id: householdId,
      goal_id: goalId,
      user_id: userId,
      txn_date: date,
      amount: finalAmount,
      notes: notes.trim() || null,
    };

    const { error: saveError } = await supabase
      .from("savings_transactions")
      .insert(transactionData);

    if (saveError) {
      setError(`Gagal menyimpan: ${saveError.message}`);
    } else {
      setMessage("Transaksi berhasil dicatat!");
      // Reset form atau redirect
      setTimeout(() => router.push("/savings"), 1000);
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }
  if (error && goals.length === 0) {
    // Tampilkan error jika tidak ada goal
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <p className="text-sm text-yellow-700">{error}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg bg-white p-6 shadow-lg md:p-8"
    >
      {/* Tipe Transaksi: Deposit / Withdrawal */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Jenis Transaksi
        </label>
        <div className="flex gap-4 rounded-md border border-gray-300 p-1">
          <button
            type="button"
            onClick={() => setType("deposit")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              type === "deposit"
                ? "bg-green-600 text-white shadow"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ArrowDownCircle className="mr-1 inline h-4 w-4" /> Setoran
          </button>
          <button
            type="button"
            onClick={() => setType("withdrawal")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              type === "withdrawal"
                ? "bg-red-600 text-white shadow"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ArrowUpCircle className="mr-1 inline h-4 w-4" /> Penarikan
          </button>
        </div>
      </div>

      {/* Tanggal & Jumlah */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Tanggal *
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          />
        </div>
        <div>
          <label
            htmlFor="amount"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Jumlah (Rp) *
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            placeholder="50000"
            step="1000"
            min="0"
          />
        </div>
      </div>

      {/* Target Tabungan */}
      <div>
        <label
          htmlFor="goal"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Target Tabungan *
        </label>
        <select
          id="goal"
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          required
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
        >
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </select>
      </div>

      {/* Catatan */}
      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Catatan (Opsional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          placeholder="cth: Setoran mingguan, Ambil untuk perbaikan motor"
        />
      </div>

      {/* Tombol Simpan */}
      <div className="border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={isSubmitting || goals.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-base font-bold text-white shadow transition-all hover:bg-green-700 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
        </button>
        {message && (
          <p className="mt-4 text-center text-sm text-green-600">{message}</p>
        )}
        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </form>
  );
}
