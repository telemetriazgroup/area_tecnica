import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, eventPhotoUrl, photoUrl } from "../../api";
import { useAuth } from "../../auth";
import { WORK_STATUS_LABEL, formatDateTime, formatDuration, inspectionStateLabel, useFetch } from "../../format";
import { Banner, Field, MachinePhotos, ManualView, Page, Pill } from "../../ui";

const STATUSES = [
  ["programado", "Programado"],
  ["en_proceso", "En proceso"],
  ["reparado", "Reparado"],
  ["sin_accion", "Sin acción"],
];

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const detail = useFetch(() => api(`/api/inspections/${id}`), [id]);
  const technicians = useFetch(() => api("/api/technicians"), []);
  const conditions = useFetch(() => api("/api/conditions"), []);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState("");
  const [follow, setFollow] = useState({ note: "", photos: [] });
  const [decision, setDecision] = useState({ status: "programado", note: "", photos: [] });
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const labelOf = (key) => conditions.data?.find((row) => row.key === key)?.label;
  const data = detail.data;

  useEffect(() => {
    if (!data) return;
    setTechnicianId(data.assigned_technician_id ? String(data.assigned_technician_id) : "");
    if (data.work_status) setDecision((current) => ({ ...current, status: data.work_status }));
  }, [data?.id, data?.assigned_technician_id, data?.work_status]);

  const techOptions = (technicians.data || []).filter((tech) => !tech.archived);
  if (data?.assigned_technician_id && !techOptions.some((tech) => tech.id === data.assigned_technician_id)) {
    techOptions.unshift({ id: data.assigned_technician_id, name: data.assigned_technician_name });
  }

  async function saveTechnician(event) {
    event.preventDefault();
    setBusy("tech");
    setError("");
    try {
      await api(`/api/inspections/${id}/technician`, {
        method: "PATCH",
        body: { technician_id: technicianId ? Number(technicianId) : null },
      });
      detail.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function addFollow(event) {
    event.preventDefault();
    if (follow.photos.length > 4) {
      setError("Solo puedes adjuntar 4 fotos por seguimiento.");
      return;
    }
    setBusy("follow");
    setError("");
    const form = new FormData();
    form.set("note", follow.note);
    follow.photos.forEach((file) => form.append("photos", file));
    try {
      await api(`/api/inspections/${id}/events`, { method: "POST", form });
      setFollow({ note: "", photos: [] });
      setFileKey((value) => value + 1);
      detail.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function saveStatus(event) {
    event.preventDefault();
    if (decision.photos.length > 4) {
      setError("Solo puedes adjuntar 4 fotos por status.");
      return;
    }
    setBusy("status");
    setError("");
    const form = new FormData();
    form.set("status", decision.status);
    form.set("note", decision.note);
    decision.photos.forEach((file) => form.append("photos", file));
    try {
      await api(`/api/inspections/${id}/status`, { method: "POST", form });
      setDecision((current) => ({ ...current, note: "", photos: [] }));
      setFileKey((value) => value + 1);
      detail.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function removeInspection() {
    const serial = data?.machine.serial || "esta inspección";
    const confirmed = window.confirm(
      `¿Borrar los datos de ${serial}? Se eliminan repuestos, fotos y la línea de trazabilidad. Si la revisión seguía abierta, la asignación vuelve a pendiente.`,
    );
    if (!confirmed) return;
    setBusy("delete");
    setError("");
    try {
      await api(`/api/inspections/${id}`, { method: "DELETE" });
      navigate("/app/inspecciones");
    } catch (err) {
      setError(err.message);
      setBusy("");
    }
  }

  return (
    <Page
      title={data ? data.machine.serial : "Inspección"}
      lede={data ? `${data.machine.brand} · ${data.machine.model}` : "Cargando el detalle."}
      action={<Link className="btn ghost" to="/app/inspecciones">Volver</Link>}
    >
      <Banner>{detail.error || error}</Banner>
      {data && (
        <>
          <p className="muted">
            {data.machine.location || "Sin ubicación"}
            {data.machine.year ? ` · ${data.machine.year}` : ""}
          </p>
          <div className="stats">
            <article className="stat">
              <strong>{formatDuration(data.assigned_at, data.completed_at)}</strong>
              <span>{data.completed_at ? "Desde la asignación" : "En curso, desde la asignación"}</span>
            </article>
            <article className="stat">
              <strong>{formatDuration(data.started_at, data.completed_at)}</strong>
              <span>{data.completed_at ? "Armando la lista" : "Desde que entró"}</span>
            </article>
          </div>
          <p className="muted">
            Asignada {formatDateTime(data.assigned_at)}
            {" · "}Entró {formatDateTime(data.started_at)}
            {" · "}{data.completed_at ? `Cerró la inspección ${formatDateTime(data.completed_at)}` : "La inspección sigue abierta"}
          </p>
          <div className="actions">
            <span className="muted">Estado de inspección</span>
            <Pill value={data.status} label={inspectionStateLabel(data.status)} />
            <span className="muted">Status</span>
            <Pill value={data.work_status || "sin_definir"} label={WORK_STATUS_LABEL[data.work_status] || "—"} />
          </div>
          <div className="actions">
            <button type="button" className="btn ghost photos-btn" onClick={() => setPhotosOpen(true)}>Ver fotos</button>
            <button type="button" className="btn ghost photos-btn" onClick={() => setManualOpen(true)}>Ver manual</button>
            {user?.role === "superadmin" && (
              <button type="button" className="btn danger" disabled={busy === "delete"} onClick={removeInspection}>
                Borrar inspección
              </button>
            )}
          </div>
          {photosOpen && <MachinePhotos machine={data.machine} onClose={() => setPhotosOpen(false)} />}
          {manualOpen && (
            <ManualView
              modelId={data.machine.model_id}
              title={`Manual de ${data.machine.brand} ${data.machine.model}`}
              present={data.machine.has_manual}
              onClose={() => setManualOpen(false)}
            />
          )}

          <form className="card" onSubmit={saveTechnician}>
            <h2>Técnicos</h2>
            <div className="split">
              <Field label="Técnico supervisor">
                <input value={data.technician_name} readOnly />
              </Field>
              <Field label="Técnico" hint="Quien ejecuta el trabajo en esta inspección.">
                <select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
                  <option value="">Sin asignar</option>
                  {techOptions.map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <button className="btn" type="submit" disabled={busy === "tech"}>{busy === "tech" ? "Guardando…" : "Asignar técnico"}</button>
          </form>

          <form className="card" onSubmit={addFollow}>
            <h2>Seguimiento o incidencia</h2>
            <p className="muted">Nota y fotos de la inspección. No cambia el status.</p>
            <Field label="Fotos" hint="Hasta 4, JPG o PNG.">
              <input
                key={`follow-${fileKey}`}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setFollow({ ...follow, photos: Array.from(event.target.files || []).slice(0, 4) })}
              />
            </Field>
            <Field label="Nota">
              <textarea
                rows={3}
                maxLength={800}
                value={follow.note}
                placeholder="Qué se vio en la inspección o qué incidencia apareció"
                onChange={(event) => setFollow({ ...follow, note: event.target.value })}
              />
            </Field>
            {follow.photos.length > 0 && <p className="muted">{follow.photos.map((file) => file.name).join(", ")}</p>}
            <button className="btn" type="submit" disabled={busy === "follow"}>{busy === "follow" ? "Registrando…" : "Registrar seguimiento"}</button>
          </form>

          {data.status === "completada" ? (
            <form className="card" onSubmit={saveStatus}>
              <h2>Status</h2>
              <p className="muted">Se define después de cerrar la inspección: programar la reparación, seguirla, marcarla reparada o no hacer ninguna acción.</p>
              <div className="split">
                <Field label="Status">
                  <select value={decision.status} onChange={(event) => setDecision({ ...decision, status: event.target.value })}>
                    {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Fotos" hint="Hasta 4, JPG o PNG.">
                  <input
                    key={`status-${fileKey}`}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setDecision({ ...decision, photos: Array.from(event.target.files || []).slice(0, 4) })}
                  />
                </Field>
              </div>
              <Field label="Nota">
                <textarea
                  rows={3}
                  maxLength={800}
                  value={decision.note}
                  placeholder="Por qué se programa, se sigue, se da por reparada o no se actúa"
                  onChange={(event) => setDecision({ ...decision, note: event.target.value })}
                />
              </Field>
              {decision.photos.length > 0 && <p className="muted">{decision.photos.map((file) => file.name).join(", ")}</p>}
              <button className="btn" type="submit" disabled={busy === "status"}>{busy === "status" ? "Guardando…" : "Registrar status"}</button>
            </form>
          ) : (
            <p className="muted">El status se define cuando el técnico cierra la inspección.</p>
          )}

          <h2>Trazabilidad</h2>
          {data.events.length === 0 && <p className="muted">Todavía no hay seguimientos.</p>}
          <div className="timeline">
            {data.events.map((event) => (
              <article key={event.id}>
                <span className="dot" aria-hidden="true" />
                <header className="actions">
                  <Pill value={event.status || "seguimiento"} label={WORK_STATUS_LABEL[event.status] || event.status} />
                  <span className="muted">{formatDateTime(event.created_at)}{event.author_name ? ` · ${event.author_name}` : ""}</span>
                </header>
                {event.note && <p>{event.note}</p>}
                {event.photos.length > 0 && (
                  <div className="photo-grid">
                    {event.photos.map((photo) => (
                      <a key={photo.id} href={eventPhotoUrl(photo.id)} target="_blank" rel="noreferrer">
                        <img src={eventPhotoUrl(photo.id)} alt="Foto del seguimiento" />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          <h2>Repuestos</h2>
          <div className="stack">
            {data.items.length === 0 && <p>Esta máquina se revisó sin repuestos anotados.</p>}
            {data.items.map((item) => (
              <article key={item.id} className="card">
                <header>
                  <div>
                    <h2>{item.description}</h2>
                    <p className="muted">{item.code} · cantidad {item.quantity}{item.part_type ? ` · ${item.part_type}` : ""}</p>
                  </div>
                  <Pill value={item.condition} label={labelOf(item.condition)} />
                </header>
                {item.note && <p>{item.note}</p>}
                {item.photos.length > 0 && (
                  <div className="photo-grid">
                    {item.photos.map((photo) => (
                      <a key={photo.id} href={photoUrl(photo.id)} target="_blank" rel="noreferrer">
                        <img src={photoUrl(photo.id)} alt={`Evidencia de ${item.description}`} />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
