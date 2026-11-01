// IndexedDB on this phone. The name and version must stay "ghar-hisaab" / 2 so existing data keeps opening.
export const DB_NAME = "ghar-hisaab";
export const DB_VERSION = 2;
export type StoreName = "entries" | "slips" | "projects" | "contacts" | "meta";

let handle: IDBDatabase | null = null;

const reqP = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const dbReady = (): boolean => handle !== null;

/** Opens (and if needed creates or upgrades) the database. onBlocked runs when another tab holds an old version. */
export function openDB(onBlocked?: () => void): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("entries")) d.createObjectStore("entries", { keyPath: "id" });
      if (!d.objectStoreNames.contains("slips")) d.createObjectStore("slips");
      if (!d.objectStoreNames.contains("projects")) d.createObjectStore("projects", { keyPath: "id" });
      if (!d.objectStoreNames.contains("contacts")) d.createObjectStore("contacts", { keyPath: "id" });
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
    };
    r.onblocked = () => onBlocked?.();
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); location.reload(); }; handle = d; res(d); };
    r.onerror = () => rej(r.error);
  });
}

const os = (name: StoreName, mode: IDBTransactionMode = "readonly"): IDBObjectStore => {
  if (!handle) throw new Error("Database is not open");
  return handle.transaction(name, mode).objectStore(name);
};
export const dbAll = <T = unknown>(s: StoreName): Promise<T[]> => reqP(os(s).getAll()) as Promise<T[]>;
export const dbGet = <T = unknown>(s: StoreName, k: IDBValidKey): Promise<T | undefined> => reqP(os(s).get(k)) as Promise<T | undefined>;
export const dbPut = (s: StoreName, v: unknown, k?: IDBValidKey): Promise<IDBValidKey> =>
  reqP(k === undefined ? os(s, "readwrite").put(v) : os(s, "readwrite").put(v, k));
export const dbDel = (s: StoreName, k: IDBValidKey): Promise<undefined> => reqP(os(s, "readwrite").delete(k));
