import {
  route,
  group,
  use,
  guard,
  secure,
  run,
  file,
  db,
  model,
  resource,
  Type,
  Jwt,
  hashPassword,
  verifyPassword,
  rateLimit,
  securityHeaders,
  cors,
  AuthenticationError
} from "apex14";

const JWT_SECRET = process.env.JWT_SECRET || "enterprise-secure-jwt-secret-apex14-key";

// 1. Zero-SQL Model Definition
// No raw SQL, no CREATE TABLE queries. Schema automatically maps to database table!
const ArticleSchema = Type.Object({
  title: Type.String({ minLength: 3 }),
  content: Type.String({ minLength: 5 }),
  author: Type.String()
});

export const Article = model("articles", ArticleSchema);

// 2. Security Middleware & Config
secure({
  cors: { origin: true, credentials: true },
  jwt: { secret: JWT_SECRET, expiresIn: "2h" }
});

use(securityHeaders());
use(cors({ origin: true, credentials: true }));
use(rateLimit({ max: 100, windowMs: 60000 }));

// 3. Guards
guard("auth", async (ctx) => {
  const authHeader = ctx.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing or invalid Bearer token");
  }
  const token = authHeader.slice(7);
  const payload = await Jwt.verify(token, JWT_SECRET);
  ctx.user = payload;
  return true;
});

// 4. Public Authentication Routes
route("/auth/login", {
  POST: async ({ body }) => {
    // Demo validation
    if (body.username === "admin" && body.password === "secret123") {
      const token = await Jwt.sign(
        { sub: "1", username: "admin", role: "admin" },
        JWT_SECRET,
        { expiresIn: "2h" }
      );
      return { token, user: { username: "admin", role: "admin" } };
    }
    throw new AuthenticationError("Invalid username or password");
  }
});

// 5. File Upload Route
route("/upload", {
  POST: async ({ files }) => {
    if (!files.avatar) {
      return { error: "No avatar file provided" };
    }
    const saved = await file.save(files.avatar, {
      enforceSignature: true,
      allowedMimes: ["image/*"]
    });
    return { success: true, file: saved };
  }
}, { guard: "auth" });

// 6. Direct CRUD Resource for Articles (Full REST API in 1 line)
resource("articles", {
  database: "main",
  schema: ArticleSchema,
  allowedFields: ["title", "content", "author"],
  pagination: { default: 10, max: 50 }
});

// 7. Custom Routes Using the Model Directly (Zero Pure Query)
route("/featured-articles", async () => {
  return await Article.where("author", "admin").limit(5).get();
});

run(4000);
