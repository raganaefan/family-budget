// app/(app)/settings/HouseholdSettings.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Save } from "lucide-react";

type Household = {
  id: string;
  name: string;
  payday_start: number;
};

export default function HouseholdSettings() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [payday, setPayday] = useState(1);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadHousehold = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Ambil data household (termasuk payday_start)
    const { data: membership, error } = await supabase
      .from("memberships")
      .select("households (id, name, payday_start)")
      .eq("user_id", user.id)
      .single();

    if (error || !membership) {
      setMessage("Gagal memuat data household");
    } else {
      setHousehold(membership.households);
      setPayday(membership.households.payday_start || 1);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  const handleSave = async () => {
    if (!household) return;
    setIsSubmitting(true);
    setMessage("");

    const { error } = await supabase
      .from("households")
      .update({ payday_start: payday })
      .eq("id", household.id);

    if (error) {
      setMessage(`Gagal menyimpan: ${error.message}`);
    } else {
      setMessage("Pengaturan berhasil disimpan!");
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-white shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-lg">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900">
          Pengaturan Rumah Tangga
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Atur tanggal mulai siklus anggaran bulanan Anda.
        </p>
      </div>

      <div className="p-6">
        <label
          htmlFor="payday"
          className="block text-lg font-medium text-gray-800"
        >
          Tanggal Mulai Siklus (Gajian)
        </label>
        <p className="mt-1 text-sm text-gray-500">
          Masukkan tanggal gajian Anda (misal: 25). Anggaran "November" akan
          berjalan dari 25 Okt s/d 24 Nov.
        </p>
        <input
          type="number"
          id="payday"
          value={payday}
          onChange={(e) =>
            setPayday(Math.max(1, Math.min(28, parseInt(e.target.value) || 1)))
          }
          min="1"
          max="28" // Batasi 28 untuk amannya
          className="mt-4 w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

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
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white shadow transition-all hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </div>
    </div>
  );
}
