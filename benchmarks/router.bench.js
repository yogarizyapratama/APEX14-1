import { RadixRouter } from "../packages/router/dist/index.js";

console.log("▲ APEX14 Router Micro-Benchmark");
console.log(`• Node: ${process.version} (${process.platform} ${process.arch})\n`);

const router = new RadixRouter();

router.add({ method: "GET", path: "/", handler: () => "root", middleware: [], metadata: {} });
router.add({ method: "GET", path: "/health", handler: () => "health", middleware: [], metadata: {} });
router.add({ method: "GET", path: "/api/v1/health/detailed", handler: () => "deep", middleware: [], metadata: {} });
router.add({ method: "GET", path: "/users/:id", handler: () => "user", middleware: [], metadata: {} });
router.add({
  method: "GET",
  path: "/organizations/:orgId/projects/:projectId/issues/:issueId",
  handler: () => "issue",
  middleware: [],
  metadata: {}
});
router.add({ method: "GET", path: "/static/*filepath", handler: () => "static", middleware: [], metadata: {} });

function bench(name, fn, iterations = 2_000_000) {
  // Warmup
  for (let i = 0; i < 50_000; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const duration = performance.now() - start;
  const opsSec = Math.round((iterations / duration) * 1000);
  const avgNs = Math.round((duration / iterations) * 1_000_000);

  console.log(`  ${name.padEnd(45, " ")}: ${opsSec.toLocaleString().padStart(12, " ")} ops/sec  (${avgNs} ns/op)`);
}

console.log("Benchmarking Route Lookups (2,000,000 iterations each):");
bench("Root static route: '/'", () => router.match("GET", "/"));
bench("Deep static route: '/api/v1/health/detailed'", () => router.match("GET", "/api/v1/health/detailed"));
bench("Single param route: '/users/12345'", () => router.match("GET", "/users/12345"));
bench("Multi-param route: '/organizations/org_1/projects/prj_2/issues/iss_3'", () =>
  router.match("GET", "/organizations/org_1/projects/prj_2/issues/iss_3")
);
bench("Wildcard route: '/static/css/theme/dark.css'", () => router.match("GET", "/static/css/theme/dark.css"));

console.log("\n✔ Benchmark finished successfully.\n");
