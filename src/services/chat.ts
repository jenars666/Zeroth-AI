import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const chatWithGemini = async (message: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: message
  });
  return response.text || "No response generated.";
};

export const fastResponse = async (message: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: message,
  });
  return response.text || "No response generated.";
};

export const searchWithGemini = async (message: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: message,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  
  let text = response.text || "No response generated.";
  
  // Append grounding links if available
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks && chunks.length > 0) {
    text += "\n\n**Sources:**\n";
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri && chunk.web?.title) {
        text += `- [${chunk.web.title}](${chunk.web.uri})\n`;
      }
    });
  }
  
  return text;
};

export const analyzeImage = async (base64Image: string, mimeType: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Analyze this image in detail. What do you see? If it contains code, explain what it does.",
        },
      ],
    }
  });
  return response.text || "Could not analyze the image.";
};
