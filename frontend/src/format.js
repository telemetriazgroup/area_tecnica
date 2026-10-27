import { useEffect, useState } from "react";

export function useFetch(loader, deps) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (live) setState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (live) setState({ loading: false, error: error.message || "Error", data: null });
      });
    return () => {
      live = false;
    };
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((value) => value + 1) };
}

const dateTime = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value) {
  if (!value) return "—";
  return dateTime.format(new Date(value));
}

export function formatDuration(from, to) {
  if (!from) return "—";
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  let seconds = Math.max(0, Math.round((end - start) / 1000));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  if (days) return `${days} d ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return "menos de 1 min";
}

export function todayInput() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

export function monthStartInput() {
  return `${todayInput().slice(0, 8)}01`;
}

export function formatInputDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export const STATUS_LABEL = {
  pendiente: "Asignada",
  en_proceso: "En revisión",
  completada: "Revisada",
  cancelada: "Cancelada",
};

export const ROLE_LABEL = {
  superadmin: "Superadmin",
  encargado: "Encargado",
  tecnico: "Técnico",
};
