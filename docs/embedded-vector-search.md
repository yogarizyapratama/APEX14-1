# Embedded Vector Similarity & Semantic Search (`vector`)

Modern AI applications require semantic similarity retrieval for RAG, product recommendations, and context injection. APEX14 includes an ultra-fast, zero-dependency in-memory vector index supporting Cosine Similarity, Dot Product, and Euclidean distance with metadata filtering.

---

## 1. Creating a Vector Index

```ts
import { vector, route } from "apex14";

const index = vector.index({
  dimensions: 1536, // Standard OpenAI/Gemini embedding vector size
  metric: "cosine"  // "cosine" | "dot" | "euclidean"
});

// Index documents with custom metadata
index.upsert("doc_001", embedding1, { category: "legal", title: "Terms of Service" });
index.upsert("doc_002", embedding2, { category: "billing", title: "Refund Policy" });
```

---

## 2. Searching Nearest Neighbors (Top-K)

```ts
route("/api/search/semantic", async (ctx) => {
  const queryEmbedding = await getEmbedding(ctx.query.q);

  // Search Top-5 closest records with metadata filtering
  const results = index.search(queryEmbedding, {
    topK: 5,
    minScore: 0.75,
    filter: { category: "billing" }
  });

  return { results };
});
```

---

## 3. Metrics Supported

| Metric | Formula | Range | Best For |
| :--- | :--- | :--- | :--- |
| `cosine` | $\frac{A \cdot B}{\|A\| \|B\|}$ | $-1.0$ to $1.0$ | Normalized text embeddings (OpenAI, Voyage, Gemini) |
| `dot` | $\sum a_i b_i$ | $-\infty$ to $\infty$ | Pre-normalized unit vectors |
| `euclidean` | $\frac{1}{1 + \text{dist}(A, B)}$ | $(0, 1]$ | Geometric spatial distances and image embeddings |
