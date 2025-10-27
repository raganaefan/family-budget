import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // --- PERBAIKANNYA DI SINI ---
    // Kita harus 'await' cookies()
    const cookieStore = await cookies();
    // --- SELESAI PERBAIKAN ---

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            // Sekarang cookieStore adalah objek yang sudah di-resolve
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Abaikan error jika dipanggil dari Server Component
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.delete({ name, ...options });
            } catch (error) {
              // Abaikan error jika dipanggil dari Server Component
            }
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // URL redirect jika terjadi error atau tidak ada code
  console.error("Error or no code in auth callback:", request.url);
  return NextResponse.redirect(
    `${origin}/login?error=Gagal login, silakan coba lagi.`
  );
}
