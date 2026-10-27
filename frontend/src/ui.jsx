import { useEffect, useRef, useState } from "react";
import { BASE, machinePhotoUrl, manualUrl } from "./api";
import { STATUS_LABEL } from "./format";

function fold(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

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

export function Modal({ title, onClose, children, wide = false }) {
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
        className={wide ? "modal wide" : "modal"}
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

export function Pill({ value, label }) {
  return <span className={`pill ${value}`}>{label || STATUS_LABEL[value] || value}</span>;
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

export function MachinePhotos({ machine, onClose }) {
  const shots = [
    ["maquina", "Foto de la máquina", machine?.has_machine_photo],
    ["serie", "Foto de la serie", machine?.has_serial_photo],
  ];
  return (
    <Modal title={`Fotos de ${machine?.serial || "la máquina"}`} onClose={onClose}>
      <div className="photo-panel">
        {shots.map(([kind, label, present]) => (
          <figure key={kind}>
            <figcaption>{label}</figcaption>
            {present ? (
              <img src={machinePhotoUrl(machine.id, kind)} alt={label} />
            ) : (
              <p className="muted">Sin foto.</p>
            )}
          </figure>
        ))}
      </div>
    </Modal>
  );
}

export function ManualView({ modelId, title, present, onClose }) {
  return (
    <Modal wide title={title || "Manual"} onClose={onClose}>
      {present ? (
        <iframe className="manual-frame" title={title || "Manual"} src={manualUrl(modelId)} />
      ) : (
        <p className="muted">Este modelo no tiene manual cargado.</p>
      )}
    </Modal>
  );
}

export function TechBar({ title, onBack, action, hello, serial }) {
  if (serial) {
    return (
      <header className="machine-bar">
        <button type="button" className="text-btn" onClick={onBack}>Atrás</button>
        <div className="serial-plate">
          <span>Serie de la máquina</span>
          <strong>{serial}</strong>
        </div>
      </header>
    );
  }
  return (
    <header className="tech-bar">
      {onBack ? (
        <button type="button" className="text-btn" onClick={onBack}>Atrás</button>
      ) : (
        <img className="tech-logo" src={`${BASE}/logo.png`} alt="ZGROUP" />
      )}
      <div className="tech-bar-copy">
        {hello ? <p className="hello">Hola, {hello}</p> : null}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function Combo({ label, placeholder, options, value, onChange }) {
  const box = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((option) => String(option.value) === String(value));
  const selectedLabel = selected?.label || "";
  const showingSelected = Boolean(selectedLabel) && text === selectedLabel;
  const query = fold(text.trim());
  const filtered = options.filter((option) => !query || showingSelected || fold(option.label).includes(query));

  useEffect(() => {
    if (!open) setText(selectedLabel);
  }, [open, selectedLabel]);

  useEffect(() => {
    function onDoc(event) {
      if (!box.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  function pick(option) {
    onChange(String(option.value));
    setText(option.label);
    setOpen(false);
  }

  function onKey(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="combo field" ref={box}>
      <span>{label}</span>
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onFocus={(event) => {
          setOpen(true);
          setActive(0);
          event.target.select();
        }}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange("");
        }}
        onKeyDown={onKey}
      />
      {open && (
        <div className="combo-list" role="listbox">
          {filtered.length === 0 && <p className="combo-empty">Sin coincidencias</p>}
          {filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={index === active}
              className={index === active ? "active" : undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(option)}
            >
              {option.serial ? <strong>{option.serial}</strong> : option.label}
              {option.hint ? <small>{option.hint}</small> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
