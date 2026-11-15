import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import {
  LocalStorageProvider,
  detectFileSignature,
  file,
  configureStorage
} from "./index.js";
import { ValidationError, NotFoundError } from "@apex14/http";

const TEST_UPLOAD_DIR = "./test-uploads";

describe("@apex14/storage", () => {
  let provider: LocalStorageProvider;

  beforeAll(async () => {
    provider = new LocalStorageProvider(TEST_UPLOAD_DIR);
    configureStorage(provider);
    await provider.init();
  });

  afterAll(async () => {
    try {
      await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
    } catch {}
  });

  it("detects valid magic-byte file signatures", () => {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectFileSignature(pngBytes)?.mime).toBe("image/png");

    // JPEG signature: FF D8 FF
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectFileSignature(jpegBytes)?.mime).toBe("image/jpeg");

    // PDF signature: 25 50 44 46 (%PDF)
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(detectFileSignature(pdfBytes)?.mime).toBe("application/pdf");
  });

  it("saves a valid file and retrieves its metadata and download stream", async () => {
    const pngData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02
    ]);

    const meta = await file.save(pngData, {
      filename: "avatar.png",
      enforceSignature: true
    });

    expect(meta.id).toBeDefined();
    expect(meta.mimeType).toBe("image/png");
    expect(meta.size).toBe(pngData.length);

    // Retrieve info
    const info = await file.info(meta.id);
    expect(info.id).toBe(meta.id);
    expect(info.mimeType).toBe("image/png");

    // Download
    const downloadResult = await file.download(meta.id);
    expect(downloadResult.status).toBe(200);
    expect(downloadResult.contentType).toBe("image/png");

    // Delete
    const deleted = await file.delete(meta.id);
    expect(deleted).toBe(true);

    await expect(file.info(meta.id)).rejects.toThrow(NotFoundError);
  });

  it("rejects uploads exceeding size limit", async () => {
    const largeData = new Uint8Array(1000);
    await expect(
      file.save(largeData, { maxSizeBytes: 500 })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects disallowed MIME types", async () => {
    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    await expect(
      file.save(pdfData, { allowedMimes: ["image/*"] })
    ).rejects.toThrow(ValidationError);
  });

  it("saves multiple files via saveMany", async () => {
    const f1 = new Uint8Array([1, 2, 3]);
    const f2 = new Uint8Array([4, 5, 6]);

    const metas = await file.saveMany([f1, f2]);
    expect(metas.length).toBe(2);
    expect(metas[0]?.id).not.toBe(metas[1]?.id);

    // Cleanup
    await file.delete(metas[0]!.id);
    await file.delete(metas[1]!.id);
  });
});
