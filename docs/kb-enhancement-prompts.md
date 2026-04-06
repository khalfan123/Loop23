# Knowledge Base Enhancement Prompts (Call Center)

Use these prompts to improve KB quality quickly and consistently.

---

## Prompt 1 — Master KB Rewrite Prompt (recommended)

Use this to transform existing docs/pages into call-center-ready KB entries.

```text
You are a senior call center knowledge engineer.

TASK
Rewrite the source content into a voice-agent-ready knowledge base entry for phone calls.

CONTEXT
- Industry: {{industry}}
- Product/Service: {{product_or_service}}
- Target callers: {{caller_type}}
- Allowed languages: {{languages}}
- Policy strictness: {{strict|moderate}}
- Escalation trigger rules: {{paste rules}}

INPUT CONTENT
{{paste source content}}

OUTPUT FORMAT (strict)
1) Title
2) Intent tags (3-6)
3) Must-know facts (bullet list, factual only)
4) Caller-ready answer script (2-4 spoken sentences)
5) Clarifying questions to ask caller (max 2)
6) Next best action
7) Escalation conditions
8) Disallowed claims (what agent must never say)
9) Evidence lines (quote exact source snippets used)

QUALITY RULES
- Keep it phone-conversational and concise.
- Do not include URLs in spoken script.
- Do not invent prices, legal terms, SLAs, or policy details.
- If source is incomplete, explicitly mark unknowns under Disallowed claims.
- Prefer plain language over technical jargon.
- Ensure script can be spoken naturally in under 20 seconds.
- Include one optional follow-up suggestion only if contextually relevant.

RETURN
Return exactly in the 9-section format above.
```

---

## Prompt 2 — FAQ Pair Generator Prompt

Use when you need structured high-retrieval FAQ entries from long docs.

```text
Convert the content below into high-signal FAQ pairs for retrieval.

Requirements:
- Generate 12-20 FAQ pairs.
- Each question must reflect how real callers ask on phone calls.
- Each answer must be 1-3 sentences, fact-grounded, no speculation.
- Add tags for each FAQ: billing, technical, policy, account, escalation, other.
- Include "escalation_required: yes/no" for each pair.
- Include "missing_data_warning" if answer depends on unavailable info.

Content:
{{paste content}}
```

---

## Prompt 3 — Retrieval Gap Analyzer Prompt

Use after benchmark runs to convert failures into fixes.

```text
You are analyzing call center KB benchmark failures.

Given failed cases, produce a remediation plan grouped by:
- retrieval_miss
- ranking_error
- reasoning_error
- policy_error
- hallucination_error
- voice_style_error
- latency_budget_error

For each failure:
1) root cause
2) exact KB patch (new/edited entry text)
3) retrieval rule or metadata change
4) prompt/instruction change
5) expected score impact (0-5 dimension deltas)

Failed cases:
{{paste failed benchmark rows}}
```

---

## Prompt 4 — Agent Runtime Guardrail Prompt Snippet

Add this to your runtime system prompt/tool instruction area:

```text
When answering from knowledge:
- Use only retrieved evidence for factual claims.
- If evidence is missing, say you don’t have confirmed information and offer next step.
- Never guess prices, legal terms, timelines, or policy exceptions.
- Keep answers short and phone-friendly.
- If caller intent implies compliance risk or exception handling, follow escalation policy immediately.
```

---

## How to use these prompts

1. Run Prompt 1 on top 200 highest-traffic KB items first.
2. Generate FAQ variants using Prompt 2 for weak retrieval domains.
3. Re-run benchmark (`docs/kb-benchmark-rubric.md`).
4. Feed failed rows into Prompt 3.
5. Apply Prompt 4 guardrails in agent runtime config.
