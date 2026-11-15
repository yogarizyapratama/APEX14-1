import { LocalStorageProvider, type StorageProvider, type SaveFileOptions, type FileMetadata } from "./storage.js";
import type { ApexFileResult } from "@apex14/http";

const stores = new Map<string, StorageProvider>();
let defaultStore: StorageProvider = new LocalStorageProvider("./uploads");

export function configureStorage(provider: StorageProvider, name?: string): void {
  if (!name || name === "default") {
    defaultStore = provider;
  }
  if (name) {
    stores.set(name, provider);
  }
}

export function store(name: string = "default"): StorageProvider {
  if (name === "default") {
    return defaultStore;
  }
  const found = stores.get(name);
  if (!found) {
    const newStore = new LocalStorageProvider(`./uploads/${name}`);
    stores.set(name, newStore);
    return newStore;
  }
  return found;
}

export const file = {
  save(data: Uint8Array | Blob | Buffer, options?: SaveFileOptions): Promise<FileMetadata> {
    return defaultStore.save(data, options);
  },

  async saveMany(
    items: Array<Uint8Array | Blob | Buffer>,
    options?: SaveFileOptions
  ): Promise<FileMetadata[]> {
    const results: FileMetadata[] = [];
    for (const item of items) {
      results.push(await defaultStore.save(item, options));
    }
    return results;
  },

  download(id: string): Promise<ApexFileResult> {
    return defaultStore.download(id);
  },

  info(id: string): Promise<FileMetadata> {
    return defaultStore.info(id);
  },

  delete(id: string): Promise<boolean> {
    return defaultStore.delete(id);
  },

  exists(id: string): Promise<boolean> {
    return defaultStore.exists(id);
  }
};
