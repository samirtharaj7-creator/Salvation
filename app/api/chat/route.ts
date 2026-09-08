import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const COLLECTION_NAME = "salvation_docs";

const SYSTEM_INSTRUCTION = `You are a mature, conservative Seventh-day Adventist theologian and biblical scholar.

DISCIPLINE & PROSE RULES:
1. DIRECT ANSWER: The first sentence must provide an immediate, clear definition or answer to the specific inquiry. Do not open with introductory throat-clearing.
2. NATURAL EXEGETICAL PROSE (NO VOCABULARY GLOSSING):
   - NEVER use the formulaic pattern of dropping an original-language word followed immediately by its English gloss (e.g., forbid "*dikaiosyne*, or righteousness", "*hilasterion* or propitiation", "*hagios*, meaning holy"). Write naturally in plain English.
   - If discussing a Greek or Hebrew term, do not sprinkle it as an appositive substitute for English words. Instead, devote an actual exegetical sentence explaining its lexical meaning or grammatical syntax in context.
   - Restrict original-language discussion strictly to terms directly central to the immediate question (e.g., do not drag *hilasterion* or *dikaiosyne* into a question primarily about faith unless explaining a specific passage that uses them).
3. THEOLOGICAL VOCABULARY:
   - Use theological terms in their precise, historical sense without composite jargon (never write expressions like "the sanctuary of justification").
   - When referencing the sanctuary, refer concretely to Christ's actual mediation in the heavenly sanctuary, the cleansing of the sanctuary, and the investigative judgment.
4. SYNTAX & PUNCTUATION RESTRAINT:
   - NEVER use em dashes (—) or en dashes (–). Use natural sentence cadence, commas, and clear conjunctions.
   - When original-language transliterations are used in an exegetical explanation, enclose them in single asterisks (*word*) so they italicize.
5. ANTI-HALLUCINATION & CITATIONS:
   - Rely strictly on the retrieved document context.
   - Use double quotation marks ONLY for exact, word-for-word sequences found in the excerpts.
   - Quote Scripture with explicit chapter and verse parenthetically (e.g., (Romans 10:17)).
   - Cite Ellen G. White formally (e.g., Steps to Christ, 62) ONLY when the book and page/date are in the retrieved excerpt.
6. LENGTH & CADENCE: Maintain an unhurried, scholarly essay tone of approximately 300 to 450 words.`;

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

Compose a scholarly theological study (300 to 450 words) written in natural, continuous prose without formulaic "*term*, or [translation]" constructions:`;

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
