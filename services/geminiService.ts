import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

// All Gemini calls are proxied through Cloud Functions.
// The API key lives in Secret Manager and never reaches the browser bundle.

const getFns = () => getFunctions(getApp());

export interface SignAnalysisResult {
  status: "YES" | "NO" | "CONDITIONAL" | "ERROR";
  explanation: string;
  restrictionStartsAt?: string | null;
  restrictionEndsAt?: string | null;
  actionableAdvice?: string | null;
}

export const analyzeParkingSign = async (imageBase64: string): Promise<SignAnalysisResult> => {
  try {
    const fn = httpsCallable<{ imageBase64: string }, SignAnalysisResult>(getFns(), "analyzeSign");
    const result = await fn({ imageBase64 });
    return result.data;
  } catch (error: any) {
    console.error("Gemini Vision Error:", error);
    const code = error?.code ?? error?.details?.code ?? "";
    if (code === "resource-exhausted" || code === "failed-precondition" || code === "unavailable" || code === "internal") {
      return {
        status: "ERROR",
        explanation: "Assistant temporarily unavailable\nThe AI service is temporarily unavailable. Please try again shortly.",
      };
    }
    return {
      status: "ERROR",
      explanation: "Couldn't read this sign\nTry taking another photo with the full sign visible and in focus.",
    };
  }
};

export const generateListingDescription = async (features: string[]): Promise<string> => {
  try {
    const fn = httpsCallable<{ features: string[] }, { description: string }>(
      getFns(),
      "generateListingDescription"
    );
    const result = await fn({ features });
    return result.data.description;
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return "Secure parking spot available for rent.";
  }
};

export const generateSmartReplies = async (
  lastMessage: string,
  context: string
): Promise<string[]> => {
  try {
    const fn = httpsCallable<
      { lastMessage: string; context: string },
      { replies: string[] }
    >(getFns(), "generateSmartReplies");
    const result = await fn({ lastMessage, context });
    return result.data.replies;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return ["I'm interested!", "Is it available?", "Thanks!"];
  }
};
