# English Speaking Assessment: Speechace vs In-House Agentic System  
**Decision Document for Final recommendation** 

---

## 1. Summary

**Recommendation: Use Speechace for English speaking tests and keep the FoloUp/Deepgram agent for conversational interviews.**

For **standardized English speaking assessment** (pronunciation, fluency, calibrated CEFR/IELTS-style scores), we should **stick with Speechace** rather than trying to mould our agentic architecture into a full replacement. Our agent is well-suited for **interview content and soft skills**; replicating Speechace’s domain would require heavy investment and would still lag on reliability and calibration. This document outlines the rationale, risks, and a direct comparison so the team can make a final call.

---

## 2. Can we mould our agent to be “like Speechace”?

**Short answer: We can get closer, but we cannot realistically match Speechace’s level for speaking assessment without disproportionate effort and ongoing maintenance.**

### What we would need to do

| Gap | What “moulding” would require | Effort & risk |
|-----|-------------------------------|----------------|
| **Pronunciation from audio** | Integrate or build acoustic models (phoneme/word-level scoring, stress, clarity). Deepgram Voice Agent does not expose pronunciation scoring; we’d need a dedicated pronunciation API or in-house ML. | **High**. Specialized R&D; ongoing tuning and validation. |
| **Real fluency (WPM, pauses)** | Fix our pipeline: capture and store **word-level timestamps** from Deepgram (or equivalent), then compute WPM and pause metrics in analytics. | **Medium**. Achievable with engineering; depends on Deepgram exposing timestamps. |
| **Structured speaking tasks** | Add flows for read-aloud, repeat-sentence, describe-image, etc., with task-specific prompts and rubrics. | **Medium–High**. New UX, prompts, and scoring logic per task type. |
| **Calibrated CEFR/IELTS scores** | Collect labeled data, run correlation studies, and continuously tune LLM or rules to match standard benchmarks. | **High**. Research and iteration; risk of drift over time. |
| **Consistency & objectivity** | Reduce LLM variance (e.g. stricter prompts, multiple runs, or rule-based layers). Still not the same as deterministic speech models. | **Medium**. Improves reliability but not to “exam-grade” level without heavy validation. |

### Realistic outcome

- We could build a **“good enough”** in-house speaking assessment for **internal or non-critical** use.
- We would **not** reliably match a **specialized vendor** (Speechace, etc.) on:
  - Pronunciation accuracy and fairness  
  - Calibration to CEFR/IELTS and other benchmarks  
  - Consistency and auditability expected in high-stakes or certification contexts  

So: **moulding our agent can make it “more like” Speechace, but not “as good as” Speechace for high-stakes English speaking tests**, without very large and ongoing investment.

---

## 3. Why specialized platforms (e.g. Speechace) usually win

- **Focused product**: Built only for speaking assessment: item types, rubrics, and scoring are aligned to that.
- **Acoustic models**: Pronunciation and fluency are derived from **audio**, not inferred from text.
- **Calibration**: Scores are tied to CEFR/IELTS (or similar) through data and validation, not LLM prompts alone.
- **Maintenance**: They handle updates to standards, accents, and edge cases; we would own all of that.
- **Liability and trust**: In regulated or high-stakes contexts, “we use Speechace” is easier to defend than “we use our own unvalidated agent.”

That doesn’t mean our agent is weak—it means it’s built for a **different job** (interviews and content) and Speechace is built for **speaking tests**.

---

## 4. Reliability and quality: agent vs Speechace (realistic view)

| Aspect | Our moulded agentic system (realistic) | Speechace |
|--------|----------------------------------------|-----------|
| **Pronunciation** | Would remain mostly text-inferred unless we add a dedicated pronunciation engine; still behind audio-native solutions. | **Strong**: built on audio; industry-standard for this. |
| **Fluency (WPM, pauses)** | Can be improved (e.g. with Deepgram timestamps) to “good” for internal use. | **Strong**: purpose-built from audio. |
| **Consistency** | LLM-based; some variance run-to-run even with hardening. | **Strong**: model-based; more stable and auditable. |
| **Calibration (CEFR/IELTS)** | Possible only with significant validation and ongoing work. | **Strong**: core part of their product. |
| **Time to market** | Months of dev + research + validation to get “good enough”. | **Immediate**: integrate API/product. |
| **Ongoing maintenance** | We own models, prompts, and benchmark alignment. | **Vendor**: they maintain and improve. |
| **Interview / content / soft skills** | **Strong**: our agent’s strength. | **Out of scope**: not their focus. |

**Conclusion:** For **speaking assessment only**, Speechace is more reliable and higher quality. For **interview + content + soft skills**, our agent is the right tool. They complement each other.

---

## 5. Recommendation

- **Use Speechace** for:
  - English **speaking tests** (pronunciation, fluency, structured tasks, CEFR/IELTS-style scores).
- **Use our FoloUp/Deepgram agent** for:
  - **Conversational interviews** (content, relevance, depth, soft skills, fit).
- **Optional hybrid**: Speaking test (Speechace) first, then interview (our agent) for candidates who pass the bar—best of both.

This gives:
- **Quality**: Speaking assessment from a specialized vendor; interview from our own agent.
- **Speed**: No need to “mould” the agent into a full Speechace replacement.
- **Risk**: No promise that our system will ever match Speechace on speaking; we don’t bet the product on that.

---

## 6. If we stick with Speechace: how is it better than our moulded agent?

Table below summarizes **why sticking with Speechace is the better approach** for the **English speaking assessment** feature, compared to building/moulding our own agentic system for the same purpose.

| Dimension | Stick with Speechace | Mould our own agentic system | Advantage |
|-----------|----------------------|------------------------------|-----------|
| **Pronunciation accuracy** | Audio-based; phoneme/word-level; industry-validated. | Text-inferred or extra integration; hard to match. | **Speechace** |
| **Fluency (WPM, pauses, rhythm)** | Native from audio; stable metrics. | Can improve with timestamps but still second to purpose-built. | **Speechace** |
| **Calibration (CEFR/IELTS)** | Built-in; maintained by vendor. | We’d need data, research, and ongoing tuning. | **Speechace** |
| **Structured task types** | Read-aloud, repeat sentence, describe image, etc., out of the box. | We’d design and implement each task and rubric. | **Speechace** |
| **Consistency & auditability** | Deterministic, model-based; easier to explain and audit. | LLM variance; harder to guarantee same input → same score. | **Speechace** |
| **Time to production** | Integration only (weeks). | Months of dev, research, and validation. | **Speechace** |
| **Maintenance & updates** | Vendor handles standards, accents, edge cases. | We own all updates and regressions. | **Speechace** |
| **Risk for high-stakes use** | Lower; “industry tool” is defensible. | Higher; “custom agent” needs heavy validation. | **Speechace** |
| **Cost** | License/API cost. | Dev + research + ongoing maintenance cost. | **Context-dependent** (TCO often favors Speechace for quality). |
| **Interview + soft skills** | Not their focus. | Our agent’s strength. | **Our agent** |

**Net:** For the **feature “English speaking assessment”**, sticking with Speechace is **better** than moulding our agent to replace it: higher quality, lower risk, faster, and less long-term burden. Our agent remains better for **interview** and **content** evaluation.

---

## 7. Summary table for the team

| Decision | Use case | Rationale |
|----------|----------|-----------|
| **Stick with Speechace** | English **speaking tests** (pronunciation, fluency, CEFR/IELTS-style scores, structured tasks) | Specialized, audio-native, calibrated, lower risk and faster than building equivalent in-house. |
| **Keep our agent** | **Interviews** (content, depth, soft skills, fit, conversational flow) | Our differentiator; Speechace does not cover this. |
| **Do not** | Try to fully replace Speechace with a moulded agent for high-stakes speaking assessment | Would require large effort and would still have loopholes (pronunciation, calibration, consistency); not recommended. |
