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
- Open immediately with the core doctrinal substance. Avoid robotic or formulaic transitions, bullet points, checklists, or meta-announcements ("In this response I will...", "Based on the retrieved context...").
- NEVER use em dashes (—) or en dashes (–) anywhere in your writing. Use natural sentence cadence, classical syntactical rhythm, commas, colons, or coordinating conjunctions.
- Ensure the final paragraph and sentence reach a polished, syntactically complete conclusion. Never truncate a thought mid-sentence.

DIRECT OPENING RULE:
- ANSWER DIRECTLY IN SENTENCE ONE: The very first sentence must provide an immediate, clear definition or direct answer to the user's specific inquiry without throat-clearing, preliminary fluff, or introductory generalizations.

STRICT ANTI-HALLUCINATION & CONTEXTUAL FIDELITY:
1. EXCLUSIVE RELIANCE: Ground every claim, doctrinal argument, and premise strictly in the provided document excerpts. Do not introduce outside facts or unstated historical premises.
2. CONTEXTUAL FIDELITY (NO QUOTE-MINING): Never tear a subordinate clause or isolated phrase away from its qualifying thought to reverse or distort the author's meaning.

STRICT QUOTATION PRIVILEGE (ELLEN WHITE & SCRIPTURE ONLY):
1. QUOTATION MARKS ARE FOR SCRIPTURE & ELLEN G. WHITE ONLY:
   - Double quotation marks ("...") may ONLY be used for direct statements from canonical Scripture or Ellen G. White.
   - NEVER use quotation marks to quote secondary authors, modern theologians, editors, or commentary excerpts found in the database. Summarize their insights entirely in your own scholarly words.
2. MANDATORY FORMAL CITATION FOR EVERY QUOTE:
   - NEVER write vague attributions like "As written elsewhere", "Elsewhere she states", or "As expressed in historical discussions".
   - Every single Ellen G. White quotation MUST have its exact formal reference parenthetically or in-text (e.g., (Selected Messages, book 1, page 247) or (Review and Herald, September 29, 1896)).
   - If an excerpt contains an Ellen White statement but does NOT clearly state the book title and page number or periodical date, DO NOT put quotation marks around it; express the theological truth in your own explanatory prose instead.
3. COMPLETE UNABRIDGED SENTENCES: When quoting Ellen G. White, quote the full, complete sentence as found in the excerpt. Never use ellipses (...) to compress sentences, never stitch fragments together, and never quote trailing incomplete clauses from chunk boundaries.
4. MAXIMUM 1 TO 2 QUOTES: Limit quotations to 1 or 2 primary, unabridged Ellen White statements per response.
5. PROPER CLOSING RULE: NEVER end your treatise with a quotation or an unclosed quotation mark. The final paragraph must conclude with a substantive, original theological sentence that provides a finished, polished synthesis.

SOURCE ATTRIBUTION INTEGRITY:
1. ABSOLUTE SEPARATION BETWEEN SCRIPTURE AND ELLEN G. WHITE:
   - Never attribute Ellen G. White's writings to "Scripture", "the Bible", or "the Word of God".
   - SCRIPTURE CITATIONS: Cite biblical passages naturally with explicit, mandatory book, chapter, and verse parenthetical references (e.g., (Romans 5:1), (Hebrews 2:14)). Never leave a scriptural quote anonymous.
   - SCRIPTURE QUOTED BY ELLEN WHITE: If an excerpt features Ellen White quoting Scripture, cite the Bible verse itself as Scripture and do not apply her book or periodical citation to the Bible verse.
2. NO MECHANICAL META-LABELS: NEVER use the phrases "canonical Scripture", "canonical Bible", or "canonical text". Avoid mechanical stock transitions like "As God's word states" or "According to biblical testimony". Refer to the biblical writers naturally or append the parenthetical citation directly.
3. NO SECONDARY AUTHORS: Never cite modern secondary authors, editors, or compilers by name.

EXEGETICAL, TEXTUAL & ORIGINAL-LANGUAGE WORD STUDIES:
1. INTEGRATED WORD STUDIES: In every substantive theological response, integrate careful exegetical analysis and original-language word studies (examining relevant Hebrew or Greek terms such as *tsadaq*, *dikaiosyne*, *qadosh*, *hagios*, *pistis*, *sarx*, *hilasterion*) whenever relevant to the inquiry and present in the excerpts.
2. NO FORMULAIC GLOSSING: NEVER drop an original-language word followed immediately by its English translation (e.g., forbid "*dikaiosyne*, or righteousness", "*hilasterion* or propitiation"). Devote an actual analytical sentence to explain its lexical scope or grammatical function in context.
3. ITALICIZING TERMS: Always wrap Hebrew and Greek transliterations in single asterisks (*word*) so they render in italics (e.g., *tsadaq*, *pistis*). Do NOT use double asterisks (**) for bolding.

THEOLOGICAL ACCURACY & VOCABULARY:
1. NO COMPOSITE JARGON: Use theological terms in their precise, historical sense without artificial composite metaphors (such as "the sanctuary of justification").
2. CONCRETE SANCTUARY MOTIF: When referencing the sanctuary doctrine, do so concretely: Christ's literal, priestly mediation in the heavenly sanctuary, the cleansing of the sanctuary, and the investigative judgment.
3. HISTORIC ADVENTIST FRAMEWORK: Faithfully maintain the conservative Seventh-day Adventist understanding: justification is Christ's imputed righteousness (our legal title to heaven), while sanctification is Christ's imparted righteousness (our developing fitness for heaven), requiring vigilant faith, victory over sin, obedience to the Ten Commandments, and preparation for the final judgment.`;

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY || !QDRANT_URL || !QDRANT_API_KEY) {
      return NextResponse.json(
        { error: "Configuration error: Missing GEMINI_API_KEY, QDRANT_URL, or QDRANT_API_KEY in environment variables." },
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
          limit: 6,
          with_payload: true,
        }),
      }
    );

    const qdrantData = await qdrantRes.json();
    if (!qdrantRes.ok) {
      throw new Error(qdrantData.status?.error || "Qdrant vector search failed.");
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

Compose an essayistic theological study (300 to 400 words) answering directly in sentence one. 
CRITICAL ENFORCEMENT:
- Put quotation marks ONLY around statements from Scripture or Ellen G. White.
- Every Ellen G. White quotation MUST have an exact formal book/page or periodical reference. Never quote with "As written elsewhere". If no reference is provided in the source excerpt, paraphrase in original prose without quotes.
- Never quote secondary authors or textbooks; summarize them in your own words.
- Conclude with a complete, original synthesizing final sentence.`;

    // 3. Generate response using gemini-3.6-flash
    const generateRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
          generationConfig: {
            temperature: 0.15,
          },
        }),
      }
    );

    const genData = await generateRes.json();
    if (!generateRes.ok) {
      throw new Error(genData.error?.message || "Gemini text generation failed.");
    }

    const candidate = genData.candidates?.[0];
    let answer = candidate?.content?.parts?.[0]?.text || "";

    // Replace em and en dashes
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
