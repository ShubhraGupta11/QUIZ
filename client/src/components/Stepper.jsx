import "./Stepper.css";

export default function Stepper({ steps, current }) {
  return (
    <div className="stepper">
      {steps.map((step, i) => (
        <div key={step} className="stepper-item">
          <div className={`stepper-dot ${i <= current ? "active" : ""}`}>{i + 1}</div>
          <span className={`stepper-label ${i <= current ? "active" : ""}`}>{step}</span>
          {i < steps.length - 1 && <div className={`stepper-line ${i < current ? "active" : ""}`} />}
        </div>
      ))}
    </div>
  );
}
