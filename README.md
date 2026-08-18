# MONARK — Gestor del Sistema

Aplicación de escritorio para Windows que centraliza gestión de archivos, monitoreo de hardware, procesos y red en una sola herramienta — con un diseño propio, coherente y más rápido que alternar entre el Explorador de Windows, el Administrador de Tareas y herramientas de red sueltas.

Este proyecto es, además, una **práctica deliberada** antes de construir una versión profesional equivalente para **Arch Linux** — varias decisiones de arquitectura (detección de tipo de archivo por contenido en vez de extensión, estructura de rutas protegidas configurable, etc.) están tomadas pensando en esa portabilidad futura.

## Estado actual

**Iteración 1 (MVP) — completa.** Backend y frontend funcionando de punta a punta contra datos reales del sistema.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLite |
| Frontend | Tauri, React, TypeScript, Tailwind CSS v4, Framer Motion |
| Base de datos | SQLite (local). PostgreSQL en la nube planeado para sincronización remota futura |

## Módulos implementados (Iteración 1)

### Archivos (9 endpoints)
Crear/renombrar/mover/eliminar carpetas y archivos, conversión de archivos (Nivel 1 y 2: texto↔markdown, imágenes, texto/DOCX→PDF), listado de contenido, analizador de espacio en disco con caché y desglose por categorías, listado automático de unidades detectadas, y papelera de reciclaje propia (solo lectura en esta iteración).

**Principio de diseño clave:** el tipo de archivo se detecta por **contenido** (magic bytes, vía `python-magic`), no por extensión — coherente con convenciones de Linux y con la meta de portabilidad a Arch.

### Hardware (2 endpoints/canales)
Monitor en tiempo real de CPU (global y por núcleo), RAM y velocidad de disco I/O vía WebSocket (actualización cada 1 segundo), más un endpoint de estado general resumido (bien/regular/mal) con umbrales configurables en base de datos.

### Procesos (1 canal)
Visor de procesos activos en tiempo real vía WebSocket. El backend no ordena ni filtra — esa lógica vive en el frontend.

### Red (4 endpoints)
Estado de conexión (IP local/pública, gateway, adaptador), test de velocidad (vía CLI oficial de Ookla), puertos en uso por el sistema, y dispositivos detectados en la red local (tabla ARP).

## Estructura del proyecto

```
MONARK/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── database/
│   │   └── gestor_sistema.db      (no versionado — ver Instalación)
│   └── routers/
│       ├── files.py
│       ├── disk.py
│       ├── hardware.py
│       ├── processes.py
│       └── network.py
└── frontend/
    ├── src/
    │   ├── api/                    (conexión a cada módulo del backend)
    │   ├── components/              (Sidebar, modales, íconos)
    │   ├── pages/                   (Dashboard, Archivos, Hardware, Red, Papelera)
    │   └── App.tsx
    └── src-tauri/
```

## Instalación

### Requisitos previos

- Python 3.11+
- Node.js LTS
- Rust (vía [rustup](https://rustup.rs))
- Visual Studio Build Tools 2022, con el componente **"Desarrollo para el escritorio con C++"**
- [Ookla Speedtest CLI](https://www.speedtest.net/apps/cli) (`winget install Ookla.Speedtest.CLI`, y ejecutarlo una vez manualmente para aceptar la licencia)
- (Opcional) [Pandoc](https://pandoc.org/installing.html) — solo necesario para la conversión DOCX → PDF

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

**Base de datos**: el archivo `.db` no está versionado (contiene datos locales, no código). Créalo con [DB Browser for SQLite](https://sqlitebrowser.org/) ejecutando el script de creación de tablas y datos iniciales documentado en `docs/modelo_de_datos.sql` *(pendiente de generar — por ahora, ver el historial de definición del proyecto)*.

> **Mejora pendiente anotada**: automatizar este paso con un script de inicialización que cree la base de datos sola en el primer arranque si no existe.

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run tauri dev
```

Con el backend corriendo en `http://localhost:8000` y el frontend con `npm run tauri dev`, la aplicación de escritorio se abre automáticamente.

## Hoja de ruta

**Iteración 2**: restaurar/purgar en la papelera, caché de tamaño de carpetas, verificación de estado de software, compresión/descompresión, detección de duplicados, backup básico.

**Iteración 3**: detección de archivos peligrosos, OCR, cifrado/descifrado.

**Iteración 4**: clasificación de riesgo de procesos, escaneo activo de red, análisis de vulnerabilidades — módulo de seguridad completo.

**A futuro**: sincronización en la nube (PostgreSQL) y acceso remoto desde celular/reloj/lentes inteligentes; versión profesional para Arch Linux.

## Mejoras pendientes identificadas (no bloquean la Iteración 1)

- Selector visual de carpeta destino al mover archivos (actualmente se escribe la ruta manualmente).
- Actualización optimista de la interfaz al eliminar/convertir (evitar recarga completa de la lista).
- Script de inicialización automática de la base de datos.
- Lógica de bloqueo parcial de rutas (Documentos/Descargas: no eliminables como carpeta completa, pero contenido editable) — actualmente solo existe el bloqueo total.
- Excepción de `AppData` para la carpeta propia de la papelera dentro del sistema de rutas protegidas.
- Etiqueta de volumen real de Windows en el listado de unidades (actualmente muestra el punto de montaje).

## Licencia

Proyecto personal, actualmente sin licencia pública definida.
