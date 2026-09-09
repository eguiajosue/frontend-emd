/**
 * Cola de mutaciones offline (IndexedDB vía `idb`).
 *
 * Cuando una escritura al backend falla por falta de red (no por un error de
 * negocio: eso se propaga tal cual), se guarda acá en vez de perderse, y se
 * reintenta cuando vuelve la conexión (`registerBackgroundSync` / el listener
 * `online`, ver `useEnqueueOnReconnect`). Vive tanto en el hilo principal como
 * en el service worker (`sw.ts`): `idb` es compatible con ambos contextos.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface PendingMutation {
  id: string;
  url: string;
  method: string;
  body: unknown;
  createdAt: number;
}

interface OfflineQueueDB extends DBSchema {
  "pending-mutations": {
    key: string;
    value: PendingMutation;
  };
}

const DB_NAME = "emd-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-mutations";

let dbPromise: Promise<IDBPDatabase<OfflineQueueDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineQueueDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Encola una mutación que no se pudo enviar por falta de red. */
export async function enqueueMutation(
  url: string,
  method: string,
  body: unknown
): Promise<PendingMutation> {
  const mutation: PendingMutation = {
    id: generateId(),
    url,
    method,
    body,
    createdAt: Date.now(),
  };
  const db = await getDb();
  await db.put(STORE_NAME, mutation);
  return mutation;
}

/** Todas las mutaciones pendientes, más viejas primero. */
export async function listPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDb();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/** Saca una mutación de la cola (ya sea porque se envió o se descartó). */
export async function removePendingMutation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}
