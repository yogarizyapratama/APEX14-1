# Zero-Config Polyglot Client SDK Generator (`sdk`)

Stop maintaining hand-written API client libraries or relying on heavy Java-based OpenAPI generation tools. APEX14 reads its in-memory routing manifest and contracts to generate lightweight, zero-dependency, idiomatic client SDKs for TypeScript, Python, Dart (Flutter), and Go.

---

## 1. Programmatic Generation

```ts
import { sdk } from "apex14";

// 1. Generate TypeScript client
const tsCode = sdk.generate({ language: "typescript", baseUrl: "https://api.myapp.com" });

// 2. Generate Python client
const pyCode = sdk.generate({ language: "python", baseUrl: "https://api.myapp.com" });

// 3. Generate Dart / Flutter client
const dartCode = sdk.generate({ language: "dart", baseUrl: "https://api.myapp.com" });

// 4. Generate Go client
const goCode = sdk.generate({ language: "go", baseUrl: "https://api.myapp.com" });
```

---

## 2. Using the Generated Clients

### TypeScript Client
```ts
import { ApexClient } from "./generated-client";

const client = new ApexClient("https://api.myapp.com");
const users = await client.getUsers();
const user = await client.getUsersById("usr_123");
await client.postUsers({ name: "Alex", email: "alex@example.com" });
```

### Python Client
```python
from client import ApexClient

client = ApexClient("https://api.myapp.com")
users = client.get_users()
user = client.get_users_by_id("usr_123")
```
