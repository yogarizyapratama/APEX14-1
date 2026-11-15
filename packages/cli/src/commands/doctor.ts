import fs from "node:fs/promises";
import path from "node:path";

export interface DoctorCheck {
  name: string;
  passed: boolean;
  message: string;
}

export async function runDoctor(cwd: string = process.cwd()): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  // 1. Node.js Version Check
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0] || "0", 10);
  if (major >= 20) {
    checks.push({
      name: "Node.js Version",
      passed: true,
      message: `${nodeVersion} (compatible >= 20.0.0)`
    });
  } else {
    checks.push({
      name: "Node.js Version",
      passed: false,
      message: `${nodeVersion} is outdated. APEX14 requires Node.js >= 20.0.0`
    });
  }

  // 2. package.json check
  try {
    const pkgPath = path.join(cwd, "package.json");
    const content = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    checks.push({
      name: "package.json",
      passed: true,
      message: `Found ${pkg.name || "unnamed package"} (type: ${pkg.type || "commonjs"})`
    });

    if (pkg.type !== "module") {
      checks.push({
        name: "ESM Module Setup",
        passed: false,
        message: 'package.json should have "type": "module" for native ESM support.'
      });
    } else {
      checks.push({
        name: "ESM Module Setup",
        passed: true,
        message: 'package.json configured with "type": "module"'
      });
    }
  } catch {
    checks.push({
      name: "package.json",
      passed: false,
      message: "No package.json found in current directory"
    });
  }

  // 3. tsconfig.json check
  try {
    const tsconfigPath = path.join(cwd, "tsconfig.json");
    await fs.access(tsconfigPath);
    checks.push({
      name: "TypeScript Config",
      passed: true,
      message: "tsconfig.json detected"
    });
  } catch {
    checks.push({
      name: "TypeScript Config",
      passed: false,
      message: "No tsconfig.json found"
    });
  }

  return checks;
}
