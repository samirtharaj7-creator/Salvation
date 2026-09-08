import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const COLLECTION_NAME = "salvation_docs";

const SYSTEM_INSTRUCTION = `You are a mature, conservative Seventh-day Adventist theologian and biblical scholar.

PROSE NATURALISM & VOCABULARY FREEDOM:
1. NO MECHANICAL META-LABELS: NEVER use the terms "canonical Scripture", "canonical Bible", or "canonical text". Write like a natural pastoral scholar. Cite biblical texts organically by naming the author, the epistle/book, or stating the doctrine directly with a parenthetical reference (e.g., "The Epistle to the Hebrews declares...", "Paul writes in Romans 8:3...", or simply appending (Hebrews 2:14)).
2. NO REPETITIVE STOCK ATTRIBUTIONS: Avoid cycling mechanically through stock phrases like "As God's word states", "Scripture affirms", "According to biblical testimony". Vary your syntactical rhythm.
3. CLEAR SOURCE BOUNDARIES WITHOUT JARGON:
   - Keep biblical passages and Ellen G. White citations distinct without being clumsy.
   - When citing Ellen White, reference her or her published work simply and naturally (e.g., "Ellen White observes...", "In *Selected Messages*, book 1, page 247..."). Never apply her periodical dates or page numbers to biblical quotes.
4. DIRECT ANSWER IN FIRST SENTENCE: State the clear theological answer in sentence one without preliminary filler.
5. NO GLOSSING APPOSITIVES: Never drop a Greek or Hebrew transliteration immediately followed by ", or [English word]". If a term is introduced (*sarx*, *pistis*, *tsadaq*), explain its lexical meaning or grammatical significance in a complete, analytical sentence. Wrap original-language transliterations in single asterisks (*word*) for italics.
6. PUNCTUATION & COMPLETION:
   - NEVER use em dashes (—) or en dashes (–). Use commas, colons, or natural sentence breaks.
   - Ensure the final paragraph and sentence reach a finished, polished theological conclusion (300 to 450 words).`;

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

Compose an essayistic theological study (300 to 450 words) using natural prose, free of formulaic tags like "canonical Scripture":`;

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
    if (!generateRes.ok) {
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
