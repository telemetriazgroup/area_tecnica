import { useState } from "react";
import { api, download } from "../../api";
import { useAuth } from "../../auth";
import { useFetch } from "../../format";
import { Banner, Empty, Field, Modal, Page } from "../../ui";

const blank = { name: "", cargo: "", dni: "", phone: "" };

export default function Technicians() {
  const { user } = useAuth();
  const canSeeArchived = user?.role === "superadmin";
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const list = useFetch(
    () => api(`/api/technicians?include_archived=${includeArchived}&q=${encodeURIComponent(query)}`),
    [includeArchived, query],
  );
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      name: form.name,
      cargo: form.cargo || null,
      dni: form.dni || null,
      phone: form.phone || null,
    };
    try {
      if (form.id) await api(`/api/technicians/${form.id}`, { method: "PATCH", body });
      else await api("/api/technicians", { method: "POST", body });
      setForm(null);
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row) {
    const action = row.archived ? "restore" : "archive";
    const question = row.archived ? "¿Restaurar este técnico?" : "¿Archivar este técnico?";
    if (!window.confirm(question)) return;
    setError("");
    try {
      await api(`/api/technicians/${row.id}/${action}`, { method: "POST" });
      list.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await api("/api/technicians/bulk", { method: "POST", form: formData });
      const sample = (result.errors || []).slice(0, 3).map((item) => `Fila ${item.row}: ${item.detail}`).join(" ");
      const fails = result.errors?.length ? ` ${result.errors.length} filas con error.` : "";
      setMessage(`Se crearon ${result.created} y se actualizaron ${result.updated}.${fails} ${sample}`.trim());
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Técnicos"
      lede="El nombre es el único dato obligatorio. El acceso al celular se crea aparte, en Usuarios."
      action={<button type="button" className="btn" onClick={() => { setError(""); setForm({ ...blank }); }}>Nuevo técnico</button>}
    >
      <Banner>{error || list.error}</Banner>
      <Banner kind="ok">{message}</Banner>
      <form className="filters" onSubmit={(event) => { event.preventDefault(); setQuery(q.trim()); }}>
        <input value={q} placeholder="Buscar por nombre, DNI o usuario" onChange={(event) => setQ(event.target.value)} />
        <button className="btn ghost" type="submit">Buscar</button>
        {canSeeArchived && (
          <label className="check"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Mostrar archivados</label>
        )}
      </form>
      <div className="actions" style={{ marginBottom: 14 }}>
        <label className="btn ghost">
          Cargar Excel
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={upload} />
        </label>
        <button type="button" className="btn ghost" onClick={() => download("/api/technicians/template", "plantilla-tecnicos.xlsx").catch((err) => setError(err.message))}>
          Descargar plantilla
        </button>
      </div>
      {list.loading && <p>Cargando…</p>}
      {!list.loading && list.data?.length === 0 && <Empty title="No hay técnicos" text="Agrega el primero o sube la plantilla Excel." />}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Nombre</th><th>Cargo</th><th>DNI</th><th>Número</th><th>Usuario</th><th></th></tr>
          </thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td data-label="Nombre">{row.name}{row.archived ? " · archivado" : ""}</td>
                <td data-label="Cargo">{row.cargo || "—"}</td>
                <td data-label="DNI">{row.dni || "—"}</td>
                <td data-label="Número">{row.phone || "—"}</td>
                <td data-label="Usuario">{row.username || "Sin usuario"}</td>
                <td className="actions" data-label="">
                  <button type="button" className="btn ghost small" onClick={() => setForm({ ...blank, ...row })}>Editar</button>
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
        <Modal title={form.id ? "Editar técnico" : "Nuevo técnico"} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Banner>{error}</Banner>
            <Field label="Apellido y nombre" hint="Único campo obligatorio.">
              <input value={form.name} required minLength={3} onChange={(event) => update("name", event.target.value)} />
            </Field>
            <Field label="Cargo"><input value={form.cargo || ""} onChange={(event) => update("cargo", event.target.value)} /></Field>
            <Field label="DNI"><input value={form.dni || ""} onChange={(event) => update("dni", event.target.value)} /></Field>
            <Field label="Número"><input value={form.phone || ""} onChange={(event) => update("phone", event.target.value)} /></Field>
            {form.username && <p className="muted">Usuario ligado: {form.username}</p>}
            <button className="btn block" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </Page>
  );
}
