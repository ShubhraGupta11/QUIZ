import { useEffect, useState, useCallback } from "react";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { getSubjectSuggestions } from "../../data/subjectCatalog";
import ManagePanel from "./ManagePanel";

export default function ManageSubjects() {
  const [semesters, setSemesters] = useState([]);
  const { user } = useAuth();

  const fetchSemesters = useCallback(async (department) => {
    try {
      const query = department ? `?department=${encodeURIComponent(department)}` : "";
      const res = await apiClient.get(`/semesters${query}`);
      setSemesters(res.data.data.map(sem => ({
        id: sem._id,
        name: sem.name,
        order: sem.order,
      })));
    } catch (err) {
      console.error("Error fetching semesters:", err);
    }
  }, []);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  return (
    <ManagePanel
      type="subjects"
      title="Subjects"
      description="Create subjects under a semester."
      parentOptions={semesters}
      parentLabel="Semester"
      onRefreshParent={fetchSemesters}
      departmentOptions={user?.departments || []}
      getNameOptions={(department, parent) =>
        department && parent ? getSubjectSuggestions(department, parent.order) : null
      }
    />
  );
}
