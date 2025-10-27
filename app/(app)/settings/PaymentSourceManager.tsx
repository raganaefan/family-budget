// app/(app)/settings/PaymentSourceManager.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  CreditCard,
} from "lucide-react";

// Ganti nama tipe dari 'Category' ke 'PaymentSource'
type PaymentSource = {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
  household_id: string;
};

export default function PaymentSourceManager() {
  const supabase = createClient();
  const [sources, setSources] = useState<PaymentSource[]>([]); // Ganti nama state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Ubah nama fungsi dan tabel 'from'
  const loadSources = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("User not found");
      setLoading(false);
      return;
    }

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

    const { data, error } = await supabase
      .from("payment_sources") // <-- UBAH TABEL
      .select("*")
      .eq("household_id", membership.household_id)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setSources(data || []); // Ganti nama state
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSources(); // Ganti nama fungsi
  }, [loadSources]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !householdId) return;
    setIsSubmitting(true);
    setError("");

    const { error } = await supabase.from("payment_sources").insert({
      // <-- UBAH TABEL
      name: newName,
      household_id: householdId,
      active: true,
    });

    if (error) {
      setError(`Gagal menambah: ${error.message}`);
    } else {
      setNewName("");
      await loadSources();
    } // Ganti nama fungsi
    setIsSubmitting(false);
  };

  const handleUpdateName = async (id: string) => {
    if (!newName.trim()) {
      setEditingId(null);
      setNewName("");
      return;
    }
    setIsSubmitting(true);

    const { error } = await supabase
      .from("payment_sources") // <-- UBAH TABEL
      .update({ name: newName })
      .eq("id", id);

    if (error) setError(`Gagal update: ${error.message}`);
    setEditingId(null);
    setNewName("");
    await loadSources(); // Ganti nama fungsi
    setIsSubmitting(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("payment_sources") // <-- UBAH TABEL
      .update({ active: !currentStatus })
      .eq("id", id);

    if (error) setError(`Gagal update: ${error.message}`);
    await loadSources(); // Ganti nama fungsi
  };

  if (loading) {
    /* ... (kode loading sama) ... */
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-lg">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900">
          Kelola Sumber Pembayaran
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Tambah/edit sumber dana (misal: Gopay, OVO, Tunai).
        </p>
      </div>

      {/* Form Tambah */}
      <form
        onSubmit={handleAdd}
        className="flex gap-4 border-b border-gray-200 p-6"
      >
        <input
          type="text"
          value={editingId ? "" : newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nama sumber baru (cth: OVO)"
          disabled={isSubmitting || !!editingId}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isSubmitting || !!editingId || !newName.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white shadow transition-all hover:bg-green-700 disabled:opacity-50"
        >
          <Plus size={18} />
          Tambah
        </button>
      </form>

      {/* Daftar Sumber */}
      <ul className="divide-y divide-gray-200">
        {sources.map(
          (
            source // Ganti nama variabel
          ) => (
            <li key={source.id} className="flex items-center gap-4 p-5">
              <CreditCard
                className={`h-6 w-6 shrink-0 ${
                  source.active ? "text-blue-600" : "text-gray-400"
                }`}
              />
              <div className="flex-1">
                {editingId === source.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateName(source.id);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setNewName("");
                      }}
                      className="rounded-lg bg-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-300"
                    >
                      Batal
                    </button>
                  </form>
                ) : (
                  <span
                    className={`text-lg ${
                      source.active
                        ? "text-gray-800"
                        : "text-gray-400 line-through"
                    }`}
                  >
                    {source.name}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(source.id);
                    setNewName(source.name);
                  }}
                  disabled={!!editingId}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-30"
                  title="Edit Nama"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleToggleActive(source.id, source.active)}
                  disabled={!!editingId}
                  className={`rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30 ${
                    source.active
                      ? "text-green-600 hover:text-green-700"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  title={source.active ? "Nonaktifkan" : "Aktifkan"}
                >
                  {source.active ? (
                    <ToggleRight size={20} />
                  ) : (
                    <ToggleLeft size={20} />
                  )}
                </button>
              </div>
            </li>
          )
        )}
      </ul>
      {error && <p className="p-6 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
