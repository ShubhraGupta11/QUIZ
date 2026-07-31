import "./StepCard.css";

export default function StepCard({ title, subtitle, icon, onClick }) {
  return (
    <button className="step-card fade-in" onClick={onClick}>
      <div className="step-card-icon">{icon}</div>
      <div className="step-card-text">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <span className="step-card-arrow">→</span>
    </button>
  );
}
