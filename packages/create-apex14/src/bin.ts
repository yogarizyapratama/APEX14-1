#!/usr/bin/env node
import { createProject } from "@apex14/cli";

async function main() {
  const args = process.argv.slice(2);
  const name = args[0] || "my-apex14-api";
  const template = args.includes("--template") ? (args[args.indexOf("--template") + 1] as any) : "minimal";

  console.log(`▲ Scaffolding new APEX14 project: ${name} (${template} template)...`);
  const target = await createProject({ name, template });
  console.log(`✔ Created project at ${target}`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${name}`);
  console.log(`  pnpm install`);
  console.log(`  pnpm dev\n`);
}

main().catch((err) => {
  console.error("Error creating project:", err);
  process.exit(1);
});
