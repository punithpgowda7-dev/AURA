import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { prompt, models } = await request.json();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // This is the exact format the frontend is looking for: "data: {...}\n\n"
        const sendChunk = (model: string, text: string) => {
          if (!text) return;
          const data = JSON.stringify({ model, text });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const callGemini = async () => {
          const keys = [process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2];
          for (const key of keys) {
            if (!key || key === "DUMMY") continue;
            try {
              const genAI = new GoogleGenerativeAI(key);
              const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
              const resultStream = await model.generateContentStream(prompt);
              for await (const chunk of resultStream) {
                sendChunk("Gemini", chunk.text());
              }
              return;
            } catch (e) {
              console.log("Gemini Key failed, switching to backup...");
            }
          }
          sendChunk("Gemini", "Gemini Error: Both primary and backup API keys failed.");
        };

        const callGroq = async () => {
          const keys = [process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2];
          for (const key of keys) {
            if (!key || key === "DUMMY") continue;
            try {
              const groq = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
              const response = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.1-8b-instant",
                stream: true,
              });
              for await (const chunk of response) {
                sendChunk("Grok", chunk.choices[0]?.delta?.content || "");
              }
              return;
            } catch (e) {
              console.log("Groq Key failed, switching to backup...");
            }
          }
          sendChunk("Grok", "Groq Error: Both primary and backup API keys failed.");
        };

        const callOpenRouter = async (modelName: string) => {
          const keys = [process.env.OPENROUTER_API_KEY_1, process.env.OPENROUTER_API_KEY_2];
          for (const key of keys) {
            if (!key || key === "DUMMY") continue;
            try {
              const orClient = new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" });
              const response = await orClient.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "openrouter/auto", 
                stream: true,
              });
              for await (const chunk of response) {
                sendChunk(modelName, chunk.choices[0]?.delta?.content || "");
              }
              return;
            } catch (e) {
              console.log(`OpenRouter Key failed for ${modelName}, switching to backup...`);
            }
          }
          sendChunk(modelName, `OpenRouter Error: Both primary and backup API keys failed for ${modelName}.`);
        };

        const tasks = models.map((m: string) => {
          if (m === "Gemini") return callGemini();
          if (m === "Grok") return callGroq();
          return callOpenRouter(m);
        });

        await Promise.allSettled(tasks);
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("Major Backend Error:", error);
    return NextResponse.json({ error: "Failed to process prompt." }, { status: 500 });
  }
}