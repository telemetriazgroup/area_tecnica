import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Splash } from "./ui";
import Login from "./pages/Login";
import TechHome from "./pages/tech/TechHome";
import Inspect from "./pages/tech/Inspect";
import AdminLayout from "./pages/admin/Layout";
import Dashboard from "./pages/admin/Dashboard";
import Technicians from "./pages/admin/Technicians";
import Brands from "./pages/admin/Brands";
import Machines from "./pages/admin/Machines";
import Parts from "./pages/admin/Parts";
import Assignments from "./pages/admin/Assignments";
import Inspections from "./pages/admin/Inspections";
import InspectionDetail from "./pages/admin/InspectionDetail";
import Reports from "./pages/admin/Reports";
import Users from "./pages/admin/Users";
import Manuals from "./pages/admin/Manuals";
import Conditions from "./pages/admin/Conditions";
import Audit from "./pages/admin/Audit";
import Backup from "./pages/admin/Backup";

function homeFor(user) {
  return user?.role === "tecnico" ? "/tecnico" : "/app";
}

function Gate({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function Start() {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/login" element={<Login />} />
      <Route path="/tecnico" element={<Gate roles={["tecnico"]}><TechHome /></Gate>} />
      <Route path="/tecnico/inspeccion/:id" element={<Gate roles={["tecnico"]}><Inspect /></Gate>} />
      <Route path="/app" element={<Gate roles={["encargado", "superadmin"]}><AdminLayout /></Gate>}>
        <Route index element={<Dashboard />} />
        <Route path="tecnicos" element={<Technicians />} />
        <Route path="marcas" element={<Brands />} />
        <Route path="maquinas" element={<Machines />} />
        <Route path="repuestos" element={<Parts />} />
        <Route path="manuales" element={<Manuals />} />
        <Route path="asignaciones" element={<Assignments />} />
        <Route path="inspecciones" element={<Inspections />} />
        <Route path="inspecciones/:id" element={<InspectionDetail />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="usuarios" element={<Users />} />
        <Route path="condiciones" element={<Conditions />} />
        <Route path="auditoria" element={<Audit />} />
        <Route path="backup" element={<Backup />} />
      </Route>
      <Route path="*" element={<Start />} />
    </Routes>
  );
}
