import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChapters, findSemester, findSubject } from "../../api/mockData";
import apiClient from "../../api/apiClient";
import StepCard from "../../components/StepCard";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function ChapterSelect() {
  const { semesterId, subjectId } = useParams();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [summaryModal, setSummaryModal] = useState(null); // { chapterName, text, loading }
  const navigate = useNavigate();
  const semester = findSemester(semesterId);
  const subject = findSubject(semesterId, subjectId);

  useEffect(() => {
    getChapters(subjectId).then((data) => {
      setChapters(data);
      setLoading(false);
    });
  }, [subjectId]);

  async function viewSummary(e, ch) {
    e.stopPropagation();
    setSummaryModal({ chapterName: ch.name, text: "", loading: true });
    try {
      const res = await apiClient.post("/faculty/chapter-summary", { chapterId: ch.id });
      setSummaryModal({ chapterName: ch.name, text: res.data.summary, loading: false });
    } catch (err) {
      console.error("Failed to load chapter summary:", err);
      setSummaryModal({ chapterName: ch.name, text: "Couldn't load a summary right now. Please try again.", loading: false });
    }
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Step 3 of 3</span>
          <h1>{subject?.name} — Chapters</h1>
          <p>{semester?.name} · Choose a chapter to start your quiz.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-gold">{chapters.length} chapter{chapters.length === 1 ? "" : "s"}</span>
          <button
            className="btn btn-outline"
            onClick={() => navigate("/student/generate-quiz", { state: { subjectName: subject?.name, semesterName: semester?.name } })}
          >
            ✨ Generate quiz from your notes
          </button>
        </div>
      </div>

      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={practiceMode}
              onChange={(e) => setPracticeMode(e.target.checked)}
            />
            Practice Mode (untimed, no timer pressure, attempt not saved to history/leaderboard)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={negativeMarking}
              onChange={(e) => setNegativeMarking(e.target.checked)}
            />
            Negative Marking (-1 mark for each wrong answer, exam-style)
          </label>
        </div>
      )}

      {loading ? (
        <Loader label="Loading chapters..." />
      ) : (
        <div className="grid-cards">
          {chapters.map((ch, i) => (
            <div key={ch.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <StepCard
                title={ch.name}
                subtitle={
                  ch.questionCount > 0
                    ? `${ch.questionCount} question${ch.questionCount === 1 ? "" : "s"} · ${Math.ceil((ch.questionCount * 30) / 60)} min`
                    : "No quiz yet — tap to generate one from your notes"
                }
                icon={i + 1}
                onClick={() =>
                  ch.questionCount > 0
                    ? navigate(`/student/${semesterId}/${subjectId}/${ch.id}/quiz`, {
                        state: { chapterName: ch.name, subjectName: subject?.name, semesterName: semester?.name, practiceMode, negativeMarking },
                      })
                    : navigate("/student/generate-quiz", {
                        state: { chapterName: ch.name, subjectName: subject?.name, semesterName: semester?.name },
                      })
                }
              />
              {ch.questionCount > 0 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: 12, padding: "6px 10px", alignSelf: "flex-start" }}
                  onClick={(e) => viewSummary(e, ch)}
                >
                  📖 View AI Summary
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {summaryModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
          onClick={() => setSummaryModal(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 560, width: "100%", padding: 28, maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 12 }}>📖 {summaryModal.chapterName} — Summary</h3>
            {summaryModal.loading ? (
              <Loader label="Generating summary..." />
            ) : (
              <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{summaryModal.text}</div>
            )}
            <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => setSummaryModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
