import { InferenceResult } from "./api";

export interface StoredScan {
  id: string;
  filename: string;
  timestamp: number;
  detected_organs: string[];
  sliceCount: number;
  result: InferenceResult;
}

const DB_NAME = "SuPreM_CT_Scans_DB";
const STORE_NAME = "recent_scans";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecentScan(result: InferenceResult): Promise<StoredScan> {
  const id = `${result.filename}_${Date.now()}`;
  const item: StoredScan = {
    id,
    filename: result.filename,
    timestamp: Date.now(),
    detected_organs: result.detected_organs || [],
    sliceCount: result.ct_images?.length || 0,
    result,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to save scan to IndexedDB, falling back to localStorage", err);
    try {
      const existing = getRecentScansLocalFallback();
      const filtered = existing.filter((s) => s.filename !== item.filename);
      filtered.unshift(item);
      localStorage.setItem("recent_scans_meta", JSON.stringify(filtered.slice(0, 10)));
    } catch (e) {
      console.warn("LocalStorage fallback failed", e);
    }
  }

  return item;
}

export async function getRecentScans(): Promise<StoredScan[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("timestamp");
      const request = index.openCursor(null, "prev"); // newest first
      const results: StoredScan[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB read error, using localStorage fallback", err);
    return getRecentScansLocalFallback();
  }
}

export async function deleteRecentScan(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB delete error", err);
    const existing = getRecentScansLocalFallback();
    const updated = existing.filter((s) => s.id !== id);
    localStorage.setItem("recent_scans_meta", JSON.stringify(updated));
  }
}

export async function clearAllRecentScans(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB clear error", err);
  }
  localStorage.removeItem("recent_scans_meta");
}

function getRecentScansLocalFallback(): StoredScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("recent_scans_meta");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
