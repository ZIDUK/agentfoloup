import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertToAscii(inputString: string) {
  // remove non ascii characters
  const asciiString = inputString.replace(/[^\x20-\x7F]+/g, "");

  return asciiString;
}

export function formatTimestampToDateHHMM(timestamp: string): string {
  const date = new Date(timestamp);

  // Format date to YYYY-MM-DD
  const datePart =
    date.getDate().toString().padStart(2, "0") +
    "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    date.getFullYear();

  // Format time to HH:MM
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const timePart = `${hours}:${minutes}`;

  return `${datePart} ${timePart}`;
}

export function testEmail(email: string) {
  const re = /\S+@\S+\.\S+/;

  return re.test(email);
}

export function convertSecondstoMMSS(seconds: number) {
  const minutes = Math.trunc(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

export function isLightColor(color: string) {
  const hex = color?.replace("#", "");
  const r = parseInt(hex?.substring(0, 2), 16);
  const g = parseInt(hex?.substring(2, 4), 16);
  const b = parseInt(hex?.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness > 155;
}

/**
 * Calculate CEFR level based on language proficiency scores
 * @param pronunciationScore - Score for pronunciation (0-10)
 * @param fluencyScore - Score for fluency (0-10)
 * @param grammarScore - Score for grammar (0-10)
 * @param vocabularyScore - Score for vocabulary (0-10)
 * @param coherenceScore - Score for coherence (0-10)
 * @returns CEFR level (A1-C2)
 */
export function calculateCEFRLevel(
  pronunciationScore?: number,
  fluencyScore?: number,
  grammarScore?: number,
  vocabularyScore?: number,
  coherenceScore?: number,
): "A1" | "A2" | "B1" | "B2" | "C1" | "C2" {
  const scores = [
    pronunciationScore,
    fluencyScore,
    grammarScore,
    vocabularyScore,
    coherenceScore,
  ].filter((score) => score !== undefined && score !== null) as number[];

  if (scores.length === 0) {
    return "A1";
  }

  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  if (averageScore >= 9.0) return "C2";
  if (averageScore >= 7.5) return "C1";
  if (averageScore >= 6.0) return "B2";
  if (averageScore >= 4.5) return "B1";
  if (averageScore >= 3.0) return "A2";
  return "A1";
}

/**
 * Get CEFR level description
 */
export function getCEFRDescription(
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
): string {
  const descriptions: Record<string, string> = {
    A1: "Can understand and use familiar everyday expressions and very basic phrases. Can introduce themselves and ask/answer simple questions.",
    A2: "Can understand sentences and frequently used expressions related to areas of most immediate relevance. Can communicate in simple and routine tasks.",
    B1: "Can understand the main points of clear standard input on familiar matters. Can produce simple connected text on topics that are familiar or of personal interest.",
    B2: "Can understand the main ideas of complex text on both concrete and abstract topics. Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible.",
    C1: "Can understand a wide range of demanding, longer texts, and recognize implicit meaning. Can express ideas fluently and spontaneously without much obvious searching for expressions.",
    C2: "Can understand with ease virtually everything heard or read. Can express themselves spontaneously, very fluently and precisely, differentiating finer shades of meaning even in more complex situations.",
  };

  return descriptions[level] || descriptions.A1;
}

/**
 * Get color for CEFR level badge (supports levels with +)
 */
export function getCEFRColor(
  level: string,
): string {
  // Normalize level by removing + for color lookup
  const baseLevel = level.replace("+", "") as "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  
  const colors: Record<string, string> = {
    A1: "bg-red-100 text-red-800 border-red-300",
    A2: "bg-orange-100 text-orange-800 border-orange-300",
    B1: "bg-yellow-100 text-yellow-800 border-yellow-300",
    B2: "bg-green-100 text-green-800 border-green-300",
    C1: "bg-blue-100 text-blue-800 border-blue-300",
    C2: "bg-purple-100 text-purple-800 border-purple-300",
  };

  return colors[baseLevel] || colors.A1;
}

/**
 * Estimate IELTS band score from CEFR level
 */
export function estimateIELTSBand(
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
): string {
  const ieltsMapping: Record<string, string> = {
    A1: "1.0-2.0",
    A2: "2.5-3.5",
    B1: "4.0-5.0",
    B2: "5.5-6.5",
    C1: "7.0-8.0",
    C2: "8.5-9.0",
  };

  return ieltsMapping[level] || "N/A";
}
