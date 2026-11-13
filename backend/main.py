"""API prototipe lokal: inferensi tanpa pelatihan ulang per permintaan."""
from contextlib import asynccontextmanager
import os
from pathlib import Path
from dotenv import load_dotenv

# Railway environment tetap menang atas konfigurasi lokal.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", encoding="utf-8-sig")
from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from model.recommender import ARTIFACT, load_model, recommend


@asynccontextmanager
async def lifespan(app):
    if not ARTIFACT.exists():
        raise RuntimeError("Artefak belum tersedia. Jalankan notebook sampai bagian export.")
    if os.getenv("REQUIRE_FRONTEND") == "1" and not (FRONTEND_DIST / "index.html").is_file():
        raise RuntimeError("Build frontend tidak ditemukan. Deploy menggunakan Dockerfile dari root proyek.")
    app.state.bundle = load_model()
    yield


app = FastAPI(title="Eksplorasi Peran Magang", lifespan=lifespan)
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])


class Profile(BaseModel):
    skills: list[str] = Field(min_length=1, max_length=50)
    interest: str = Field(default="", max_length=500)
    category: str | None = Field(default=None, max_length=100)
    scope: Literal["internship", "early_career", "all"] = "internship"
    method: Literal["tfidf", "knn"] = "tfidf"
    k: int = Field(default=5, ge=1, le=20)

    @field_validator("skills")
    @classmethod
    def check_skills(cls, values):
        if any(not value.strip() or len(value) > 100 for value in values):
            raise ValueError("Setiap skill harus berisi 1–100 karakter.")
        return values


@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "ok", "rows": len(app.state.bundle["jobs"]), "mode": "local-prototype"}


@app.get("/api/catalog")
@app.get("/catalog")
def catalog():
    bundle = app.state.bundle
    jobs = bundle["jobs"]
    candidates = jobs.loc[jobs["internship_candidate"]]
    # Contoh katalog tanpa skor: belum merupakan rekomendasi personal.
    preview_columns = ["job_id", "category", "job_title", "job_description", "skills", "internship_candidate"]
    return {"categories": sorted(bundle["jobs"]["category"].unique().tolist()),
            "skills": bundle["skill_encoder"].classes_.tolist(),
            "internship_candidates": int(bundle["jobs"]["internship_candidate"].sum()),
            "category_counts": candidates["category"].value_counts().to_dict(),
            "suggested_skills": candidates["skills"].explode().value_counts().head(24).index.tolist(),
            "preview_jobs": candidates.sort_values(["category", "job_id"])[preview_columns].to_dict("records")}


@app.post("/api/recommend")
@app.post("/recommend")
def recommendations(profile: Profile):
    try:
        return recommend(app.state.bundle, **profile.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/jobs")
@app.get("/jobs")
def jobs(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    data = app.state.bundle["jobs"]
    columns = ["job_id", "category", "job_title", "job_description", "skills", "internship_candidate"]
    return {"total": len(data), "items": data.iloc[offset:offset+limit][columns].to_dict("records")}

# CV diterima sebagai body biner agar batas ukuran diperiksa saat streaming.
from fastapi import Request
from starlette.concurrency import run_in_threadpool
import httpx
from uuid import UUID, uuid4
from backend.cv import MAX_CV_BYTES, MIME_TYPES, extract_skills


@app.post("/api/cv")
@app.post("/cv")
async def upload_cv(request: Request, extension: Literal["pdf", "docx", "txt"]):
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not url or not key:
        raise HTTPException(503, "Penyimpanan CV Supabase belum dikonfigurasi.")
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Masuk terlebih dahulu untuk mengunggah CV.")
    headers = {"apikey": key, "Authorization": authorization}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Validasi token pada Auth server; identitas tidak diterima dari body pengguna.
            user = await client.get(f"{url}/auth/v1/user", headers=headers)
            if user.status_code != 200:
                raise HTTPException(401, "Sesi tidak valid atau kedaluwarsa. Silakan masuk lagi.")
            user_id = str(UUID(user.json()["id"]))
            payload = bytearray()
            async for chunk in request.stream():
                if len(payload) + len(chunk) > MAX_CV_BYTES:
                    raise HTTPException(413, "Ukuran CV maksimal 5 MB (5.000.000 byte).")
                payload.extend(chunk)
            try:
                analysis = await run_in_threadpool(extract_skills, bytes(payload), extension,
                                                 app.state.bundle["skill_encoder"].classes_.tolist())
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
            path = f"{user_id}/{uuid4()}.{extension}"
            # Token pengguna mempertahankan aturan kepemilikan RLS. Tidak memakai service_role.
            response = await client.post(f"{url}/storage/v1/object/cvs/{path}",
                                         headers={**headers, "Content-Type": MIME_TYPES[extension], "x-upsert": "false"},
                                         content=bytes(payload))
            if response.status_code not in (200, 201):
                raise HTTPException(502, "CV belum tersimpan. Periksa bucket cvs dan kebijakan akses Supabase.")
            return {**analysis, "path": path, "stored": True,
                    "message": "CV tersimpan privat. Tinjau skill terdeteksi sebelum mencari rekomendasi."}
    except httpx.HTTPError as error:
        raise HTTPException(502, "Koneksi Supabase gagal. Coba kembali atau periksa daftar CV sebelum mengulang unggahan.") from error


# Daftarkan frontend terakhir agar /api dan endpoint lama tetap menuju API.
from fastapi.staticfiles import StaticFiles
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if (FRONTEND_DIST / "index.html").is_file():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
