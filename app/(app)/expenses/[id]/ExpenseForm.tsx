// app/(app)/expenses/[id]/ExpenseForm.tsx
"use client";

import {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Tipe data (ambil dari form tambah expense dan sesuaikan)
type Category = { id: string; name: string };
type PaymentSource = { id: string; name: string };
type ExpenseData = {
  id: string;
  household_id: string;
  user_id: string;
  category_id: string | null; // Bisa null jika kategori dihapus
  payment_source_id: string | null; // Bisa null jika sumber dihapus
  txn_date: string; // Format YYYY-MM-DD
  amount: number;
  merchant: string | null;
  notes: string | null;
  receipt_url: string | null;
  // Tambahkan field lain jika perlu
};

export default function ExpenseForm({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const supabase = createClient();

  // State Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [expense, setExpense] = useState<ExpenseData | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  // State Form (diinisialisasi nanti setelah data dimuat)
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentSourceId, setPaymentSourceId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  // State untuk receipt tidak di-handle di edit form ini (terlalu kompleks untuk MVP)

  // State UI
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Fungsi load data awal (kategori, sumber, dan expense yg diedit)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // 1. Ambil Household ID (untuk RLS check & data terkait)
    const { data: membership } = await supabase
      .from("memberships")
      .select("household_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      setError("Household tidak ditemukan");
      setLoading(false);
      return;
    }
    setHouseholdId(membership.household_id);

    // 2. Ambil Kategori & Sumber Pembayaran Aktif
    const [categoriesRes, sourcesRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("household_id", membership.household_id)
        .eq("active", true)
        .order("name"),
      supabase
        .from("payment_sources")
        .select("id, name")
        .eq("household_id", membership.household_id)
        .eq("active", true)
        .order("name"),
    ]);

    if (categoriesRes.error)
      setError(`Gagal load kategori: ${categoriesRes.error.message}`);
    else setCategories(categoriesRes.data || []);

    if (sourcesRes.error)
      setError(`Gagal load sumber: ${sourcesRes.error.message}`);
    else setPaymentSources(sourcesRes.data || []);

    // 3. Ambil data Expense yang akan diedit
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .select("*") // Ambil semua field
      .eq("id", expenseId)
      .eq("household_id", membership.household_id) // Pastikan milik household ini
      .single();

    if (expenseError || !expenseData) {
      setError("Pengeluaran tidak ditemukan atau Anda tidak punya akses.");
      setExpense(null);
    } else {
      setExpense(expenseData);
      // Isi state form dengan data yang ada
      setDate(expenseData.txn_date.split("T")[0]); // Format YYYY-MM-DD
      setAmount(expenseData.amount.toString());
      setCategoryId(expenseData.category_id);
      setPaymentSourceId(expenseData.payment_source_id);
      setMerchant(expenseData.merchant || "");
      setNotes(expenseData.notes || "");
    }

    setLoading(false);
  }, [expenseId, supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fungsi Update
  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!expense || !householdId) {
      setError("Data tidak lengkap untuk update.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setError("");

    const updatedData = {
      txn_date: date,
      amount: parseFloat(amount) || 0,
      category_id: categoryId || null,
      payment_source_id: paymentSourceId || null,
      merchant: merchant.trim() || null,
      notes: notes.trim() || null,
      // Kita tidak update user_id atau household_id
      // receipt_url tidak diupdate di sini
    };

    const { error: updateError } = await supabase
      .from("expenses")
      .update(updatedData)
      .eq("id", expenseId);

    if (updateError) {
      setError(`Gagal menyimpan perubahan: ${updateError.message}`);
    } else {
      setMessage("Perubahan berhasil disimpan!");
      // Muat ulang data untuk memastikan form terupdate (jika ada perubahan server-side)
      // await loadData();
      // Atau langsung redirect
      setTimeout(() => router.push("/dashboard"), 1000); // Kembali ke dashboard
    }
    setIsSubmitting(false);
  };

  // Fungsi Hapus
  const handleDelete = async () => {
    if (!expense || !confirm("Yakin ingin menghapus pengeluaran ini?")) {
      return;
    }
    setIsSubmitting(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId);
    if (deleteError) {
      setError(`Gagal menghapus: ${deleteError.message}`);
      setIsSubmitting(false);
    } else {
      setMessage("Pengeluaran berhasil dihapus.");
      setTimeout(() => router.push("/dashboard"), 1000);
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !expense) {
    // Tampilkan error jika load gagal
    return (
      <div className="rounded-md bg-red-50 p-4 shadow">
        <h3 className="text-sm font-medium text-red-800">Gagal Memuat Data</h3>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-red-800 hover:underline"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="space-y-6 rounded-lg bg-white p-6 shadow-lg md:p-8"
    >
      {/* Field Form (Sama seperti form tambah, tapi value dari state) */}

      {/* Baris 1: Tanggal & Jumlah */}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setDate(e.target.value)
            }
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="amount"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Jumlah (IDR) *
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setAmount(e.target.value)
            }
            required
            placeholder="50000"
            step="1"
            min="0"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Baris 2: Kategori & Sumber */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="category"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Kategori
          </label>
          <select
            id="category"
            value={categoryId ?? ""}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setCategoryId(e.target.value || null)
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- Pilih Kategori --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="paymentSource"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Sumber Pembayaran
          </label>
          <select
            id="paymentSource"
            value={paymentSourceId ?? ""}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setPaymentSourceId(e.target.value || null)
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- Pilih Sumber --</option>
            {paymentSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Baris 3: Merchant */}
      <div>
        <label
          htmlFor="merchant"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Toko / Merchant (Opsional)
        </label>
        <input
          type="text"
          id="merchant"
          value={merchant}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setMerchant(e.target.value)
          }
          placeholder="Indomaret"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Baris 4: Catatan */}
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
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setNotes(e.target.value)
          }
          rows={3}
          placeholder="Beli kopi dan roti"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Receipt Info (Read-only) - Opsional */}
      {expense?.receipt_url && (
        <div className="text-sm">
          <span className="font-medium text-gray-700">Struk Tersimpan:</span>
          {/* TODO: Tambahkan link view/download jika diperlukan, pakai signed URL */}
          <span className="ml-2 text-gray-500">
            {expense.receipt_url.split("/").pop()}
          </span>
        </div>
      )}

      {/* Tombol Aksi */}
      <div className="flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={isSubmitting}
          className="order-1 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white shadow transition-all hover:bg-blue-700 disabled:opacity-50 sm:order-2 sm:w-auto"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting}
          className="order-2 flex w-full items-center justify-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-200 disabled:opacity-50 sm:order-1 sm:w-auto"
        >
          <Trash2 size={16} /> Hapus Pengeluaran
        </button>

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
