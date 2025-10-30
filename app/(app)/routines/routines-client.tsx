"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Link from "next/link";

/** ===== Types ===== */
type Row = {
  id: string;
  household_id: string;
  user_id: string;
  name: string;
  interval_months: number;
  last_date: string;
  next_date: string;
  status: "ok" | "due_soon" | "overdue";
};

type FormState = {
  id?: string;
  name: string;
  interval_months: number | "";
  last_date: string; // yyyy-mm-dd
};

/** ===== Small UI primitives (no deps) ===== */

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl"
      >
        {/* Tombol Close X */}
        <button
          type="button"
          className="absolute top-3.5 right-3.5 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={onClose}
        >
          <span className="sr-only">Tutup</span>
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Confirm({
  open,
  message,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <Modal open title="Konfirmasi" onClose={onCancel}>
      <p className="text-sm text-gray-700">{message}</p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={busy}
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-70"
          disabled={busy}
        >
          {busy ? "Menghapus..." : "Hapus"}
        </button>
      </div>
    </Modal>
  );
}

// Komponen helper untuk Status Badge
function StatusBadge({ status }: { status: Row["status"] }) {
  const styles: Record<Row["status"], string> = {
    ok: "bg-green-100 text-green-800",
    due_soon: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-800",
  };
  const text: Record<Row["status"], string> = {
    ok: "OK",
    due_soon: "Segera",
    overdue: "Terlambat",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {text[status]}
    </span>
  );
}

// Helper untuk input form
const inputClass =
  "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-70";

/** ===== Main component ===== */
export default function RoutinesClient({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName?: string;
}) {
  const supabase = createClient();

  // state (tidak ada perubahan)
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | "ok" | "due_soon" | "overdue"
  >("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "",
    interval_months: "",
    last_date: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ... (Semua logika fetch, derived, dan CRUD tetap sama) ...
  // ... (Saya akan melompat ke bagian Render) ...

  /** ===== Fetch ===== */
  async function fetchData() {
    if (!householdId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("routine_tasks_computed")
      .select("*")
      .eq("household_id", householdId)
      .order("next_date", { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setRows((data as Row[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    if (!householdId) return;
    const channel = supabase
      .channel("routines-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "routine_tasks" },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  /** ===== Derived ===== */
  const filtered = useMemo(() => {
    let result = rows;
    const key = q.trim().toLowerCase();
    if (key) result = result.filter((r) => r.name.toLowerCase().includes(key));
    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    return result;
  }, [rows, q, statusFilter]);

  /** ===== CRUD ===== */
  function openAdd() {
    setForm({ name: "", interval_months: "", last_date: "" });
    setFormOpen(true);
    setNotice(null);
    setError(null);
  }
  function openEdit(r: Row) {
    setForm({
      id: r.id,
      name: r.name,
      interval_months: r.interval_months,
      last_date: r.last_date, // already yyyy-mm-dd
    });
    setFormOpen(true);
    setNotice(null);
    setError(null);
  }
  function closeForm() {
    if (!saving) setFormOpen(false);
  }

  function validateForm(f: FormState): string | null {
    if (!f.name.trim()) return "Nama kegiatan wajib diisi.";
    const iv = Number(f.interval_months);
    if (!Number.isFinite(iv) || iv <= 0) return "Interval harus angka > 0.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.last_date))
      return "Tanggal terakhir wajib (format yyyy-mm-dd).";
    return null;
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const msg = validateForm(form);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);

    const { data: auth } = await supabase.auth.getUser();
    const user_id = auth?.user?.id;

    if (form.id) {
      // update
      const { error } = await supabase
        .from("routine_tasks")
        .update({
          name: form.name.trim(),
          interval_months: Number(form.interval_months),
          last_date: form.last_date,
        })
        .eq("id", form.id);
      if (error) {
        setError("Gagal menyimpan: " + error.message);
      } else {
        setNotice("Perubahan disimpan.");
        setFormOpen(false);
        fetchData();
      }
    } else {
      // insert
      const { error } = await supabase.from("routine_tasks").insert({
        name: form.name.trim(),
        interval_months: Number(form.interval_months),
        last_date: form.last_date,
        household_id: householdId,
        user_id, // penting untuk WITH CHECK
      });
      if (error) {
        setError("Gagal menambah: " + error.message);
      } else {
        setNotice("Catatan rutin ditambahkan.");
        setFormOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  }

  function askDelete(id: string) {
    setDeletingId(id);
    setConfirmOpen(true);
    setError(null);
    setNotice(null);
  }

  async function doDelete() {
    if (!deletingId) return;
    setSaving(true);
    const { error } = await supabase
      .from("routine_tasks")
      .delete()
      .eq("id", deletingId);
    if (error) {
      setError("Gagal menghapus: " + error.message);
    } else {
      setNotice("Catatan rutin dihapus.");
      fetchData();
    }
    setSaving(false);
    setConfirmOpen(false);
    setDeletingId(null);
  }

  /** ===== Render ===== */
  return (
    // Wrapper utama untuk padding dan max-width
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {" "}
        {/* <--- Di dalam sini */}
        {/* --- TOMBOL KEMBALI --- */}
        <div>
          <Link
            href="/dashboard" // <-- Sesuaikan link dashboard Anda
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
            Kembali ke Dashboard
          </Link>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catatan Rutin</h1>
            {householdName && (
              <p className="mt-1 text-sm text-gray-600">
                Household: {householdName}
              </p>
            )}
          </div>
          {/* Filter & Aksi - dibuat responsive */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kegiatan…"
              className={`${inputClass} sm:w-56`}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`${inputClass} sm:w-auto`}
              title="Filter status"
            >
              <option value="">Semua status</option>
              <option value="due_soon">Segera</option>
              <option value="overdue">Terlambat</option>
              <option value="ok">OK</option>
            </select>
            <button
              onClick={openAdd}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
            >
              <svg
                className="-ml-0.5 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <span>Tambah</span>
            </button>
          </div>
        </div>
        {/* Alerts - styling diperhalus */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </div>
        )}
        {/* Table Area */}
        {loading ? (
          <div className="text-sm text-gray-500">Memuat data…</div>
        ) : filtered.length === 0 ? (
          // Empty state yang lebih baik
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center text-gray-500">
            <p>Tidak ada data untuk filter saat ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Kegiatan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Interval
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Terakhir
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Berikutnya
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="whitespace-normal px-4 py-3 align-top">
                        <div className="font-medium text-gray-900">
                          {r.name}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-gray-700">
                        {r.interval_months} bulan
                        {/* Link "ubah" di sini dihapus karena redundan.
                          Sudah ada tombol "Edit" di kolom aksi.
                        */}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-gray-700">
                        {format(parseISO(r.last_date), "d MMM yyyy", {
                          locale: localeId,
                        })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-gray-700">
                        {format(parseISO(r.next_date), "d MMM yyyy", {
                          locale: localeId,
                        })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right align-top text-sm font-medium">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => openEdit(r)}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => askDelete(r.id)}
                            className="text-red-600 hover:text-red-800 hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* ===== Modal: Add/Edit ===== */}
        <Modal
          open={formOpen}
          title={form.id ? "Ubah Catatan Rutin" : "Tambah Catatan Rutin"}
          onClose={closeForm}
        >
          <form onSubmit={submitForm} className="space-y-4">
            <div>
              <label
                htmlFor="form-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nama Kegiatan
              </label>
              <input
                id="form-name"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                className={inputClass}
                placeholder="Service AC"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="form-interval"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Interval (bulan)
                </label>
                <input
                  id="form-interval"
                  type="number"
                  min={1}
                  value={form.interval_months}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      interval_months:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className={inputClass}
                  placeholder="4"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="form-lastdate"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Tanggal Terakhir
                </label>
                <input
                  id="form-lastdate"
                  type="date"
                  value={form.last_date}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, last_date: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>
            </div>

            {/* Error message di dalam form */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70"
                disabled={saving}
              >
                {saving
                  ? form.id
                    ? "Menyimpan..."
                    : "Menambah..."
                  : form.id
                  ? "Simpan Perubahan"
                  : "Tambah Catatan"}
              </button>
            </div>
          </form>
        </Modal>
        {/* ===== Confirm Delete ===== */}
        <Confirm
          open={confirmOpen}
          message="Yakin ingin menghapus catatan rutin ini? Tindakan tidak bisa dibatalkan."
          onCancel={() => setConfirmOpen(false)}
          onConfirm={doDelete}
          busy={saving}
        />
      </div>
    </div>
  );
}
