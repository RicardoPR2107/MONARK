"""
database.py
Conexión centralizada a la base de datos SQLite del proyecto.
Todos los routers importan get_connection() desde aquí — nunca abren
su propia conexión suelta, para mantener un único punto de control.
"""

import sqlite3
from pathlib import Path

# Ruta al archivo .db que ya creaste con DB Browser for SQLite.
# Ajusta esta ruta si tu archivo .db está en otro lugar dentro de backend/database/
DB_PATH = Path(__file__).parent / "database" / "gestor_sistema.db"


def get_connection() -> sqlite3.Connection:
    """
    Abre y devuelve una conexión nueva a la base de datos.
    Se usa 'row_factory = sqlite3.Row' para que los resultados de las
    consultas se puedan leer como diccionarios (por nombre de columna),
    en vez de tuplas posicionales — mucho más cómodo y legible en el código.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_setting(key: str) -> str | None:
    """
    Función de ayuda genérica para leer un valor individual de
    user_preferences o hardware_thresholds cuando se necesite por separado.
    Ejemplo de uso: get_setting("accent_color")
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT preference_value FROM user_preferences WHERE preference_key = ?",
        (key,)
    )
    row = cursor.fetchone()
    conn.close()
    return row["preference_value"] if row else None