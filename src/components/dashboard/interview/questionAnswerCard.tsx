import { CardTitle } from "@/components/ui/card";
import { QuestionSummary } from "@/types/response";
import { getCEFRColor } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface QuestionCardProps {
  questionNumber: number;
  question: string;
  answer: string;
  questionSummary?: QuestionSummary;
}

function QuestionAnswerCard({
  questionNumber,
  question,
  answer,
  questionSummary,
}: QuestionCardProps) {
  const hasCEFRData =
    questionSummary?.cefrLevel ||
    questionSummary?.wordsPerMinute !== undefined ||
    questionSummary?.badPauses !== undefined;

  return (
    <>
      <div className="shadow-md mb-2 bg-card rounded-2xl py-2">
        <div className="flex flex-row items-center">
          <CardTitle className="text-lg min-w-[42px] bg-primary/20 rounded-full p-1 mx-3">
            <p className="my-auto text-center">{questionNumber}</p>
          </CardTitle>
          <div className="flex flex-col p-1 flex-1">
            <p className="font-medium">{question}</p>
            <p className="text-sm mt-1">{answer}</p>

            {/* CEFR Analysis per Question */}
            {hasCEFRData && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex flex-row gap-3 items-center mb-2">
                  {questionSummary.cefrLevel && (
                    <div
                      className={`px-2 py-1 rounded border-2 text-xs font-semibold ${getCEFRColor(
                        questionSummary.cefrLevel,
                      )}`}
                    >
                      CEFR: {questionSummary.cefrLevel}
                    </div>
                  )}
                  {questionSummary.wordsPerMinute !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-brand-700">
                        {Math.round(questionSummary.wordsPerMinute)}
                      </span>
                      <span>Words/min</span>
                    </div>
                  )}
                  {questionSummary.badPauses !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-destructive">
                        {questionSummary.badPauses}
                      </span>
                      <span>bad pauses</span>
                    </div>
                  )}
                </div>

                {/* Per-skill CEFR levels */}
                {(questionSummary.pronunciationLevel ||
                  questionSummary.fluencyLevel ||
                  questionSummary.vocabularyLevel ||
                  questionSummary.grammarLevel) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {questionSummary.pronunciationLevel && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          Pronunciation
                        </span>
                        <span
                          className={`text-xs font-semibold ${getCEFRColor(
                            questionSummary.pronunciationLevel,
                          )} px-1 py-0.5 rounded border`}
                        >
                          {questionSummary.pronunciationLevel}
                        </span>
                      </div>
                    )}
                    {questionSummary.fluencyLevel && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Fluency</span>
                        <span
                          className={`text-xs font-semibold ${getCEFRColor(
                            questionSummary.fluencyLevel,
                          )} px-1 py-0.5 rounded border`}
                        >
                          {questionSummary.fluencyLevel}
                        </span>
                      </div>
                    )}
                    {questionSummary.vocabularyLevel && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Vocabulary</span>
                        <span
                          className={`text-xs font-semibold ${getCEFRColor(
                            questionSummary.vocabularyLevel,
                          )} px-1 py-0.5 rounded border`}
                        >
                          {questionSummary.vocabularyLevel}
                        </span>
                      </div>
                    )}
                    {questionSummary.grammarLevel && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Grammar</span>
                        <span
                          className={`text-xs font-semibold ${getCEFRColor(
                            questionSummary.grammarLevel,
                          )} px-1 py-0.5 rounded border`}
                        >
                          {questionSummary.grammarLevel}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Detailed feedback per skill */}
                {(questionSummary.pronunciationFeedback ||
                  questionSummary.fluencyFeedback ||
                  questionSummary.vocabularyFeedback ||
                  questionSummary.grammarFeedback) && (
                  <div className="mt-3 space-y-2">
                    {questionSummary.pronunciationFeedback && (
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">
                          Pronunciation:{" "}
                        </span>
                        <span className="text-muted-foreground">
                          {questionSummary.pronunciationFeedback}
                        </span>
                      </div>
                    )}
                    {questionSummary.fluencyFeedback && (
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">
                          Fluency:{" "}
                        </span>
                        <span className="text-muted-foreground">
                          {questionSummary.fluencyFeedback}
                        </span>
                      </div>
                    )}
                    {questionSummary.vocabularyFeedback && (
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">
                          Vocabulary:{" "}
                        </span>
                        <span className="text-muted-foreground">
                          {questionSummary.vocabularyFeedback}
                        </span>
                      </div>
                    )}
                    {questionSummary.grammarFeedback && (
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">
                          Grammar:{" "}
                        </span>
                        <span className="text-muted-foreground">
                          {questionSummary.grammarFeedback}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Question Transcript */}
                {questionSummary.questionTranscript && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        Transcript:
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-muted text-foreground text-xs max-w-xs">
                            <p>Exact transcript of the candidate's answer</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-xs text-muted-foreground italic bg-muted p-2 rounded">
                      {questionSummary.questionTranscript}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
export default QuestionAnswerCard;
