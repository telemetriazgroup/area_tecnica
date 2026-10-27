# Área técnica

Sistema para inspeccionar reefers de segundo uso: el encargado asigna máquinas, el técnico registra faltantes desde el celular y el reporte junta lo que hay que pedir a almacén.

## Cómo levantarlo

```bash
docker compose up --build
```

Abre [http://localhost:8180/inspecciones](http://localhost:8180/inspecciones).

La primera vez se cargan marcas, modelos, repuestos y una inspección de ejemplo. Para cambiar la clave de sesión, copia `.env.example` a `.env` y define `JWT_SECRET`.

## Accesos de prueba

| Perfil | Usuario | Contraseña |
| --- | --- | --- |
| Superadmin | `admin` | `admin123` |
| Encargado | `encargado` | `encargado123` |
| Técnico | `jperez` | `tecnico123` |
| Técnico | `mlopez` | `tecnico123` |

`jperez` ya tiene la serie `RFFU1234567` asignada. La serie `RFFU7654321` está revisada, para ver fotos, estados y el reporte.

## Perfiles

- **Técnico:** solo ve sus máquinas. Busca el repuesto, indica cantidad, estado (faltante, incompleto o inoperativo), nota y foto.
- **Encargado:** técnicos (uno a uno o con Excel), marcas, modelos, series, catálogo de repuestos, asignaciones, inspecciones y reportes.
- **Superadmin:** lo mismo que el encargado, más usuarios (técnico, encargado y superadmin), auditoría de lo archivado y respaldo JSON de los módulos. Un usuario técnico puede quedar ligado a una ficha para tomar su nombre.

## Reportes

En Reportes se puede ver el día, lo que pide cada serie, el total de una marca y modelo, y el conglomerado para almacén. El botón Imprimir usa el diálogo de impresión del navegador.
# area_tecnica
