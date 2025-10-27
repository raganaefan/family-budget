// app/(app)/layout.tsx

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Ini adalah wrapper utama untuk semua halaman di dalam (app)
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-5xl p-4 py-8 md:p-10">
        {/* Halaman Anda (dashboard, budgets, dll) akan di-render di sini */}
        {children}
      </main>
    </div>
  );
}
