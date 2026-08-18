-- =============================================================================
-- MONARK — Gestor del Sistema
-- Script de creación de base de datos (Iteración 1)
-- =============================================================================
-- Cómo usarlo:
--   1) Abre este archivo en DB Browser for SQLite (pestaña "Execute SQL")
--   2) Ejecútalo completo (▶ o Ctrl+Return)
--   3) File → Write Changes (Ctrl+S) — NO olvides este paso, o se pierde todo
--
-- Este script recrea exactamente el estado de la base de datos tal como quedó
-- definida y usada durante el desarrollo de la Iteración 1. Si formateas tu PC
-- o clonas el proyecto en otra máquina, este archivo es todo lo que necesitas
-- para volver a tener la base de datos funcionando (colócala en
-- backend/database/gestor_sistema.db).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tabla 1: trash_items — Papelera propia de la aplicación
-- -----------------------------------------------------------------------------
CREATE TABLE trash_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_path TEXT NOT NULL,
    trash_path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
    size_bytes INTEGER,
    deleted_at TEXT NOT NULL
);
-- Sin datos iniciales: se va llenando con el uso real de la app.
-- Borrado físico de la fila al restaurar/purgar (Iteración 2).


-- -----------------------------------------------------------------------------
-- Tabla 2: disk_analysis — Caché del análisis de espacio en disco
-- -----------------------------------------------------------------------------
CREATE TABLE disk_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive TEXT NOT NULL,
    total_bytes INTEGER NOT NULL,
    used_bytes INTEGER NOT NULL,
    free_bytes INTEGER NOT NULL,
    used_percentage REAL NOT NULL,
    breakdown_json TEXT NOT NULL,
    analyzed_at TEXT NOT NULL
);
-- Sin datos iniciales: se llena la primera vez que se analiza cada unidad.


-- -----------------------------------------------------------------------------
-- Tabla 3: protected_paths — Rutas protegidas del sistema
-- -----------------------------------------------------------------------------
CREATE TABLE protected_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    protection_level TEXT NOT NULL CHECK (protection_level IN ('total', 'partial')),
    reason TEXT,
    added_at TEXT NOT NULL
);

INSERT INTO protected_paths (path, protection_level, reason, added_at) VALUES
('C:/Windows', 'total', 'Archivos del sistema operativo', '2026-08-07T00:00:00Z'),
('C:/Program Files', 'total', 'Programas instalados del sistema', '2026-08-07T00:00:00Z'),
('C:/Program Files (x86)', 'total', 'Programas instalados del sistema (32 bits)', '2026-08-07T00:00:00Z'),
('C:/ProgramData', 'total', 'Configuración compartida de aplicaciones', '2026-08-07T00:00:00Z'),
('C:/bootmgr', 'total', 'Archivo de arranque del sistema', '2026-08-07T00:00:00Z'),
('C:/pagefile.sys', 'total', 'Archivo de memoria virtual del sistema', '2026-08-07T00:00:00Z'),
('C:/hiberfil.sys', 'total', 'Archivo de hibernación del sistema', '2026-08-07T00:00:00Z'),
('C:/swapfile.sys', 'total', 'Archivo de intercambio del sistema', '2026-08-07T00:00:00Z');
-- Pendiente (anotado como mejora futura): AppData (con excepción para la
-- carpeta propia de la papelera) y la lógica real de bloqueo 'partial'
-- para Documentos/Descargas/Escritorio.


-- -----------------------------------------------------------------------------
-- Tabla 4: hardware_thresholds — Umbrales configurables de hardware
-- -----------------------------------------------------------------------------
CREATE TABLE hardware_thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric TEXT NOT NULL UNIQUE CHECK (metric IN ('cpu', 'ram', 'disk_space')),
    good_max REAL NOT NULL,
    regular_max REAL NOT NULL,
    weight REAL NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO hardware_thresholds (metric, good_max, regular_max, weight, updated_at) VALUES
('cpu', 60, 85, 0.35, '2026-08-04T00:00:00Z'),
('ram', 70, 90, 0.35, '2026-08-04T00:00:00Z'),
('disk_space', 80, 95, 0.30, '2026-08-04T00:00:00Z');


-- -----------------------------------------------------------------------------
-- Tabla 5: user_preferences — Preferencias visuales del usuario
-- -----------------------------------------------------------------------------
CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preference_key TEXT NOT NULL UNIQUE,
    preference_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO user_preferences (preference_key, preference_value, updated_at) VALUES
('theme_mode', 'dark', '2026-08-04T00:00:00Z'),
('background_opacity', '70', '2026-08-04T00:00:00Z'),
('accent_color', '#3D5AFE', '2026-08-04T00:00:00Z'),
('dark_background_color', '#171E33', '2026-08-04T00:00:00Z'),
('light_background_color', '#FFFFFF', '2026-08-04T00:00:00Z');

-- =============================================================================
-- Fin del script. Verifica en "Database Structure" que las 5 tablas existan,
-- y en "Browse Data" que hardware_thresholds y user_preferences tengan sus
-- filas iniciales. No olvides File → Write Changes.
-- =============================================================================
