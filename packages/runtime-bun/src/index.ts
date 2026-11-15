import type { ApexScope } from "@apex14/core";

export interface BunServerOptions {
  port?: number;
  hostname?: string;
  silent?: boolean;
}

export function listenBun(scope: ApexScope, options: BunServerOptions = {}) {
  // @ts-ignore
  if (typeof Bun === "undefined" || !Bun.serve) {
    throw new Error("Bun runtime adapter can only be run in a Bun environment");
  }

  const port = options.port || 3000;
  const hostname = options.hostname || "0.0.0.0";

  // @ts-ignore
  const server = Bun.serve({
    port,
    hostname,
    fetch(req: Request) {
      return scope.handle(req);
    }
  });

  if (!options.silent) {
    console.log(`▲ APEX14 — The Intelligent API Framework`);
    console.log(`• Server listening on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${server.port}`);
    // @ts-ignore
    console.log(`• Runtime: Bun (${Bun.version})`);
  }

  return server;
}
