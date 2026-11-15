import fs from "node:fs/promises";
import path from "node:path";

export interface CreateProjectOptions {
  name: string;
  template?: "minimal" | "professional";
  cwd?: string;
}

export async function createProject(options: CreateProjectOptions): Promise<string> {
  const rootDir = path.resolve(options.cwd || process.cwd(), options.name);
  const template = options.template || "minimal";

  await fs.mkdir(path.join(rootDir, "src"), { recursive: true });

  const pkgJson = {
    name: options.name,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "node --watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js"
    },
    dependencies: {
      apex14: "^0.1.0"
    },
    devDependencies: {
      "@types/node": "^22.10.1",
      typescript: "^5.7.2"
    }
  };

  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      outDir: "./dist"
    },
    include: ["src/**/*"]
  };

  let indexContent = "";

  if (template === "minimal") {
    indexContent = `import { route, run } from "apex14";

route("/", () => ({
  name: "${options.name}",
  framework: "APEX14",
  status: "running"
}));

route("/health", () => "healthy");

run(3000);
`;
  } else {
    // Professional template
    indexContent = `import { route, group, use, secure, run, Type } from "apex14";

// 1. Security configuration
secure({
  cors: { origin: true, credentials: true }
});

// 2. Global logging middleware
use(async (ctx, next) => {
  const start = Date.now();
  const res = await next();
  console.log(\`[\${ctx.request.method}] \${ctx.url.pathname} - \${Date.now() - start}ms\`);
  return res;
});

// 3. Root health route
route("/", () => ({
  app: "${options.name}",
  framework: "APEX14",
  version: "0.1.0"
}));

// 4. API group with validation
group("/api", () => {
  const ItemSchema = Type.Object({
    title: Type.String({ minLength: 2 }),
    quantity: Type.Number({ minimum: 1 })
  });

  const items = [
    { id: 1, title: "Sample Item", quantity: 5 }
  ];

  route("/items", {
    GET: () => items,
    POST: ({ body }) => {
      const created = { id: items.length + 1, ...body };
      items.push(created);
      return created;
    }
  }, { body: ItemSchema });
});

run(3000);
`;
  }

  await fs.writeFile(path.join(rootDir, "package.json"), JSON.stringify(pkgJson, null, 2));
  await fs.writeFile(path.join(rootDir, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));
  await fs.writeFile(path.join(rootDir, "src", "index.ts"), indexContent);

  return rootDir;
}
