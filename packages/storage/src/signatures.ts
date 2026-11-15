export interface FileSignature {
  mime: string;
  extension: string;
  matches: (bytes: Uint8Array) => boolean;
}

export const SIGNATURES: FileSignature[] = [
  {
    mime: "image/jpeg",
    extension: "jpg",
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    mime: "image/png",
    extension: "png",
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
  },
  {
    mime: "image/gif",
    extension: "gif",
    matches: (b) =>
      b.length >= 4 &&
      b[0] === 0x47 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38
  },
  {
    mime: "application/pdf",
    extension: "pdf",
    matches: (b) =>
      b.length >= 4 &&
      b[0] === 0x25 &&
      b[1] === 0x50 &&
      b[2] === 0x44 &&
      b[3] === 0x46
  },
  {
    mime: "application/zip",
    extension: "zip",
    matches: (b) =>
      b.length >= 4 &&
      b[0] === 0x50 &&
      b[1] === 0x4b &&
      b[2] === 0x03 &&
      b[3] === 0x04
  },
  {
    mime: "image/webp",
    extension: "webp",
    matches: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
  }
];

export function detectFileSignature(bytes: Uint8Array): FileSignature | null {
  for (const sig of SIGNATURES) {
    if (sig.matches(bytes)) {
      return sig;
    }
  }
  return null;
}
