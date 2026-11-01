# PROCESS: how this was built with AI tooling

> **Candidate's note:** the account below was assembled from the agent session's own record:
> commits, test runs and the hand-off reports. Add your own perspective where marked ✍️.

## Tools

- **Claude Code** (terminal agent, Claude Opus 5.5) as the main implementer and orchestrator.
- **One delegated sub-agent** (Claude Code `general-purpose` agent) for the React frontend, run in
  parallel with backend work.
- **A local LLM** (`qwen2.5:7b` via Ollama) as the "real model" test bench for prompts, because it
  is the weakest model a reviewer might plausibly use. If prompts work there, they work on Groq's 70B.

## 1. Planning before any code

The plan existed before the agent touched the repo: **[`MailRiskIntel-development.md`](MailRiskIntel-development.md)**.
It fixes the stack, service layout, pipeline diagram, data model, API, env vars, failure-handling
checklist and a 14-step build order. The agent was told to follow it, and it treated it as the
spec; every deviation is listed below.

✍️ *How the development guide itself was produced (by hand, or drafted with an AI and edited), and
what you deliberately put in it to steer the agent.*

The session started with the agent reading only the brief and the seed data, and summarising
**what a correct pipeline should flag for each of the 10 seed emails**: an expected-results table
written before any code. Three things from that table shaped the design:

- **E004 can only be judged against E009.** The new account `…9902` vs `…6621` on file, and an
  invoice 3.4× the usual amount, are invisible to an agent that sees one email at a time. This led to
  the "sender history" context node.
- **E001 and E008 use lookalike domains.** Code can detect these cheaply and reliably, which led to
  deterministic signals that double as the offline fallback.
- **E002, E007 and E009 are traps for over-flagging.** They became regression tests.

Three questions went back to the human before coding started: which track, where the repo lives
(personal GitHub, not the org), and stack preferences, answered by "follow the guide". Two more came
up before the first commit: commit identity (GitHub noreply, to keep a work email off a public repo)
and repo visibility.

## 2. How the work was split

| Work | Who | Mode |
|---|---|---|
| Backend: config, storage, ingestion, agents, signals, fallback, LangGraph pipeline, worker, API | Main agent | Autonomous, following the guide's build order |
| Backend tests (pytest, fake LLM) | Main agent | Autonomous |
| Frontend: all of `frontend/` | **Sub-agent**, in the background | Autonomous, against a written brief (Appendix A) |
| Real-model prompt evaluation | Main agent, on local Ollama | Iterative: run, read output, change, re-run |
| Integration: API follow-ups from the sub-agent, docker verification, screenshot review | Main agent | Review and fix |

**Why only one sub-agent.** The backend's pieces (schemas, signals, pipeline, persistence) depend on
each other closely, and one consistent author mattered more there than speed. The frontend was the
one large, separable piece. It could be built in parallel once the **API contract was frozen** in
`backend/app/api/schemas.py`. So the main agent wrote that contract first, then delegated. The brief
told the sub-agent to treat the Pydantic models as the source of truth and mirror them in zod, not to
touch anything outside `frontend/`, not to commit, and to report back honestly what it had and
hadn't verified in a browser.

## 3. Where the agent ran on its own, and where it was corrected

Most of the build ran autonomously. The interesting parts are where something pushed back: a test,
the type checker, a real model, or the sub-agent.

### 3.1 A real model exposed prompt weaknesses; mocked tests could not

The first end-to-end run on `qwen2.5:7b` produced valid JSON every time, so the plumbing was
right, but the *content* was weak:

| | First prompt | After revision |
|---|---|---|
| E001 (CEO impersonation, lookalike domain) | **medium** | **high**: "domain imitates arcline.com… urgent, large wire… asks not to loop in others" |
| E004 (vendor bank change) | (not reached) | **high**: "account ending 9902… differs from the prior known account (6621) in E009… significantly higher than the previous median ($13,900)" |
| Accounts | `"routing 044000037, account ending 6621"` as **one** entity, which breaks cross-email linking | one entity per number |
| Mailboxes | typed `other` | typed `person` with `attributes.email` |
| Organisations | missing ("Northgate Suppliers Inc." was in the text) | present; "Arclne Corp" (the spoof) kept separate from "Arcline" |
| Noise | `"net 15"` became an entity | gone |

The fix had two layers on purpose:

1. **Prompt.** High-risk *patterns* were spelled out (impersonation = lookalike domain + money,
   credentials or secrecy), along with explicit entity rules and one worked example on an email that
   is *not* in the seed set, to avoid teaching to the test.
2. **Deterministic normalisation** for what small models will keep getting wrong: email-address
   entities are coerced to `person`; compound account strings are split, with relationships
   re-pointed to the parts; and the mailbox→organisation backbone and `sent_email_to` edges are added
   in code after Agent B (`agents/entities.py::enrich_graph`). The graph's join keys therefore no
   longer depend on how one model run phrased things.

### 3.2 Tests changed the design, not just checked it

- **Sticky failover.** While writing the "Groq times out" test, the agent noticed that after
  extraction fell over to Ollama, *assessment would start at Groq again* and wait out another round
  of timeouts. It changed the pipeline so providers that failed during a run are skipped by later
  stages, and the test now asserts it (`test_timeouts_retry_then_fall_through_to_next_provider`).
- **A wrong test, not wrong code.** One API test expected 7 high-risk seed emails; there are 6. The
  agent checked the expected-results table before touching code, and fixed the test.

### 3.3 Running it the way a reviewer would

- **An Ollama that is down shouldn't be slow.** With no key and no Ollama container, every email
  would have waited out connection retries before reaching the rules fallback. The agent changed the
  design: Ollama counts as "configured" only if it responds and has the model pulled. The worker
  rebuilds its provider chain every 60 s, so a model that finishes downloading is picked up without
  a restart.
- **mypy** caught a real API mismatch (`ChatAnthropic` takes `model_name`) and loose typing of
  per-stage state. The state was made an explicitly documented dict, rather than silencing the errors.
- **A fresh `git clone` followed by `docker compose up --build`**, with no `.env`, was run before
  publishing. The seed set was processed, `/api/health` reported `mode: rules`, uploads were accepted
  or rejected through nginx, and the SPA routes resolved.

### 3.4 Reviewing the sub-agent's work

The sub-agent returned:
- lint, test and build results (27 tests passing);
- a list of what it had and had not verified (headless Chromium screenshots: yes; real file
  drag-and-drop, screen readers, Docker image: no);
- **API changes it suggested but, as instructed, did not make.**

The main agent then:

- **Accepted three suggestions:**
  - a mailbox-wide `in_flight` count, because polling stopped while a risk filter hid pending emails;
  - UTC offsets on timestamps, because SQLite drops tzinfo;
  - an amount regex fix, because `$47,300,` kept the trailing comma.

  It also updated the sub-agent's test fixtures to the new contract.
- **Deferred the rest** (richer `email_ids` in the graph, paging) to "what I'd do with more time".
- **Re-ran its own screenshots** at 1366px and 375px against the Docker build: no horizontal
  overflow, no console errors. It spotted a focus ring drawn around a programmatically focused
  heading on mobile, and fixed it at the global CSS rule that caused it.

### 3.5 The default provider, tested for real

Groq was the one path that couldn't be tested until a key was available, and the agent said so
rather than claiming it worked. Once the human added a key, the first live run failed in exactly
the way the agent had flagged as the top risk: **Groq had retired `llama-3.3-70b-versatile`**
(`model_not_found`). The fallback chain hid it, and every email quietly came from rules. The agent:

1. listed the models the key could actually use, and ran the live tests against the two plausible
   candidates instead of guessing;
2. ruled out `qwen/qwen3.8-27b`: every request exceeded the free tier's per-minute output budget
   (a 429 that retrying can never fix);
3. picked `openai/gpt-oss-120b`, then found two Groq-specific failure modes and handled them in
   code, with tests:
   - Groq's server-side JSON check returns `400 json_validate_failed` with the rejected text. That is
     an *output* problem, so it now goes to the repair retry instead of skipping the provider.
   - 429s are routine at 8k tokens per minute. "Request too large" is now classified as permanent,
     rate-limit retries are more patient, and `reasoning_effort=low` cuts tokens per call;
4. re-ran the **full seed set through the real worker**: 157 s, 10/10 levels as expected, zero
   rules fallbacks (README, "Results with a real model").

5. ran the stack **in Docker** for the human to check, and found two more bugs before handing it over:
   - **`.env` comments became values.** Docker Compose reads `GEMINI_API_KEY=   # note` as the value
     `# note`; pydantic, used natively, doesn't. So a reviewer who left the Groq key empty would get a
     "configured" Groq with a junk key, and `/health` would wrongly say `mode: llm`. Fixed in the
     template (comments on their own lines), with a config guard and a test.
   - **The model over-flagged E009** (the routine invoice) as *high*. It treated "no prior
     correspondence" as evidence of a new account, and claimed a spoofed domain that code had not
     detected. The prompt now says missing history is not suspicious, and that spoofing tags require a
     deterministic signal. Checked on both sides: E009 came out `none` 3 times out of 3, while E004
     and E001 stayed `high`.

It also documented the "Groq retires models" risk in the README, because a silent fall to rules is
the failure mode a reviewer would most likely hit.

✍️ *Any points where you, the human, stepped in: re-scoped, rejected an approach, asked for
something different. The session above contains the decisions you made up front (track, repo, plan,
identity, visibility); add anything you changed after reviewing the result.*

## 4. Deviations from the plan

- **`langgraph-checkpoint-sqlite` was not used.** One run is two LLM calls; a crashed run is
  re-queued by the worker, and reprocessing starts from scratch. Mid-run resume wasn't worth the
  complexity.
- **Added beyond the plan:**
  - the deterministic signals, sender-history context, safety floor and graph enrichment (§3.1);
  - the Ollama reachability probe and chain refresh (§3.3);
  - the `in_flight` field (§3.4);
  - sample upload files in `data/samples/`.

## 5. Verification record

| Check | Result |
|---|---|
| Backend `pytest` (no network) | 82 passed; `pytest -m live` is opt-in |
| `ruff`, `mypy` (backend) | clean |
| Frontend `vitest`, `eslint`, `tsc` + `vite build` | 27 passed, clean, builds |
| Rules-only run of the seed set | E001/E003/E004/E005/E006/E008 high, E010 medium, E002/E007/E009 none |
| Groq `gpt-oss-120b`, full seed set via the worker | 157 s, 10/10 expected levels, 0 rules fallbacks |
| Local LLM (`qwen2.5:7b`) on the hard cases | E001/E004 high, E009 low, E002 none |
| Fresh clone → `docker compose up --build` | all services healthy, seed processed, uploads OK, SPA routes OK |
| Headless browser at 1366px and 375px | no overflow, no console errors |

✍️ **Honest time spent:** *fill in.*

---

## Appendix A: the frontend sub-agent's brief (abridged)

> Build the React + TypeScript frontend in `frontend/`. **Do not modify anything outside `frontend/`,
> and do not run git.** Read `backend/app/api/schemas.py` (the exact API contract; mirror it as zod
> and validate every response), `backend/app/api/routes.py`, the development guide, and the brief's UI
> section. Stack: Vite, React 18, strict TS, TanStack Query, react-router, zod, react-force-graph-2d,
> Tailwind, vitest + Testing Library; npm.
>
> Build: app shell with a rules-mode banner; inbox with risk badges, a fallback chip, risk filter and
> search, master–detail on desktop and full-screen detail on mobile, polling while anything is in
> flight; detail with risk (rationale, tags, deterministic signals, provider, safety-floor note),
> extraction, entities and relationships, original content, processing trace, and Retry on failure;
> an accessible add-email dialog (paste / upload, client checks, inline 422s); a knowledge graph
> (type-coloured nodes, risk rings, mention-sized, click → connections panel or bottom sheet,
> min-risk filter, legend, resize-aware); loading, empty and error states everywhere.
>
> Quality bar: one type scale, accessible contrast, level conveyed by text not only colour, keyboard
> navigation, visible focus, works at 360px. Tests for badge, inbox states and form validation.
> `npm run lint`, `npm test` and `npm run build` must pass. A Dockerfile (node build → nginx on 8080
> proxying `/api`).
>
> When done, report: files and design decisions, check output, anything you couldn't do, **API
> changes you'd suggest (don't make them)**, and what you verified in a real browser and what you
> didn't.
