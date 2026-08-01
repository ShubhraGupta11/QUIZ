import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getFlashcards, getRevisableFlashcards, removeFlashcard } from "../../utils/flashcards";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function Flashcards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState(() => getFlashcards(user?._id));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[index];
  const revisable = getRevisableFlashcards(user?._id);

  function startRevisionQuiz() {
    const questions = revisable.map((c) => ({
      id: c.id,
      text: c.questionText,
      options: c.options,
      correctIndex: c.correctIndex,
      marks: 2,
      difficulty: "medium",
    }));
    navigate("/student/self-quiz", {
      state: {
        selfQuiz: true,
        questions,
        chapterName: "Flashcard Revision",
        subjectName: "Mixed Chapters",
        semesterName: "Your Saved Mistakes",
      },
    });
  }

  function markKnown() {
    removeFlashcard(user?._id, card.id);
    const next = getFlashcards(user?._id);
    setCards(next);
    setFlipped(false);
    setIndex((i) => Math.min(i, Math.max(next.length - 1, 0)));
  }

  function skip() {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Revise</span>
          <h1>Flashcards</h1>
          <p>Questions you got wrong, saved for quick revision. Tap a card to flip it.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{cards.length} card{cards.length === 1 ? "" : "s"}</span>
          {revisable.length >= 2 && (
            <button className="btn btn-primary" onClick={startRevisionQuiz}>📝 Start Revision Quiz</button>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state card">
          <p>No flashcards yet. After a quiz, save your wrong answers as flashcards from the Result page.</p>
        </div>
      ) : (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div
            className="card fade-in"
            onClick={() => setFlipped((f) => !f)}
            style={{
              padding: 40,
              minHeight: 220,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 16,
            }}
          >
            {!flipped ? (
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Question ({index + 1}/{cards.length}) — tap to reveal answer
                </div>
                <div style={{ fontWeight: 600 }}>{card.questionText}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: "var(--teal)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Correct Answer
                </div>
                <div style={{ fontWeight: 700, color: "var(--teal)" }}>{card.correctAnswer}</div>
                {card.chapterName && (
                  <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 10 }}>{card.chapterName}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button className="btn btn-outline" onClick={skip}>Skip →</button>
            <button className="btn btn-primary" onClick={markKnown}>✓ I know this now</button>
          </div>
        </div>
      )}
    </div>
  );
}
