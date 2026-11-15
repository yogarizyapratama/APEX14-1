import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { runDoctor, generateFile, createProject, benchmarkRoute, formatBenchmarkMarkdown } from "./index.js";
import { createScope } from "@apex14/core";

const CLI_TEST_DIR = "./test-cli-sandbox";

describe("@apex14/cli", () => {
  afterAll(async () => {
    try {
      await fs.rm(CLI_TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it("runs doctor diagnostic check", async () => {
    const checks = await runDoctor(process.cwd());
    expect(checks.length).toBeGreaterThan(0);
    const nodeCheck = checks.find((c) => c.name === "Node.js Version");
    expect(nodeCheck?.passed).toBe(true);
  });

  it("generates route, middleware, and schema files", async () => {
    await fs.mkdir(CLI_TEST_DIR, { recursive: true });

    // Generate route
    const routeFile = await generateFile("route", "articles", CLI_TEST_DIR);
    const routeContent = await fs.readFile(routeFile, "utf8");
    expect(routeContent).toContain('route("/articles"');

    // Generate middleware
    const mwFile = await generateFile("middleware", "timer", CLI_TEST_DIR);
    const mwContent = await fs.readFile(mwFile, "utf8");
    expect(mwContent).toContain("timerMiddleware");

    // Generate schema
    const schemaFile = await generateFile("schema", "post", CLI_TEST_DIR);
    const schemaContent = await fs.readFile(schemaFile, "utf8");
    expect(schemaContent).toContain("PostSchema");
  });

  it("scaffolds a new project with createProject", async () => {
    const projectDir = await createProject({
      name: "sample-app",
      template: "minimal",
      cwd: CLI_TEST_DIR
    });

    const pkg = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf8"));
    expect(pkg.name).toBe("sample-app");
    expect(pkg.dependencies.apex14).toBeDefined();

    const indexFile = await fs.readFile(path.join(projectDir, "src", "index.ts"), "utf8");
    expect(indexFile).toContain('route("/", () => ({');
  });

  it("benchmarks routes with benchmarkRoute and generates report", async () => {
    const scope = createScope();
    scope.route("/ping", () => "pong");

    const res = await benchmarkRoute(scope, "/ping", {
      requests: 50,
      durationMs: 500
    });

    expect(res.totalRequests).toBeGreaterThan(0);
    expect(res.requestsPerSecond).toBeGreaterThan(0);
    expect(res.latency.p50).toBeGreaterThanOrEqual(0);

    const md = formatBenchmarkMarkdown(res);
    expect(md).toContain("APEX14 Route Benchmark");
    expect(md).toContain("Throughput");
  });
});
