"use client";

import { useEffect, useState } from "react";
import {
  getAllDrafts,
  deleteDraftExpense,
  type DraftExpense,
} from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";
// Jika Anda pakai toast/notifikasi, import di sini
// import { toast } from 'react-hot-toast'

export default function SyncProvider() {
  const [isSyncing, setIsSyncing] = useState(false);
  const supabase = createClient();

  const syncDrafts = async () => {
    if (isSyncing) return;
    if (!navigator.onLine) return;

    setIsSyncing(true);
    // toast.loading('Sinkronisasi data offline...')

    const drafts = await getAllDrafts();
    if (drafts.length === 0) {
      setIsSyncing(false);
      // toast.dismiss()
      return;
    }

    console.log(`Mulai sinkronisasi ${drafts.length} draf...`);

    let successCount = 0;
    const errors: string[] = [];

    for (const draft of drafts) {
      try {
        let receiptPath = null;

        // 1. Upload struk jika ada
        if (draft.receipt_file) {
          const filePath = `${draft.user_id}/${uuidv4()}-${
            draft.receipt_file.name
          }`;
          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(filePath, draft.receipt_file);

          if (uploadError)
            throw new Error(`Gagal upload struk: ${uploadError.message}`);
          receiptPath = filePath;
        }

        // 2. Insert data pengeluaran
        const { error: insertError } = await supabase.from("expenses").insert({
          household_id: draft.household_id,
          user_id: draft.user_id,
          category_id: draft.category_id,
          payment_source_id: draft.payment_source_id,
          txn_date: draft.txn_date,
          amount: draft.amount,
          merchant: draft.merchant,
          notes: draft.notes,
          receipt_url: receiptPath,
        });

        if (insertError) throw insertError;

        // 3. Hapus draf dari IndexedDB
        await deleteDraftExpense(draft.id);
        successCount++;
      } catch (error: any) {
        console.error("Gagal sinkronisasi draf:", draft.id, error);
        errors.push(draft.id);
      }
    }

    setIsSyncing(false);
    // toast.dismiss()
    if (successCount > 0) {
      // toast.success(`${successCount} draf berhasil disinkronkan!`)
      console.log(`${successCount} draf berhasil disinkronkan!`);
    }
    if (errors.length > 0) {
      // toast.error(`Gagal sinkronisasi ${errors.length} draf.`)
      console.error(`Gagal sinkronisasi ${errors.length} draf.`);
    }
  };

  useEffect(() => {
    // Coba sinkronisasi saat komponen dimuat
    syncDrafts();

    // Tambahkan listener untuk event 'online'
    window.addEventListener("online", syncDrafts);

    // Hapus listener saat komponen di-unmount
    return () => {
      window.removeEventListener("online", syncDrafts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Hanya jalan sekali saat mount

  return null; // Komponen ini tidak me-render UI
}
