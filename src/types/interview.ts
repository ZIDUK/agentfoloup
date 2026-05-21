export interface Question {
  id: string;
  question: string;
  follow_up_count: number;
}

export interface Quote {
  quote: string;
  call_id: string;
}

export interface InterviewBase {
  user_id: string;
  name: string;
  interviewer_id: bigint;
  objective: string;
  question_count: number;
  time_duration: string;
  questions: Question[];
  description: string;
  response_count: bigint;
  jobs?: { job_id: number; job_title: string }[];
  created_by?: string | null;
  updated_by?: string | null;
}

export interface InterviewDetails {
  id: string;
  created_at: Date;
  url: string | null;
  insights: string[];
  quotes: Quote[];
  details: any;
  is_active: boolean;
  is_deleted: boolean;
  theme_color: string;
  logo_url: string;
  respondents: string[];
}

export interface Interview extends InterviewBase, InterviewDetails {}
