import { useAuth } from "../../context/AuthContext";
import ManagePanel from "./ManagePanel";

export default function ManageSemesters() {
  const { user } = useAuth();

  return (
    <ManagePanel
      type="semesters"
      title="Semesters"
      description="Create and manage semesters (Sem 1 to Sem 7)."
      departmentOptions={user?.departments || []}
    />
  );
}
