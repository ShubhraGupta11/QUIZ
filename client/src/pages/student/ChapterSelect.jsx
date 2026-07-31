import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getChapters, findSemester, findSubject } from "../../api/mockData";
import StepCard from "../../components/StepCard";
import Loader from "../../components/Loader";
import "./Student.css";

export default function ChapterSelect() {
  const { semesterId, subjectId } = useParams();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const navigate = useNavigate();
  const semester = findSemester(semesterId);
  const subject = findSubject(semesterId, subjectId);

  useEffect(() => {
    getChapters(subjectId).then((data) => {
      setChapters(data);
      setLoading(false);
    });
  }, [subjectId]);

  return (
    <div className="page container">
      <Link to={`/student/${semesterId}/subjects`} className="back-link">← Change Subject</Link>
      <div className="page-header">
        <div>
          <span className="eyebrow">Step 3 of 3</span>
          <h1>{subject?.name} — Chapters</h1>
          <p>{semester?.name} · Choose a chapter to start your quiz.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-gold">{chapters.length} chapter{chapters.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {!loading && (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={practiceMode}
            onChange={(e) => setPracticeMode(e.target.checked)}
          />
          Practice Mode (untimed, no timer pressure, attempt not saved to history/leaderboard)
        </label>
      )}

      {loading ? (
        <Loader label="Loading chapters..." />
      ) : (
        <div className="grid-cards">
          {chapters.map((ch, i) => (
            <StepCard
              key={ch.id}
              title={ch.name}
              subtitle={`${ch.questionCount} question${ch.questionCount === 1 ? "" : "s"} · ${Math.ceil((ch.questionCount * 30) / 60)} min`}
              icon={i + 1}
              onClick={() =>
                navigate(`/student/${semesterId}/${subjectId}/${ch.id}/quiz`, {
                  state: { chapterName: ch.name, subjectName: subject?.name, semesterName: semester?.name, practiceMode },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
