export interface Response {
  id: bigint;
  created_at: Date;
  name: string | null;
  interview_id: string;
  duration: number;
  call_id: string;
  details: any;
  is_analysed: boolean;
  email: string;
  is_ended: boolean;
  is_viewed: boolean;
  analytics: any;
  candidate_status: string;
  tab_switch_count: number;
}

export type CEFRLevel =
  | "A1"
  | "A2"
  | "A2+"
  | "B1"
  | "B1+"
  | "B2"
  | "B2+"
  | "C1"
  | "C1+"
  | "C2";

export interface QuestionSummary {
  question: string;
  summary: string;
  // Per-question CEFR analysis (optional, only if answer found)
  questionTranscript?: string;
  wordsPerMinute?: number;
  badPauses?: number;
  cefrLevel?: CEFRLevel;
  pronunciationLevel?: CEFRLevel;
  fluencyLevel?: CEFRLevel;
  vocabularyLevel?: CEFRLevel;
  grammarLevel?: CEFRLevel;
  pronunciationFeedback?: string;
  fluencyFeedback?: string;
  vocabularyFeedback?: string;
  grammarFeedback?: string;
}

export interface Analytics {
  overallScore: number;
  overallFeedback: string;
  communication: { score: number; feedback: string };
  generalIntelligence: string;
  softSkillSummary: string;
  questionSummaries: QuestionSummary[];
  // Answer Quality Metrics
  averageAnswerLength?: number;
  answerRelevanceScore?: number;
  depthScore?: number;
  consistencyScore?: number;
  // Advanced Analysis
  confidenceLevel?: "High" | "Medium" | "Low";
  engagementScore?: number;
  problemSolvingScore?: number;
  adaptabilityScore?: number;
  // CEFR Language Proficiency Evaluation (Overall)
  pronunciationScore?: number;
  fluencyScore?: number;
  grammarScore?: number;
  vocabularyScore?: number;
  coherenceScore?: number;
  cefrLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  cefrDescription?: string;
  ieltsEstimate?: string;
  // Detailed feedback by skill (Overall)
  pronunciationFeedback?: string;
  fluencyFeedback?: string;
  vocabularyFeedback?: string;
  grammarFeedback?: string;
  coherenceFeedback?: string;
}

export interface FeedbackData {
  interview_id: string;
  satisfaction: number | null;
  feedback: string | null;
  email: string | null;
}

export interface CallData {
  call_id: string;
  agent_id: string;
  audio_websocket_protocol: string;
  audio_encoding: string;
  sample_rate: number;
  call_status: string;
  end_call_after_silence_ms: number;
  from_number: string;
  to_number: string;
  metadata: Record<string, unknown>;
  // Legacy field from Retell AI (kept for backward compatibility)
  retell_llm_dynamic_variables?: {
    customer_name: string;
  };
  drop_call_if_machine_detected: boolean;
  opt_out_sensitive_data_storage: boolean;
  start_timestamp: number;
  end_timestamp: number;
  transcript: string;
  transcript_object: {
    role: "agent" | "user";
    content: string;
    words: {
      word: string;
      start: number;
      end: number;
    }[];
  }[];
  transcript_with_tool_calls: {
    role: "agent" | "user";
    content: string;
    words: {
      word: string;
      start: number;
      end: number;
    }[];
  }[];
  recording_url: string;
  public_log_url: string;
  e2e_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  llm_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  llm_websocket_network_rtt_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  disconnection_reason: string;
  call_analysis: {
    call_summary: string;
    user_sentiment: string;
    agent_sentiment: string;
    agent_task_completion_rating: string;
    agent_task_completion_rating_reason: string;
    call_completion_rating: string;
    call_completion_rating_reason: string;
  };
}
