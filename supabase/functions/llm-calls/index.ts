/**
 * llm-calls — unified LLM gateway edge function.
 *
 * Accepts POST { action, data } and routes to the appropriate Bedrock call.
 * Can be called by both the Next.js server (via service role key) and the
 * browser frontend (via anon key).
 *
 * Actions:
 *   generate_questions    — generate interview questions          (120b)
 *   generate_insights     — generate insights from call summaries (120b)
 *   generate_analytics    — full interview analytics              (120b, 16k tokens)
 *   analyze_communication — communication skills analysis         (20b)
 *   generate_call_analysis— call summary + sentiment ratings      (20b)
 *
 * Required Supabase edge function secrets:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (optional)
 *
 * Optional tracing:
 *   PHOENIX_URL, PHOENIX_PROJECT
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { callBedrock, getBedrockConfig, BedrockConfig } from '../_shared/bedrock.ts'
import { buildPhoenixLlmTraceBody, sendPhoenixOtlp } from '../_shared/phoenix_otlp.ts'

const LOG = '[llm-calls]'

// Heavy model: complex multi-step reasoning, large outputs
const MODEL_HEAVY = 'openai.gpt-oss-safeguard-120b'
// Light model: structured extraction, sentiment, shorter outputs
const MODEL_LIGHT = 'openai.gpt-oss-safeguard-20b'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---------------------------------------------------------------------------
// Prompt builders (ported from src/lib/prompts/*)
// ---------------------------------------------------------------------------

const GENERATE_QUESTIONS_SYSTEM =
  'You are an expert in coming up with follow up questions to uncover deeper insights.'

function buildGenerateQuestionsPrompt(data: {
  name: string
  objective: string
  number: number
  context: string
}): string {
  return `Imagine you are an interviewer specialized in designing interview questions to help hiring managers find candidates with strong technical expertise and project experience, making it easier to identify the ideal fit for the role.

Interview Title: ${data.name}
Interview Objective: ${data.objective}

Number of questions to be generated: ${data.number}

Follow these detailed guidelines when crafting the questions:
- Focus on evaluating the candidate's technical knowledge and their experience working on relevant projects. Questions should aim to gauge depth of expertise, problem-solving ability, and hands-on project experience. These aspects carry the most weight.
- Include questions designed to assess problem-solving skills through practical examples. For instance, how the candidate has tackled challenges in previous projects, and their approach to complex technical issues.
- Soft skills such as communication, teamwork, and adaptability should be addressed, but given less emphasis compared to technical and problem-solving abilities.
- Maintain a professional yet approachable tone, ensuring candidates feel comfortable while demonstrating their knowledge.
- Ask concise and precise open-ended questions that encourage detailed responses. Each question should be 30 words or less for clarity.

Use the following context to generate the questions:
${data.context}

Moreover generate a 50 word or less second-person description about the interview to be shown to the user. It should be in the field 'description'.
Do not use the exact objective in the description. Remember that some details are not be shown to the user. It should be a small description for the user to understand what the content of the interview would be. Make sure it is clear to the respondent who's taking the interview.

The field 'questions' should take the format of an array of objects with the following key: question.

Strictly output only a JSON object with the keys 'questions' and 'description'.`
}

const GENERATE_QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: { type: 'string' } },
        required: ['question'],
      },
    },
    description: { type: 'string' },
  },
  required: ['questions', 'description'],
}

// ---------------------------------------------------------------------------

const GENERATE_INSIGHTS_SYSTEM =
  'You are an expert in uncovering deeper insights from interview question and answer sets.'

function buildGenerateInsightsPrompt(data: {
  callSummaries: string
  interviewName: string
  interviewObjective: string
  interviewDescription: string
}): string {
  return `Imagine you are an interviewer who is an expert in uncovering deeper insights from call summaries.
    Use the list of call summaries and the interview details below to generate insights.

    ###
    Call Summaries: ${data.callSummaries}

    ###
    Interview Title: ${data.interviewName}
    Interview Objective: ${data.interviewObjective}
    Interview Description: ${data.interviewDescription}

    Give 3 insights from the call summaries that highlights user feedback. Only output the insights. Do not include user names in the insights.
    Make sure each insight is 25 words or less.

    Output the answer in JSON format with the key "insights" with an array on 3 insights as the value.`
}

const GENERATE_INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    insights: { type: 'array', items: { type: 'string' } },
  },
  required: ['insights'],
}

// ---------------------------------------------------------------------------

const GENERATE_ANALYTICS_SYSTEM =
  'You are an expert in analyzing interview transcripts. You must only use the main questions provided and not generate or infer additional questions.'

function buildGenerateAnalyticsPrompt(data: {
  transcript: string
  questionsText: string
}): string {
  return `Analyse the following interview transcript and provide structured feedback:

###
Transcript: ${data.transcript}

Main Interview Questions:
${data.questionsText}


Based on this transcript and the provided main interview questions, generate the following analytics in JSON format:
1. Overall Score (0-100) and Overall Feedback (60 words) - take into account the following factors:
   - Communication Skills: Evaluate the use of language, grammar, and vocabulary. Assess if the interviewee communicated effectively and clearly.
   - Time Taken to Answer: Consider if the interviewee answered promptly or took too long. Note if they were concise or tended to ramble.
   - Confidence: Assess the interviewee's confidence level. Were they assertive and self-assured, or did they seem hesitant and unsure?
   - Clarity: Evaluate the clarity of their answers. Were their responses well-structured and easy to understand?
   - Attitude: Consider the interviewee's attitude towards the interview and questions. Were they positive, respectful, and engaged?
   - Relevance of Answers: Determine if the interviewee's responses are relevant to the questions asked. Assess if they stayed on topic or veered off track.
   - Depth of Knowledge: Evaluate the interviewee's depth of understanding and knowledge in the subject matter. Look for detailed and insightful answers.
   - Problem-Solving Ability: Consider how the interviewee approaches problem-solving questions. Assess their logical reasoning and analytical skills.
   - Examples and Evidence: Note if the interviewee provides concrete examples or evidence to support their answers. This can indicate experience and credibility.
   - Listening Skills: Look for signs that the interviewee is actively listening and responding appropriately to follow-up questions.
   - Consistency: Evaluate if the interviewee's answers are consistent throughout the interview or if they contradict themselves.
   - Adaptability: Assess how well the interviewee adapts to different types of questions, including unexpected or challenging ones.

2. Communication Skills: Score (0-10) and Feedback (60 words). Rating system and guidelines for communication skills is as following.
    - 10: Fully operational command, use of English is appropriate, accurate, fluent, shows complete understanding.
    - 09: Fully operational command with occasional inaccuracies and inappropriate usage. May misunderstand unfamiliar situations but handles complex arguments well.
    - 08: Operational command with occasional inaccuracies, inappropriate usage, and misunderstandings. Handles complex language and detailed reasoning well.
    - 07: Effective command despite some inaccuracies, inappropriate usage, and misunderstandings. Can use and understand reasonably complex language, especially in familiar situations.
    - 06: Partial command, copes with overall meaning, frequent mistakes. Handles basic communication in their field.
    - 05: Basic competence limited to familiar situations with frequent problems in understanding and expression.
    - 04: Understands only general meaning in very familiar situations, with frequent communication breakdowns.
    - 03: Has great difficulty understanding spoken English.
    - 02: Has no ability to use the language except a few isolated words.
    - 01: Did not answer the questions.
3. Summary for each main interview question: ${data.questionsText}
   - Use ONLY the main questions provided, it should output all the questions with the numbers even if it's not found in the transcript.
   - Follow the below rules when outputing the question and summary
      - If a main interview question isn't found in the transcript, then output the main question and give the summary as "Not Asked"
      - If a main interview question is found in the transcript but an answer couldn't be found, then output the main question and give the summary as "Not Answered"
      - If a main interview question is found in the transcript and an answer can also be found, then,
          - For each main question (q), provide a summary that includes:
            a) The candidate's response to the main question
            b) Any follow-up questions that were asked related to this main question and their answers
          - The summary should be a cohesive paragraph encompassing all related information for each main question
          - For EACH question with a valid answer, also provide:
            * questionTranscript: string - The exact transcript of the candidate's answer to this question (extract from the full transcript)
            * cefrLevel: string (one of: "A1", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C1+", "C2") - CEFR level for this specific answer
            NOTE: wordsPerMinute and badPauses will be calculated separately using timing data, so you don't need to provide them.
            * pronunciationLevel: string - CEFR level for pronunciation in this answer
            * fluencyLevel: string - CEFR level for fluency in this answer
            * vocabularyLevel: string - CEFR level for vocabulary in this answer
            * grammarLevel: string - CEFR level for grammar in this answer
            * pronunciationFeedback: string (40-60 words) - Detailed feedback on pronunciation for this answer
            * fluencyFeedback: string (40-60 words) - Detailed feedback on fluency for this answer
            * vocabularyFeedback: string (40-60 words) - Detailed feedback on vocabulary for this answer
            * grammarFeedback: string (40-60 words) - Detailed feedback on grammar for this answer
4. Create a 10 to 15 words summary regarding the soft skills considering factors such as confidence, leadership, adaptability, critical thinking and decision making.

5. Answer Quality Metrics:
   - averageAnswerLength: number (average number of words per answer)
   - answerRelevanceScore: number (0-10) - How relevant are the answers to the questions asked?
   - depthScore: number (0-10) - How deep and detailed are the answers? Do they show thorough understanding?
   - consistencyScore: number (0-10) - Are the answers consistent throughout the interview? Do they contradict each other?

6. Advanced Analysis:
   - confidenceLevel: string (one of: "High", "Medium", "Low") - Overall confidence level based on assertiveness, hesitation, and self-assurance
   - engagementScore: number (0-10) - How engaged and interested was the candidate? Did they ask questions? Show enthusiasm?
   - problemSolvingScore: number (0-10) - How well did they approach problem-solving questions? Logical reasoning and analytical skills
   - adaptabilityScore: number (0-10) - How well did they adapt to different types of questions, including unexpected or challenging ones?

7. English Language Proficiency (CEFR Evaluation):
   Based on the transcript, evaluate the candidate's English proficiency according to the Common European Framework of Reference (CEFR) levels A1-C2.

   Language Assessment Criteria:
   - Pronunciation & Fluency (0-10): Evaluate pronunciation clarity, intonation, rhythm, and speaking rate. Consider hesitations, pauses, and natural flow of speech.
   - Grammar Accuracy (0-10): Assess grammatical correctness, use of tenses, sentence structure, and complexity.
   - Vocabulary Range (0-10): Evaluate vocabulary diversity, use of appropriate words, idiomatic expressions, and precision in word choice.
   - Coherence & Relevance (0-10): Assess how well the candidate structures their responses, maintains logical flow, stays on topic, and connects ideas coherently.

   CEFR Level Mapping (average of pronunciation, grammar, vocabulary, and coherence scores):
   - C2 (Proficient): 9.0-10.0
   - C1 (Advanced): 7.5-8.9
   - B2 (Upper Intermediate): 6.0-7.4
   - B1 (Intermediate): 4.5-5.9
   - A2 (Elementary): 3.0-4.4
   - A1 (Beginner): 0.0-2.9

   Output:
   - pronunciationScore, fluencyScore, grammarScore, vocabularyScore, coherenceScore (0-10 each)
   - cefrLevel (one of: "A1", "A2", "B1", "B2", "C1", "C2")
   - cefrDescription (20-30 words)
   - ieltsEstimate (e.g., "6.5-7.0")
   - pronunciationFeedback, fluencyFeedback, vocabularyFeedback, grammarFeedback, coherenceFeedback (60-80 words each)

Ensure the output is in valid JSON format matching this structure exactly. Return ONLY the raw JSON object, no markdown, no code fences.`
}

// ---------------------------------------------------------------------------

const ANALYZE_COMMUNICATION_SYSTEM = `You are an expert in analyzing communication skills from interview transcripts. Your task is to:
1. Analyze the communication skills demonstrated in the transcript
2. Identify specific quotes that support your analysis
3. Provide a detailed breakdown of strengths and areas for improvement`

function buildAnalyzeCommunicationPrompt(data: { transcript: string }): string {
  return `Analyze the communication skills demonstrated in the following interview transcript:

Transcript: ${data.transcript}

Please provide your analysis in the following JSON format:
{
  "communicationScore": number,
  "overallFeedback": string,
  "supportingQuotes": [
    {
      "quote": string,
      "analysis": string,
      "type": string
    }
  ],
  "strengths": [string],
  "improvementAreas": [string]
}`
}

const ANALYZE_COMMUNICATION_SCHEMA = {
  type: 'object',
  properties: {
    communicationScore: { type: 'number' },
    overallFeedback: { type: 'string' },
    supportingQuotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string' },
          analysis: { type: 'string' },
          type: { type: 'string' },
        },
        required: ['quote', 'analysis', 'type'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    improvementAreas: { type: 'array', items: { type: 'string' } },
  },
  required: ['communicationScore', 'overallFeedback', 'supportingQuotes', 'strengths', 'improvementAreas'],
}

// ---------------------------------------------------------------------------

const GENERATE_CALL_ANALYSIS_SYSTEM =
  'You are an expert in analyzing interview calls. Your task is to analyze the interview transcript and provide a comprehensive call analysis including sentiment analysis and call completion assessment.'

function buildGenerateCallAnalysisPrompt(data: {
  transcript: string
  overallScore?: number
  overallFeedback?: string
}): string {
  return `Analyze the following interview transcript and provide a comprehensive call analysis:

Transcript: ${data.transcript}

${data.overallScore !== undefined ? `Overall Score: ${data.overallScore}/100` : ''}
${data.overallFeedback ? `Overall Feedback: ${data.overallFeedback}` : ''}

Please provide your analysis in the following JSON format:
{
  "call_summary": string,
  "user_sentiment": string,
  "agent_sentiment": string,
  "agent_task_completion_rating": string,
  "agent_task_completion_rating_reason": string,
  "call_completion_rating": string,
  "call_completion_rating_reason": string
}

Guidelines:
- user_sentiment: one of "Positive", "Neutral", or "Negative"
- agent_sentiment: one of "Positive", "Neutral", or "Negative"
- agent_task_completion_rating: one of "Complete", "Partial", or "Incomplete"
- call_completion_rating: one of "Complete", "Partial", or "Incomplete"
- call_summary: 2-3 sentence summary of the entire interview call`
}

const GENERATE_CALL_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    call_summary: { type: 'string' },
    user_sentiment: { type: 'string' },
    agent_sentiment: { type: 'string' },
    agent_task_completion_rating: { type: 'string' },
    agent_task_completion_rating_reason: { type: 'string' },
    call_completion_rating: { type: 'string' },
    call_completion_rating_reason: { type: 'string' },
  },
  required: [
    'call_summary',
    'user_sentiment',
    'agent_sentiment',
    'agent_task_completion_rating',
    'agent_task_completion_rating_reason',
    'call_completion_rating',
    'call_completion_rating_reason',
  ],
}

// ---------------------------------------------------------------------------
// JSON extraction helper for free-text analytics responses
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
  if (fenced) return fenced[1].trim()
  return trimmed
}

// ---------------------------------------------------------------------------
// Core LLM call + tracing wrapper
// ---------------------------------------------------------------------------

async function callWithTrace(opts: {
  config: BedrockConfig
  action: string
  modelId: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
  responseSchema?: Record<string, unknown>
  phoenixBase?: string
  phoenixProject?: string
}): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined }> {
  const rootStartMs = Date.now()
  let llmStartMs = 0
  let llmEndMs = 0
  let text = ''
  let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined
  let llmError: string | undefined

  try {
    llmStartMs = Date.now()
    const result = await callBedrock(opts.config, opts.modelId, opts.userPrompt, {
      systemPrompt: opts.systemPrompt,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      responseSchema: opts.responseSchema,
    })
    text = result.text
    usage = result.usage
  } catch (e) {
    llmError = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    llmEndMs = Date.now()
    const rootEndMs = Date.now()

    if (opts.phoenixBase) {
      const traceBody = buildPhoenixLlmTraceBody({
        serviceName: 'llm-calls',
        projectName: opts.phoenixProject ?? 'foloup',
        rootSpanName: `llm-calls-${opts.action}.request`,
        llmSpanName: 'bedrock.converse',
        scopeName: 'llm-calls',
        fieldType: opts.action,
        model: opts.modelId,
        promptPreview: opts.userPrompt.slice(0, 8192),
        outputPreview: text.slice(0, 8192),
        promptLen: opts.userPrompt.length,
        outputLen: text.length,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        tokenPrompt: usage?.inputTokens,
        tokenCompletion: usage?.outputTokens,
        tokenTotal: usage?.totalTokens,
        rootStartMs,
        rootEndMs,
        llmStartMs,
        llmEndMs,
        llmError,
      })
      await sendPhoenixOtlp(opts.phoenixBase, traceBody)
    }
  }

  return { text, usage }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const phoenixBase = Deno.env.get('PHOENIX_URL')?.trim()
  const phoenixProject = Deno.env.get('PHOENIX_PROJECT')?.trim()

  let bedrockConfig
  try {
    bedrockConfig = getBedrockConfig()
  } catch {
    console.error(`${LOG} AWS Bedrock not configured — missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY`)
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { action?: string; data?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { action, data = {} } = body

  if (!action) {
    return new Response(JSON.stringify({ error: 'Missing required field: action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: 'INFO', fn: 'llm-calls',
    msg: 'Request received',
    action,
    phoenixProject: phoenixProject ?? '(none)',
    phoenixEnabled: !!phoenixBase,
  }))

  try {
    // ── generate_questions ──────────────────────────────────────────────────
    if (action === 'generate_questions') {
      const { text } = await callWithTrace({
        config: bedrockConfig,
        action,
        modelId: MODEL_HEAVY,
        systemPrompt: GENERATE_QUESTIONS_SYSTEM,
        userPrompt: buildGenerateQuestionsPrompt(data as Parameters<typeof buildGenerateQuestionsPrompt>[0]),
        temperature: 0.7,
        maxTokens: 2048,
        responseSchema: GENERATE_QUESTIONS_SCHEMA,
        phoenixBase,
        phoenixProject,
      })
      return new Response(JSON.stringify({ response: text }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── generate_insights ───────────────────────────────────────────────────
    if (action === 'generate_insights') {
      const { text } = await callWithTrace({
        config: bedrockConfig,
        action,
        modelId: MODEL_HEAVY,
        systemPrompt: GENERATE_INSIGHTS_SYSTEM,
        userPrompt: buildGenerateInsightsPrompt(data as Parameters<typeof buildGenerateInsightsPrompt>[0]),
        temperature: 0.7,
        maxTokens: 1024,
        responseSchema: GENERATE_INSIGHTS_SCHEMA,
        phoenixBase,
        phoenixProject,
      })
      return new Response(JSON.stringify({ response: text }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── generate_analytics ──────────────────────────────────────────────────
    if (action === 'generate_analytics') {
      const { text } = await callWithTrace({
        config: bedrockConfig,
        action,
        modelId: MODEL_HEAVY,
        systemPrompt: GENERATE_ANALYTICS_SYSTEM,
        userPrompt: buildGenerateAnalyticsPrompt(data as Parameters<typeof buildGenerateAnalyticsPrompt>[0]),
        temperature: 0.3,
        maxTokens: 16000,
        // No responseSchema — schema is too complex for tool-use; prompt enforces JSON
        phoenixBase,
        phoenixProject,
      })
      const analytics = JSON.parse(extractJson(text))
      return new Response(JSON.stringify({ analytics }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── analyze_communication ───────────────────────────────────────────────
    if (action === 'analyze_communication') {
      const { text } = await callWithTrace({
        config: bedrockConfig,
        action,
        modelId: MODEL_LIGHT,
        systemPrompt: ANALYZE_COMMUNICATION_SYSTEM,
        userPrompt: buildAnalyzeCommunicationPrompt(data as Parameters<typeof buildAnalyzeCommunicationPrompt>[0]),
        temperature: 0.3,
        maxTokens: 2048,
        responseSchema: ANALYZE_COMMUNICATION_SCHEMA,
        phoenixBase,
        phoenixProject,
      })
      return new Response(JSON.stringify({ analysis: JSON.parse(text) }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── generate_call_analysis ──────────────────────────────────────────────
    if (action === 'generate_call_analysis') {
      const { text } = await callWithTrace({
        config: bedrockConfig,
        action,
        modelId: MODEL_LIGHT,
        systemPrompt: GENERATE_CALL_ANALYSIS_SYSTEM,
        userPrompt: buildGenerateCallAnalysisPrompt(data as Parameters<typeof buildGenerateCallAnalysisPrompt>[0]),
        temperature: 0.3,
        maxTokens: 1024,
        responseSchema: GENERATE_CALL_ANALYSIS_SCHEMA,
        phoenixBase,
        phoenixProject,
      })
      return new Response(JSON.stringify({ callAnalysis: JSON.parse(text) }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        error: `Unknown action: ${action}. Valid actions: generate_questions, generate_insights, generate_analytics, analyze_communication, generate_call_analysis`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${LOG} error [${action}]:`, message)
    return new Response(JSON.stringify({ error: message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
