// app/(app)/components/MonthSelector.tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format, addMonths, subMonths, startOfMonth, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  /** Bulan default dari server (format "YYYY-MM-01"), berbasis payday */
  fallbackMonthISO?: string;
};

export default function MonthSelector({ fallbackMonthISO }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Sinkronkan URL sekali saat mount bila tidak ada ?month ---
  useEffect(() => {
    const urlHasMonth = !!searchParams.get("month");
    if (!urlHasMonth && fallbackMonthISO) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", fallbackMonthISO);
      // replace agar tidak nambah riwayat
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // sekali saja

  // --- Sumber kebenaran: param URL; jika belum ada, pakai fallback; jika tetap kosong, pakai kalender sekarang ---
  const selectedMonth =
    searchParams.get("month") ??
    fallbackMonthISO ??
    format(startOfMonth(new Date()), "yyyy-MM-01");

  const currentMonthDate = parseISO(selectedMonth);
  const formattedMonth = format(currentMonthDate, "MMMM yyyy", { locale: id });

  const handleMonthChange = (direction: "prev" | "next") => {
    const newMonthDate =
      direction === "prev"
        ? subMonths(currentMonthDate, 1)
        : addMonths(currentMonthDate, 1);

    const newMonthISO = format(newMonthDate, "yyyy-MM-01");
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonthISO);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-center gap-4 rounded-lg bg-white p-2 shadow-sm ring-1 ring-inset ring-gray-200">
      <button
        onClick={() => handleMonthChange("prev")}
        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
        title="Bulan Sebelumnya"
      >
        <ChevronLeft size={24} className="text-gray-700" />
      </button>

      <h2 className="w-48 text-center text-xl font-bold text-gray-800">
        {formattedMonth}
      </h2>

      <button
        onClick={() => handleMonthChange("next")}
        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
        title="Bulan Berikutnya"
      >
        <ChevronRight size={24} className="text-gray-700" />
      </button>
    </div>
  );
}
