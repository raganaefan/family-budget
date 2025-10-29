// app/(app)/expenses/new/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveDraftExpense, type DraftExpense } from "@/lib/offline";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Loader2 } from "lucide-react";

type Category = {
  id: string;
  name: string;
};
type PaymentSource = { id: string; name: string };
type Household = {
  id: string;
  name: string;
  categories: Category[];
  payment_sources: PaymentSource[];
};
type User = {
  id: string;
};

export default function NewExpensePage() {
  const router = useRouter();
  const supabase = createClient();

  // State Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(
    null
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // State Form
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  // State UI
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser({ id: user.id });

      const { data: membership, error: memberError } = await supabase
        .from("memberships")
        .select(
          "households(id, name, categories(id, name, active), payment_sources(id, name, active))"
        ) // <-- EDIT QUERY
        .eq("user_id", user.id)
        .single();

      if (memberError || !membership || !membership.households) {
        setMessage("Gagal memuat data household.");
        setLoading(false);
        return;
      }

      // NORMALISASI: households bisa array atau objek
      const rawHouseholds = (membership as any).households;
      const household = Array.isArray(rawHouseholds)
        ? rawHouseholds[0]
        : rawHouseholds;

      if (!household) {
        setMessage("Household tidak ditemukan untuk user ini.");
        setCategories([]);
        setPaymentSources([]);
        setLoading(false);
        return;
      }

      // Filter kategori aktif (aman dengan optional chaining + default [])
      const activeCategories = (household.categories ?? []).filter(
        (c: any) => c?.active
      );
      setCategories(activeCategories);
      if (activeCategories.length > 0) {
        setCategoryId(activeCategories[0].id);
      }

      // Filter sumber aktif
      const activeSources = (household.payment_sources ?? []).filter(
        (s: any) => s?.active
      );
      setPaymentSources(activeSources);
      if (activeSources.length > 0) {
        setPaymentSourceId(activeSources[0].id);
      }

      setCurrentHousehold(household as Household);

      setLoading(false);
    }
    loadInitialData();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    if (!currentHousehold || !currentUser || !categoryId || !paymentSourceId) {
      setMessage(
        "Data tidak lengkap (Household, User, Kategori, atau Sumber)."
      );
      setSubmitting(false);
      return;
    }

    const isOnline = navigator.onLine;

    try {
      if (isOnline) {
        // --- ALUR ONLINE ---
        let receiptPath = null;
        if (receipt) {
          // TODO: Tambahkan kompresi gambar di sini
          const filePath = `${currentUser.id}/${uuidv4()}-${receipt.name}`;
          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(filePath, receipt);

          if (uploadError)
            throw new Error(`Gagal upload struk: ${uploadError.message}`);
          receiptPath = filePath;
        }

        const { error: insertError } = await supabase.from("expenses").insert({
          household_id: currentHousehold.id,
          user_id: currentUser.id,
          category_id: categoryId,
          payment_source_id: paymentSourceId,
          txn_date: date,
          amount: parseFloat(amount),
          merchant: merchant || null,
          notes: notes || null,
          receipt_url: receiptPath,
        });

        if (insertError) throw insertError;
        setMessage("Pengeluaran berhasil disimpan!");
      } else {
        // --- ALUR OFFLINE ---
        const draft: DraftExpense = {
          id: uuidv4(),
          household_id: currentHousehold.id,
          user_id: currentUser.id,
          category_id: categoryId,
          payment_source_id: paymentSourceId,
          txn_date: date,
          amount: parseFloat(amount),
          merchant: merchant || undefined,
          notes: notes || undefined,
          receipt_file: receipt || undefined,
        };

        await saveDraftExpense(draft);
        setMessage("Offline. Pengeluaran disimpan sebagai draf.");
      }

      // Reset form & kembali ke expenses
      setTimeout(() => router.push("/expenses"), 1000);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
        <form onSubmit={handleSubmit} className="space-y-6 p-6 md:p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Tambah Pengeluaran Baru
          </h1>

          {/* Baris 1: Tanggal & Jumlah */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="date"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Tanggal
              </label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="amount"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Jumlah (IDR)
              </label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="50000"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                step="100"
              />
            </div>
          </div>

          {/* Baris 2: Kategori & Sumber (BARU) */}
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
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* --- INPUT BARU DI SINI --- */}
            <div>
              <label
                htmlFor="paymentSource"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Sumber Pembayaran
              </label>
              <select
                id="paymentSource"
                value={paymentSourceId}
                onChange={(e) => setPaymentSourceId(e.target.value)}
                required
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {paymentSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>
            {/* --- AKHIR INPUT BARU --- */}
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
              onChange={(e) => setMerchant(e.target.value)}
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
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Beli kopi dan roti"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Baris 5: Struk */}
          <div>
            <label
              htmlFor="receipt"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Struk (Opsional)
            </label>
            <input
              type="file"
              id="receipt"
              accept="image/*"
              onChange={(e) =>
                setReceipt(e.target.files ? e.target.files[0] : null)
              }
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          {/* Tombol Simpan */}
          <div className="border-t border-gray-200 pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-bold text-white shadow transition-all hover:bg-green-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              {submitting ? "Menyimpan..." : "Simpan Pengeluaran"}
            </button>
            {message && (
              <p
                className={`mt-4 text-center text-sm ${
                  message.startsWith("Error")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
