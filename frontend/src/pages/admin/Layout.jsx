import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BASE } from "../../api";
import { useAuth } from "../../auth";
import { ROLE_LABEL } from "../../format";

const LINKS = [
  ["/app", "Inicio", true],
  ["/app/tecnicos", "Técnicos"],
  ["/app/marcas", "Marcas y modelos"],
  ["/app/maquinas", "Máquinas"],
  ["/app/repuestos", "Repuestos"],
  ["/app/asignaciones", "Asignaciones"],
  ["/app/inspecciones", "Inspecciones"],
  ["/app/reportes", "Reportes"],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const links = user?.role === "superadmin"
    ? [...LINKS, ["/app/usuarios", "Usuarios"], ["/app/auditoria", "Auditoría"], ["/app/backup", "Backup"]]
    : LINKS;

  return (
    <div className="layout">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <img src={`${BASE}/logo.png`} alt="ZGROUP" />
          <div>
            <strong>Área técnica</strong>
            <span>Reefers de segundo uso</span>
          </div>
        </div>
        <nav className="nav">
          {links.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={Boolean(end)} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <footer>
          <div>
            <strong>{user?.full_name}</strong>
            <span>{ROLE_LABEL[user?.role]}</span>
          </div>
          <button type="button" className="text-btn" onClick={logout}>Salir</button>
        </footer>
      </aside>
      {open && <button type="button" className="backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
      <div className="workspace">
        <header className="topbar">
          <button type="button" className="btn small menu-btn" onClick={() => setOpen(true)}>Menú</button>
          <div className="topbar-id">
            <img className="topbar-logo" src={`${BASE}/logo.png`} alt="" />
            <strong>{user?.full_name}</strong>
          </div>
          <button type="button" className="btn exit small" onClick={logout}>Salir</button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
