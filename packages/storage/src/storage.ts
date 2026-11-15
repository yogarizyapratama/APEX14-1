import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ApexFileResult, ValidationError, NotFoundError } from "@apex14/http";
import { detectFileSignature } from "./signatures.js";

export interface FileMetadata {
  id: string;
  originalName: string;
  sanitizedName: string;
  size: number;
  mimeType: string;
  detectedMimeType?: string;
  extension: string;
  createdAt: string;
  path?: string;
}

export interface SaveFileOptions {
  filename?: string;
  maxSizeBytes?: number;
  allowedMimes?: string[];
  enforceSignature?: boolean;
}

export interface StorageProvider {
  save(data: Uint8Array | Blob | Buffer, options?: SaveFileOptions): Promise<FileMetadata>;
  read(id: string): Promise<Uint8Array>;
  download(id: string): Promise<ApexFileResult>;
  info(id: string): Promise<FileMetadata>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string = "./uploads") {
    this.baseDir = path.resolve(baseDir);
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  public async save(
    data: Uint8Array | Blob | Buffer,
    options: SaveFileOptions = {}
  ): Promise<FileMetadata> {
    await this.init();

    let bytes: Uint8Array;
    let originalName = options.filename || "file";
    let mimeType = "application/octet-stream";

    if (data instanceof Blob) {
      const arr = await data.arrayBuffer();
      bytes = new Uint8Array(arr);
      if (!options.filename && "name" in data && typeof (data as any).name === "string") {
        originalName = (data as any).name;
      }
      if (data.type) {
        mimeType = data.type;
      }
    } else if (Buffer.isBuffer(data)) {
      bytes = new Uint8Array(data);
    } else {
      bytes = data;
    }

    // 1. Max size validation
    if (options.maxSizeBytes && bytes.length > options.maxSizeBytes) {
      throw new ValidationError(
        `File size (${bytes.length} bytes) exceeds limit of ${options.maxSizeBytes} bytes`
      );
    }

    // 2. Magic byte / Signature inspection
    const signature = detectFileSignature(bytes);
    if (options.enforceSignature && !signature) {
      throw new ValidationError("File signature could not be verified or is unsupported");
    }

    if (signature) {
      // If signature is detected, use the verified MIME type
      mimeType = signature.mime;
    }

    // 3. Allowed MIME check
    if (options.allowedMimes && options.allowedMimes.length > 0) {
      const isAllowed = options.allowedMimes.some((m) =>
        m.endsWith("/*") ? mimeType.startsWith(m.slice(0, -1)) : m === mimeType
      );
      if (!isAllowed) {
        throw new ValidationError(`MIME type '${mimeType}' is not allowed`);
      }
    }

    // 4. Safe ID & filename generation
    const id = crypto.randomUUID();
    const ext = signature ? `.${signature.extension}` : path.extname(originalName) || "";
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
    const safeFilename = `${id}${sanitizedExt}`;

    const filePath = path.join(this.baseDir, safeFilename);

    // Verify path doesn't escape baseDir (Path traversal defense)
    if (!filePath.startsWith(this.baseDir)) {
      throw new ValidationError("Invalid destination path");
    }

    await fs.writeFile(filePath, bytes);

    const meta: FileMetadata = {
      id,
      originalName,
      sanitizedName: safeFilename,
      size: bytes.length,
      mimeType,
      detectedMimeType: signature?.mime,
      extension: sanitizedExt,
      createdAt: new Date().toISOString(),
      path: filePath
    };

    // Store metadata JSON alongside file
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(meta, null, 2));

    return meta;
  }

  public async read(id: string): Promise<Uint8Array> {
    const meta = await this.info(id);
    const data = await fs.readFile(meta.path!);
    return new Uint8Array(data);
  }

  public async download(id: string): Promise<ApexFileResult> {
    const meta = await this.info(id);
    const bytes = await this.read(id);
    return new ApexFileResult(bytes, meta.originalName, meta.mimeType);
  }

  public async info(id: string): Promise<FileMetadata> {
    // Sanitize ID
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const files = await fs.readdir(this.baseDir);
    const metaFile = files.find((f) => f.startsWith(safeId) && f.endsWith(".meta.json"));

    if (!metaFile) {
      throw new NotFoundError(`File with ID '${id}' not found`);
    }

    const content = await fs.readFile(path.join(this.baseDir, metaFile), "utf8");
    return JSON.parse(content) as FileMetadata;
  }

  public async delete(id: string): Promise<boolean> {
    try {
      const meta = await this.info(id);
      if (meta.path) {
        await fs.unlink(meta.path);
        await fs.unlink(`${meta.path}.meta.json`);
      }
      return true;
    } catch {
      return false;
    }
  }

  public async exists(id: string): Promise<boolean> {
    try {
      await this.info(id);
      return true;
    } catch {
      return false;
    }
  }
}
