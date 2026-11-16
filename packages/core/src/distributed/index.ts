import type { DistributedDriver } from "./types.js";
import { MemoryDistributedDriver } from "./memory.js";
import { RedisDistributedDriver, type RedisDriverOptions } from "./redis.js";

export * from "./types.js";
export * from "./memory.js";
export * from "./redis.js";

let activeDriver: DistributedDriver = new MemoryDistributedDriver();

export function configureDistributed(
  driverOrUrl: DistributedDriver | string | RedisDriverOptions
): DistributedDriver {
  if (typeof driverOrUrl === "string") {
    if (driverOrUrl.startsWith("redis://") || driverOrUrl.startsWith("rediss://")) {
      activeDriver = new RedisDistributedDriver(driverOrUrl);
    } else {
      activeDriver = new MemoryDistributedDriver();
    }
  } else if (typeof (driverOrUrl as any).lockAcquire === "function") {
    activeDriver = driverOrUrl as DistributedDriver;
  } else {
    activeDriver = new RedisDistributedDriver(driverOrUrl as RedisDriverOptions);
  }

  return activeDriver;
}

export function getDistributedDriver(): DistributedDriver {
  return activeDriver;
}
