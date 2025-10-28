// app/auth/confirm/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'; // Gunakan client-side
import { Loader2 } from 'lucide-react';

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('Memproses autentikasi...');

  useEffect(() => {
    // Fungsi untuk memproses hash
    const processAuth = async () => {
      // 1. Ambil hash dari URL
      const hash = window.location.hash.substring(1); // Hapus '#' di awal
      if (!hash) {
        setError('Token autentikasi tidak ditemukan di URL.');
        setMessage('Gagal memproses. Kembali ke login...');
        setTimeout(() => router.replace('/login?error=Token tidak ditemukan'), 1500);
        return;
      }

      // 2. Parse hash menjadi objek
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const error_description = params.get('error_description'); // Cek jika ada error dari Supabase

      // Jika Supabase mengirim error di hash
      if (error_description) {
         setError(`Error dari server: ${error_description}`);
         setMessage('Gagal memproses. Kembali ke login...');
         setTimeout(() => router.replace(`/login?error=${encodeURIComponent(error_description)}`), 1500);
         return;
      }

      // 3. Pastikan token ada
      if (!access_token || !refresh_token) {
        setError('Informasi sesi tidak lengkap di URL.');
        setMessage('Gagal memproses. Kembali ke login...');
        setTimeout(() => router.replace('/login?error=Informasi sesi tidak lengkap'), 1500);
        return;
      }

      // 4. Panggil setSession
      setMessage('Mengatur sesi...');
      console.log('AuthConfirmPage: Memanggil setSession...');
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      // 5. Handle hasil setSession
      if (sessionError) {
        console.error('AuthConfirmPage: Gagal setSession:', sessionError);
        setError(`Gagal mengatur sesi: ${sessionError.message}`);
        setMessage('Gagal memproses. Kembali ke login...');
        setTimeout(() => router.replace(`/login?error=Gagal mengatur sesi: ${sessionError.message}`), 1500);
      } else if (data.session) {
        console.log('AuthConfirmPage: setSession berhasil! Sesi:', data.session);
        setMessage('Autentikasi berhasil! Mengarahkan ke dashboard...');
        // Beri sedikit waktu agar cookie mungkin tersimpan sebelum redirect
        setTimeout(() => {
            // Hapus hash dari URL sebelum redirect (opsional, tapi bersih)
            // window.history.replaceState(null, '', window.location.pathname);
            router.replace('/dashboard');
        }, 100);
      } else {
         // Kasus aneh jika setSession tidak error tapi sesi tetap null
         console.error('AuthConfirmPage: setSession tidak error, tapi sesi null.');
         setError('Gagal mendapatkan sesi setelah autentikasi.');
         setMessage('Gagal memproses. Kembali ke login...');
         setTimeout(() => router.replace('/login?error=Gagal mendapatkan sesi'), 1500);
      }
    };

    // Jalankan proses saat komponen mount
    processAuth();

  }, [supabase, router]);

  // UI Loading atau Error
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 text-center">
      {!error ? (
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      ) : (
        <div className="text-red-500">❌</div> // Tanda error
      )}
      <p className={`mt-4 font-medium ${error ? 'text-red-700' : 'text-gray-600'}`}>
        {message}
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}