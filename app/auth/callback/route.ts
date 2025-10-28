import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Tetap siapkan redirect ke dashboard sebagai tujuan utama
  const next = searchParams.get("next") ?? "/dashboard";

  // Jika ADA code (alur PKCE, misal dari Magic Link), proses seperti biasa
  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.delete({ name, ...options });
            } catch (error) {}
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // BERHASIL via PKCE: Langsung ke dashboard
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      // GAGAL tukar code: Log error & ke login dengan error
      console.error("exchangeCodeForSession failed:", error.message);
      return NextResponse.redirect(
        `${origin}/login?error=Gagal menukar kode sesi: ${error.message}`
      );
    }
  }

  // JIKA TIDAK ADA code (mungkin alur Implicit #access_token dari Invite)
  // JANGAN langsung redirect ke login.
  // Redirect saja ke halaman tujuan ('/dashboard').
  // Biarkan client-side (@supabase/ssr) yang berjalan di browser
  // mendeteksi #access_token, memvalidasi, dan mengatur cookie sesi.
  // Middleware akan menangani sisanya.
  console.log(
    "No code found in callback URL, attempting client-side session recovery."
  );
  return NextResponse.redirect(`${origin}${next}`);
}
