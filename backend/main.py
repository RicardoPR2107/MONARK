from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import files, disk, hardware, processes, network

app = FastAPI(title="Gestor del Sistema API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],  # puertos/orígenes de tu frontend en desarrollo y producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(disk.router)
app.include_router(hardware.router)
app.include_router(processes.router)
app.include_router(network.router)

@app.get("/")
def root():
    return {"success": True, "data": "API funcionando correctamente", "error": None}