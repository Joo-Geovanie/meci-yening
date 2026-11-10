"""API prototipe lokal: inferensi tanpa pelatihan ulang per permintaan."""
from contextlib import asynccontextmanager
import os
from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from model.recommender import ARTIFACT, load_model, recommend


@asynccontextmanager
async def lifespan(app):
    if not ARTIFACT.exists():
        raise RuntimeError("Artefak belum tersedia. Jalankan notebook sampai bagian export.")
    app.state.bundle = load_model()
    yield


app = FastAPI(title="Eksplorasi Peran Magang", lifespan=lifespan)
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


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


@app.get("/health")
def health():
    return {"status": "ok", "rows": len(app.state.bundle["jobs"]), "mode": "local-prototype"}


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


@app.post("/recommend")
def recommendations(profile: Profile):
    try:
        return recommend(app.state.bundle, **profile.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/jobs")
def jobs(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    data = app.state.bundle["jobs"]
    columns = ["job_id", "category", "job_title", "job_description", "skills", "internship_candidate"]
    return {"total": len(data), "items": data.iloc[offset:offset+limit][columns].to_dict("records")}
