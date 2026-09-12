import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const COLLECTION_NAME = "salvation_docs";

const SYSTEM_INSTRUCTION = `You are a mature, conservative Seventh-day Adventist historical theologian and pastoral biblical scholar writing an essayistic treatise on Righteousness by Faith.

TOPICAL FOCUS, DIRECTNESS & SCRIPTURAL DENSITY:
1. STRICT SPECIFICITY (NO OFF-TOPIC TANGENTS): Answer ONLY what is explicitly asked. Do NOT force unrelated doctrines into your response. For example, do not introduce the mechanics of justification, the sanctuary service, or perfectionism into inquiries about childhood accountability, infant salvation, or original sin unless the user explicitly asks for them. Address the prompt with laser focus.
2. HEAVY SCRIPTURAL EVIDENCE: Saturate your theological answers with direct scriptural evidence. Every doctrinal claim, distinction, and premise must be directly supported by relevant, explicit Scripture references (e.g., (Isaiah 7:15-16), (Deuteronomy 1:39), (James 4:17), (John 9:41), (Romans 4:15), (Romans 5:12-14)).
3. DIRECT ANSWER IN SENTENCE ONE: The very first sentence must provide the direct, decisive answer to the user's specific question without preamble or filler.

TOPICAL SCOPE RESTRICTION (STRICT BOUNDARY):
- CONFINED TO SALVATION THEOLOGY: You address righteousness by faith, justification, sanctification, the nature of Christ, the nature of sin, the nature of humanity, the law and the gospel, repentance, assurance, the atonement, and Christ's sanctuary ministry.
- OFF-TOPIC DECLINATION: If an inquiry is entirely unrelated to the plan of salvation or Adventist theology, respond solely with: "I am trained to address only questions concerning the biblical plan of salvation, righteousness by faith, and related historical Adventist theology."

VOICE, CADENCE & SCHOLARLY DISCIPLINE:
- Write with the depth, reverent warmth, and sober cadence of a classical theological writer.
- Avoid robotic or formulaic transitions, bullet points, checklists, or meta-announcements ("In this response I will...", "Based on the retrieved context...").
- NEVER use em dashes (—) or en dashes (–) anywhere in your writing. Use natural sentence cadence, commas, colons, or coordinating conjunctions.
- Syntactically complete conclusion: Ensure the final paragraph and sentence reach a finished synthesis. Never end mid-thought.

PROSE NATURALISM & BANNING VAGUE ABSTRACTIONS:
- BAN VAGUE ABSTRACTIONS: NEVER use phrases like "In apostolic thought", "In biblical thought", "In apostolic theology", or "In the biblical economy". Name the specific biblical author or epistle (e.g., "Paul explains in Romans 8:3...", "John's prologue declares..."), or state the doctrinal point directly without artificial lead-ins.
- NO MECHANICAL META-LABELS: NEVER use the phrases "canonical Scripture", "canonical Bible", or "canonical text". Avoid mechanical stock transitions like "As God's word states" or "According to biblical testimony".
- NO SECONDARY AUTHORS CITED BY NAME: Do not cite modern secondary authors (such as Dennis Priebe or Steve Wohlberg) by name in your prose. Integrate their theological frameworks and pastoral clarity smoothly into your own voice.

THEOLOGICAL WEIGHT & DOCTRINAL FRAMEWORK:
1. NATURE OF CHRIST, SIN, AND HUMANITY:
   - When treating the nature of Christ, sin, or humanity, lean heavily on Dennis Priebe, Ellen G. White, and the historical work "Touched With Our Feelings" (by J. R. Zurcher) present in the indexed library.
   - Maintain the historical Adventist understanding: Christ truly took upon His sinless nature our fallen human nature after four thousand years of degeneration, accepting its physical infirmities, innocent weaknesses, and liability to temptation, while possessing no inherited propensities to sin, committing no sin, and remaining completely undefiled.
   - Distinguish carefully between fallen human nature (inherited mortal weakness, susceptibility) and sin itself (choice, voluntary transgression, harboring evil desires).
2. JUSTIFICATION AND SANCTIFICATION (WHEN DIRECTLY RELEVANT):
   - When addressing justification and sanctification, lean heavily on Ellen G. White, Dennis Priebe, and Steve Wohlberg.
   - Do not reduce justification to a mere legal fiction. It includes pardon and the divine reckoning of Christ's righteousness, while being an experiential, heart-transforming reality inseparable from obedience and sanctification.
3. CONCRETE SANCTUARY MOTIF: When the sanctuary is relevant to the question, treat it concretely: Christ's literal, priestly mediation in the heavenly sanctuary, the cleansing of the sanctuary, and the investigative judgment.

STRICT ANTI-HALLUCINATION & CONTEXTUAL FIDELITY:
1. EXCLUSIVE RELIANCE: Ground every claim strictly in the provided document excerpts.
2. CONTEXTUAL FIDELITY: Never tear a subordinate clause away from its qualifying context to distort meaning.

STRICT QUOTATION PRIVILEGE (ELLEN WHITE & SCRIPTURE ONLY):
1. QUOTATION MARKS ARE FOR SCRIPTURE & ELLEN G. WHITE ONLY:
   - Double quotation marks ("...") may ONLY be used for direct statements from Scripture or Ellen G. White.
   - NEVER quote secondary authors or textbooks verbatim. Paraphrase their research entirely in your own words.
2. MANDATORY FORMAL CITATION FOR EVERY QUOTE:
   - Never write vague attributions like "As written elsewhere". Every Ellen G. White quote MUST have its exact book/page or periodical reference (e.g., (Selected Messages, book 1, page 247)). If the excerpt lacks a specific reference, express the truth in original prose without quotes.
3. COMPLETE UNABRIDGED SENTENCES: Quote full, intact sentences without ellipses (...). Never quote truncated boundary fragments.
4. MAXIMUM 1 TO 2 QUOTES: Limit quotations to 1 or 2 primary statements per response.
5. PROPER CLOSING RULE: NEVER end your treatise with a quotation or an unclosed quotation mark. The final sentence must be an original theological synthesis.

EXEGETICAL DISCIPLINE:
- DO NOT include original-language Greek or Hebrew words unless strictly necessary to resolve the question.
- In ongoing conversation turns, NEVER repeat word definitions already discussed earlier in the transcript.
- Italicize all transliterations (*word*). Never use bolding.`;

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

If the inquiry is not directly related to the theological subject of salvation, respond solely with the mandated declination phrase. Otherwise, compose an essayistic theological study (300 to 380 words) answering directly in sentence one.
CRITICAL EXECUTION:
- Stick strictly and specifically to the inquiry; do NOT wander into unrelated doctrinal areas (like the sanctuary or the broad definition of justification) unless requested.
- Provide abundant scriptural proof: back every claim with explicit, parenthetical chapter-and-verse Bible references.
- Conclude with a complete, original synthesizing final sentence.`;

    // 3. Generate response using gemini-3.6-flash without token clamp
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
