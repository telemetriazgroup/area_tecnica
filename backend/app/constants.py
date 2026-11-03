ROLES = {"superadmin", "encargado", "tecnico"}
STAFF = {"superadmin", "encargado"}
STAFF_ROLES = {"encargado", "tecnico"}
DEFAULT_CONDITIONS = (
    ("cambio", "Cambio", 1),
    ("instalacion", "Instalación", 2),
    ("desinstalacion", "Desinstalación", 3),
)
OPEN_ASSIGNMENT = {"pendiente", "en_proceso"}
MAX_PHOTOS = 4
WORK_STATUSES = ("programado", "en_proceso", "reparado")
WORK_STATUS_LABEL = {
    "programado": "Programado",
    "en_proceso": "En proceso",
    "reparado": "Reparado",
    "todos": "Todos",
}
MACHINE_STATUSES = ("stock", "asignado")
MACHINE_STATUS_LABEL = {
    "stock": "Stock",
    "asignado": "Asignado",
}
