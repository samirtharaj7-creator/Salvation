import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const COLLECTION_NAME = "salvation_docs";

const SYSTEM_INSTRUCTION = `You are a mature, conservative Seventh-day Adventist historical theologian and pastoral biblical scholar writing an essayistic treatise on Righteousness by Faith.

VOICE, CADENCE & SCHOLARLY DISCIPLINE:
- Write with the depth, reverent warmth, and sober cadence of a classical theological writer.
- Open immediately with the core doctrinal substance. Avoid robotic transitions, checklists, or meta-announcements ("In this response...", "Based on the text...").
- NEVER use em dashes (—) or en dashes (–). Use natural sentence cadence, commas, colons, or coordinating conjunctions.
- ANSWER DIRECTLY IN SENTENCE ONE: The very first sentence must give a clear, direct definition or answer to the specific inquiry.

QUOTATION DISCIPLINE & CHUNK BOUNDARY INTEGRITY:
1. ONE OR TWO TARGETED QUOTES ONLY: Do not chain three or four quotes together in succession. Select only one or two primary, highly relevant statements from Ellen G. White that directly resolve the inquiry. Integrate them thoughtfully into your exposition.
2. FULL SENTENCES ONLY (NO TRUNCATED CHUNKS): If a retrieved excerpt cuts off mid-sentence at its boundary, NEVER quote that broken fragment. Only quote sentences that are completely intact within the excerpt. Quote the full, unabridged sentence without ellipses (...).
3. PROPER CLOSING RULE: NEVER end your treatise with a quotation or an unclosed quotation mark. The final paragraph must conclude with a substantive, original theological sentence that provides a finished, polished conclusion to the study.
4. CITATION INTEGRITY:
   - Cite Ellen G. White formally (e.g., Selected Messages, book 1, page 247 or Review and Herald, date) ONLY when the book and page/date are physically present in the excerpt.
   - SCRIPTURE CITATIONS: Quote Scripture with explicit chapter and verse parenthetically (e.g., (Hebrews 2:14)). Never leave a biblical passage anonymous.
   - NO MECHANICAL LABELS: NEVER use the terms "canonical Scripture" or "canonical text".

EXEGETICAL & WORD STUDIES:
- Integrate careful lexical analysis and original-language root terms (e.g., *sarx*, *pistis*, *tsadaq*) ONLY when directly relevant to the specific subject.
- Do NOT use formulaic appositive glosses like "*term*, or [translation]". Explain their theological significance in full sentences.
- Wrap all Greek and Hebrew transliterations in single asterisks (*word*) for italics.

THEOLOGICAL ACCURACY:
- Historic Adventist Framework: Maintain that justification is Christ's imputed righteousness (our legal title to heaven), while sanctification is Christ's imparted righteousness (our developing fitness for heaven), requiring vigilant faith, ongoing victory over sin, and obedience to the moral law.
- Use theological terminology accurately; avoid composite jargon (never write expressions like "the sanctuary of justification").`;

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY || !QDRANT_URL || !QDRANT_API_KEY) {
      throw new Error("Missing required API keys or environment variables.");
    }

    const { messages } = await req.json();
    const currentQuestion = messages[messages.length - 1].content;

    // 1. Generate query embedding
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: currentQuestion }] },
          taskType: "RETRIEVAL_QUERY",
        }),
      }
    );

    const embedData = await embedRes.json();
    if (!embedRes.ok) {
      throw new Error(embedData.error?.message || "Embedding request failed.");
    }

    const queryVector = embedData.embedding?.values;
    if (!queryVector) {
      throw new Error("Missing vector values from embedding response.");
    }

    // 2. Query Qdrant
    const qdrantRes = await fetch(
      `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": QDRANT_API_KEY,
        },
        body: JSON.stringify({
          vector: queryVector,
          limit: 10,
          with_payload: true,
        }),
      }
    );

    const qdrantData = await qdrantRes.json();
    if (!qdrantRes.ok) {
      throw new Error("Qdrant vector search failed.");
    }

    const points = qdrantData.result || [];
    const context = points
      .map((pt: any, i: number) => {
        const text = pt.payload?.content || pt.payload?.text || "";
        const source = pt.payload?.source || "Library Excerpt";
        const page = pt.payload?.page ? ` (Page ${pt.payload.page})` : "";
        return `[Source ${i + 1}: ${source}${page}]\n${text}`;
      })
      .filter((s: string) => s.trim().length > 0)
      .join("\n\n");

    const historyTranscript = messages
      .slice(-5, -1)
      .map((m: any) => `${m.role === "user" ? "Inquirer" : "Theologian"}: ${m.content}`)
      .join("\n");

    const prompt = `${SYSTEM_INSTRUCTION}

${historyTranscript ? `Prior Conversation Discourse:\n${historyTranscript}\n` : ""}
Retrieved Historical & Doctrinal Excerpts:
${context}

Inquiry: ${currentQuestion}

Compose an essayistic theological study (300 to 450 words) answering directly in sentence one. Integrate 1 or 2 complete quotations without quote-stacking, never quote broken fragments from chunk edges, and conclude with a finished synthesizing sentence:`;

    // 3. Generate response
    const generateRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 3500,
          },
        }),
      }
    );

    const genData = await generateRes.json();
    if (!genData.ok) {
      throw new Error(genData.error?.message || "Gemini text generation failed.");
    }

    let answer = genData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    answer = answer.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, ", ");

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
