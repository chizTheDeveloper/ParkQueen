import { GoogleGenAI } from "@google/genai";

// Helper to get the AI instance lazily.
// This prevents the app from crashing on startup if the API key is missing.
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key is missing. AI features will not work.");
  }
  // We initialize here so the error (if any) happens during the function call, not app load.
  return new GoogleGenAI({ apiKey: apiKey || "MISSING_KEY" });
};

export interface SignAnalysisResult {
  status: "YES" | "NO" | "CONDITIONAL" | "ERROR";
  explanation: string;
  restrictionStartsAt?: string | null;
  restrictionEndsAt?: string | null;
  actionableAdvice?: string | null;
}

export const analyzeParkingSign = async (imageBase64: string): Promise<SignAnalysisResult> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: `You are a NYC parking expert. Analyze this parking sign image. 
            Crucially, there may be MULTIPLE stacked signs on this pole. Read all of them carefully. Resolve any conflicting rules (e.g. temporary construction signs override permanent signs).
            Respond strictly in JSON format with the following structure:
            {
              "status": "YES", "NO", or "CONDITIONAL",
              "explanation": "A one sentence explanation of the rules.",
              "restrictionStartsAt": "ISO timestamp or null if unknown/not applicable",
              "restrictionEndsAt": "ISO timestamp or null if unknown/not applicable",
              "actionableAdvice": "Short advice, e.g., 'Move car by 4 PM'"
            }
            Do not include Markdown formatting like \`\`\`json. Just output the raw JSON object.`,
          },
        ],
      },
    });
    
    const text = response.text || "{}";
    try {
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      return parsed as SignAnalysisResult;
    } catch (e) {
      return {
        status: "ERROR",
        explanation: "I couldn't read this sign clearly. Try a sharper photo with the full sign visible.",
      };
    }
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return {
      status: "ERROR",
      explanation: "ParQueen Assistant is having trouble right now. Please try again."
    };
  }
};

export const generateListingDescription = async (features: string[]): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a catchy, short marketing description (max 2 sentences) for a parking spot in NYC with these features: ${features.join(', ')}. Use a premium, trustworthy tone.`,
    });
    return response.text || "A great parking spot in the heart of the city.";
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return "Secure parking spot available for rent.";
  }
};

export const generateSmartReplies = async (lastMessage: string, context: string): Promise<string[]> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an AI assistant in a parking app called ParQueen. 
      The user just received this message: "${lastMessage}". 
      Context: ${context}.
      Generate 3 short, natural, polite responses (max 5 words each) that the user might want to send back. 
      Return them as a comma-separated list.`,
    });
    const text = response.text || "";
    return text.split(',').map(s => s.trim()).slice(0, 3);
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return ["I'm interested!", "Is it available?", "Thanks!"];
  }
};