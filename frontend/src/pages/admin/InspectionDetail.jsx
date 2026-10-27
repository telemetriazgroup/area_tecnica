import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, photoUrl } from "../../api";
import { formatDateTime, formatDuration, useFetch } from "../../format";
import { Banner, MachinePhotos, ManualView, Page, Pill } from "../../ui";

export default function InspectionDetail() {
  const { id } = useParams();
  const detail = useFetch(() => api(`/api/inspections/${id}`), [id]);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const conditions = useFetch(() => api("/api/conditions"), []);
  const labelOf = (key) => conditions.data?.find((row) => row.key === key)?.label;
  const data = detail.data;

  return (
    <Page
      title={data ? data.machine.serial : "Inspección"}
      lede={data ? `${data.machine.brand} · ${data.machine.model} · ${data.technician_name}` : "Cargando el detalle."}
      action={<Link className="btn ghost" to="/app/inspecciones">Volver</Link>}
    >
      <Banner>{detail.error}</Banner>
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
            {" · "}{data.completed_at ? `Cerró la lista ${formatDateTime(data.completed_at)}` : "La lista sigue abierta"}
          </p>
          <Pill value={data.status} />
          <div className="actions">
            <button type="button" className="btn ghost photos-btn" onClick={() => setPhotosOpen(true)}>Ver fotos</button>
            <button type="button" className="btn ghost photos-btn" onClick={() => setManualOpen(true)}>Ver manual</button>
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
          <div className="stack" style={{ marginTop: 16 }}>
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
