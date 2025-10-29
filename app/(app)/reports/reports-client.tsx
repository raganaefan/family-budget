// app/(app)/reports/reports-client.tsx
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

type ReportsClientProps = {
  selectedMonthISO: string;
  trend: { month: string; actual_amount: number; budget_amount: number }[];
  categories: {
    category_id: string;
    category_name: string;
    actual_amount: number;
    budget_amount: number;
    remaining_amount: number;
    pct_used: number | null;
  }[];
  weekly: {
    week_no: number;
    week_start: string;
    week_end: string;
    actual_amount: number;
  }[];
  merchants: {
    merchant: string | null;
    total_amount: number;
    txn_count: number;
  }[];
  sources: { source_name: string; total_amount: number }[];
  householdName: string;
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-lg">
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ReportsClient(props: ReportsClientProps) {
  const {
    selectedMonthISO,
    trend,
    categories,
    weekly,
    merchants,
    sources,
    householdName,
  } = props;

  const monthLabel = format(parseISO(selectedMonthISO), "MMMM yyyy", {
    locale: localeId,
  });

  // Recharts but tanpa set warna manual (biarkan default)
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Charts</h1>
        <p className="text-gray-600">
          {householdName} — {monthLabel}
        </p>
        <div className="pt-2">
          <Link
            href={`/expenses?month=${selectedMonthISO}&page=1`}
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Lihat Pengeluaran Bulan Ini →
          </Link>
        </div>
      </header>

      {/* Row 1: Tren Bulanan (Line) + Category Breakdown (Bar) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Tren Bulanan (6 bulan terakhir)">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <XAxis
                  dataKey="month"
                  tickFormatter={(d) =>
                    format(parseISO(d), "MMM yy", { locale: localeId })
                  }
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(d) =>
                    format(parseISO(String(d)), "MMMM yyyy", {
                      locale: localeId,
                    })
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="budget_amount"
                  name="Budget"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual_amount"
                  name="Actual"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={`Breakdown Kategori — ${monthLabel}`}>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={categories}>
                <XAxis dataKey="category_name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="budget_amount" name="Budget" />
                <Bar dataKey="actual_amount" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: Weekly Spending (Bar) + Payment Source (Pie) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title={`Pengeluaran Mingguan — ${monthLabel}`}>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart
                data={weekly.map((w) => ({
                  ...w,
                  label: `${format(parseISO(w.week_start), "d MMM", {
                    locale: localeId,
                  })}`,
                }))}
              >
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="actual_amount" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Share per Sumber Pembayaran">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={sources}
                  dataKey="total_amount"
                  nameKey="source_name"
                  outerRadius={110}
                  // Label custom: tampilkan nama + % jika ada
                  label={(entry: any) => {
                    const n = entry?.source_name ?? entry?.name ?? "-";
                    const p =
                      typeof entry?.pct_share === "number"
                        ? ` (${entry.pct_share}%)`
                        : "";
                    return `${n}${p}`;
                  }}
                  labelLine
                >
                  {/* Alternatif kalau mau: gunakan LabelList, bisa ganti di atas */}
                  {/* <LabelList dataKey="source_name" position="outside" /> */}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => {
                    const v = new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(value || 0);
                    const pct = props?.payload?.pct_share;
                    return pct != null
                      ? [`${v} (${pct}%)`, "Total"]
                      : [v, "Total"];
                  }}
                />
                <Legend /> {/* supaya ada legenda nama-nama juga */}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 3: Top Merchants (Table) */}
      <Card title={`Top Merchant — ${monthLabel}`}>
        {merchants.length === 0 ? (
          <div className="text-center text-gray-500">Belum ada data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    Merchant
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">
                    Transaksi
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {merchants.map((m, i) => (
                  <tr key={`${m.merchant}-${i}`}>
                    <td className="px-3 py-2">{m.merchant || "-"}</td>
                    <td className="px-3 py-2 text-right">{m.txn_count}</td>
                    <td className="px-3 py-2 text-right">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(m.total_amount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
