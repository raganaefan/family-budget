// app/(app)/savings/goals/[id]/SavingsGoalForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

// Cek UUID v4/v5 cukup longgar
const isUuid = (v?: string | null) =>
  !!v &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v || ""
  );

type SavingsGoal = {
  id: string;
  household_id: string;
  name: string;
  target_amount: number | null;
  target_date: string | null; // YYYY-MM-DD
  notes: string | null;
  active: boolean;
};

export default function SavingsGoalForm({ goalId }: { goalId: string | null }) {
  const router = useRouter();
  const supabase = createClient();

  // 🔒 Normalisasi goalId: kalau bukan UUID valid → anggap null (mode new)
  const normalizedGoalId = isUuid(goalId) ? goalId : null;
  const isNew = normalizedGoalId === null;

  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Ambil household id (robust: relasi atau kolom langsung)
  const fetchHouseholdId = useCallback(async (): Promise<string | null> => {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      router.push("/login");
      return null;
    }

    const { data, error: mErr } = await supabase
      .from("memberships")
      .select("household_id, households(id)")
      .eq("user_id", user.id)
      .single();

    if (mErr || !data) {
      setError("Household tidak ditemukan.");
      return null;
    }

    const hid =
      (data as any)?.households?.id ?? (data as any)?.household_id ?? null;

    if (!hid) {
      setError("Household tidak ditemukan.");
      return null;
    }

    return String(hid);
  }, [supabase, router]);

  const loadGoal = useCallback(
    async (hid: string) => {
      if (!normalizedGoalId) return;
      const { data, error: goalError } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("id", normalizedGoalId)
        .eq("household_id", hid)
        .single();

      if (goalError || !data) {
        setError(
          "Target tabungan tidak ditemukan atau Anda tidak punya akses."
        );
        return;
      }

      setName(data.name ?? "");
      setTargetAmount(
        data.target_amount != null ? String(data.target_amount) : ""
      );
      setTargetDate(
        data.target_date ? String(data.target_date).slice(0, 10) : ""
      );
      setNotes(data.notes ?? "");
      setActive(Boolean(data.active));
    },
    [normalizedGoalId, supabase]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      const hid = await fetchHouseholdId();
      if (!hid) {
        setLoading(false);
        return;
      }
      setHouseholdId(hid);

      if (!isNew) {
        await loadGoal(hid);
      }

      setLoading(false);
    })();
  }, [isNew, fetchHouseholdId, loadGoal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !householdId) {
      setError("Nama target dan household ID wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setError("");

    const parsedAmount =
      targetAmount.trim() === ""
        ? null
        : Number.isNaN(Number(targetAmount))
        ? null
        : Number(targetAmount);

    const goalData = {
      household_id: householdId, // ✅ dijamin ada
      name: name.trim(),
      target_amount: parsedAmount,
      target_date: targetDate || null, // "" → null
      notes: notes.trim() || null,
      active: active,
    };

    try {
      if (isNew) {
        const { error: insertErr } = await supabase
          .from("savings_goals")
          .insert(goalData);
        if (insertErr) throw insertErr;
      } else {
        // ✅ pakai normalizedGoalId yang valid
        const { error: updateErr } = await supabase
          .from("savings_goals")
          .update(goalData)
          .eq("id", normalizedGoalId!);
        if (updateErr) throw updateErr;
      }

      setMessage("Target berhasil disimpan!");
      setIsSubmitting(false);
      setTimeout(() => router.push("/savings"), 800);
    } catch (e: any) {
      // Debug cepat kalau masih ada "undefined"
      if (
        String(e?.message || "").includes("invalid input syntax for type uuid")
      ) {
        console.warn("DEBUG uuid error", {
          goalId,
          normalizedGoalId,
          householdId,
          payload: goalData,
        });
      }
      setError(`Gagal menyimpan: ${e?.message ?? "Unknown error"}`);
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      isNew ||
      !normalizedGoalId ||
      !confirm("Yakin ingin menghapus target ini?")
    ) {
      return;
    }
    setIsSubmitting(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", normalizedGoalId);

    if (deleteError) {
      setError(`Gagal menghapus: ${deleteError.message}`);
      setIsSubmitting(false);
      return;
    }
    setMessage("Target berhasil dihapus.");
    setTimeout(() => router.push("/savings"), 800);
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg bg-white p-6 shadow-lg md:p-8"
    >
      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Nama Target *
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="cth: Dana Darurat, DP Rumah"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="targetAmount"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Target Jumlah (Rp) (Opsional)
          </label>
          <input
            type="number"
            id="targetAmount"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="0"
            step="10000"
            min="0"
          />
        </div>
        <div>
          <label
            htmlFor="targetDate"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Target Tanggal (Opsional)
          </label>
          <input
            type="date"
            id="targetDate"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      {!isNew && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Status
          </label>
          <button
            type="button"
            onClick={() => setActive(!active)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-medium ${
              active
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {active ? "Aktif" : "Nonaktif"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={isSubmitting || !householdId}
          className="order-1 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-bold text-white shadow transition-all hover:bg-indigo-700 disabled:opacity-50 sm:order-2 sm:w-auto"
          title={!householdId ? "Menunggu household terdeteksi..." : undefined}
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {isSubmitting
            ? "Menyimpan..."
            : isNew
            ? "Buat Target"
            : "Simpan Perubahan"}
        </button>

        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="order-2 flex w-full items-center justify-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-200 disabled:opacity-50 sm:order-1 sm:w-auto"
          >
            <Trash2 size={16} /> Hapus Target Ini
          </button>
        )}

        {message && (
          <p className="order-3 mt-2 text-center text-sm text-green-600 sm:mt-0">
            {message}
          </p>
        )}
        {error && (
          <p className="order-3 mt-2 text-center text-sm text-red-600 sm:mt-0">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
