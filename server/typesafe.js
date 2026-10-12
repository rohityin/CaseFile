/**
 * TypeSafe AI (System One / Jev) integration for CaseFile AI.
 * Handles sub-100ms typed question evaluation (choice, score, noul)
 * for fast jurisdiction routing, legal intent classification, and case triage.
 *
 * API Docs: https://docs.typesafe.ai/introduction
 * Endpoint: POST https://api.typesafe.ai/v1/systemone
 */

const TYPESAFE_API_URL = process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai/v1/systemone";

/**
 * Raw client for TypeSafe System One API with automatic retry on rate-limits / overloads.
 * @param {Object} options
 * @param {string|Object} options.state - Document or context text/object to evaluate
 * @param {Object} options.questions - Map of typed questions (choice, score, noul)
 * @param {string} [options.model="jev-latest"] - Model identifier
 * @param {string} options.apiKey - TypeSafe API key
 * @param {number} [options.timeoutMs=15000] - Request timeout in milliseconds
 * @param {number} [options.maxRetries=2] - Number of retries for rate-limiting (429/529)
 */
export async function callTypeSafe({
  state,
  questions,
  model = "jev-latest",
  apiKey,
  timeoutMs = 15000,
  maxRetries = 2,
}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing TypeSafe API key");
  }
  if (!state || (typeof state !== "string" && typeof state !== "object")) {
    throw new Error("State text is required for TypeSafe System One");
  }
  if (!questions || typeof questions !== "object" || Object.keys(questions).length === 0) {
    throw new Error("At least one question is required for TypeSafe System One");
  }

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(TYPESAFE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          state,
          model,
          questions,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const status = res.status;
        const errBody = await res.text().catch(() => "");
        // TypeSafe rate-limit (429), overloaded (529), or service unavailable (503)
        if ((status === 429 || status === 529 || status === 503) && attempt < maxRetries) {
          attempt++;
          const retryHeader = res.headers.get("retry-after");
          const delayMs = retryHeader ? Math.min(Number(retryHeader) * 1000, 3000) : attempt * 600;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw new Error(`TypeSafe API HTTP ${status}: ${errBody.slice(0, 300)}`);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      if (
        attempt < maxRetries &&
        (err.name === "TimeoutError" || err.message?.includes("fetch failed"))
      ) {
        attempt++;
        await new Promise((r) => setTimeout(r, attempt * 500));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Classify user prompt for target jurisdiction, legal domain, and actionability
 * using TypeSafe's Choice and Noul primitives with confidence-gated routing.
 * @param {string} prompt - User legal query
 * @param {string} apiKey - TypeSafe API key
 */
export async function classifyLegalIntent(prompt, apiKey) {
  if (!apiKey || !prompt?.trim()) return null;

  const questions = {
    jurisdiction: {
      type: "choice",
      instructions: "Which US court, federal appellate circuit, or jurisdiction is targeted or most relevant?",
      criteria: {
        scotus: "US Supreme Court, constitutional law, nationwide precedent",
        ca1: "First Circuit (Maine, Massachusetts, New Hampshire, Rhode Island)",
        ca2: "Second Circuit (New York, Connecticut, Vermont)",
        ca3: "Third Circuit (Delaware, New Jersey, Pennsylvania)",
        ca4: "Fourth Circuit (Maryland, Virginia, West Virginia, North Carolina, South Carolina)",
        ca5: "Fifth Circuit (Texas, Louisiana, Mississippi)",
        ca6: "Sixth Circuit (Michigan, Ohio, Kentucky, Tennessee)",
        ca7: "Seventh Circuit (Illinois, Indiana, Wisconsin)",
        ca8: "Eighth Circuit (Arkansas, Iowa, Minnesota, Missouri, Nebraska, North Dakota, South Dakota)",
        ca9: "Ninth Circuit (California, Washington, Oregon, Arizona, Nevada, Idaho, Montana, Alaska, Hawaii)",
        ca10: "Tenth Circuit (Colorado, Kansas, New Mexico, Oklahoma, Utah, Wyoming)",
        ca11: "Eleventh Circuit (Alabama, Florida, Georgia)",
        cadc: "District of Columbia Circuit, federal administrative agency rules",
        cal: "California state courts, California codes and statutes",
        other: "Other state court, general federal law, or no specific circuit mentioned",
      },
    },
    category: {
      type: "choice",
      instructions: "What is the primary legal domain or category of this research question?",
      criteria: {
        ip_copyright: "Intellectual property, copyright, trademark, fair use, patents, trade secrets",
        tenant_housing: "Landlord tenant law, leases, evictions, habitability, housing codes",
        antitrust: "Antitrust, monopoly, unfair business competition, FTC, Sherman Act",
        labor_employment: "Employment law, wrongful termination, discrimination, FLSA, non-competes",
        contracts: "Breach of contract, commercial agreements, UCC, warranties, damages",
        constitutional: "Constitutional law, First Amendment, civil rights, Fourth Amendment, Section 1983",
        tort_personal_injury: "Tort law, negligence, personal injury, product liability, damages",
        general: "General civil litigation, procedural rules, or general legal dispute",
      },
    },
    is_actionable: {
      type: "noul",
      instructions: "Is this prompt an actionable legal inquiry seeking court precedents, statutes, or legal doctrine?",
      criteria: {
        true: "A legal question, research inquiry, case law analysis, or request for statutory/precedent guidance",
        false: "General conversation, greeting, spam, off-topic statement, or non-legal remark",
      },
    },
  };

  try {
    const result = await callTypeSafe({ state: prompt.trim(), questions, apiKey });
    const answers = result?.answers || {};

    const jurisdictionChoice = answers.jurisdiction?.choice;
    const jurisdictionConfidence = answers.jurisdiction?.confidence ?? 0;
    // Confidence-gated routing: only constrain to circuit if confidence is strong (>= 0.40) and not 'other'
    const jurisdiction =
      jurisdictionChoice === "other" || jurisdictionConfidence < 0.4
        ? ""
        : jurisdictionChoice || "";

    const category = answers.category?.choice || "general";
    const categoryConfidence = answers.category?.confidence ?? 0;

    const actionableScore = answers.is_actionable?.noul ?? 0.5;
    const isActionable = actionableScore >= 0.5;

    return {
      jurisdiction,
      jurisdictionConfidence,
      category,
      categoryConfidence,
      isActionable,
      actionableScore,
      raw: result,
    };
  } catch (err) {
    console.warn("[typesafe] classifyLegalIntent error:", err.message);
    return null;
  }
}

/**
 * Triages CourtListener candidate cases in parallel using Jev:
 * - Score (relevance 0-2)
 * - Choice (favorable vs adverse stance)
 * - Noul (is_precedent)
 * Filters out low-relevance noise and tags each case with pre-computed stance.
 * Guarantees balanced representation so both favorable and adverse precedents
 * reach the adversarial synthesis matrix.
 *
 * @param {Array<Object>} cases - Candidate CourtListener cases
 * @param {string} userQuery - User legal question
 * @param {string} apiKey - TypeSafe API key
 * @returns {Promise<Array<Object>>} Retained, scored, and stance-tagged cases
 */
export async function triageCandidateCases(cases, userQuery, apiKey) {
  if (!apiKey || !Array.isArray(cases) || cases.length === 0) {
    return cases;
  }

  const querySnippet = userQuery.trim().slice(0, 250);

  const triageQuestions = {
    relevance: {
      type: "score",
      instructions: `How relevant is this court case to the user's legal question: "${querySnippet}"?`,
      criteria: [
        "Completely unrelated, irrelevant, or inapplicable to the legal issue",
        "Tangentially related, general background, or adjacent legal concept",
        "Directly on-point, governs the specific legal issue, or provides controlling precedent",
      ],
    },
    stance: {
      type: "choice",
      instructions: `Does this court opinion favor or oppose the researcher's inquiry: "${querySnippet}"?`,
      criteria: {
        favorable: "Supports researcher's legal position, grants relief, upholds rights, or provides favorable holding",
        adverse: "Supports opposing party, limits claim, denies relief, or establishes restrictive defense",
        neutral: "Purely procedural, remand without decision on merits, or neutral statutory interpretation",
      },
    },
    is_precedent: {
      type: "noul",
      instructions: "Does this decision establish, clarify, or apply a meaningful legal precedent or binding holding?",
      criteria: {
        true: "Establishes, clarifies, or applies a substantive legal precedent or binding holding",
        false: "Purely procedural order, minute entry, boilerplate denial, or non-precedential disposition",
      },
    },
  };

  const evalPromises = cases.map(async (c) => {
    const textSnippet = c.opinionText || c.snippet || "";
    const state = `Case: ${c.Title || c.title || "Untitled Case"}
Court: ${c.court || "Unknown Court"} | Filed: ${c.dateFiled || "Unknown date"}
Citation: ${Array.isArray(c.citation) ? c.citation.join(", ") : c.citation || "Unbound"}
Summary / Opinion Snippet:
${textSnippet.slice(0, 3000)}`;

    try {
      const res = await callTypeSafe({
        state,
        questions: triageQuestions,
        apiKey,
      });

      const answers = res?.answers || {};
      const relScore = typeof answers.relevance?.score === "number" ? answers.relevance.score : 1.0;
      const relConf = typeof answers.relevance?.confidence === "number" ? answers.relevance.confidence : 0.5;
      const stance = answers.stance?.choice || "neutral";
      const stanceConf = typeof answers.stance?.confidence === "number" ? answers.stance.confidence : 0.5;
      const isPrecedentScore = typeof answers.is_precedent?.noul === "number" ? answers.is_precedent.noul : 0.5;
      const isPrecedent = isPrecedentScore >= 0.5;

      return {
        ...c,
        relevanceScore: Number(relScore.toFixed(3)),
        relevanceConfidence: Number(relConf.toFixed(3)),
        stance,
        stanceConfidence: Number(stanceConf.toFixed(3)),
        isPrecedent,
        isPrecedentScore: Number(isPrecedentScore.toFixed(3)),
        typesafeTriaged: true,
      };
    } catch (err) {
      console.warn(`[typesafe] Failed to triage case "${c.title || c.Title || c.id}":`, err.message);
      return {
        ...c,
        relevanceScore: 0.5,
        relevanceConfidence: 0.3,
        stance: "neutral",
        stanceConfidence: 0.3,
        isPrecedent: false,
        isPrecedentScore: 0.3,
        typesafeTriaged: false,
      };
    }
  });

  const triaged = await Promise.all(evalPromises);

  // Filter out low-relevance noise: score < 0.7 or confidence < 0.35
  const qualified = triaged.filter(
    (c) => c.typesafeTriaged && c.relevanceScore >= 0.7 && c.relevanceConfidence >= 0.35
  );

  // Starvation protection: if filtering left fewer than 2 cases, fall back to all triaged cases
  const workingPool = qualified.length >= 2 ? [...qualified] : [...triaged];

  // Helper sort: prioritize successfully triaged cases, then relevance, then precedent strength
  const sortByRelevance = (a, b) =>
    (Number(b.typesafeTriaged) - Number(a.typesafeTriaged)) ||
    (b.relevanceScore - a.relevanceScore) ||
    (b.isPrecedentScore - a.isPrecedentScore);

  workingPool.sort(sortByRelevance);

  // Adversarial balance: ensure BOTH favorable and adverse stances are represented if available
  const favorablePool = workingPool.filter((c) => c.stance === "favorable");
  const adversePool = workingPool.filter((c) => c.stance === "adverse");

  if (favorablePool.length > 0 && adversePool.length > 0) {
    // Take top 2-3 favorable and top 2 adverse
    const selected = [];
    const favCount = Math.min(favorablePool.length, 3);
    const advCount = Math.min(adversePool.length, 2);

    selected.push(...favorablePool.slice(0, favCount));
    selected.push(...adversePool.slice(0, advCount));

    // Fill remaining capacity up to 6 with best remaining cases
    const selectedIds = new Set(selected.map((c) => c.id || c.Id));
    const remaining = workingPool.filter((c) => !selectedIds.has(c.id || c.Id));
    while (selected.length < 6 && remaining.length > 0) {
      selected.push(remaining.shift());
    }

    selected.sort(sortByRelevance);
    return selected.slice(0, 6);
  }

  // Otherwise take top 4-6 by relevance
  return workingPool.slice(0, 6);
}

/**
 * Classifies appellate disposition or procedural outcome using TypeSafe Choice primitive.
 * Safely excerpts long opinions to retain both initial context and the concluding disposition section.
 *
 * @param {string} text - Opinion text or summary
 * @param {string} apiKey - TypeSafe API key
 * @returns {Promise<{outcome: string, confidence: number}|null>}
 */
export async function enrichOpinionOutcome(text, apiKey) {
  if (!apiKey || !text?.trim()) return null;

  const questions = {
    outcome: {
      type: "choice",
      instructions: "What was the final procedural outcome or appellate disposition of this court decision?",
      criteria: {
        affirmed: "Lower court decision affirmed, sustained, or upheld in full",
        reversed: "Lower court decision reversed, vacated, or overturned",
        remanded: "Case remanded or returned to lower court or agency for further proceedings",
        dismissed: "Appeal or petition dismissed on procedural grounds, lack of jurisdiction, or mootness",
        mixed: "Affirmed in part and reversed/vacated in part, or mixed procedural disposition",
        unknown: "No clear appellate disposition, preliminary order, or interlocutory procedural ruling",
      },
    },
  };

  const trimmed = text.trim();
  // Appellate dispositions are almost universally stated at the very end of an opinion.
  // If the opinion is long, retain the first 2,500 chars (context) and the last 5,000 chars (conclusion).
  let state = trimmed;
  if (trimmed.length > 8000) {
    const head = trimmed.slice(0, 2500);
    const tail = trimmed.slice(-5000);
    state = `${head}\n\n[...]\n\n[Concluding Opinion Section & Disposition]:\n${tail}`;
  }

  try {
    const res = await callTypeSafe({
      state,
      questions,
      apiKey,
    });
    const answers = res?.answers || {};
    const outcome = answers.outcome?.choice || "unknown";
    const confidence = answers.outcome?.confidence ?? 0;
    return { outcome, confidence };
  } catch (err) {
    console.warn("[typesafe] enrichOpinionOutcome error:", err.message);
    return null;
  }
}
