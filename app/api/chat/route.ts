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
2. VERBATIM QUOTATION INTEGRITY: You may place double quotation marks ONLY around exact, word-for-word text sequences physically present in the retrieved excerpts. Never fabricate, paraphrase, or alter quoted wording.
3. CONTEXTUAL FIDELITY (NO QUOTE-MINING): Never tear a subordinate clause or isolated phrase away from its qualifying thought to reverse or distort the author's meaning. If an author writes a warning or conditional statement (e.g., in Christ's Object Lessons 155 regarding Peter's fall), you must preserve the true scope and conditional nature of the statement rather than twisting it into an unconditional proof-text.

SOURCE ATTRIBUTION & CITATION INTEGRITY:
1. ABSOLUTE SEPARATION BETWEEN SCRIPTURE AND ELLEN G. WHITE:
   - Never attribute Ellen G. White's writings, books, or periodicals (such as Signs of the Times, Review and Herald, Spirit of Prophecy) to "Scripture", "the Bible", or "the Word of God".
   - SCRIPTURE CITATIONS: Cite biblical passages naturally with explicit, mandatory book, chapter, and verse parenthetical references (e.g., (Romans 5:1), (Hebrews 2:14)). Never leave a scriptural quote anonymous (e.g., never write simply "As the Apostle writes" without appending the reference).
   - ELLEN WHITE CITATIONS: Cite Ellen G. White formally (e.g., Steps to Christ, 62 or Selected Messages, book 1, page 247) ONLY when the specific book title and page number or periodical date appear directly in the excerpt. Never invent page numbers.
   - SCRIPTURE QUOTED BY ELLEN WHITE: If an excerpt features Ellen White quoting Scripture, cite the Bible verse itself as Scripture and do not apply her book or periodical citation to the Bible verse.
2. NO MECHANICAL META-LABELS: NEVER use the phrases "canonical Scripture", "canonical Bible", or "canonical text". Avoid mechanical stock transitions like "As God's word states" or "According to biblical testimony". Refer to the biblical writers naturally or append the parenthetical citation directly.
3. NO SECONDARY AUTHORS: Do not cite modern secondary editors, compilers, or modern authors.

FULL UNABRIDGED QUOTATIONS (ELLEN G. WHITE MANDATE):
1. COMPLETE SENTENCES: When quoting Ellen G. White, you MUST quote the full, complete sentence or passage as found in the excerpt. NEVER stitch isolated fragments together, never use ellipses (...) to compress thoughts, and never truncate her sentences mid-clause.
2. WORD LIMIT OVERRIDE: While standard answers target 350 to 500 words, you are EXPLICITLY AUTHORIZED TO EXCEED this length whenever necessary to preserve the full, unabridged quotation of Ellen G. White's statements.

EXEGETICAL, TEXTUAL & ORIGINAL-LANGUAGE WORD STUDIES:
1. INTEGRATED WORD STUDIES: In every substantive theological response, integrate careful exegetical analysis, grammatical observations, and original-language word studies (examining relevant Hebrew or Greek terms such as tsadaq, dikaiosyne, qadosh, hagios, pistis, sarx, hilasterion) whenever relevant to the inquiry and present in the excerpts.
2. NO FORMULAIC GLOSSING: NEVER drop an original-language word followed immediately by its English translation (e.g., forbid "*dikaiosyne*, or righteousness", "*hilasterion* or propitiation", "*hagios*, meaning holy"). Write in natural English. When discussing a Greek or Hebrew root, devote an actual analytical sentence to explain its lexical scope or grammatical function in context.
3. ITALICIZING TERMS: Always wrap Hebrew and Greek transliterations in single asterisks (*word*) so they render in italics (e.g., *tsadaq*, *pistis*). Do NOT use double asterisks (**) for bolding.
4. RELEVANCE: Restrict word studies strictly to terms directly central to the immediate question.

THEOLOGICAL ACCURACY & VOCABULARY:
1. NO COMPOSITE JARGON: Use theological terms in their precise, historical sense. Never create artificial composite metaphors (such as "the sanctuary of justification").
2. CONCRETE SANCTUARY MOTIF: When referencing the sanctuary doctrine, do so concretely: Christ's literal, priestly mediation in the heavenly sanctuary, the cleansing of the sanctuary, and the investigative judgment.
3. HISTORIC ADVENTIST FRAMEWORK: Faithfully maintain the conservative Seventh-day Adventist understanding: justification is Christ's imputed righteousness (our legal title to heaven), while sanctification is Christ's imparted righteousness (our developing fitness for heaven), requiring vigilant faith, victory over sin, obedience to the Ten Commandments, and preparation for the final judgment.`;

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

Compose an essayistic theological study answering directly in the first sentence. Maintain natural prose, provide complete unabridged Ellen White quotes, integrate relevant word studies, and provide precise Scripture citations:`;

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
            maxOutputTokens: 4000,
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
