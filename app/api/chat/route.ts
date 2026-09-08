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
      return NextResponse.json(
        { error: "Configuration error: GEMINI_API_KEY, QDRANT_URL, or QDRANT_API_KEY is missing." },
        { status: 500 }
      );
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const currentQuestion = messages[messages.length - 1].content;

    // 1. Generate query embedding
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
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
      const msg = embedData.error?.message || JSON.stringify(embedData);
      console.error("Embedding API Error:", msg);
      return NextResponse.json(
        { error: `Embedding error (${embedRes.status}): ${msg}` },
        { status: embedRes.status }
      );
    }

    const queryVector = embedData.embedding?.values;
    if (!queryVector) {
      return NextResponse.json(
        { error: "Missing vector values from embedding model response." },
        { status: 500 }
      );
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
          limit: 8,
          with_payload: true,
        }),
      }
    );

    const qdrantData = await qdrantRes.json();
    if (!qdrantRes.ok) {
      const msg = qdrantData.status?.error || JSON.stringify(qdrantData);
      console.error("Qdrant Search Error:", msg);
      return NextResponse.json(
        { error: `Vector search error (${qdrantRes.status}): ${msg}` },
        { status: qdrantRes.status }
      );
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

    const userPrompt = `${historyTranscript ? `Prior Conversation Discourse:\n${historyTranscript}\n\n` : ""}Retrieved Historical & Doctrinal Excerpts:
${context}

Inquiry: ${currentQuestion}

Compose an essayistic theological study (300 to 450 words) answering directly in sentence one. Integrate 1 or 2 complete quotations without quote-stacking, never quote broken fragments from chunk edges, and conclude with a finished synthesizing sentence:`;

    // 3. Generate response via Gemini
    const generateRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 3000,
          },
        }),
      }
    );

    const genData = await generateRes.json();
    if (!generateRes.ok) {
      const msg = genData.error?.message || JSON.stringify(genData);
      console.error("Gemini Generation Error:", msg);
      return NextResponse.json(
        { error: `Gemini API error (${generateRes.status}): ${msg}` },
        { status: generateRes.status }
      );
    }

    let answer = genData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    answer = answer.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, ", ");

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("Chat route catch-block error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error occurred." },
      { status: 500 }
    );
  }
}
