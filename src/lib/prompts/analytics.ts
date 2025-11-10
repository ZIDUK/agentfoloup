export const SYSTEM_PROMPT =
  "You are an expert in analyzing interview transcripts. You must only use the main questions provided and not generate or infer additional questions.";

export const getInterviewAnalyticsPrompt = (
  interviewTranscript: string,
  mainInterviewQuestions: string,
) => `Analyse the following interview transcript and provide structured feedback:

###
Transcript: ${interviewTranscript}

Main Interview Questions:
${mainInterviewQuestions}


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

2. Communication Skills: Score (0-10) and Feedback (60 words). Rating system and guidleines for communication skills is as follwing.
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
3. Summary for each main interview question: ${mainInterviewQuestions}
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
   - Pronunciation & Fluency (0-10): Evaluate pronunciation clarity, intonation, rhythm, and speaking rate. Consider hesitations, pauses, and natural flow of speech. Higher scores indicate native-like pronunciation and smooth delivery.
   - Grammar Accuracy (0-10): Assess grammatical correctness, use of tenses, sentence structure, and complexity. Look for errors, self-corrections, and grammatical sophistication.
   - Vocabulary Range (0-10): Evaluate vocabulary diversity, use of appropriate words, idiomatic expressions, and precision in word choice. Consider whether they use basic or advanced vocabulary.
   - Coherence & Relevance (0-10): Assess how well the candidate structures their responses, maintains logical flow, stays on topic, and connects ideas coherently.
   
   CEFR Level Mapping:
   Based on the overall language assessment (average of pronunciation, grammar, vocabulary, and coherence scores), determine the CEFR level:
   - C2 (Proficient): 9.0-10.0 - Can understand with ease virtually everything heard or read. Can express themselves spontaneously, very fluently and precisely, differentiating finer shades of meaning even in more complex situations.
   - C1 (Advanced): 7.5-8.9 - Can understand a wide range of demanding, longer texts, and recognize implicit meaning. Can express ideas fluently and spontaneously without much obvious searching for expressions.
   - B2 (Upper Intermediate): 6.0-7.4 - Can understand the main ideas of complex text on both concrete and abstract topics. Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible.
   - B1 (Intermediate): 4.5-5.9 - Can understand the main points of clear standard input on familiar matters. Can produce simple connected text on topics that are familiar or of personal interest.
   - A2 (Elementary): 3.0-4.4 - Can understand sentences and frequently used expressions related to areas of most immediate relevance. Can communicate in simple and routine tasks requiring a simple and direct exchange of information.
   - A1 (Beginner): 0.0-2.9 - Can understand and use familiar everyday expressions and very basic phrases. Can introduce themselves and ask/answer simple questions.
   
   Output the following for OVERALL assessment:
   - pronunciationScore: number (0-10)
   - fluencyScore: number (0-10) - Combined with pronunciation, evaluate speaking rate, pausing patterns, and natural flow
   - grammarScore: number (0-10)
   - vocabularyScore: number (0-10)
   - coherenceScore: number (0-10)
   - cefrLevel: string (one of: "A1", "A2", "B1", "B2", "C1", "C2")
   - cefrDescription: string (brief description of the level, 20-30 words)
   - ieltsEstimate: string (optional, e.g., "6.5-7.0" if applicable) - Estimate IELTS band score equivalent
   
   Additionally, provide detailed descriptive feedback for each language skill:
   - pronunciationFeedback: string (60-80 words) - Detailed feedback on pronunciation, intonation, clarity, and common errors
   - fluencyFeedback: string (60-80 words) - Detailed feedback on speaking rate, pausing patterns, hesitations, and natural flow
   - vocabularyFeedback: string (60-80 words) - Detailed feedback on vocabulary range, word choice, idiomatic expressions, and appropriateness
   - grammarFeedback: string (60-80 words) - Detailed feedback on grammatical accuracy, sentence structure, complexity, and common errors
   - coherenceFeedback: string (60-80 words) - Detailed feedback on logical flow, organization, topic maintenance, and connection of ideas

Ensure the output is in valid JSON format with the following structure:
{
  "overallScore": number,
  "overallFeedback": string,
  "communication": { "score": number, "feedback": string },
  "questionSummaries": [
    {
      "question": string,
      "summary": string,
      "questionTranscript": string (optional, only if answer found),
      "cefrLevel": string (optional, only if answer found),
      "pronunciationLevel": string (optional, only if answer found),
      "fluencyLevel": string (optional, only if answer found),
      "vocabularyLevel": string (optional, only if answer found),
      "grammarLevel": string (optional, only if answer found),
      "pronunciationFeedback": string (optional, only if answer found),
      "fluencyFeedback": string (optional, only if answer found),
      "vocabularyFeedback": string (optional, only if answer found),
      "grammarFeedback": string (optional, only if answer found)
    }
  ],
  "softSkillSummary": string,
  "averageAnswerLength": number,
  "answerRelevanceScore": number,
  "depthScore": number,
  "consistencyScore": number,
  "confidenceLevel": string,
  "engagementScore": number,
  "problemSolvingScore": number,
  "adaptabilityScore": number,
  "pronunciationScore": number,
  "fluencyScore": number,
  "grammarScore": number,
  "vocabularyScore": number,
  "coherenceScore": number,
  "cefrLevel": string,
  "cefrDescription": string,
  "ieltsEstimate": string,
  "pronunciationFeedback": string,
  "fluencyFeedback": string,
  "vocabularyFeedback": string,
  "grammarFeedback": string,
  "coherenceFeedback": string
}

IMPORTANT: Only use the main questions provided. Do not generate or infer additional questions such as follow-up questions.`;
