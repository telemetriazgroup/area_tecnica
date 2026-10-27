import { useState } from "react";
import { Navigate } from "react-router-dom";
import { download } from "../../api";
import { useAuth } from "../../auth";
import { Banner, Page } from "../../ui";

const MODULES = [
  ["all", "Todo", "Técnicos, usuarios, marcas, máquinas, repuestos, asignaciones e inspecciones."],
  ["technicians", "Técnicos", "Fichas, cargo, DNI y número."],
  ["users", "Usuarios", "Accesos, sin contraseñas."],
  ["brands", "Marcas y modelos", "Catálogo de marcas con sus modelos."],
  ["machines", "Máquinas", "Series, ubicación y año."],
  ["spare_parts", "Repuestos", "Serie, descripción y tipo."],
  ["assignments", "Asignaciones", "Qué máquina se encargó a cada técnico."],
  ["inspections", "Inspecciones", "Ítems, notas y referencias de fotos. No incluye los archivos de imagen."],
];

export default function Backup() {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  if (user && user.role !== "superadmin") return <Navigate to="/app" replace />;

  async function save(module) {
    setBusy(module);
    setError("");
    const filename = module === "all" ? "respaldo-area-tecnica.json" : `respaldo-${module}.json`;
    try {
      await download(`/api/backup?module=${module}`, filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <Page title="Backup" lede="Descarga un JSON con la información de los módulos. No incluye contraseñas ni las fotos.">
      <Banner>{error}</Banner>
      {MODULES.map(([module, title, text]) => (
        <section key={module} className="card">
          <header>
            <div>
              <h2>{title}</h2>
              <p className="muted">{text}</p>
            </div>
            <button type="button" className="btn small" disabled={Boolean(busy)} onClick={() => save(module)}>
              {busy === module ? "Descargando…" : "Descargar"}
            </button>
          </header>
        </section>
      ))}
    </Page>
  );
}
