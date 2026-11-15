import { runDoctor } from "./commands/doctor.js";
import { generateFile } from "./commands/generate.js";
import { createProject } from "./commands/create.js";
import { getActiveScope } from "@apex14/core";

export async function runCli(args: string[]): Promise<void> {
  const command = args[0] || "--help";

  if (command === "--help" || command === "-h" || command === "help") {
    console.log(`
▲ APEX14 CLI — Developer Productivity Engine

Usage:
  apex14 <command> [options]

Commands:
  create <name>               Create a new APEX14 project
  doctor                      Check environment and project configuration
  routes                      List all registered routes in current project
  generate <type> <name>      Generate route, middleware, or schema file
  info                        Display runtime and environment info
  dev                         Run development server with hot-reload
  build                       Compile project with TypeScript
  start                       Start compiled application

Options:
  --version, -v               Display APEX14 version
  --help, -h                  Display help information
`);
    return;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    console.log("APEX14 v0.1.0");
    return;
  }

  if (command === "info") {
    console.log("▲ APEX14 Framework");
    console.log(`• Version: 0.1.0`);
    console.log(`• Node: ${process.version}`);
    console.log(`• Platform: ${process.platform} (${process.arch})`);
    return;
  }

  if (command === "doctor") {
    console.log("▲ APEX14 Doctor Diagnostic\n");
    const checks = await runDoctor();
    let allOk = true;
    for (const c of checks) {
      const icon = c.passed ? "✔" : "✖";
      console.log(`  ${icon} ${c.name}: ${c.message}`);
      if (!c.passed) allOk = false;
    }
    console.log("");
    if (allOk) {
      console.log("✨ All checks passed! Ready to build with APEX14.\n");
    } else {
      console.log("⚠️ Some checks failed. Please address the warnings above.\n");
    }
    return;
  }

  if (command === "create") {
    const name = args[1];
    if (!name) {
      console.error("Error: Project name required. Example: apex14 create my-api");
      process.exitCode = 1;
      return;
    }
    const template = args.includes("--template") ? (args[args.indexOf("--template") + 1] as any) : "minimal";
    console.log(`▲ Scaffolding APEX14 project '${name}' (${template} template)...`);
    const target = await createProject({ name, template });
    console.log(`✔ Created project at ${target}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${name}`);
    console.log(`  pnpm install`);
    console.log(`  pnpm dev\n`);
    return;
  }

  if (command === "generate") {
    const type = args[1] as "route" | "middleware" | "schema";
    const name = args[2];
    if (!type || !name || !["route", "middleware", "schema"].includes(type)) {
      console.error("Usage: apex14 generate [route|middleware|schema] <name>");
      process.exitCode = 1;
      return;
    }
    const createdPath = await generateFile(type, name);
    console.log(`✔ Generated ${type}: ${createdPath}`);
    return;
  }

  if (command === "routes") {
    const scope = getActiveScope();
    const routes = scope.router.getRoutes();

    console.log("\n▲ APEX14 Registered Routes\n");
    console.log("METHOD  │ PATH                                     │ GUARD");
    console.log("────────┼──────────────────────────────────────────┼───────────────");
    if (routes.length === 0) {
      console.log("  (No routes currently loaded in active scope)\n");
    } else {
      for (const r of routes) {
        const methodCol = r.method.padEnd(7, " ");
        const pathCol = r.path.padEnd(41, " ");
        const guardCol = r.metadata.guard ? String(r.metadata.guard) : "—";
        console.log(`${methodCol} │ ${pathCol} │ ${guardCol}`);
      }
      console.log("");
    }
    return;
  }

  console.error(`Unknown command: '${command}'. Run 'apex14 --help' for available commands.`);
  process.exitCode = 1;
}
