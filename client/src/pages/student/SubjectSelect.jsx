import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSubjects, findSemester } from "../../api/mockData";
import StepCard from "../../components/StepCard";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function SubjectSelect() {
  const { semesterId } = useParams();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const semester = findSemester(semesterId);

  useEffect(() => {
    getSubjects(semesterId).then((data) => {
      setSubjects(data);
      setLoading(false);
    });
  }, [semesterId]);

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Step 2 of 3</span>
          <h1>{semester?.name} — Subjects</h1>
          <p>Pick a subject to view its chapters.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{subjects.length} subject{subjects.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading subjects..." />
      ) : subjects.length === 0 ? (
        <div className="empty-state card">No subjects available for this semester yet.</div>
      ) : (
        <div className="grid-cards">
          {subjects.map((sub, i) => (
            <StepCard
              key={sub.id}
              title={sub.name}
              subtitle="Tap to view chapters"
              icon={sub.name[0]}
              onClick={() => navigate(`/student/${semesterId}/${sub.id}/chapters`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
