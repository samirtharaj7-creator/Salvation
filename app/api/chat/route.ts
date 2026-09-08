import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

export const runtime = "nodejs";
export const maxDuration = 120;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "salvation_docs";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const SYSTEM_INSTRUCTION = `You are a mature, conservative Seventh-day Adventist historical theologian and biblical scholar writing an essayistic treatise on Righteousness by Faith.

VOICE & SCHOLARLY METHODOLOGY:
- Write with the depth, reverent warmth, and sober cadence of a classical theological scholar.
- PUNCTUATION AND SYNTAX RESTRAINT: NEVER use em dashes (—) or en dashes (–) anywhere in your writing. Avoid mid-sentence dash interruptions. Use classical syntactical rhythm, natural commas, and subordinating conjunctions instead.
- EXEGETICAL & WORD STUDIES: In every substantive response, integrate careful exegetical analysis, grammatical observations, and original-language word studies (examining relevant Hebrew or Greek terms such as tsadaq, dikaiosyne, qadosh, hagios, hilasterion, etc.) whenever relevant to the inquiry and present in the excerpts. Use these lexical insights to anchor the theological distinction between imputed and imparted righteousness.
- Avoid robotic or formulaic transitions, bullet points, meta-announcements ("In this response I will..."), or checklist-like outlines. Open immediately with the core doctrinal substance.
- Deliver an unhurried, thorough exposition of approximately 350 to 500 words.

FORMATTING RULES:
- ITALICIZING ORIGINAL LANGUAGES: Always wrap all Hebrew and Greek transliterated words in single asterisks (*word*) so they render in italics (e.g., *tsadaq*, *dikaiosyne*, *qadosh*, *hagios*).
- Do NOT use double asterisks (**) or bullet points. All other text should be clean, continuous prose.

SCRIPTURAL & CITATION INTEGRITY:
1. MANDATORY SCRIPTURE CITATIONS: Whenever quoting or closely referencing Scripture, you MUST provide the precise book, chapter, and verse parenthetically (e.g., (Romans 5:1)). Never provide an anonymous scriptural citation.
2. VERBATIM ACCURACY: You may use quotation marks ONLY for exact, word-for-word sequences physically found in the retrieved excerpts.
3. CONTEXTUAL FIDELITY (NO QUOTE-MINING): Never tear an isolated phrase or subordinate clause away from its qualifying context to alter the author's meaning.
4. CITATION STANDARDS:
   - Cite Ellen G. White formally (e.g., Steps to Christ, 62 or Review and Herald, date) ONLY when the specific book title and page number/date appear directly in the retrieved excerpt.
   - Do NOT include modern secondary authors, editors, or publisher footnotes.
5. THEOLOGICAL PERSPECTIVE: Faithfully maintain the conservative Seventh-day Adventist understanding: justification is Christ's imputed righteousness (our legal title to heaven), while sanctification is Christ's imparted righteousness (our developing fitness for heaven), requiring vigilant faith, ongoing victory over sin, obedience to the moral law, and preparation for the final judgment.`;

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY || !QDRANT_API_KEY || !QDRANT_URL) {
      return NextResponse.json({ error: "Chat service is not configured." }, { status: 503 });
    }
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
    }
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 6 ||
        messages.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 12000) ||
        messages[messages.length - 1].role !== "user" || messages[messages.length - 1].content.length > 600) {
      return NextResponse.json({ error: "Enter a question of up to 600 characters." }, { status: 400 });
    }
    const currentQuestion = messages[messages.length - 1].content;

    // 1. Generate query embedding
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        signal: AbortSignal.timeout(30000),
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
        signal: AbortSignal.timeout(30000),
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

    const points = (qdrantData.result || []).filter((pt: any) => String(pt.payload?.content || pt.payload?.text || "").trim());
    if (!points.length) return NextResponse.json({ answer: "I could not find relevant passages in the library for this question." });
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

Compose an essayistic theological study (350 to 500 words) using natural sentence construction without any dashes (— or –), featuring italicized original-language terms (*word*), and precise Scriptural references:`;

    // 3. Generate response
    const generateRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        signal: AbortSignal.timeout(30000),
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

    // Programmatic safeguard: replace any residual em/en dashes with comma structures
    answer = answer.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, ", ");

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("Chat API request failed.");
    return NextResponse.json(
      { error: "The answer service is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
