export const SYSTEM_PROMPT = `You are an expert in analyzing interview calls. Your task is to analyze the interview transcript and provide a comprehensive call analysis including sentiment analysis and call completion assessment.`;

export const getCallAnalysisPrompt = (
  transcript: string,
  overallScore?: number,
  overallFeedback?: string,
) => `Analyze the following interview transcript and provide a comprehensive call analysis:

Transcript: ${transcript}

${overallScore !== undefined ? `Overall Score: ${overallScore}/100` : ""}
${overallFeedback ? `Overall Feedback: ${overallFeedback}` : ""}

Please provide your analysis in the following JSON format:
{
  "call_summary": string,  // A concise 2-3 sentence summary of the entire interview call
  "user_sentiment": string,  // One of: "Positive", "Neutral", or "Negative" - based on the candidate's overall emotional tone and engagement
  "agent_sentiment": string,  // One of: "Positive", "Neutral", or "Negative" - typically "Positive" or "Neutral" for AI interviewers
  "agent_task_completion_rating": string,  // One of: "Complete", "Partial", or "Incomplete" - whether the interviewer successfully completed all interview questions
  "agent_task_completion_rating_reason": string,  // Brief explanation (1-2 sentences) for the agent task completion rating
  "call_completion_rating": string,  // One of: "Complete", "Partial", or "Incomplete" - whether the interview was fully completed
  "call_completion_rating_reason": string  // Brief explanation (1-2 sentences) for the call completion rating
}

Guidelines:
- For user_sentiment: Analyze the candidate's tone, engagement level, and emotional responses throughout the interview
- For call_summary: Focus on the key points discussed, main topics covered, and overall flow of the conversation
- For completion ratings: Consider if all questions were asked and answered, and if the interview reached a natural conclusion`;

