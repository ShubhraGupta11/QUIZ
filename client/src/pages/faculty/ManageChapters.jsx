import { useEffect, useState, useCallback } from "react";
import apiClient from "../../api/apiClient";
import ManagePanel from "./ManagePanel";

export default function ManageChapters() {
  const [subjects, setSubjects] = useState([]);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await apiClient.get("/subjects");
      setSubjects(res.data.data.map(subject => ({
        id: subject._id,
        name: subject.name
      })));
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  return (
    <ManagePanel
      type="chapters"
      title="Chapters"
      description="Create chapters under a subject."
      parentOptions={subjects}
      parentLabel="Subject"
      onRefreshParent={fetchSubjects}
    />
  );
}
