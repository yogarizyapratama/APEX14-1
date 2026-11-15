import { getActiveScope } from "@apex14/core";
import { listenNode, type NodeServerOptions, type NodeServerHandle } from "@apex14/runtime-node";
import { listenBun } from "@apex14/runtime-bun";

export type RunOptions = NodeServerOptions;

export function run(portOrOptions: number | RunOptions = 3000): Promise<NodeServerHandle | any> {
  const options: RunOptions = typeof portOrOptions === "number" ? { port: portOrOptions } : portOrOptions;
  const scope = getActiveScope();

  // Runtime detection: Bun vs Node
  if (typeof (globalThis as any).Bun !== "undefined") {
    return Promise.resolve(listenBun(scope, {
      port: options.port,
      hostname: options.host,
      silent: options.silent
    }));
  }

  return listenNode(scope, options);
}
