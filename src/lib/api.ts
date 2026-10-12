export interface CaseRecord {
  Id: string;
  Link: string;
  Title: string;
  caseNameFull?: string;
  court?: string;
  courtId?: string;
  dateFiled?: string | null;
  docketNumber?: string;
  citation?: string[];
  status?: string;
  clusterId?: number | null;
  opinionId?: number | null;
  downloadUrl?: string | null;
  snippet?: string;
  opinionText?: string;
  textSource?: string;
  extracted?: boolean;
  // LLM enrichment (optional, populated by /api/enrich)
  summary?: string;
  jurisdiction?: string;
  outcome?: string;
  precedents?: string[];
  enriched?: boolean;
}

export interface EnrichResponse {
  count: number;
  cases: Array<{
    Id: string;
    enriched: boolean;
    summary?: string;
    court?: string;
    jurisdiction?: string;
    outcome?: string;
    precedents?: string[];
  }>;
  mode: "nebius" | "typesafe" | "disabled";
  model?: string;
  detail?: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  next: string | null;
  results: CaseRecord[];
  meta: {
    source: string;
    orderedBy: string;
    pageSize: number;
    tokenMode: boolean;
  };
}

export interface ExtractResponse {
  count: number;
  requested?: number;
  skipped?: number;
  cases: CaseRecord[];
  schema: string[];
}

export function exportSchema(cases: CaseRecord[]) {
  return cases.map((c) => ({
    Id: c.Id,
    Link: c.Link,
    Title: c.Title,
    court: c.court || "",
    dateFiled: c.dateFiled || null,
    docketNumber: c.docketNumber || "",
    citation: c.citation || [],
    opinionText: c.opinionText || c.snippet || "",
    textSource: c.textSource || (c.extracted ? "extracted" : "snippet"),
    // Enrichment fields are only included once populated, keeping exports lean.
    ...(c.enriched
      ? {
          summary: c.summary || "",
          jurisdiction: c.jurisdiction || "",
          outcome: c.outcome || "",
          precedents: c.precedents || [],
        }
      : {}),
  }));
}

const apiFetch = fetch;

export async function searchCases(
  query: string,
  options?: { pageSize?: number; published?: boolean; court?: string; signal?: AbortSignal }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page_size: String(options?.pageSize ?? 15),
    order_by: "dateFiled desc",
  });
  if (options?.published !== false) params.set("stat_Published", "on");
  if (options?.court) params.set("court", options.court);

  const res = await apiFetch(`/api/search?${params}`, { signal: options?.signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Search failed (${res.status})`);
  }
  return res.json();
}

export async function extractCases(
  cases: CaseRecord[],
  signal?: AbortSignal
): Promise<ExtractResponse> {
  const res = await apiFetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cases }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Extract failed (${res.status})`);
  }
  return res.json();
}

export async function enrichCases(
  cases: CaseRecord[],
  signal?: AbortSignal
): Promise<EnrichResponse> {
  const res = await apiFetch("/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cases }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Enrich failed (${res.status})`);
  }
  return res.json();
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugifyQuery(q: string) {
  return (
    q
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "cases"
  );
}

// ---------------------------------------------------------------------------
// CaseFile AI Autonomous Agent Types & SSE Client
// ---------------------------------------------------------------------------

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  casesCount?: number;
}

export interface AgentThought {
  id: string;
  title: string;
  detail: string;
  phase: "planning" | "reading" | "verifying" | "synthesis" | "action";
  timestamp: string;
}

export interface AgentAction {
  id: string;
  tool: string;
  query: string;
  court?: string;
  purpose?: string;
  timestamp: string;
}

export interface AgentObservation {
  id: string;
  tool: string;
  foundCount?: number;
  returnedCount?: number;
  sampleTitles?: string[];
  timestamp: string;
}

export interface FavorableCase {
  id: string;
  title: string;
  citation: string;
  holding: string;
  strategicValue: string;
  link?: string;
}

export interface AdverseCase {
  id: string;
  title: string;
  citation: string;
  opposingArgument: string;
  distinguishingStrategy: string;
  link?: string;
}

export interface AdversarialMatrix {
  favorable: FavorableCase[];
  adverse: AdverseCase[];
}

export interface VerifiedCitation {
  id: string;
  caseTitle: string;
  citation: string;
  court: string;
  dateFiled?: string | null;
  docketNumber?: string;
  link?: string;
  status: "verified" | "partial" | "unverified";
  confidence?: number;
}

export interface IracMemo {
  title: string;
  executiveSummary: string;
  issue: string;
  rule: string;
  application: string;
  counterArguments: string;
  conclusion: string;
}

export type AgentEvent =
  | { type: "start"; data: { message: string; objective: string; hasApiKey: boolean } }
  | { type: "thought"; data: AgentThought }
  | { type: "action"; data: AgentAction }
  | { type: "observation"; data: AgentObservation }
  | { type: "matrix_update"; data: { matrix: AdversarialMatrix } }
  | { type: "citations_verified"; data: { citations: VerifiedCitation[] } }
  | { type: "memo_ready"; data: { memo: IracMemo } }
  | { type: "message"; data: { role: "assistant"; content: string; casesCount?: number } }
  | { type: "completed"; data: { cases: CaseRecord[]; matrix: AdversarialMatrix; citations: VerifiedCitation[]; memo: IracMemo | null } }
  | { type: "error"; data: { message: string } }
  | { type: "done"; data: Record<string, unknown> };

export const NEBIUS_KEY_STORAGE = "casefile:nebius_key";

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(NEBIUS_KEY_STORAGE) || localStorage.getItem("casefile:gemini_key") || "";
  } catch {
    return "";
  }
}

// Deprecated alias for backwards compatibility
export const getStoredGeminiKey = getStoredApiKey;
export function setStoredGeminiKey(key: string) {
  try {
    if (key.trim()) {
      localStorage.setItem(NEBIUS_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(NEBIUS_KEY_STORAGE);
    }
  } catch {
    // ignore
  }
}

export async function streamAgentChat({
  messages,
  court,
  onEvent,
  signal,
  customApiKey,
}: {
  messages: Array<{ role: string; content: string }>;
  court?: string;
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
  customApiKey?: string;
}): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (customApiKey) {
    headers["x-nebius-key"] = customApiKey;
  }

  const response = await fetch("/api/agent/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, court }),
    signal,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.detail || `Agent connection failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("ReadableStream not supported by browser.");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentEventType = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        currentEventType = "message";
        continue;
      }
      if (trimmed.startsWith("event:")) {
        currentEventType = trimmed.slice(6).trim();
      } else if (trimmed.startsWith("data:")) {
        const jsonStr = trimmed.slice(5).trim();
        try {
          const parsed = JSON.parse(jsonStr);
          onEvent({ type: currentEventType as AgentEvent["type"], data: parsed } as AgentEvent);
        } catch {
          // non-json keepalive or line
        }
      }
    }
  }
}

