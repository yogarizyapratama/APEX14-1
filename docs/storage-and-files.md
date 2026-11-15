# APEX14 — Safe File Management & Storage Engine

File handling in APEX14 is designed to be effortless while maintaining strict security boundaries against path traversal and malicious file masquerading.

---

## 1. Quick Example

```ts
import { route, file, run } from "apex14";

// Upload single file
route("/upload/avatar", {
  POST: async ({ files }) => {
    if (!files.avatar) {
      return { error: "No avatar uploaded" };
    }

    const saved = await file.save(files.avatar, {
      enforceSignature: true,       // Inspects magic bytes (not just extension)
      allowedMimes: ["image/*"],    // Only allow images
      maxSizeBytes: 2 * 1024 * 1024 // 2MB limit
    });

    return {
      success: true,
      fileId: saved.id,
      url: `/download/${saved.id}`
    };
  }
});

// Download file
route("/download/:id", ({ params }) => {
  return file.download(params.id);
});

run(3000);
```

---

## 2. Magic-Byte File Signature Verification

Clients can easily spoof file extensions (e.g. renaming `malware.exe` to `photo.png`). APEX14 inspects the first binary bytes (magic bytes) to verify genuine file types before saving:

```ts
const saved = await file.save(files.document, {
  enforceSignature: true
});
```

Supported out-of-the-box:
- **PNG**: `89 50 4E 47 0D 0A 1A 0A`
- **JPEG**: `FF D8 FF`
- **GIF**: `47 49 46 38`
- **PDF**: `25 50 44 46` (`%PDF`)
- **ZIP**: `50 4B 03 04`
- **WebP**: `RIFF....WEBP`

---

## 3. Storage Security Defense

- **Path Traversal Protection**: Uploaded files are assigned random UUID identifiers (`crypto.randomUUID()`) and sanitized extensions. Filenames containing `../`, null bytes, or slashes cannot escape the storage root.
- **Quota & Size Enforcement**: Automatically enforces `maxSizeBytes` with early termination.
- **Metadata Isolation**: File metadata (original name, verified MIME type, size, upload timestamp) is stored securely alongside the binary artifact.

---

## 4. Multiple Files (`saveMany`)

```ts
route("/upload/gallery", {
  POST: async ({ files }) => {
    const list = [files.photo1, files.photo2, files.photo3].filter(Boolean);
    const saved = await file.saveMany(list, {
      allowedMimes: ["image/*"]
    });
    return { count: saved.length, files: saved };
  }
});
```

---

## 5. Storage Inspection & Cleanup

```ts
// Retrieve metadata
const info = await file.info(fileId);
console.log(info.originalName, info.mimeType, info.size);

// Check if file exists
const exists = await file.exists(fileId);

// Delete file
const isDeleted = await file.delete(fileId);
```
