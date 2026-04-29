import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

// 1. GEMINI HANDLER (2 Keys)
async function callGemini(prompt: string) {
  const keys = [process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2];
  for (const key of keys) {
    if (!key || key === "DUMMY") continue;
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      console.log(`Gemini Key failed, switching to backup...`);
    }
  }
  return "Gemini Error: Both primary and backup API keys failed.";
}

// 2. GROQ HANDLER (2 Keys)
async function callGroq(prompt: string) {
  const keys = [process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2];
  for (const key of keys) {
    if (!key || key === "DUMMY") continue;
    try {
      const groq = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
      const response = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
      });
      return response.choices[0]?.message?.content || "No response";
    } catch (e) {
      console.log(`Groq Key failed, switching to backup...`);
    }
  }
  return "Groq Error: Both primary and backup API keys failed.";
}

// 3. OPENROUTER HANDLER (2 Keys)
async function callOpenRouter(prompt: string, modelName: string) {
  const keys = [process.env.OPENROUTER_API_KEY_1, process.env.OPENROUTER_API_KEY_2];
  for (const key of keys) {
    if (!key || key === "DUMMY") continue;
    try {
      const orClient = new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" });
      const response = await orClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: modelName,
      });
      return response.choices[0]?.message?.content || "No response";
    } catch (e) {
      console.log(`OpenRouter Key failed, switching to backup...`);
    }
  }
  return `OpenRouter Error: Both primary and backup API keys failed for ${modelName}.`;
}

export async function POST(request: Request) {
  try {
    const { prompt, models } = await request.json();

    const promises = models.map((modelName: string) => {
      if (modelName === "Gemini") return callGemini(prompt);
      if (modelName === "Grok") return callGroq(prompt);
      
      if (modelName === "Perplexity") return callOpenRouter(prompt, "openrouter/auto");
      if (modelName === "ChatGPT") return callOpenRouter(prompt, "openrouter/auto");
      if (modelName === "Claude") return callOpenRouter(prompt, "openrouter/auto");
      if (modelName === "DeepSeek") return callOpenRouter(prompt, "openrouter/auto");
      
      return Promise.resolve("Model not recognized.");
    });

    const resultsArray = await Promise.all(promises);

    const finalResponse: Record<string, string> = {};
    models.forEach((modelName: string, index: number) => {
      finalResponse[modelName] = resultsArray[index];
    });

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error("Major Backend Error:", error);
    return NextResponse.json({ error: "Failed to process prompt." }, { status: 500 });
  }
}