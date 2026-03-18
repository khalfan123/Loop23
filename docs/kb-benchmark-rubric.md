# Call Center Knowledge Base Benchmark Rubric

This rubric is designed for **A/B testing**:

- **System A** = Your KB stack
- **System B** = Retell KB stack

It is optimized for phone-call behavior (not chatbot behavior).

---

## 1) Benchmark Goals

Measure which system is better for live call center usage across:

1. Answer correctness and grounding
2. Safety and hallucination control
3. Conversation quality on voice calls
4. Operational latency
5. Policy/escalation reliability

---

## 2) Test Set Size and Mix (ready-to-run)

Use **120 total test cases**:

- 40 FAQ/simple queries
- 30 policy/compliance queries
- 20 troubleshooting/multi-step queries
- 15 escalation-sensitive queries (refund, cancellation, legal threat)
- 15 ambiguous/missing-data queries

Languages:

- 80 English
- 20 Arabic
- 20 mixed (English + local terms)

Caller sentiment labels:

- 50 neutral
- 35 frustrated
- 20 confused
- 15 urgent

---

## 3) Required Inputs Per Test Case

See `docs/templates/kb-benchmark-cases.csv`.

Minimum fields:

- `case_id`
- `category`
- `language`
- `caller_sentiment`
- `user_query`
- `gold_answer_points` (must-have facts separated by `|`)
- `disallowed_claims` (facts that must never be invented)
- `escalation_expected` (`yes/no`)
- `max_target_latency_ms`

---

## 4) Scoring Dimensions (0-5 each)

Score each response with these dimensions:

1. **Grounded Accuracy (weight 30%)**  
   - 5 = all must-have facts correct; no factual errors  
   - 3 = partially correct; minor miss  
   - 1 = major error

2. **Hallucination Safety (weight 20%)**  
   - 5 = no unsupported claims  
   - 3 = mild speculative phrasing  
   - 1 = fabricated policy/price/process

3. **Call-Readiness / Voice Naturalness (weight 15%)**  
   - 5 = concise, spoken, clear  
   - 3 = slightly robotic/verbose  
   - 1 = unreadable for calls

4. **Policy & Compliance Adherence (weight 15%)**  
   - 5 = follows policy/escalation rules exactly  
   - 3 = minor policy drift  
   - 1 = wrong policy behavior

5. **Task Completeness (weight 10%)**  
   - 5 = fully addresses intent + next step  
   - 3 = partial answer  
   - 1 = misses intent

6. **Latency SLO (weight 10%)**  
   - 5 = <= target latency  
   - 3 = up to 25% over  
   - 1 = >25% over

---

## 5) Weighted Score Formula

Per case:

```text
case_score =
  grounded*0.30 +
  safety*0.20 +
  voice*0.15 +
  policy*0.15 +
  completeness*0.10 +
  latency*0.10
```

Scale: 0 to 5.

Overall score (per system):

```text
overall = average(case_score across all cases)
```

---

## 6) Gate Metrics (must-pass)

A system is "production-ready for call center" only if all pass:

- Overall weighted score >= **4.20 / 5**
- Hallucination Safety average >= **4.50 / 5**
- Policy/Compliance average >= **4.40 / 5**
- P95 latency <= **1.2x target latency**
- Critical failure rate (score <=2 in Grounded Accuracy) <= **2%**

---

## 7) Failure Taxonomy (for improvement planning)

Label each failure with one primary root cause:

- `retrieval_miss` (did not fetch relevant chunk)
- `ranking_error` (relevant chunk fetched but not prioritized)
- `reasoning_error` (wrong conclusion from right facts)
- `policy_error` (business rule/escalation mishandled)
- `voice_style_error` (too long/robotic/not call-ready)
- `latency_budget_error` (slow response path)
- `hallucination_error` (invented facts)

Track `%` by root cause for each system.

---

## 8) Execution Protocol (A/B)

1. Freeze same test set for both systems.
2. Run both systems with equivalent prompts/persona where possible.
3. Collect raw response text and first-token latency.
4. Blind-score outputs (hide system label from scorer).
5. Compute:
   - overall weighted
   - category-wise scores
   - language-wise scores
   - sentiment-wise scores
6. Decide winner by:
   - higher overall score
   - plus must-pass gate metrics.

---

## 9) Quick Sheet Columns

Recommended result sheet columns:

- `case_id`
- `system` (`our_kb` / `retell_kb`)
- `grounded_0_5`
- `safety_0_5`
- `voice_0_5`
- `policy_0_5`
- `completeness_0_5`
- `latency_0_5`
- `case_score`
- `root_cause`
- `notes`

`case_score` formula (Google Sheets / Excel):

```text
=C2*0.30 + D2*0.20 + E2*0.15 + F2*0.15 + G2*0.10 + H2*0.10
```

---

## 10) Interpretation

- If Retell wins mostly on latency/freshness but loses on policy/voice quality:  
  prioritize retrieval freshness automation and keep your advanced logic stack.

- If your KB wins on quality but loses only on operations burden:  
  automate crawl/sync pipelines and monitoring instead of replacing architecture.

- If either system fails safety/compliance gate:  
  do **not** use for customer-facing live calls yet.
