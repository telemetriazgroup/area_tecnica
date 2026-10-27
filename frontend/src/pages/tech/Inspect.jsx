import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, photoUrl } from "../../api";
import { Banner, MachinePhotos, Pill, TechBar } from "../../ui";

const CONDITIONS = [
  ["faltante", "Faltante"],
  ["incompleto", "Incompleto"],
  ["inoperativo", "Inoperativo"],
];

const emptySheet = {
  mode: "add",
  part: null,
  item: null,
  quantity: 1,
  condition: "faltante",
  note: "",
  photo: null,
  preview: "",
};

export default function Inspect() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const editable = inspection?.status === "en_proceso";

  useEffect(() => {
    let live = true;
    api(`/api/inspections/${id}`)
      .then((data) => {
        if (live) setInspection(data);
      })
      .catch((err) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (!inspection || !editable) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      api(`/api/inspections/${id}/parts?q=${encodeURIComponent(query)}`)
        .then((data) => {
          if (live) setResults(data);
        })
        .catch(() => {
          if (live) setResults([]);
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, inspection, editable, id]);

  useEffect(() => {
    return () => {
      if (sheet?.preview) URL.revokeObjectURL(sheet.preview);
    };
  }, [sheet?.preview]);

  function openAdd(part) {
    const existing = inspection.items.find((item) => item.spare_part_id === part.id);
    if (existing) {
      openEdit(existing);
      return;
    }
    setSheet({ ...emptySheet, part });
  }

  function openEdit(item) {
    setSheet({
      ...emptySheet,
      mode: "edit",
      item,
      quantity: item.quantity,
      condition: item.condition,
      note: item.note || "",
    });
  }

  function onPhoto(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setSheet((current) => ({ ...current, photo: file, preview: file ? URL.createObjectURL(file) : "" }));
  }

  async function saveSheet(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let next;
      if (sheet.mode === "add") {
        const form = new FormData();
        form.set("spare_part_id", String(sheet.part.id));
        form.set("quantity", String(sheet.quantity));
        form.set("condition", sheet.condition);
        form.set("note", sheet.note.trim());
        if (sheet.photo) form.set("photo", sheet.photo);
        next = await api(`/api/inspections/${id}/items`, { method: "POST", form });
      } else {
        next = await api(`/api/inspection-items/${sheet.item.id}`, {
          method: "PATCH",
          body: { quantity: sheet.quantity, condition: sheet.condition, note: sheet.note.trim() || null },
        });
        if (sheet.photo) {
          const form = new FormData();
          form.set("photo", sheet.photo);
          next = await api(`/api/inspection-items/${sheet.item.id}/photos`, { method: "POST", form });
        }
      }
      setInspection(next);
      setSheet(null);
      setQuery("");
    } catch (err) {
      if (err.status === 409 && err.detail?.item_id) {
        const current = inspection.items.find((item) => item.id === err.detail.item_id);
        if (current) openEdit(current);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId) {
    if (!window.confirm("¿Quitar este repuesto de la máquina?")) return;
    setError("");
    try {
      setInspection(await api(`/api/inspection-items/${itemId}`, { method: "DELETE" }));
      setSheet(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removePhoto(itemId, photoId) {
    setError("");
    try {
      const next = await api(`/api/inspection-items/${itemId}/photos/${photoId}`, { method: "DELETE" });
      setInspection(next);
      const item = next.items.find((row) => row.id === itemId);
      if (item) openEdit(item);
    } catch (err) {
      setError(err.message);
    }
  }

  async function finish() {
    const empty = inspection.items.length === 0;
    const message = empty
      ? "¿Terminar sin repuestos? La máquina quedará revisada y sin faltantes."
      : "¿Terminar la inspección? Después ya no podrás editarla.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/inspections/${id}/complete`, { method: "POST" });
      navigate("/tecnico", { state: { done: inspection.machine.serial } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!inspection) {
    return (
      <main className="phone">
        <TechBar title="Inspección" onBack={() => navigate("/tecnico")} />
        <div className="tech-body">
          <Banner>{error}</Banner>
          {!error && <p>Cargando máquina…</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="phone">
      <TechBar serial={inspection.machine.serial} onBack={() => navigate("/tecnico")} />
      <div className="tech-body">
        <p className="muted machine-meta">
          {inspection.machine.brand} · {inspection.machine.model}
          {inspection.machine.location ? ` · ${inspection.machine.location}` : ""}
          {inspection.machine.year ? ` · ${inspection.machine.year}` : ""}
        </p>
        <button type="button" className="btn ghost block photos-btn" onClick={() => setPhotosOpen(true)}>Ver fotos</button>
        <Banner>{error}</Banner>
        {!editable && <Banner kind="ok">Esta revisión ya está cerrada.</Banner>}

        {editable && (
          <section className="finder">
            <label>
              <span>Buscar repuesto</span>
              <input
                value={query}
                placeholder="Escribe serie o descripción"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="finder-results">
              {results.map((part) => (
                <button key={part.id} type="button" className="hit" onClick={() => openAdd(part)}>
                  <span>
                    <strong>{part.description}</strong>
                    <small>{part.part_type || "Repuesto"}</small>
                  </span>
                  <b>{part.code}</b>
                </button>
              ))}
              {results.length === 0 && <p>No hay repuestos con ese texto en este modelo.</p>}
            </div>
          </section>
        )}

        <h2>Anotados ({inspection.items.length})</h2>
        <div className="stack">
          {inspection.items.map((item) => (
            <article key={item.id} className="item-card">
              <header>
                <div>
                  <strong>{item.description}</strong>
                  <small>{item.code} · cantidad {item.quantity}</small>
                </div>
                <Pill value={item.condition} />
              </header>
              {item.note && <p className="note">{item.note}</p>}
              {item.photos.length > 0 && (
                <div className="photo-row">
                  {item.photos.map((photo) => (
                    <img key={photo.id} src={photoUrl(photo.id)} alt={`Evidencia de ${item.description}`} />
                  ))}
                </div>
              )}
              {editable && (
                <button type="button" className="text-btn" onClick={() => openEdit(item)}>
                  Editar
                </button>
              )}
            </article>
          ))}
          {inspection.items.length === 0 && <p className="muted">Todavía no agregas repuestos.</p>}
        </div>
      </div>

      {editable && (
        <div className="finish-bar">
          <button type="button" className="btn block" disabled={busy} onClick={finish}>
            Terminar inspección
          </button>
        </div>
      )}

      {photosOpen && <MachinePhotos machine={inspection.machine} onClose={() => setPhotosOpen(false)} />}

      {sheet && (
        <div className="drawer-back" onMouseDown={() => setSheet(null)}>
          <form className="drawer" onSubmit={saveSheet} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{sheet.mode === "add" ? sheet.part.description : sheet.item.description}</h2>
              <button type="button" className="icon-btn" onClick={() => setSheet(null)} aria-label="Cerrar">×</button>
            </header>
            <p className="muted">{sheet.mode === "add" ? sheet.part.code : sheet.item.code}</p>
            <div className="field">
              <span>Cantidad</span>
              <div className="stepper">
                <button type="button" className="btn ghost" onClick={() => setSheet({ ...sheet, quantity: Math.max(1, sheet.quantity - 1) })}>−</button>
                <strong>{sheet.quantity}</strong>
                <button type="button" className="btn ghost" onClick={() => setSheet({ ...sheet, quantity: Math.min(999, sheet.quantity + 1) })}>+</button>
              </div>
            </div>
            <div className="field">
              <span>Estado</span>
              <div className="segment">
                {CONDITIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={sheet.condition === value ? `active ${value}` : value}
                    onClick={() => setSheet({ ...sheet, condition: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Nota</span>
              <textarea
                value={sheet.note}
                maxLength={800}
                placeholder="Opcional, para almacén"
                onChange={(event) => setSheet({ ...sheet, note: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Foto</span>
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
              <small>{sheet.mode === "edit" ? "Puedes sumar hasta 4 fotos." : "Opcional. Puedes agregar más después."}</small>
            </label>
            {sheet.preview && <img className="preview" src={sheet.preview} alt="Vista previa" />}
            {sheet.mode === "edit" && sheet.item.photos?.length > 0 && (
              <div className="photo-row">
                {sheet.item.photos.map((photo) => (
                  <div key={photo.id}>
                    <img src={photoUrl(photo.id)} alt="" />
                    <button type="button" className="text-btn" onClick={() => removePhoto(sheet.item.id, photo.id)}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn block" disabled={busy} type="submit">
              {busy ? "Guardando…" : sheet.mode === "add" ? "Agregar a la máquina" : "Guardar cambios"}
            </button>
            {sheet.mode === "edit" && (
              <button type="button" className="btn ghost block" onClick={() => removeItem(sheet.item.id)}>
                Quitar de la lista
              </button>
            )}
          </form>
        </div>
      )}
    </main>
  );
}
