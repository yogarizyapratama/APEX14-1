import fs from "node:fs/promises";
import path from "node:path";

export async function generateFile(
  type: "route" | "middleware" | "schema",
  name: string,
  cwd: string = process.cwd()
): Promise<string> {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const targetDir = path.join(cwd, "src", type === "route" ? "routes" : type === "middleware" ? "middleware" : "schemas");
  await fs.mkdir(targetDir, { recursive: true });

  let filename = "";
  let content = "";

  if (type === "route") {
    filename = `${cleanName}.ts`;
    content = `import { route } from "apex14";

route("/${cleanName}", {
  GET: () => ({
    message: "List ${cleanName}"
  }),

  POST: ({ body }) => ({
    message: "Create ${cleanName}",
    data: body
  })
});
`;
  } else if (type === "middleware") {
    filename = `${cleanName}.ts`;
    content = `import type { ApexRequestContext } from "apex14";

export async function ${cleanName}Middleware(
  ctx: ApexRequestContext,
  next: () => Promise<any>
) {
  // Before request logic
  const start = Date.now();

  const result = await next();

  // After request logic
  const duration = Date.now() - start;
  ctx.header("x-response-time", \`\${duration}ms\`);

  return result;
}
`;
  } else if (type === "schema") {
    const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    filename = `${cleanName}.ts`;
    content = `import { Type, type Static } from "apex14";

export const ${capitalized}Schema = Type.Object({
  id: Type.Optional(Type.String({ format: "uuid" })),
  name: Type.String({ minLength: 2 }),
  createdAt: Type.Optional(Type.String({ format: "date-time" }))
});

export type ${capitalized} = Static<typeof ${capitalized}Schema>;
`;
  }

  const destPath = path.join(targetDir, filename);
  await fs.writeFile(destPath, content, "utf8");
  return destPath;
}
