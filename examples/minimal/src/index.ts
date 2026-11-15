import { route, run } from "apex14";

// Direct return string
route("/", () => "Hello from APEX14!");

// Direct return JSON object
route("/health", () => ({
  status: "healthy",
  framework: "APEX14",
  timestamp: new Date().toISOString()
}));

// Route with dynamic parameter
route("/greet/:name", ({ params }) => ({
  message: `Welcome to APEX14, ${params.name}!`
}));

run(3000);
