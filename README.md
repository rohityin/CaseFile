# CaseFile AI — Smart Legal Research Assistant

> **Autonomous Legal Intelligence Platform**  
> Powered by live federal and state court records from CourtListener and high-speed LLM reasoning via Nebius Token Factory.

**CaseFile AI** is an intelligent assistant that does real legal research for you. Instead of acting like a basic search box or a chatbot that makes up answers, CaseFile AI works step-by-step using real court records from [CourtListener](https://www.courtlistener.com/) (Free Law Project):

1. **Understands Your Legal Question**: Breaks down your question into key laws, the right courts to check, and points the other side might make.
2. **Searches Real Court Records**: Searches CourtListener directly, reads real court rulings, and pulls out the key decision made by the judge.
3. **Compares Both Sides**: Puts helpful cases that support you side-by-side with opposing cases the other side will argue, showing how to answer their claims.
4. **Checks Every Citation**: Verifies every case citation against real official court records so there are zero fake citations.
5. **Writes a Complete Legal Memo**: Prepares a court-ready legal memo in standard IRAC format (Issue, Rule, Facts, and Answer) with one click to copy, print, or export.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CaseFile AI Studio (Split-Screen UI)                     │
│                                                                             │
│   ┌───────────────────────────────┐     ┌───────────────────────────────┐   │
│   │     LEFT: Conversational      │     │     RIGHT: Dynamic Artifact   │   │
│   │     Research Assistant        │     │     Legal Canvas              │   │
│   │                               │     │                               │   │
│   │  • Session History Drawer     │     │  • Verified Case Cards        │   │
│   │  • Multi-turn chat input      │     │  • Adversarial Matrix         │   │
│   │  • Live ReAct Thought Stream  │◄───►│  • IRAC Legal Memo            │   │
│   │  • Pause / Steer / Resume     │     │  • Inline Guardrail Badges    │   │
│   │  • Quick Scenario Starters    │     │  • MD / PDF / JSON Export     │   │
│   └───────────────┬───────────────┘     └───────────────┬───────────────┘   │
└───────────────────┼─────────────────────────────────────┼───────────────────┘
                    │                                     │
                    │ SSE Stream (/api/agent/chat)        │
                    ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Express Backend (server/agent.js)                      │
│                                                                             │
│   • ReAct Agent Loop with Nebius Token Factory (Llama 3.1 / DeepSeek / Qwen)│
│   • Tool: CourtListener Search (filtered by circuit, court, published)      │
│   • Tool: Full Opinion Text Extractor (SSRF-safe, binary sniffing)          │
│   • Tool: Citation Verification Engine (validates against cluster IDs)      │
│   • Tool: Adversarial Matrix Classifier & IRAC Synthesizer                  │
│   • Server Key Provider (env.NEBIUS_API_KEY with auto model fallback)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Local Run)

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (Express backend on :8787 + Vite on :8080)
npm run dev
```

- **App**: `http://localhost:8080`
- **Backend API**: `http://localhost:8787`

---

## API Keys & Authentication

CaseFile AI uses **server-side authentication** powered by [Nebius Token Factory](https://docs.tokenfactory.nebius.com/quickstart). Users can interact with the research studio immediately without being prompted for API keys.

1. **Configure Server Environment Variable**:
   ```bash
   # Windows PowerShell
   $env:NEBIUS_API_KEY="your-nebius-token-factory-key"
   $env:COURTLISTENER_TOKEN="your-cl-token" # optional for full text
   npm run dev
   ```
2. **Model Selection**:
   - Default: `meta-llama/Meta-Llama-3.1-70B-Instruct`
   - Configurable via `NEBIUS_MODEL` in `.env` (e.g. `meta-llama/Meta-Llama-3.1-8B-Instruct-fast`, `deepseek-ai/DeepSeek-V3-0324`).

---

## API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/agent/chat` | `POST` | Primary Server-Sent Events (SSE) streaming endpoint driving the autonomous ReAct agent loop. |
| `/api/search?q=…` | `GET` | Search published CourtListener opinions with snippet extraction. |
| `/api/extract` | `POST` | SSRF-safe batch extraction of full opinion text. |
| `/api/enrich` | `POST` | Multi-field structured LLM extraction via Nebius Token Factory. |
| `/api/health` | `GET` | Reports service status, CourtListener token, and Nebius key availability. |

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7, Vanilla CSS design system, Motion, GSAP, Phosphor Icons.
- **Backend**: Node.js, Express 5, Server-Sent Events (SSE), SSRF guardrail with IP pinning.
- **Data & AI**: CourtListener REST API v4, Nebius Token Factory OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1`).
