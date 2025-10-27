import { openDB, type DBSchema } from "idb";

const DB_NAME = "family-budget-db";
const DB_VERSION = 1;
const DRAFT_STORE = "draft_expenses";

// Definisikan tipe data draf
export interface DraftExpense {
  id: string;
  household_id: string;
  user_id: string;
  category_id: string;
  payment_source_id: string; // <-- TAMBAHKAN INI
  txn_date: string;
  amount: number;
  merchant?: string;
  notes?: string;
  receipt_file?: File;
}

interface BudgetDB extends DBSchema {
  [DRAFT_STORE]: {
    key: string;
    value: DraftExpense;
  };
}

// Buka koneksi DB
async function getDB() {
  return openDB<BudgetDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
    },
  });
}

// Fungsi untuk menyimpan draf
export async function saveDraftExpense(draft: DraftExpense) {
  const db = await getDB();
  await db.put(DRAFT_STORE, draft);
  console.log("Draf berhasil disimpan ke IndexedDB:", draft.id);
}

// Fungsi untuk mengambil semua draf
export async function getAllDrafts(): Promise<DraftExpense[]> {
  const db = await getDB();
  return db.getAll(DRAFT_STORE);
}

// Fungsi untuk menghapus draf
export async function deleteDraftExpense(id: string) {
  const db = await getDB();
  await db.delete(DRAFT_STORE, id);
  console.log("Draf berhasil dihapus dari IndexedDB:", id);
}
