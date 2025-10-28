// app/auth/confirm/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client"; // Gunakan client-side
import { Loader2 } from "lucide-react";

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // @supabase/ssr client-side akan otomatis mendeteksi #access_token
    // dan mencoba mengatur sesi saat listener onAuthStateChange berjalan.
    // Kita hanya perlu menunggu sesi siap lalu redirect.

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("AuthConfirmPage: onAuthStateChange", event, session);
      // Jika sesi berhasil didapat (baik dari #access_token atau cookie yang sudah ada)
      if (session) {
        // Langsung redirect ke dashboard
        router.replace("/dashboard"); // Pakai replace agar tidak bisa kembali ke halaman ini
      } else if (event === "SIGNED_IN" && !session) {
        // Aneh, signed in tapi tidak ada sesi? Coba lagi redirect
        console.warn("Signed in but no session, redirecting anyway...");
        router.replace("/dashboard");
      } else if (event === "INITIAL_SESSION" && !session) {
        // Tidak ada sesi awal, mungkin token tidak valid? Ke login.
        console.error(
          "Initial session check found no session, redirecting to login."
        );
        router.replace("/login?error=Sesi tidak valid atau kedaluwarsa");
      }
      // Abaikan event lain seperti SIGNED_OUT di halaman ini
    });

    // Cleanup listener saat komponen unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  // Tampilkan UI loading sederhana
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <p className="mt-4 text-gray-600">Memproses autentikasi...</p>
    </div>
  );
}
