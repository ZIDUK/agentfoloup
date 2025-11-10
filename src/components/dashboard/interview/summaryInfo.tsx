"use client";

import { Interview } from "@/types/interview";
import { Interviewer } from "@/types/interviewer";
import { Response } from "@/types/response";
import React, { useEffect, useState } from "react";
import {
  UserCircleIcon,
  SmileIcon,
  Info,
  TrendingUp,
  Award,
  BarChart3,
  Target,
} from "lucide-react";
import { useInterviewers } from "@/contexts/interviewers.context";
import { PieChart } from "@mui/x-charts/PieChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { CandidateStatus } from "@/lib/enum";
import { convertSecondstoMMSS, getCEFRColor } from "@/lib/utils";
import Image from "next/image";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import DataTable, {
  TableData,
} from "@/components/dashboard/interview/dataTable";
import { ScrollArea } from "@/components/ui/scroll-area";

type SummaryProps = {
  responses: Response[];
  interview: Interview | undefined;
};

function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Info
            className="h-2 w-2 text-[#4F46E5] inline-block ml-0 align-super font-bold"
            strokeWidth={2.5}
          />
        </TooltipTrigger>
        <TooltipContent className="bg-gray-500 text-white font-normal">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SummaryInfo({ responses, interview }: SummaryProps) {
  const { interviewers } = useInterviewers();
  const [interviewer, setInterviewer] = useState<Interviewer>();
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [completedInterviews, setCompletedInterviews] = useState<number>(0);
  const [sentimentCount, setSentimentCount] = useState({
    positive: 0,
    negative: 0,
    neutral: 0,
  });
  const [callCompletion, setCallCompletion] = useState({
    complete: 0,
    incomplete: 0,
    partial: 0,
  });

  const totalResponses = responses.length;

  const [candidateStatusCount, setCandidateStatusCount] = useState({
    [CandidateStatus.NO_STATUS]: 0,
    [CandidateStatus.NOT_SELECTED]: 0,
    [CandidateStatus.POTENTIAL]: 0,
    [CandidateStatus.SELECTED]: 0,
  });

  const [tableData, setTableData] = useState<TableData[]>([]);

  // New metrics state
  const [answerQualityMetrics, setAnswerQualityMetrics] = useState({
    averageAnswerLength: 0,
    averageRelevanceScore: 0,
    averageDepthScore: 0,
    averageConsistencyScore: 0,
  });

  const [advancedAnalysis, setAdvancedAnalysis] = useState({
    confidenceLevels: { High: 0, Medium: 0, Low: 0 },
    averageEngagementScore: 0,
    averageProblemSolvingScore: 0,
    averageAdaptabilityScore: 0,
  });

  const [comparativeMetrics, setComparativeMetrics] = useState({
    scoreDistribution: [] as number[],
    topPerformers: [] as Array<{ name: string; score: number }>,
    averageScore: 0,
    scoreTrends: [] as Array<{ date: string; score: number }>,
    candidatesWithComparison: [] as Array<{
      name: string;
      score: number;
      vsAverage: number;
    }>,
  });

  const [cefrMetrics, setCefrMetrics] = useState({
    levelDistribution: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
    averagePronunciation: 0,
    averageFluency: 0,
    averageGrammar: 0,
    averageVocabulary: 0,
    averageCoherence: 0,
  });

  const prepareTableData = (responses: Response[]): TableData[] => {
    return responses.map((response) => ({
      call_id: response.call_id,
      name: response.name || "Anonymous",
      overallScore: response.analytics?.overallScore || 0,
      communicationScore: response.analytics?.communication?.score || 0,
      callSummary:
        response.analytics?.softSkillSummary ||
        response.details?.call_analysis?.call_summary ||
        "No summary available",
    }));
  };

  useEffect(() => {
    if (!interviewers || !interview) {
      return;
    }
    const interviewer = interviewers.find(
      (interviewer) => interviewer.id === interview.interviewer_id,
    );
    setInterviewer(interviewer);
  }, [interviewers, interview]);

  useEffect(() => {
    if (!responses) {
      return;
    }

    // Generate call_analysis for responses that don't have it but have a transcript
    // This ensures the sentiment chart works even if individual response pages haven't been opened
    const generateMissingCallAnalysis = async () => {
      const responsesNeedingAnalysis = responses.filter(
        (response) =>
          response.is_ended &&
          !response.details?.call_analysis?.user_sentiment &&
          (response.details?.transcript || (response.details as any)?.transcript),
      );

      // Generate analysis for up to 5 responses at a time to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < responsesNeedingAnalysis.length; i += batchSize) {
        const batch = responsesNeedingAnalysis.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (response) => {
            try {
              // Call the get-call API to generate call_analysis
              await fetch("/api/get-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: response.call_id }),
              });
            } catch (error) {
              console.error(
                `Error generating call_analysis for ${response.call_id}:`,
                error,
              );
            }
          }),
        );
      }

      // If we generated any analyses, reload the responses
      if (responsesNeedingAnalysis.length > 0) {
        // Trigger a re-render by updating the responses
        // This will be handled by the parent component refreshing
        window.dispatchEvent(new Event("responses-updated"));
      }
    };

    generateMissingCallAnalysis();

    const sentimentCounter = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    const callCompletionCounter = {
      complete: 0,
      incomplete: 0,
      partial: 0,
    };

    let totalDuration = 0;
    let completedCount = 0;

    const statusCounter = {
      [CandidateStatus.NO_STATUS]: 0,
      [CandidateStatus.NOT_SELECTED]: 0,
      [CandidateStatus.POTENTIAL]: 0,
      [CandidateStatus.SELECTED]: 0,
    };

    // New metrics accumulators
    let totalAnswerLength = 0;
    let answerLengthCount = 0;
    let totalRelevanceScore = 0;
    let totalDepthScore = 0;
    let totalConsistencyScore = 0;
    let totalEngagementScore = 0;
    let totalProblemSolvingScore = 0;
    let totalAdaptabilityScore = 0;
    const confidenceCounter = { High: 0, Medium: 0, Low: 0 };
    const scores: number[] = [];
    const performers: Array<{ name: string; score: number }> = [];
    
    // CEFR metrics accumulators
    const cefrLevelCounter = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    let totalPronunciation = 0;
    let totalFluency = 0;
    let totalGrammar = 0;
    let totalVocabulary = 0;
    let totalCoherence = 0;
    let cefrCount = 0;

    responses.forEach((response) => {
      // Check sentiment from call_analysis (if available from analysis)
      const sentiment = response.details?.call_analysis?.user_sentiment;
      if (sentiment === "Positive") {
        sentimentCounter.positive += 1;
      } else if (sentiment === "Negative") {
        sentimentCounter.negative += 1;
      } else if (sentiment === "Neutral") {
        sentimentCounter.neutral += 1;
      }

      // Check call completion from call_analysis (if available from analysis)
      const callCompletion =
        response.details?.call_analysis?.call_completion_rating;
      if (callCompletion === "Complete") {
        callCompletionCounter.complete += 1;
      } else if (callCompletion === "Incomplete") {
        callCompletionCounter.incomplete += 1;
      } else if (callCompletion === "Partial") {
        callCompletionCounter.partial += 1;
      }

      // For completion rate: use is_ended as the primary indicator
      // A response is considered completed if is_ended is true
      // This works with Deepgram responses that may or may not have call_analysis
      if (response.is_ended) {
        completedCount += 1;
      }

      totalDuration += response.duration || 0;
      if (
        Object.values(CandidateStatus).includes(
          response.candidate_status as CandidateStatus,
        )
      ) {
        statusCounter[response.candidate_status as CandidateStatus]++;
      }

      // Calculate new metrics from analytics
      const analytics = response.analytics;
      if (analytics) {
        // Answer Quality Metrics
        if (analytics.averageAnswerLength) {
          totalAnswerLength += analytics.averageAnswerLength;
          answerLengthCount++;
        }
        if (analytics.answerRelevanceScore !== undefined) {
          totalRelevanceScore += analytics.answerRelevanceScore;
        }
        if (analytics.depthScore !== undefined) {
          totalDepthScore += analytics.depthScore;
        }
        if (analytics.consistencyScore !== undefined) {
          totalConsistencyScore += analytics.consistencyScore;
        }

        // Advanced Analysis
        if (analytics.confidenceLevel) {
          confidenceCounter[analytics.confidenceLevel as "High" | "Medium" | "Low"]++;
        }
        if (analytics.engagementScore !== undefined) {
          totalEngagementScore += analytics.engagementScore;
        }
        if (analytics.problemSolvingScore !== undefined) {
          totalProblemSolvingScore += analytics.problemSolvingScore;
        }
        if (analytics.adaptabilityScore !== undefined) {
          totalAdaptabilityScore += analytics.adaptabilityScore;
        }

        // Comparative Metrics
        if (analytics.overallScore !== undefined) {
          scores.push(analytics.overallScore);
          performers.push({
            name: response.name || "Anonymous",
            score: analytics.overallScore,
          });
        }

        // CEFR Metrics
        if (analytics.cefrLevel) {
          const level = analytics.cefrLevel as "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
          if (cefrLevelCounter[level] !== undefined) {
            cefrLevelCounter[level]++;
          }
        }
        if (analytics.pronunciationScore !== undefined) {
          totalPronunciation += analytics.pronunciationScore;
          cefrCount++;
        }
        if (analytics.fluencyScore !== undefined) {
          totalFluency += analytics.fluencyScore;
        }
        if (analytics.grammarScore !== undefined) {
          totalGrammar += analytics.grammarScore;
        }
        if (analytics.vocabularyScore !== undefined) {
          totalVocabulary += analytics.vocabularyScore;
        }
        if (analytics.coherenceScore !== undefined) {
          totalCoherence += analytics.coherenceScore;
        }
      }
    });

    // Calculate averages for new metrics
    const validResponses = responses.filter((r) => r.analytics).length || 1;
    setAnswerQualityMetrics({
      averageAnswerLength: answerLengthCount > 0 ? Math.round(totalAnswerLength / answerLengthCount) : 0,
      averageRelevanceScore: validResponses > 0 ? Math.round((totalRelevanceScore / validResponses) * 10) / 10 : 0,
      averageDepthScore: validResponses > 0 ? Math.round((totalDepthScore / validResponses) * 10) / 10 : 0,
      averageConsistencyScore: validResponses > 0 ? Math.round((totalConsistencyScore / validResponses) * 10) / 10 : 0,
    });

    setAdvancedAnalysis({
      confidenceLevels: confidenceCounter,
      averageEngagementScore: validResponses > 0 ? Math.round((totalEngagementScore / validResponses) * 10) / 10 : 0,
      averageProblemSolvingScore: validResponses > 0 ? Math.round((totalProblemSolvingScore / validResponses) * 10) / 10 : 0,
      averageAdaptabilityScore: validResponses > 0 ? Math.round((totalAdaptabilityScore / validResponses) * 10) / 10 : 0,
    });

    // Calculate score distribution (histogram with 10 bins: 0-10, 10-20, ..., 90-100)
    const distribution = Array(10).fill(0);
    scores.forEach((score) => {
      const bin = Math.min(Math.floor(score / 10), 9);
      distribution[bin]++;
    });

    // Get top 3 performers
    const topPerformers = performers
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const averageScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;

    // Calculate score trends (group by date)
    const trendsMap = new Map<string, number[]>();
    responses.forEach((response) => {
      if (response.analytics?.overallScore !== undefined && response.created_at) {
        const date = new Date(response.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (!trendsMap.has(date)) {
          trendsMap.set(date, []);
        }
        trendsMap.get(date)!.push(response.analytics.overallScore);
      }
    });
    const scoreTrends = Array.from(trendsMap.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate comparison with average for all candidates
    const candidatesWithComparison = performers.map((performer) => ({
      name: performer.name,
      score: performer.score,
      vsAverage: Math.round((performer.score - averageScore) * 10) / 10,
    }));

    setComparativeMetrics({
      scoreDistribution: distribution,
      topPerformers: topPerformers,
      averageScore: averageScore,
      scoreTrends: scoreTrends,
      candidatesWithComparison: candidatesWithComparison,
    });

    // Calculate CEFR metrics
    setCefrMetrics({
      levelDistribution: cefrLevelCounter,
      averagePronunciation: cefrCount > 0 ? Math.round((totalPronunciation / cefrCount) * 10) / 10 : 0,
      averageFluency: cefrCount > 0 ? Math.round((totalFluency / cefrCount) * 10) / 10 : 0,
      averageGrammar: cefrCount > 0 ? Math.round((totalGrammar / cefrCount) * 10) / 10 : 0,
      averageVocabulary: cefrCount > 0 ? Math.round((totalVocabulary / cefrCount) * 10) / 10 : 0,
      averageCoherence: cefrCount > 0 ? Math.round((totalCoherence / cefrCount) * 10) / 10 : 0,
    });

    setSentimentCount(sentimentCounter);
    setCallCompletion(callCompletionCounter);
    setTotalDuration(totalDuration);
    setCompletedInterviews(completedCount);
    setCandidateStatusCount(statusCounter);

    const preparedData = prepareTableData(responses);
    setTableData(preparedData);
  }, [responses]);

  return (
    <div className="h-screen z-[10] mx-2">
      {responses.length > 0 ? (
        <div className="bg-slate-200 rounded-2xl min-h-[120px] p-2 ">
          <div className="flex flex-row gap-2 justify-between items-center mx-2">
            <div className="flex flex-row gap-2 items-center">
              <p className="font-semibold my-2">Overall Analysis</p>
            </div>
            <p className="text-sm">
              Interviewer used:{" "}
              <span className="font-medium">{interviewer?.name}</span>
            </p>
          </div>
          <p className="my-3 ml-2 text-sm">
            Interview Description:{" "}
            <span className="font-medium">{interview?.description}</span>
          </p>
          <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-4 rounded-2xl bg-slate-50 shadow-md">
            <ScrollArea className="h-[250px]">
              <DataTable data={tableData} interviewId={interview?.id || ""} />
            </ScrollArea>
          </div>
          <div className="flex flex-row gap-1 my-2 justify-center">
            <div className="flex flex-col">
              <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-3 rounded-2xl bg-slate-50 shadow-md max-w-[400px]">
                <div className="flex flex-row items-center justify-center gap-1 font-semibold mb-1 text-[15px]">
                  Average Duration
                  <InfoTooltip content="Average time users took to complete an interview" />
                </div>
                <div className="flex items-center justify-center">
                  <p className="text-2xl font-semibold text-indigo-600 w-fit p-1 px-2 bg-indigo-100 rounded-md">
                    {convertSecondstoMMSS(totalDuration / responses.length)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 mx-2 p-3 rounded-2xl bg-slate-50 shadow-md max-w-[360px]">
                <div className="flex flex-row gap-1 font-semibold mb-1 text-[15px] mx-auto text-center">
                  Interview Completion Rate
                  <InfoTooltip content="Percentage of interviews completed successfully" />
                </div>
                <p className="w-fit text-2xl font-semibold text-indigo-600  p-1 px-2 bg-indigo-100 rounded-md">
                  {Math.round(
                    (completedInterviews / responses.length) * 10000,
                  ) / 100}
                  %
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-4 rounded-2xl bg-slate-50 shadow-md max-w-[360px]">
              <div className="flex flex-row gap-2 text-[15px] font-bold mb-3 mx-auto">
                <SmileIcon />
                Candidate Sentiment
                <InfoTooltip content="Distribution of user sentiments during interviews" />
              </div>
              <PieChart
                sx={{
                  "& .MuiChartsLegend-series text": {
                    fontSize: "0.8rem !important",
                  },
                }}
                series={[
                  {
                    data: [
                      {
                        id: 0,
                        value: sentimentCount.positive,
                        label: `Positive (${sentimentCount.positive})`,
                        color: "#22c55e",
                      },
                      {
                        id: 1,
                        value: sentimentCount.neutral,
                        label: `Neutral (${sentimentCount.neutral})`,
                        color: "#eab308",
                      },
                      {
                        id: 2,
                        value: sentimentCount.negative,
                        label: `Negative (${sentimentCount.negative})`,
                        color: "#eb4444",
                      },
                    ],
                    highlightScope: { faded: "global", highlighted: "item" },
                    faded: {
                      innerRadius: 10,
                      additionalRadius: -10,
                      color: "gray",
                    },
                  },
                ]}
                width={360}
                height={120}
              />
            </div>
            <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-4 rounded-2xl bg-slate-50 shadow-md">
              <div className="flex flex-row gap-2 text-[15px] font-bold mx-auto mb-1">
                <UserCircleIcon />
                Candidate Status
                <InfoTooltip content="Breakdown of the candidate selection status" />
              </div>
              <div className="text-sm text-center mb-1">
                Total Responses: {totalResponses}
              </div>
              <PieChart
                sx={{
                  "& .MuiChartsLegend-series text": {
                    fontSize: "0.8rem !important",
                  },
                }}
                series={[
                  {
                    data: [
                      {
                        id: 0,
                        value: candidateStatusCount[CandidateStatus.SELECTED],
                        label: `Selected (${candidateStatusCount[CandidateStatus.SELECTED]})`,
                        color: "#22c55e",
                      },
                      {
                        id: 1,
                        value: candidateStatusCount[CandidateStatus.POTENTIAL],
                        label: `Potential (${candidateStatusCount[CandidateStatus.POTENTIAL]})`,
                        color: "#eab308",
                      },
                      {
                        id: 2,
                        value:
                          candidateStatusCount[CandidateStatus.NOT_SELECTED],
                        label: `Not Selected (${candidateStatusCount[CandidateStatus.NOT_SELECTED]})`,
                        color: "#eb4444",
                      },
                      {
                        id: 3,
                        value: candidateStatusCount[CandidateStatus.NO_STATUS],
                        label: `No Status (${candidateStatusCount[CandidateStatus.NO_STATUS]})`,
                        color: "#9ca3af",
                      },
                    ],
                    highlightScope: { faded: "global", highlighted: "item" },
                    faded: {
                      innerRadius: 10,
                      additionalRadius: -10,
                      color: "gray",
                    },
                  },
                ]}
                width={360}
                height={120}
                slotProps={{
                  legend: {
                    direction: "column",
                    position: { vertical: "middle", horizontal: "right" },
                    padding: 0,
                    itemMarkWidth: 10,
                    itemMarkHeight: 10,
                    markGap: 5,
                    itemGap: 5,
                  },
                }}
              />
            </div>
          </div>

          {/* Answer Quality Metrics Section */}
          <div className="bg-slate-200 rounded-2xl min-h-[120px] p-4 px-5 my-3">
            <div className="flex flex-row gap-2 items-center mb-4">
              <Target className="h-5 w-5 text-indigo-600" />
              <p className="font-semibold my-2">Answer Quality Metrics</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">
                  Avg Answer Length
                </p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {answerQualityMetrics.averageAnswerLength}
                  <span className="text-sm text-gray-500 ml-1">words</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">
                  Relevance Score
                </p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {answerQualityMetrics.averageRelevanceScore.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">/10</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">Depth Score</p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {answerQualityMetrics.averageDepthScore.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">/10</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">
                  Consistency Score
                </p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {answerQualityMetrics.averageConsistencyScore.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">/10</span>
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Analysis Section */}
          <div className="bg-slate-200 rounded-2xl min-h-[120px] p-4 px-5 my-3">
            <div className="flex flex-row gap-2 items-center mb-4">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <p className="font-semibold my-2">Advanced Analysis</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">
                  Engagement Score
                </p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {advancedAnalysis.averageEngagementScore.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">/10</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">
                  Problem-Solving
                </p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {advancedAnalysis.averageProblemSolvingScore.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">/10</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">
                  Adaptability
                </p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {advancedAnalysis.averageAdaptabilityScore.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">/10</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 shadow-md">
                <p className="text-sm font-medium text-gray-600">
                  Confidence Level
                </p>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-sm">
                      High: {advancedAnalysis.confidenceLevels.High}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="text-sm">
                      Medium: {advancedAnalysis.confidenceLevels.Medium}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="text-sm">
                      Low: {advancedAnalysis.confidenceLevels.Low}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CEFR Language Proficiency Section */}
          {(cefrMetrics.averagePronunciation > 0 ||
            Object.values(cefrMetrics.levelDistribution).some((v) => v > 0)) && (
            <div className="bg-slate-200 rounded-2xl min-h-[120px] p-4 px-5 my-3">
              <div className="flex flex-row gap-2 items-center mb-4">
                <Target className="h-5 w-5 text-indigo-600" />
                <p className="font-semibold my-2">English Language Proficiency (CEFR)</p>
                <InfoTooltip content="Common European Framework of Reference for Languages evaluation based on pronunciation, fluency, grammar, vocabulary, and coherence" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CEFR Level Distribution */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 shadow-md">
                  <div className="flex flex-row gap-2 items-center mb-2">
                    <p className="font-semibold text-[15px]">CEFR Level Distribution</p>
                  </div>
                  {Object.values(cefrMetrics.levelDistribution).some((v) => v > 0) ? (
                    <div className="flex flex-col gap-2">
                      {(["A1", "A2", "B1", "B2", "C1", "C2"] as const).map((level) => {
                        const count = cefrMetrics.levelDistribution[level];
                        if (count === 0) return null;
                        return (
                          <div
                            key={level}
                            className="flex flex-row justify-between items-center p-2 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`px-2 py-1 rounded border-2 text-xs font-semibold ${getCEFRColor(
                                  level,
                                )}`}
                              >
                                {level}
                              </div>
                              <span className="text-sm text-gray-600">
                                {level === "A1"
                                  ? "Beginner"
                                  : level === "A2"
                                    ? "Elementary"
                                    : level === "B1"
                                      ? "Intermediate"
                                      : level === "B2"
                                        ? "Upper Intermediate"
                                        : level === "C1"
                                          ? "Advanced"
                                          : "Proficient"}
                              </span>
                            </div>
                            <span className="font-semibold text-indigo-600">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No CEFR data available
                    </p>
                  )}
                </div>

                {/* Language Skills Scores */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 shadow-md">
                  <div className="flex flex-row gap-2 items-center mb-2">
                    <p className="font-semibold text-[15px]">Average Language Skills</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {cefrMetrics.averagePronunciation > 0 && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600">Pronunciation</span>
                        <span className="font-semibold text-indigo-600 text-lg">
                          {cefrMetrics.averagePronunciation.toFixed(1)}/10
                        </span>
                      </div>
                    )}
                    {cefrMetrics.averageFluency > 0 && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600">Fluency</span>
                        <span className="font-semibold text-indigo-600 text-lg">
                          {cefrMetrics.averageFluency.toFixed(1)}/10
                        </span>
                      </div>
                    )}
                    {cefrMetrics.averageGrammar > 0 && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600">Grammar</span>
                        <span className="font-semibold text-indigo-600 text-lg">
                          {cefrMetrics.averageGrammar.toFixed(1)}/10
                        </span>
                      </div>
                    )}
                    {cefrMetrics.averageVocabulary > 0 && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600">Vocabulary</span>
                        <span className="font-semibold text-indigo-600 text-lg">
                          {cefrMetrics.averageVocabulary.toFixed(1)}/10
                        </span>
                      </div>
                    )}
                    {cefrMetrics.averageCoherence > 0 && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600">Coherence</span>
                        <span className="font-semibold text-indigo-600 text-lg">
                          {cefrMetrics.averageCoherence.toFixed(1)}/10
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparative Metrics Section */}
          <div className="bg-slate-200 rounded-2xl min-h-[120px] p-4 px-5 my-3">
            <div className="flex flex-row gap-2 items-center mb-4">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <p className="font-semibold my-2">Comparative Metrics</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Score Distribution */}
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 shadow-md">
                <div className="flex flex-row gap-2 items-center mb-2">
                  <p className="font-semibold text-[15px]">Score Distribution</p>
                  <InfoTooltip content="Distribution of overall scores across all candidates" />
                </div>
                {comparativeMetrics.scoreDistribution.length > 0 &&
                comparativeMetrics.scoreDistribution.some((v) => v > 0) ? (
                  <BarChart
                    xAxis={[
                      {
                        scaleType: "band",
                        data: [
                          "0-10",
                          "10-20",
                          "20-30",
                          "30-40",
                          "40-50",
                          "50-60",
                          "60-70",
                          "70-80",
                          "80-90",
                          "90-100",
                        ],
                      },
                    ]}
                    series={[
                      {
                        data: comparativeMetrics.scoreDistribution,
                        color: "#4F46E5",
                      },
                    ]}
                    width={400}
                    height={200}
                  />
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No score data available
                  </p>
                )}
              </div>

              {/* Top Performers & Average */}
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 shadow-md">
                <div className="flex flex-row gap-2 items-center mb-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                  <p className="font-semibold text-[15px]">Top Performers</p>
                  <InfoTooltip content="Top 3 candidates by overall score" />
                </div>
                {comparativeMetrics.topPerformers.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {comparativeMetrics.topPerformers.map((performer, index) => (
                      <div
                        key={index}
                        className="flex flex-row justify-between items-center p-2 rounded-lg bg-indigo-50"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold ${
                              index === 0
                                ? "bg-yellow-500"
                                : index === 1
                                  ? "bg-gray-400"
                                  : "bg-orange-600"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <span className="font-medium">
                            {performer.name}
                          </span>
                        </div>
                        <span className="font-semibold text-indigo-600">
                          {performer.score}/100
                        </span>
                      </div>
                    ))}
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex flex-row justify-between items-center">
                        <span className="font-medium text-gray-600">
                          Average Score
                        </span>
                        <span className="font-semibold text-indigo-600 text-lg">
                          {comparativeMetrics.averageScore.toFixed(1)}/100
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No performance data available
                  </p>
                )}
              </div>
            </div>

            {/* Score Trends and Comparison with Average */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Score Trends */}
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 shadow-md">
                <div className="flex flex-row gap-2 items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  <p className="font-semibold text-[15px]">Score Trends</p>
                  <InfoTooltip content="Average score trends over time" />
                </div>
                {comparativeMetrics.scoreTrends.length > 0 ? (
                  <LineChart
                    xAxis={[
                      {
                        data: comparativeMetrics.scoreTrends.map((t) => t.date),
                        scaleType: "point",
                      },
                    ]}
                    series={[
                      {
                        data: comparativeMetrics.scoreTrends.map((t) => t.score),
                        color: "#4F46E5",
                        label: "Average Score",
                      },
                      {
                        data: Array(comparativeMetrics.scoreTrends.length).fill(
                          comparativeMetrics.averageScore,
                        ),
                        color: "#9ca3af",
                        label: "Overall Average",
                        strokeDasharray: "5 5",
                      },
                    ]}
                    width={400}
                    height={200}
                  />
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No trend data available
                  </p>
                )}
              </div>

              {/* Comparison with Average */}
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 shadow-md">
                <div className="flex flex-row gap-2 items-center mb-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <p className="font-semibold text-[15px]">
                    Comparison with Average
                  </p>
                  <InfoTooltip content="How each candidate compares to the average score" />
                </div>
                {comparativeMetrics.candidatesWithComparison.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="flex flex-col gap-2">
                      {comparativeMetrics.candidatesWithComparison
                        .sort((a, b) => b.score - a.score)
                        .map((candidate, index) => (
                          <div
                            key={index}
                            className="flex flex-row justify-between items-center p-2 rounded-lg bg-slate-100"
                          >
                            <span className="font-medium text-sm">
                              {candidate.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-indigo-600 text-sm">
                                {candidate.score}/100
                              </span>
                              <span
                                className={`text-sm font-medium ${
                                  candidate.vsAverage > 0
                                    ? "text-green-600"
                                    : candidate.vsAverage < 0
                                      ? "text-red-600"
                                      : "text-gray-600"
                                }`}
                              >
                                {candidate.vsAverage > 0 ? "+" : ""}
                                {candidate.vsAverage.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No comparison data available
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-[85%] h-[60%] flex flex-col items-center justify-center">
          <div className="flex flex-col items-center">
            <Image
              src="/no-responses.png"
              alt="logo"
              width={270}
              height={270}
            />
            <p className="text-center text-sm mt-0">
              Please share with your intended respondents
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SummaryInfo;
