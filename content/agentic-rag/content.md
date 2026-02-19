## Capstone Project: Creating An Agentic RAG System


DocuSearch is a RAG-based document retrieval system built for personal injury and workers' compensation law firms. A paralegal should be able to ask "when did John last see a doctor about his knee?" and get a correct, sourced answer pulled from potentially hundreds of documents. This writeup covers the ingestion pipeline and retrieval system, including the decisions that shaped the architecture and the problems that forced them.

The system is built in LangChain (TypeScript), backed by Qdrant as the vector store and PostgreSQL for conversation persistence. LLM inference runs through a configurable provider layer supporting both local models and remote APIs.

## Document Ingestion

### Loading and Chunking

The ingestion pipeline accepts PDF and DOCX files. LangChain's `PDFLoader` and `DocxLoader` handle extraction, producing flat text. That text is passed to a `RecursiveCharacterTextSplitter`, which splits on semantic boundaries first — paragraph breaks, then sentence breaks, then raw character count as a fallback. A naive character split will separate a diagnosis from its date or a claimant's name from the surrounding context, which degrades retrieval quality.

```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
  separators: ["\n\n", "\n", ". ", " ", ""]
});

const chunks = await splitter.splitDocuments(rawDocs);
```

Chunks are configured with overlap so facts straddling a boundary remain retrievable.

### Metadata

Every chunk gets metadata attached before indexing: case identifier, document type, source filename, document date where extractable, and a positional chunk index. This drives filtering, enables adjacent chunk retrieval, and allows the system to cite sources accurately in responses.

### Collection Architecture

Each legal case gets its own Qdrant collection, named `legal_docs_{case_name}`. A single shared collection with per-case metadata filtering would be simpler operationally, but in a legal context, returning a medical record from the wrong client's case is a potential ethical violation, not just an accuracy problem. The hard collection boundary eliminates that failure mode entirely.

## Hybrid Search

Pure vector search is unreliable for factual precision. A query for "knee injury treatment date" might surface chunks that are semantically about knee injuries without containing the specific date. The system uses hybrid search combining dense vector similarity with BM25 sparse retrieval. Dense search handles semantic understanding, BM25 handles keyword precision for names, dates, and medical terminology.

```typescript
const results = await qdrantClient.search(collectionName, {
  vector: { name: "dense", vector: queryEmbedding },
  sparse_vector: { name: "sparse", vector: bm25Vector },
  limit: 10,
  with_payload: true
});
```

Results are merged using Reciprocal Rank Fusion (RRF), which produces a combined ranking without requiring both scoring systems to share a scale.

## Case Detection

Before retrieval runs, the system identifies which case the user is referring to. A user might say "the Johnson case," "my slip and fall client," or "the case with the forklift." The first stage runs a hybrid search against a dedicated `case_summaries` collection using the user's message as the query. Case summaries are 5-6 sentence descriptions enriched with structured metadata including client names, opposing parties, and claim types. If confidence is ambiguous, the agent invokes a disambiguation tool to ask a clarifying question before proceeding.

## The RAG Agent

The retrieval system is a LangChain ReAct agent with a defined tool set. The agent reasons about what information it needs, calls the appropriate tool, evaluates the result, and either calls another tool or formulates a final answer.

`searchCase` performs the core hybrid search against the identified case collection.

`getAdjacentChunks` accepts a chunk ID and returns the surrounding chunks in the original document, solving the failure mode where an answer starts in one chunk and continues into the next.

```typescript
const adjacentChunks = await qdrantClient.scroll(collectionName, {
  filter: {
    must: [
      { key: "metadata.file_name", match: { value: sourceFile } },
      { key: "metadata.chunk_index", range: { gte: targetIndex - 1, lte: targetIndex + 1 } }
    ]
  }
});
```

`filterSearch` wraps `searchCase` with explicit document type filtering, allowing the agent to target medical records or police reports specifically without relying on the query alone to imply that.

## Memory Architecture

If conversation history includes all retrieved chunks from previous turns, the context window fills quickly and performance degrades. The system stores only clean user and assistant messages in conversation history. When the agent retrieves chunks to formulate an answer, it writes a compressed summary and the relevant chunk IDs to a separate `chunk_references` table. On subsequent turns, the agent can re-access original content through direct lookups rather than carrying raw text forward.

```sql
CREATE TABLE chunk_references (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_number INT NOT NULL,
  chunk_ids TEXT[],
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing

The test framework runs predefined queries against the system and evaluates responses using a secondary model as a judge. The judge receives the expected answer and the system's response and determines whether key facts are present, correctly attributed, and not contradicted by hallucinated content. The framework tracks pass/fail results, token usage, and agent iteration counts across five synthetic cases spanning complexity levels from simple auto accidents to multi-party workers' compensation cases.
