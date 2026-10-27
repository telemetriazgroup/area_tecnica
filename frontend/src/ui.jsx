import { useEffect } from "react";
import { BASE } from "./api";
import { STATUS_LABEL } from "./format";

export function Splash() {
  return (
    <div className="splash">
      <img className="splash-logo" src={`${BASE}/logo.png`} alt="ZGROUP" />
      <p>Área técnica</p>
    </div>
  );
}

export function Banner({ kind = "error", children }) {
  if (!children) return null;
  return (
    <div className={`banner ${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, text }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function Pill({ value }) {
  return <span className={`pill ${value}`}>{STATUS_LABEL[value] || value}</span>;
}

export function Page({ title, lede, action, children }) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {lede ? <p>{lede}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function TechBar({ title, onBack, action }) {
  return (
    <header className="tech-bar">
      {onBack ? (
        <button type="button" className="text-btn" onClick={onBack}>
          Atrás
        </button>
      ) : (
        <img className="tech-logo" src={`${BASE}/logo.png`} alt="ZGROUP" />
      )}
      <h1>{title}</h1>
      {action}
    </header>
  );
}
