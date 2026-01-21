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

export const analyzeParkingSign = async (imageBase64: string): Promise<string> => {
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
            Can I park here right now? (Assume current time is whatever is reasonable or ask me to check, but explain the rules clearly).
            Keep it concise: YES, NO, or CONDITIONAL, followed by a one sentence explanation.`,
          },
        ],
      },
    });
    return response.text || "Could not analyze image.";
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return "Sorry, I couldn't read that sign. Please check your network or API key.";
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