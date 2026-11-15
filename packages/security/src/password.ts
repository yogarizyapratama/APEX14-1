import crypto from "node:crypto";

function scryptPromise(
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export interface PasswordHashOptions {
  cost?: number; // N, default 16384
  blockSize?: number; // r, default 8
  parallelization?: number; // p, default 1
  keyLength?: number; // default 64 bytes
  saltLength?: number; // default 16 bytes
}

export async function hashPassword(
  password: string,
  options: PasswordHashOptions = {}
): Promise<string> {
  const cost = options.cost || 16384;
  const blockSize = options.blockSize || 8;
  const parallelization = options.parallelization || 1;
  const keyLength = options.keyLength || 64;
  const saltLength = options.saltLength || 16;

  const salt = crypto.randomBytes(saltLength);
  const derivedKey = await scryptPromise(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 32 * 1024 * 1024
  });

  return `$apex$scrypt$N=${cost},r=${blockSize},p=${parallelization}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith("$apex$scrypt$")) {
    return false;
  }

  const parts = hash.split("$");
  // parts[0] = '', parts[1] = 'apex', parts[2] = 'scrypt', parts[3] = 'N=...,r=...,p=...', parts[4] = salt, parts[5] = key
  if (parts.length !== 6) {
    return false;
  }

  const paramsStr = parts[3]!;
  const saltHex = parts[4]!;
  const expectedKeyHex = parts[5]!;

  const paramMatches = paramsStr.match(/N=(\d+),r=(\d+),p=(\d+)/);
  if (!paramMatches) return false;

  const cost = parseInt(paramMatches[1]!, 10);
  const blockSize = parseInt(paramMatches[2]!, 10);
  const parallelization = parseInt(paramMatches[3]!, 10);

  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(expectedKeyHex, "hex");

  try {
    const derivedKey = await scryptPromise(password, salt, expectedKey.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 32 * 1024 * 1024
    });

    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}
