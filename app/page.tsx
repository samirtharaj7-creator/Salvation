"use client";

import React, { useState, useRef } from "react";

interface Passage {
  n: number;
  citation: string;
  excerpt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "If I'm saved by faith alone, why does obedience matter?",
  "What is the difference between justification and sanctification?",
  "How can I know I'm accepted by God?",
  "Is faith itself a kind of work?",
];

// Formats inline markdown (*italic* and **bold**) into real styled React elements
function formatInlineText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} style={{ color: "var(--gold-lit)", fontWeight: 600 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} style={{ fontStyle: "italic", color: "var(--gold-lit)" }}>
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [flashedSource, setFlashedSource] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const ask = async (promptQuestion: string) => {
    const q = promptQuestion.trim();
    if (busy || !q) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: q }];
    setBusy(true);
    setMessages(nextMessages);
    setQuestion("");
    setPassages([]);
    setStatus("Searching the library");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-6),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setMessages([...nextMessages, { role: "assistant", content: errorData.error || "Something went wrong. Try again." }]);
      } else {
        const data = await res.json();
        setMessages([...nextMessages, { role: "assistant", content: data.answer || "No response received." }]);
      }
    } catch (e) {
      setMessages([...nextMessages, { role: "assistant", content: "The companion could not be reached. Check your connection and try again." }]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <>
      <style>{`
        :root {
          --night:#121a28; --night-deep:#0d1420; --well:#16202f;
          --vellum:#ede4d3; --vellum-dim:#b9c0ce; --slate:#7e8aa2; --slate-dim:#5b6679;
          --gold:#c9a24a; --gold-lit:#e3c278; --rubric:#b4544a;
          --rule:#26324a; --rule-soft:#1d2739;
          --display:"Cormorant Garamond",Garamond,"Times New Roman",serif;
          --text:"EB Garamond",Garamond,"Times New Roman",serif;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0; min-height: 100vh; background: var(--night); color: var(--vellum);
          font-family: var(--text); font-size: 18px; line-height: 1.65;
          -webkit-font-smoothing: antialiased;
        }
        .page { width: min(1440px, 100%); margin: 0 auto; padding: 56px 26px 70px; position: relative; }
        .page::before {
          content: ""; position: absolute; inset: 0 0 auto 0; height: 420px; pointer-events: none;
          background: radial-gradient(ellipse 44% 100% at 50% 6%, rgba(201,162,74,.13), transparent 70%);
        }
        .page-head { position: relative; text-align: center; margin-bottom: 34px; }
        .page-head h1 {
          margin: 0; font-family: var(--display); font-weight: 300;
          font-size: clamp(40px, 6vw, 62px); line-height: 1.05; letter-spacing: -.022em; text-wrap: balance;
        }
        .page-head p { margin: 14px 0 0; font-size: 18.5px; font-style: italic; color: var(--slate); }

        .ask {
          position: relative; display: flex; flex-direction: column; min-height: 540px;
          background: var(--night-deep); border: 1px solid var(--rule); border-radius: 3px;
          color: var(--vellum); font-family: var(--text);
        }
        .ask-body { flex: 1; min-height: 0; overflow-y: auto; padding: 40px 44px; }

        .ask-intro {
          display: grid; grid-template-columns: minmax(0,1fr) minmax(0,26em);
          gap: 40px; align-items: center; min-height: 340px;
        }
        .ask-prompt {
          margin: 0; font-family: var(--display); font-size: clamp(30px,3.6vw,46px);
          font-weight: 300; line-height: 1.08; letter-spacing: -.018em; text-wrap: balance;
        }
        .ask-chips { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .ask-chips-label {
          font-size: 11.5px; font-weight: 500; letter-spacing: .22em; text-transform: uppercase;
          color: var(--rubric); margin-bottom: 4px;
        }
        .ask-chip {
          font-family: var(--display); font-size: 20px; font-style: italic; line-height: 1.3;
          text-align: right; color: var(--vellum); background: var(--well);
          border: 1px solid var(--rule); border-radius: 100px; padding: 12px 22px;
          cursor: pointer; max-width: 100%; transition: border-color .2s, color .2s, background .2s;
        }
        .ask-chip:hover { border-color: var(--gold); color: var(--gold-lit); background: rgba(201,162,74,.07); }

        .ask-question {
          margin: 0; font-family: var(--display); font-size: 27px; font-style: italic;
          line-height: 1.32; padding-left: 20px; border-left: 2px solid var(--rubric);
        }
        .ask-status { margin-top: 24px; font-size: 16px; font-style: italic; color: var(--slate-dim); }
        .ask-status::after {
          content: ""; display: inline-block; width: 5px; height: 5px; margin-left: 9px;
          border-radius: 50%; background: var(--gold); vertical-align: middle;
          animation: ask-lamp 1.4s ease-in-out infinite;
        }
        @keyframes ask-lamp { 0%,100% { opacity: .2; } 50% { opacity: 1; } }

        .ask-answer { margin-top: 26px; font-size: 18px; line-height: 1.75; color: var(--vellum-dim); max-width: none; width: 100%; overflow-wrap: break-word; }
        .ask-answer p { margin: 0; }
        .ask-answer p + p { margin-top: 15px; }
        .ask-answer + .ask-turn { margin-top: 46px; padding-top: 38px; border-top: 1px solid var(--rule-soft); }
        .ask-actions { display: flex; justify-content: flex-end; padding: 18px 22px 0; }
        .ask-new {
          color: var(--gold-lit); background: transparent; border: 1px solid var(--rule);
          border-radius: 100px; padding: 8px 17px; font: 500 15px/1.2 var(--text);
          cursor: pointer; transition: border-color .2s, background .2s;
        }
        .ask-new:hover { border-color: var(--gold); background: rgba(201,162,74,.07); }

        .ask-form {
          display: flex; align-items: flex-end; gap: 14px; margin: 0 22px;
          padding: 12px 12px 12px 20px; border: 1px solid var(--rule);
          border-radius: 26px; background: var(--well);
        }
        .ask-form:focus-within { border-color: var(--gold); }
        .ask-input {
          flex: 1; min-width: 0; resize: none; font-family: var(--text); font-size: 18px;
          line-height: 1.5; color: var(--vellum); background: none; border: none;
          padding: 8px 0; max-height: 160px;
        }
        .ask-input::placeholder { color: var(--slate-dim); font-style: italic; }
        .ask-input:focus { outline: none; }
        .ask-input:disabled { opacity: .5; }
        .ask-send {
          flex: none; width: 42px; height: 42px; border-radius: 50%; border: none;
          background: var(--gold); color: var(--night-deep);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background .2s, opacity .2s;
        }
        .ask-send:hover:not(:disabled) { background: var(--gold-lit); }
        .ask-send:disabled { opacity: .4; cursor: default; }

        .ask-disclaimer {
          margin: 0; padding: 16px 44px 22px; text-align: center;
          font-size: 15px; font-style: italic; color: var(--slate-dim);
        }

        @media (max-width: 760px) {
          .page { padding: 36px 16px 44px; }
          .ask-intro { grid-template-columns: minmax(0,1fr); gap: 24px; }
          .ask-chips { align-items: stretch; }
          .ask-chip { text-align: left; font-size: 18px; }
          .ask-form { margin: 0 14px; }
        }
      `}</style>

      <main className="page">
        <header className="page-head">
          <h1>Ask a Question</h1>
          <p>Ask about righteousness by faith, justification, and assurance.</p>
        </header>

        <div className="ask">
          <div className="ask-body">
            {messages.length === 0 ? (
              <div className="ask-intro">
                <p className="ask-prompt">Where would you like to begin?</p>
                <div className="ask-chips">
                  <div className="ask-chips-label">Try asking</div>
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => ask(s)}
                      className="ask-chip"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ask-thread">
                {messages.map((message, index) => message.role === "user" ? (
                  <div className="ask-turn" key={index}>
                    <p className="ask-question">{message.content}</p>
                    {busy && index === messages.length - 1 && status && <div className="ask-status">{status}</div>}
                  </div>
                ) : (
                  <div className="ask-answer" key={index}>
                    {message.content.split(/\n\n+/).map((para, i) => (
                      <p key={i}>{formatInlineText(para)}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <div className="ask-actions">
              <button
                type="button"
                className="ask-new"
                disabled={busy}
                onClick={() => {
                  setMessages([]);
                  setQuestion("");
                  setStatus("");
                  textareaRef.current?.focus();
                }}
              >
                Start new conversation
              </button>
            </div>
          )}

          <form
            className="ask-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={question}
              disabled={busy}
              maxLength={600}
              placeholder="Ask a question…"
              aria-label="Your question"
              className="ask-input"
              onChange={(e) => {
                setQuestion(e.target.value);
                handleInputResize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(question);
                }
              }}
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              aria-label="Send question"
              className="ask-send"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M12 19V5M12 5l-6 6M12 5l6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>

          <p className="ask-disclaimer">
            Answers come from the indexed texts only. Verify important claims against Scripture and the cited sources.
          </p>
        </div>
      </main>
    </>
  );
}
