import { useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { ROLE_LABEL, useFetch } from "../../format";
import { Banner, Field, Modal, Page } from "../../ui";

const blank = { full_name: "", username: "", password: "", role: "encargado", technician_id: "" };

export default function Users() {
  const { user } = useAuth();
  const staff = user?.role === "superadmin" || user?.role === "encargado";
  const list = useFetch(() => (staff ? api("/api/users") : Promise.resolve([])), [staff]);
  const technicians = useFetch(() => (staff ? api("/api/users/technicians") : Promise.resolve([])), [staff]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user.role !== "superadmin" && user.role !== "encargado") return <Navigate to="/app" replace />;
  const roles = user?.role === "superadmin"
    ? [["tecnico", "Técnico"], ["encargado", "Encargado"], ["superadmin", "Superadmin"]]
    : [["tecnico", "Técnico"], ["encargado", "Encargado"]];

  const linked = form?.role === "tecnico" && form.technician_id;
  const choices = (technicians.data || []).filter((tech) => !tech.user_id || tech.user_id === form?.id);
  const chosen = (technicians.data || []).find((tech) => String(tech.id) === String(form?.technician_id));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      full_name: linked ? null : form.full_name,
      username: form.username,
      role: form.role,
      password: form.password || null,
      technician_id: linked ? Number(form.technician_id) : null,
    };
    try {
      if (form.id) await api(`/api/users/${form.id}`, { method: "PATCH", body });
      else await api("/api/users", { method: "POST", body });
      setForm(null);
      list.reload();
      technicians.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row) {
    const action = row.active ? "archive" : "restore";
    if (row.active && !window.confirm(`¿Desactivar a ${row.full_name}?`)) return;
    setError("");
    try {
      await api(`/api/users/${row.id}/${action}`, { method: "POST" });
      list.reload();
      technicians.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page
      title="Usuarios"
      lede={user?.role === "superadmin"
        ? "Crea el acceso de un técnico, un encargado o un superadmin. Si eliges un técnico, el nombre sale de su ficha."
        : "Puedes crear técnicos y encargados. Si eliges un técnico, el nombre sale de su ficha."}
      action={<button type="button" className="btn" onClick={() => setForm({ ...blank })}>Nuevo usuario</button>}
    >
      <Banner>{error || list.error}</Banner>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Técnico</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td data-label="Nombre">{row.full_name}</td>
                <td data-label="Usuario">{row.username}</td>
                <td data-label="Rol">{ROLE_LABEL[row.role]}</td>
                <td data-label="Técnico">{row.technician_name || "—"}</td>
                <td data-label="Estado">{row.active ? "Activo" : "Inactivo"}</td>
                <td className="actions" data-label="">
                  <button type="button" className="btn ghost small" onClick={() => setForm({ ...row, technician_id: row.technician_id || "", password: "" })}>Editar</button>
                  <button type="button" className="btn danger small" onClick={() => toggle(row)}>{row.active ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title={form.id ? "Editar usuario" : "Nuevo usuario"} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Banner>{error}</Banner>
            <Field label="Rol">
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value, technician_id: event.target.value === "tecnico" ? form.technician_id : "" })}
              >
                {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            {form.role === "tecnico" && (
              <Field label="Técnico" hint="Opcional. Si lo eliges, el nombre se toma de la ficha.">
                <select value={form.technician_id || ""} onChange={(event) => setForm({ ...form, technician_id: event.target.value })}>
                  <option value="">Sin vincular</option>
                  {choices.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
                </select>
              </Field>
            )}
            {linked ? (
              <p className="muted">Nombre: {chosen?.name || form.full_name}</p>
            ) : (
              <Field label="Nombre">
                <input required minLength={3} value={form.full_name || ""} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
              </Field>
            )}
            <Field label="Usuario"><input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></Field>
            <Field label="Contraseña" hint={form.id ? "Déjala vacía para no cambiarla." : "Mínimo 6 caracteres."}>
              <input type="password" required={!form.id} minLength={form.password ? 6 : undefined} value={form.password || ""} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </Field>
            <button className="btn block" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </Page>
  );
}
