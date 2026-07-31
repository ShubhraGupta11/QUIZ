export default function Loader({ label = "Loading..." }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: "60px 0",
      color: "var(--ink-muted)",
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: "3px solid var(--border-soft)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}
