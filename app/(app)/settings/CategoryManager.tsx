// app/(app)/settings/CategoryManager.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
  household_id: string;
};

export default function CategoryManager() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [householdId, setHouseholdId] = useState<string | null>(null);

  // State untuk form tambah/edit
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Muat semua kategori (termasuk yang non-aktif)
  const loadCategories = useCallback(async () => {
    setLoading(true);

    // 1. Dapatkan user & household
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

    // 2. Ambil semua kategori
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("household_id", membership.household_id)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // --- FUNGSI AKSI ---

  // Tambah Kategori Baru
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !householdId) return;

    setIsSubmitting(true);
    setError("");

    const { error } = await supabase.from("categories").insert({
      name: newCategoryName,
      household_id: householdId,
      active: true,
      // icon: 'default-icon' // (Opsional)
    });

    if (error) {
      setError(`Gagal menambah: ${error.message}`);
    } else {
      setNewCategoryName("");
      await loadCategories(); // Muat ulang daftar
    }
    setIsSubmitting(false);
  };

  // Edit Nama Kategori
  const handleUpdateCategoryName = async (id: string) => {
    if (!newCategoryName.trim()) {
      setEditingId(null); // Batal edit jika nama kosong
      setNewCategoryName("");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase
      .from("categories")
      .update({ name: newCategoryName })
      .eq("id", id);

    if (error) setError(`Gagal update: ${error.message}`);

    setEditingId(null);
    setNewCategoryName("");
    await loadCategories();
    setIsSubmitting(false);
  };

  // Nonaktifkan / Aktifkan Kategori
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("categories")
      .update({ active: !currentStatus })
      .eq("id", id);

    if (error) setError(`Gagal update: ${error.message}`);
    await loadCategories();
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-white shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-lg">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900">Kelola Kategori</h2>
        <p className="mt-1 text-sm text-gray-600">
          Tambah, edit, atau nonaktifkan kategori untuk household Anda.
        </p>
      </div>

      {/* Form Tambah Kategori */}
      <form
        onSubmit={handleAddCategory}
        className="flex gap-4 border-b border-gray-200 p-6"
      >
        <input
          type="text"
          value={editingId ? "" : newCategoryName} // Kosongkan jika sedang edit
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nama kategori baru..."
          disabled={isSubmitting || !!editingId}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isSubmitting || !!editingId || !newCategoryName.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white shadow transition-all hover:bg-green-700 disabled:opacity-50"
        >
          <Plus size={18} />
          Tambah
        </button>
      </form>

      {/* Daftar Kategori */}
      <ul className="divide-y divide-gray-200">
        {categories.map((cat) => (
          <li key={cat.id} className="flex items-center gap-4 p-5">
            {/* Nama Kategori atau Form Edit */}
            <div className="flex-1">
              {editingId === cat.id ? (
                // Tampilan Edit
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUpdateCategoryName(cat.id);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
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
                      setNewCategoryName("");
                    }}
                    className="rounded-lg bg-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-300"
                  >
                    Batal
                  </button>
                </form>
              ) : (
                // Tampilan Normal
                <span
                  className={`text-lg ${
                    cat.active ? "text-gray-800" : "text-gray-400 line-through"
                  }`}
                >
                  {cat.name}
                </span>
              )}
            </div>

            {/* Tombol Aksi */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingId(cat.id);
                  setNewCategoryName(cat.name); // Isi form dengan nama saat ini
                }}
                disabled={!!editingId} // Nonaktifkan jika sedang edit yg lain
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-30"
                title="Edit Nama"
              >
                <Edit2 size={18} />
              </button>

              <button
                onClick={() => handleToggleActive(cat.id, cat.active)}
                disabled={!!editingId} // Nonaktifkan jika sedang edit
                className={`rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30 ${
                  cat.active
                    ? "text-green-600 hover:text-green-700"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                title={cat.active ? "Nonaktifkan" : "Aktifkan"}
              >
                {cat.active ? (
                  <ToggleRight size={20} />
                ) : (
                  <ToggleLeft size={20} />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="p-6 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
