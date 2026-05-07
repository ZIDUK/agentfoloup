# FoloUp — Product Requirements Document

**Owner:** Product (pm)
**Last updated:** 2026-05-08
**Status:** Living document

---

## 1. Problem Statement

Hiring teams can screen dozens or hundreds of candidates per role, but meaningful conversation—the kind that reveals communication ability, adaptability, and cultural fit—does not scale. Phone screens are time-intensive and inconsistent: different interviewers ask different questions, score differently, and have no structured record. Automated test platforms (Speechace, standard MCQ tools) assess pronunciation or knowledge in isolation but cannot hold a real conversation, probe follow-up answers, or evaluate how a candidate thinks under dialogue pressure.

The result is that hiring teams either under-screen (skip early conversation entirely, missing soft-skill signals) or spend disproportionate recruiter time on low-yield initial calls.

FoloUp replaces the first-round phone screen with a real-time AI voice interview. The AI asks custom questions, adapts follow-ups to the candidate's answers, and produces a structured evaluation covering language proficiency, communication quality, soft skills, and job fit—all without a human in the room.

---

## 2. Users

### Operators (hiring teams)
Authenticated via Clerk (individual or organization account). Create interview templates, configure AI interviewers, share invite links, and review results on the dashboard. Typical profiles: recruiters, talent acquisition leads, HR managers at companies using FoloUp directly or via white-label (Talvin AI, Rapidscreen).

**Jobs-to-be-done:**
- Screen many candidates quickly without scheduling calls
- Get consistent, structured evaluation data per candidate
- Filter to a shortlist before investing human interview time
- Satisfy compliance-adjacent audit trails (proctoring logs, recordings)

### Candidates
No account required. Receive an invitation link by email or through DreamIT (an external job application system). Complete one interview per link. Typical profiles: job applicants, sometimes applying through a third-party job board integrated via DreamIT.

**Jobs-to-be-done:**
- Complete the interview asynchronously on their own schedule
- Understand what they are consenting to (recording, proctoring) before starting
- Receive their own results summary at the end

---

## 3. Success Criteria

| Metric | Target |
|---|---|
| Interview completion rate | ≥ 70% of candidates who start reach `is_ended = true` |
| Post-interview analysis availability | 100% of completed interviews have analytics within 60 seconds of end |
| Operator time-to-first-insight | < 2 minutes from candidate completion to dashboard result visible |
| Duplicate submission prevention | 0 cases where the same `application_id` produces two scored responses |
| Invitation expiry enforcement | 100% of expired invitations blocked at the `/call/[interviewId]/[jobId]/[applicationId]` resolver |
| DreamIT notification delivery | `dreamit_notified = true` on every response linked to an `application_id` |

---

## 4. User Journeys

### Journey 1 — Operator creates an interview template

1. Operator signs in via Clerk at `/sign-in`.
2. Navigates to **Dashboard → Interviews**.
3. Clicks **Create Interview**, fills in:
   - Name, objective, description
   - Number of questions and time duration (minutes)
   - Selects or creates an AI interviewer persona (name, empathy 1–10, rapport 1–10, exploration depth 1–10, speaking speed 1–10, voice: Lisa/Thalia or Bob/Orion)
   - Optionally uploads a logo and sets a theme color
4. AI generates suggested questions from the job description (via `POST /api/generate-interview-questions`); operator edits or replaces them.
5. Template saved. Operator copies the shareable link from the **Share** popup.

**Outcome:** A reusable interview template with a stable URL candidates can be invited to.

---

### Journey 2 — Candidate completes an interview (direct link)

1. Candidate opens `/call/[interviewId]`.
2. Sees the interview description, camera/microphone consent notice, and proctoring disclosure.
3. Enters email and first name. Browser permission status (granted/denied/unknown) is shown proactively.
4. Clicks **Start Interview**:
   - `requestFullscreen()` fires synchronously in the click handler (browser policy requirement).
   - Camera + mic access is requested (`getUserMedia`).
   - A Deepgram ephemeral token is fetched (`POST /api/deepgram-token`).
   - A `DeepgramAgentService` is created and configured with the interview's questions, objective, duration, and the interviewer persona parameters.
   - A response row is created in Supabase (`createResponse`).
5. The Deepgram Voice Agent greets the candidate by name and conducts the interview. STT uses Deepgram `flux-general-en v2`; the AI "think" layer uses OpenAI `gpt-4o-mini`; TTS uses Deepgram Aura-2 voices.
6. Real-time transcript is displayed: interviewer utterances on the left, candidate utterances on the right.
7. Proctoring runs continuously: tab switches, window blurs, fullscreen exits, and camera cover events are logged.
8. Interview ends (time limit reached, all questions covered, or candidate clicks **End Interview**).
9. Recording is uploaded; transcript and proctoring events are saved (`PATCH /api/responses/[callId]`).
10. OpenAI analysis runs (`POST /api/get-call`). Candidate is redirected to `/result/[callId]`.

**Outcome:** Candidate sees their CEFR proficiency level, language skill breakdown, question summaries, and full transcript. Operator sees the result on the dashboard.

---

### Journey 3 — Candidate arrives via DreamIT integration

1. Candidate receives a link in the form `/call/[interviewId]/[jobId]/[applicationId]`.
2. The resolver page (`InvitationResolver`) calls `GET /api/fn/invitations-get?application_id=...`:
   - **404 / not found:** shows "No Invitation Found" error page.
   - **`is_expired = true`:** shows "Invitation Expired" error page.
   - **Valid and active:** redirects to `/call/[invitationId]` with `applicationId` and `jobId` pre-set.
3. Before allowing the interview to start, `POST /api/check-response` checks whether this `applicationId` already has a completed response. If yes, the candidate is redirected to `/result/[call_id]` — no re-interview.
4. Flow continues as Journey 2. At completion, DreamIT is notified (`dreamit_notified` flag set on the response row).

**Outcome:** DreamIT job applicants are screened without requiring a separate FoloUp account; duplicate interviews are blocked.

---

### Journey 4 — Operator reviews results

1. Operator opens the interview on the Dashboard.
2. **Summary tab** shows: overall analysis table (name, overall score 0–100, communication score, soft-skill summary), average duration, completion rate, candidate sentiment pie chart (Positive/Neutral/Negative), candidate status pie chart (Selected/Potential/Not Selected/No Status).
3. **Answer Quality Metrics** panel: average answer length (words), relevance score, depth score, consistency score.
4. **Advanced Analysis** panel: engagement score, problem-solving score, adaptability score, confidence level distribution (High/Medium/Low).
5. **CEFR Language Proficiency** panel (when data present): distribution of candidates by CEFR level (A1–C2); average pronunciation, fluency, grammar, vocabulary, coherence scores.
6. **Comparative Metrics** panel: score distribution histogram, top 3 performers, score trends over time (line chart), per-candidate delta from cohort average.
7. Clicking a candidate row opens the individual response detail with full analytics and collapsible transcript.
8. Operator can set candidate status (Selected / Potential / Not Selected) and mark viewed.

**Outcome:** Operator has enough structured signal to shortlist candidates without listening to recordings.

---

### Journey 5 — Operator runs a test interview

1. From the interview detail page, operator clicks **Test Interview**.
2. Interview opens with `isTestResponse = true` and pre-filled email/name (operator's own).
3. An amber "Test Mode" banner is shown. The response is stored with `is_test_response = true`, keeping test data separate from production responses on the dashboard.

**Outcome:** Operator validates the interview experience and question flow before sending to real candidates.

---

## 5. Non-Goals

These are explicitly out of scope for the current product:

- **Scheduling / calendar integration.** FoloUp sends a link; the candidate completes it asynchronously. There is no meeting scheduling, calendar sync, or time-slot selection.
- **Multi-round interview orchestration.** Each interview is a single-session event. There is no built-in workflow to chain screening → technical → final rounds.
- **Video analysis / facial expression scoring.** Camera recording is collected for integrity verification only. The analysis pipeline processes the audio transcript; no face detection or emotion scoring is performed on video.
- **Inbound phone/telephony.** All interviews are browser-based (WebRTC). There is no phone number dial-in or PSTN integration.
- **Operator-facing mobile app.** The operator dashboard is a responsive web app; there is no native iOS/Android app.
- **Real-time human escalation.** There is no mechanism for a human recruiter to join or take over a live AI interview.
- **Candidate accounts.** Candidates do not create accounts, log in, or manage a profile. A completed interview is accessible only via the result URL.

---

## 6. Risks

### R1 — Browser permission friction blocks candidates
**Risk:** Candidates deny camera/mic permissions or use unsupported browsers, failing before the interview starts.
**Impact:** Completion rate drops; candidate is stuck with no clear recovery path.
**Mitigation:** Pre-flight permission status indicator on the consent screen (green/yellow/red). Error messaging instructs candidates to update browser settings. Camera access required; interview blocked if denied.

### R2 — Deepgram connection instability mid-interview
**Risk:** WebSocket connection drops partway through the interview. Transcript is incomplete; candidate panics.
**Impact:** Lost interview data; poor candidate experience; operator sees incomplete analysis.
**Mitigation:** Keep-alive pings every 5 seconds. On `AgentEvents.Error`, the interview ends gracefully (save what was captured). Incomplete response can be resumed via `reuseCallId` if the page is reloaded before a new response is created.

### R3 — OpenAI analysis latency or failure
**Risk:** Post-interview analysis (`/api/get-call`) times out or errors. Candidate is redirected to a result page with no analytics.
**Impact:** Result page shows "Interview Complete" but no scores—degraded value for both candidate and operator.
**Mitigation:** `keepalive: true` on the fetch ensures the request completes even if the candidate closes the tab immediately. Result page handles `analytics = null` gracefully. Operator can re-trigger analysis from the dashboard.

### R4 — Duplicate response from a retry or page reload
**Risk:** Candidate reloads the interview page and starts a second interview, producing two response rows for the same `application_id`.
**Impact:** Operator sees duplicate data; DreamIT may be notified twice.
**Mitigation:** `/api/check-response` is called both on page load (redirect if complete) and at interview start (redirect if complete; reuse `call_id` if incomplete). The check fires before creating a new response row.

### R5 — Proctoring data used as sole disqualifier
**Risk:** Tab switches or fullscreen exits are logged but may have innocent causes (second monitor, accessibility tool). Operators may over-weight these signals and reject qualified candidates.
**Impact:** Legal/fairness exposure; candidate dissatisfaction.
**Mitigation:** Proctoring data is surfaced as context, not a score. The candidate-facing consent notice explains what is logged. Operators are not given automated pass/fail logic based on proctoring events alone.

### R6 — White-label branding leakage
**Risk:** Talvin AI or Rapidscreen customers see "FoloUp" or "Agentic Dream" branding inside the interview UI.
**Impact:** Broken white-label trust; contractual issue.
**Mitigation:** Per-interview `logo_url` and `theme_color` fields allow operators to inject their branding. The interview UI reads these and applies them to buttons and the header. Operators must set these when configuring a white-label deployment.

---

## 7. Scope and Boundaries

### In scope
- Interview template creation, editing, and deletion by authenticated operators
- AI interviewer persona configuration (personality parameters, voice selection)
- Candidate interview flow: consent, camera/mic grant, live Deepgram Voice Agent session, real-time transcript display, proctoring
- Video recording of candidate during interview and upload to storage
- Post-interview OpenAI analysis producing: overall score, CEFR level (A1–C2), pronunciation/fluency/grammar/vocabulary/coherence scores and feedback, question summaries, soft-skill summary, confidence/engagement/problem-solving/adaptability scores
- Candidate result page showing own analysis
- Operator dashboard: per-interview analytics, candidate table, charts, candidate status management
- DreamIT integration: invitation resolution, expiry enforcement, duplicate prevention, DreamIT notification
- Test-mode interviews (operator-only, flagged separately in DB)
- White-label support via per-interview logo and theme color

### Explicitly out of scope (see Non-Goals)
- Scheduling, calendar sync
- Multi-round orchestration
- Video/facial analysis
- Telephony / phone interviews
- Native mobile apps
- Candidate accounts

### Boundary conditions
- The maximum interview duration is set by the operator on the template (`time_duration` in minutes). The timer enforces this hard limit; the agent is closed when it expires.
- Each interview question may have a `follow_up_count` stored, but follow-up depth is controlled by the AI's exploration personality parameter (1–10), not a hard counter enforced in code.
- Recordings are stored at the path Supabase Storage returns; the `recording_url` on the response row is null until upload succeeds. Analysis does not depend on the recording; it depends on the in-browser transcript.
- The CEFR evaluation is English-only. The Deepgram agent is configured with `language: "en"`.
