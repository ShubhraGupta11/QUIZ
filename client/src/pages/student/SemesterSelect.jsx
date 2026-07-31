import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSemesters } from "../../api/mockData";
import { useAuth } from "../../context/AuthContext";
import StepCard from "../../components/StepCard";
import Loader from "../../components/Loader";
import "./Student.css";

export default function SemesterSelect({ embedded = false }) {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    getSemesters().then((data) => {
      // Students only ever see their own assigned semester
      const scoped = user?.role === "student"
        ? data.filter((sem) => sem.id === user.semesterId)
        : data;
      setSemesters(scoped);
      setLoading(false);
    });
  }, [user]);

  const content = loading ? (
    <Loader label="Loading semesters..." />
  ) : (
    <div className="grid-cards">
      {semesters.map((sem) => (
        <StepCard
          key={sem.id}
          title={sem.name}
          subtitle="Tap to view subjects"
          icon={sem.order}
          onClick={() => navigate(`/student/${sem.id}/subjects`)}
        />
      ))}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="page container">
      <div className="page-header">
        <h1>Choose Your Semester</h1>
        <p>Select a semester to view subjects and start practicing.</p>
      </div>
      {content}
    </div>
  );
}
