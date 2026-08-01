import { useState, useRef, useEffect } from "react";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function DoubtChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your AI study assistant. Ask me anything about your coursework — I'll do my best to explain it clearly." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await apiClient.post("/faculty/chat", { messages: nextMessages });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch (error) {
      console.error("Chat failed:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">AI Assistant</span>
          <h1>Ask AI a Doubt</h1>
          <p>Chat with an AI study assistant — quick answers, no waiting for faculty.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: 520 }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: m.role === "user" ? "var(--accent-soft)" : "var(--bg-alt)",
                border: "1px solid var(--border-soft)",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13.5,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--ink-muted)" }}>AI is typing...</div>
          )}
        </div>

        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid var(--border-soft)" }}>
          <input
            placeholder="Type your doubt..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1 }}
            disabled={sending}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
