import { useMemo, useState } from "react";
import { api, machinePhotoUrl } from "../../api";
import { useAuth } from "../../auth";
import { useFetch } from "../../format";
import { Banner, Empty, Field, Modal, Page, Pill } from "../../ui";

function PhotoField({ label, hint, preview, onPick, onClear }) {
  return (
    <div className="field">
      <span>{label}</span>
      <input type="file" accept="image/*" capture="environment" onChange={onPick} />
      {hint ? <small>{hint}</small> : null}
      {preview ? <img className="form-photo" src={preview} alt={label} /> : null}
      {onClear ? <button type="button" className="text-btn" onClick={onClear}>Quitar foto</button> : null}
    </div>
  );
}

const blank = {
  serial: "",
  brand_id: "",
  model_id: "",
  location: "",
  year: "",
  machineFile: null,
  serialFile: null,
  machinePreview: "",
  serialPreview: "",
  removeMachine: false,
  removeSerial: false,
};

export default function Machines() {
  const { user } = useAuth();
  const canSeeArchived = user?.role === "superadmin";
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const list = useFetch(
    () => api(`/api/machines?include_archived=${includeArchived}&q=${encodeURIComponent(query)}`),
    [includeArchived, query],
  );
  const brands = useFetch(() => api("/api/brands?include_archived=true"), []);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const models = useMemo(() => {
    const brand = brands.data?.find((item) => item.id === Number(form?.brand_id));
    return brand?.models || [];
  }, [brands.data, form?.brand_id]);

  function closeForm() {
    if (form?.machinePreview) URL.revokeObjectURL(form.machinePreview);
    if (form?.serialPreview) URL.revokeObjectURL(form.serialPreview);
    setForm(null);
  }

  function openForm(row) {
    setError("");
    setForm(row ? {
      ...blank,
      ...row,
      location: row.location || "",
      year: row.year || "",
    } : { ...blank });
  }

  function pickPhoto(kind, event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    const fileKey = kind === "maquina" ? "machineFile" : "serialFile";
    const previewKey = kind === "maquina" ? "machinePreview" : "serialPreview";
    const removeKey = kind === "maquina" ? "removeMachine" : "removeSerial";
    setForm((current) => {
      if (current[previewKey]) URL.revokeObjectURL(current[previewKey]);
      return {
        ...current,
        [fileKey]: file,
        [previewKey]: file ? URL.createObjectURL(file) : "",
        [removeKey]: false,
      };
    });
  }

  function clearPhoto(kind) {
    const fileKey = kind === "maquina" ? "machineFile" : "serialFile";
    const previewKey = kind === "maquina" ? "machinePreview" : "serialPreview";
    const removeKey = kind === "maquina" ? "removeMachine" : "removeSerial";
    setForm((current) => {
      if (current[previewKey]) URL.revokeObjectURL(current[previewKey]);
      return { ...current, [fileKey]: null, [previewKey]: "", [removeKey]: true };
    });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      serial: form.serial,
      brand_id: Number(form.brand_id),
      model_id: Number(form.model_id),
      location: form.location || null,
      year: form.year === "" ? null : Number(form.year),
    };
    let saved = null;
    try {
      saved = form.id
        ? await api(`/api/machines/${form.id}`, { method: "PATCH", body })
        : await api("/api/machines", { method: "POST", body });
      if (form.removeMachine && !form.machineFile) {
        await api(`/api/machines/${saved.id}/photos/maquina`, { method: "DELETE" });
      }
      if (form.removeSerial && !form.serialFile) {
        await api(`/api/machines/${saved.id}/photos/serie`, { method: "DELETE" });
      }
      if (form.machineFile) {
        const data = new FormData();
        data.set("photo", form.machineFile);
        await api(`/api/machines/${saved.id}/photos/maquina`, { method: "POST", form: data });
      }
      if (form.serialFile) {
        const data = new FormData();
        data.set("photo", form.serialFile);
        await api(`/api/machines/${saved.id}/photos/serie`, { method: "POST", form: data });
      }
      closeForm();
      list.reload();
    } catch (err) {
      if (saved && !form.id) setForm((current) => (current ? { ...current, id: saved.id } : current));
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row) {
    const action = row.archived ? "restore" : "archive";
    if (!window.confirm(row.archived ? "¿Restaurar la máquina?" : "¿Archivar la máquina?")) return;
    setError("");
    try {
      await api(`/api/machines/${row.id}/${action}`, { method: "POST" });
      list.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page
      title="Máquinas"
      lede="La serie, la marca y el modelo identifican cada reefer. La foto de la máquina, la foto de la serie, la ubicación y el año son opcionales."
      action={<button type="button" className="btn" onClick={() => openForm(null)}>Nueva máquina</button>}
    >
      <Banner>{error || list.error}</Banner>
      <form className="filters" onSubmit={(event) => { event.preventDefault(); setQuery(q.trim()); }}>
        <input value={q} placeholder="Buscar serie o ubicación" onChange={(event) => setQ(event.target.value)} />
        <button className="btn ghost" type="submit">Buscar</button>
        {canSeeArchived && (
          <label className="check"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Mostrar archivadas</label>
        )}
      </form>
      {list.loading && <p>Cargando…</p>}
      {!list.loading && list.data?.length === 0 && <Empty title="Sin máquinas" text="Registra la serie que se va a inspeccionar." />}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Serie</th><th>Marca</th><th>Modelo</th><th>Ubicación</th><th>Año</th><th>Fotos</th><th>Revisión</th><th></th></tr>
          </thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td data-label="Serie">{row.serial}{row.archived ? " · archivada" : ""}</td>
                <td data-label="Marca">{row.brand_name}</td>
                <td data-label="Modelo">{row.model_name}</td>
                <td data-label="Ubicación">{row.location || "—"}</td>
                <td data-label="Año">{row.year || "—"}</td>
                <td data-label="Fotos">{[row.has_machine_photo ? "Máquina" : "", row.has_serial_photo ? "Serie" : ""].filter(Boolean).join(" · ") || "—"}</td>
                <td data-label="Revisión">{row.active_assignment ? <Pill value={row.active_assignment.status} /> : "Libre"}</td>
                <td className="actions" data-label="">
                  <button type="button" className="btn ghost small" onClick={() => openForm(row)}>Editar</button>
                  {row.archived ? (
                    canSeeArchived && <button type="button" className="btn danger small" onClick={() => toggle(row)}>Restaurar</button>
                  ) : (
                    <button type="button" className="btn danger small" onClick={() => toggle(row)}>Archivar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? "Editar máquina" : "Nueva máquina"} onClose={closeForm}>
          <form onSubmit={save}>
            <Banner>{error}</Banner>
            <Field label="Serie"><input value={form.serial} required onChange={(event) => setForm({ ...form, serial: event.target.value })} /></Field>
            <Field label="Marca">
              <select
                required
                value={form.brand_id}
                onChange={(event) => setForm({ ...form, brand_id: event.target.value, model_id: "" })}
              >
                <option value="">Elegir</option>
                {brands.data?.filter((brand) => !brand.archived || brand.id === Number(form.brand_id)).map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Modelo">
              <select required value={form.model_id} onChange={(event) => setForm({ ...form, model_id: event.target.value })}>
                <option value="">Elegir</option>
                {models.filter((model) => !model.archived || model.id === Number(form.model_id)).map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Ubicación" hint="Opcional.">
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </Field>
            <Field label="Año" hint="Opcional.">
              <input type="number" min="1980" max="2100" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
            </Field>
            <PhotoField
              label="Foto de la máquina"
              hint="Opcional."
              preview={form.machinePreview || (form.id && form.has_machine_photo && !form.removeMachine ? machinePhotoUrl(form.id, "maquina") : "")}
              onPick={(event) => pickPhoto("maquina", event)}
              onClear={form.machinePreview || (form.has_machine_photo && !form.removeMachine) ? () => clearPhoto("maquina") : null}
            />
            <PhotoField
              label="Foto de la serie"
              hint="Opcional. La placa donde se lee la serie."
              preview={form.serialPreview || (form.id && form.has_serial_photo && !form.removeSerial ? machinePhotoUrl(form.id, "serie") : "")}
              onPick={(event) => pickPhoto("serie", event)}
              onClear={form.serialPreview || (form.has_serial_photo && !form.removeSerial) ? () => clearPhoto("serie") : null}
            />
            <button className="btn block" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </Page>
  );
}
