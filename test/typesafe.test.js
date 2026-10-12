import test from "node:test";
import assert from "node:assert/strict";
import {
  callTypeSafe,
  classifyLegalIntent,
  triageCandidateCases,
  enrichOpinionOutcome,
} from "../server/typesafe.js";
import { enrichWithLlm } from "../server/index.js";

test("callTypeSafe parameter validation", async () => {
  await assert.rejects(
    async () => callTypeSafe({ state: "test", questions: {}, apiKey: "" }),
    /Missing TypeSafe API key/
  );

  await assert.rejects(
    async () => callTypeSafe({ state: "", questions: { q: {} }, apiKey: "test-key" }),
    /State text is required/
  );

  await assert.rejects(
    async () => callTypeSafe({ state: "hello", questions: {}, apiKey: "test-key" }),
    /At least one question is required/
  );
});

test("callTypeSafe sends correct payload to API", async () => {
  const originalFetch = globalThis.fetch;
  let interceptedRequest = null;

  globalThis.fetch = async (url, options) => {
    interceptedRequest = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        model: "jev-latest",
        answers: {
          q1: { type: "choice", choice: "optionA", confidence: 0.9 },
        },
      }),
    };
  };

  try {
    const res = await callTypeSafe({
      state: "Fair use in copyright infringement case",
      questions: {
        q1: { type: "choice", instructions: "Choose", criteria: { optionA: "A", optionB: "B" } },
      },
      apiKey: "sk-typesafe-test",
    });

    assert.equal(interceptedRequest.url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(interceptedRequest.options.headers.Authorization, "Bearer sk-typesafe-test");
    assert.equal(interceptedRequest.body.model, "jev-latest");
    assert.equal(interceptedRequest.body.state, "Fair use in copyright infringement case");
    assert.ok(interceptedRequest.body.questions.q1);
    assert.equal(res.answers.q1.choice, "optionA");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callTypeSafe retries on HTTP 429 rate-limit and succeeds", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;

  globalThis.fetch = async () => {
    attempts++;
    if (attempts === 1) {
      return {
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "0" }),
        text: async () => "Rate limit exceeded",
      };
    }
    return {
      ok: true,
      json: async () => ({
        model: "jev-latest",
        answers: { q: { type: "noul", noul: 0.95 } },
      }),
    };
  };

  try {
    const res = await callTypeSafe({
      state: "Test state",
      questions: { q: { type: "noul", instructions: "test" } },
      apiKey: "sk-test",
    });

    assert.equal(attempts, 2, "Should retry once on 429 and succeed on attempt 2");
    assert.equal(res.answers.q.noul, 0.95);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("classifyLegalIntent parses response correctly", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        jurisdiction: { type: "choice", choice: "ca9", confidence: 0.88 },
        category: { type: "choice", choice: "ip_copyright", confidence: 0.94 },
        is_actionable: { type: "noul", noul: 0.98 },
      },
    }),
  });

  try {
    const res = await classifyLegalIntent("Does training AI models on copyrighted text constitute fair use in the 9th Circuit?", "sk-test");
    assert.ok(res);
    assert.equal(res.jurisdiction, "ca9");
    assert.equal(res.jurisdictionConfidence, 0.88);
    assert.equal(res.category, "ip_copyright");
    assert.equal(res.categoryConfidence, 0.94);
    assert.equal(res.isActionable, true);
    assert.equal(res.actionableScore, 0.98);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("classifyLegalIntent maps 'other' jurisdiction to empty string", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        jurisdiction: { type: "choice", choice: "other", confidence: 0.5 },
        category: { type: "choice", choice: "contracts", confidence: 0.7 },
        is_actionable: { type: "noul", noul: 0.85 },
      },
    }),
  });

  try {
    const res = await classifyLegalIntent("What is consideration in contract formation?", "sk-test");
    assert.ok(res);
    assert.equal(res.jurisdiction, "");
    assert.equal(res.category, "contracts");
    assert.equal(res.isActionable, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("classifyLegalIntent confidence-gated routing leaves jurisdiction empty if confidence is low", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        jurisdiction: { type: "choice", choice: "ca9", confidence: 0.22 }, // Low confidence guess
        category: { type: "choice", choice: "tenant_housing", confidence: 0.80 },
        is_actionable: { type: "noul", noul: 0.90 },
      },
    }),
  });

  try {
    const res = await classifyLegalIntent("Can a landlord evict without notice?", "sk-test");
    assert.ok(res);
    assert.equal(res.jurisdiction, "", "Should not constrain jurisdiction when confidence is below 0.40");
    assert.equal(res.category, "tenant_housing");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("triageCandidateCases evaluates, scores, and filters cases", async () => {
  const originalFetch = globalThis.fetch;

  const mockCases = [
    { id: "case-1", title: "Author Guild v. Google", snippet: "Fair use protects transformative book scanning.", citation: ["804 F.3d 202"] },
    { id: "case-2", title: "Smith v. Jones", snippet: "Unrelated zoning dispute over fence height.", citation: ["123 F.3d 456"] },
    { id: "case-3", title: "Andy Warhol Foundation v. Goldsmith", snippet: "Commercial licensing of silk-screen not transformative fair use.", citation: ["598 U.S. 508"] },
  ];

  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.state.includes("Author Guild")) {
      return {
        ok: true,
        json: async () => ({
          answers: {
            relevance: { type: "score", score: 1.85, confidence: 0.92 },
            stance: { type: "choice", choice: "favorable", confidence: 0.85 },
            is_precedent: { type: "noul", noul: 0.95 },
          },
        }),
      };
    } else if (body.state.includes("Andy Warhol")) {
      return {
        ok: true,
        json: async () => ({
          answers: {
            relevance: { type: "score", score: 1.70, confidence: 0.88 },
            stance: { type: "choice", choice: "adverse", confidence: 0.90 },
            is_precedent: { type: "noul", noul: 0.99 },
          },
        }),
      };
    } else {
      // Irrelevant case
      return {
        ok: true,
        json: async () => ({
          answers: {
            relevance: { type: "score", score: 0.2, confidence: 0.80 },
            stance: { type: "choice", choice: "neutral", confidence: 0.50 },
            is_precedent: { type: "noul", noul: 0.10 },
          },
        }),
      };
    }
  };

  try {
    const triaged = await triageCandidateCases(mockCases, "AI fair use doctrine", "sk-test");
    assert.equal(triaged.length, 2, "Low relevance case-2 should be filtered out");
    assert.equal(triaged[0].id, "case-1");
    assert.equal(triaged[0].stance, "favorable");
    assert.equal(triaged[0].typesafeTriaged, true);
    assert.equal(triaged[1].id, "case-3");
    assert.equal(triaged[1].stance, "adverse");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("triageCandidateCases maintains adversarial balance when favorable and adverse cases exist", async () => {
  const originalFetch = globalThis.fetch;

  // 5 favorable cases with high relevance + 2 adverse cases with slightly lower relevance
  const mockCases = [
    { id: "fav-1", title: "Fav 1", snippet: "Favorable 1" },
    { id: "fav-2", title: "Fav 2", snippet: "Favorable 2" },
    { id: "fav-3", title: "Fav 3", snippet: "Favorable 3" },
    { id: "fav-4", title: "Fav 4", snippet: "Favorable 4" },
    { id: "fav-5", title: "Fav 5", snippet: "Favorable 5" },
    { id: "adv-1", title: "Adv 1", snippet: "Adverse 1" },
    { id: "adv-2", title: "Adv 2", snippet: "Adverse 2" },
  ];

  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.state.includes("Fav")) {
      return {
        ok: true,
        json: async () => ({
          answers: {
            relevance: { type: "score", score: 1.9, confidence: 0.9 },
            stance: { type: "choice", choice: "favorable", confidence: 0.9 },
            is_precedent: { type: "noul", noul: 0.9 },
          },
        }),
      };
    } else {
      return {
        ok: true,
        json: async () => ({
          answers: {
            relevance: { type: "score", score: 1.4, confidence: 0.85 },
            stance: { type: "choice", choice: "adverse", confidence: 0.85 },
            is_precedent: { type: "noul", noul: 0.9 },
          },
        }),
      };
    }
  };

  try {
    const triaged = await triageCandidateCases(mockCases, "legal question", "sk-test");
    const favorableCount = triaged.filter((c) => c.stance === "favorable").length;
    const adverseCount = triaged.filter((c) => c.stance === "adverse").length;

    assert.ok(triaged.length <= 6, "Retained cases must be bounded at 6");
    assert.ok(favorableCount >= 2, "Must retain favorable cases");
    assert.ok(adverseCount >= 2, "Must retain adverse cases to prevent adversarial matrix starvation");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("triageCandidateCases starvation guard preserves cases if all score low and prioritizes triaged cases", async () => {
  const originalFetch = globalThis.fetch;

  const mockCases = [
    { id: "case-a", title: "Marginal Case A", snippet: "Brief mention" },
    { id: "case-b", title: "Marginal Case B", snippet: "Another brief mention" },
  ];

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        relevance: { type: "score", score: 0.4, confidence: 0.5 },
        stance: { type: "choice", choice: "neutral", confidence: 0.5 },
        is_precedent: { type: "noul", noul: 0.3 },
      },
    }),
  });

  try {
    const triaged = await triageCandidateCases(mockCases, "unusual query", "sk-test");
    assert.equal(triaged.length, 2, "Should preserve cases rather than returning empty pool");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enrichOpinionOutcome extracts procedural outcome", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        outcome: { type: "choice", choice: "reversed", confidence: 0.93 },
      },
    }),
  });

  try {
    const res = await enrichOpinionOutcome("For the reasons stated above, we reverse the judgment of the district court.", "sk-test");
    assert.ok(res);
    assert.equal(res.outcome, "reversed");
    assert.equal(res.confidence, 0.93);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enrichOpinionOutcome preserves ending disposition in long opinions (>8000 chars)", async () => {
  const originalFetch = globalThis.fetch;
  let receivedState = "";

  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    receivedState = body.state;
    return {
      ok: true,
      json: async () => ({
        answers: {
          outcome: { type: "choice", choice: "affirmed", confidence: 0.95 },
        },
      }),
    };
  };

  try {
    const longText = "Start of opinion: background facts. " + "A".repeat(12000) + " End of opinion: AFFIRMED IN FULL.";
    const res = await enrichOpinionOutcome(longText, "sk-test");
    assert.ok(res);
    assert.equal(res.outcome, "affirmed");
    assert.ok(receivedState.includes("Start of opinion"), "Must contain opening section");
    assert.ok(receivedState.includes("AFFIRMED IN FULL"), "Must contain concluding disposition section");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enrichWithLlm supports TypeSafe-only enrichment mode", async () => {
  const originalFetch = globalThis.fetch;
  const originalTypeSafeKey = process.env.TYPESAFE_API_KEY;
  const originalNebiusKey = process.env.NEBIUS_API_KEY;

  // Simulate environment with TypeSafe key but no Nebius key
  process.env.TYPESAFE_API_KEY = "sk-test-typesafe";
  delete process.env.NEBIUS_API_KEY;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        outcome: { type: "choice", choice: "remanded", confidence: 0.91 },
      },
    }),
  });

  try {
    const res = await enrichWithLlm({
      Id: "123",
      Title: "Test v. Test",
      court: "Ninth Circuit",
      opinionText: "This matter is remanded for further factual inquiry.",
      snippet: "Remanded for further factual inquiry.",
    });

    assert.ok(res, "enrichWithLlm should return metadata when TypeSafe is available");
    assert.equal(res.outcome, "remanded");
    assert.equal(res.court, "Ninth Circuit");
  } finally {
    if (originalTypeSafeKey !== undefined) process.env.TYPESAFE_API_KEY = originalTypeSafeKey;
    else delete process.env.TYPESAFE_API_KEY;
    if (originalNebiusKey !== undefined) process.env.NEBIUS_API_KEY = originalNebiusKey;
    globalThis.fetch = originalFetch;
  }
});

test("Graceful fallbacks on missing keys or errors", async () => {
  // classifyLegalIntent returns null without key
  const intent = await classifyLegalIntent("prompt", "");
  assert.equal(intent, null);

  // triageCandidateCases returns original cases without key
  const cases = [{ id: "1" }];
  const triaged = await triageCandidateCases(cases, "query", "");
  assert.deepEqual(triaged, cases);

  // enrichOpinionOutcome returns null without key
  const outcome = await enrichOpinionOutcome("text", "");
  assert.equal(outcome, null);
});
