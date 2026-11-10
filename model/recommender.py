"""Pencocokan peran berbasis konten. Tidak mengubah data mentah."""
from pathlib import Path
import ast
import re
import unicodedata
import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "model" / "artifacts" / "recommender.joblib"


def normalize(text):
    """Samakan kapitalisasi dan spasi tanpa menghapus C++, C#, atau .NET."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(text))).strip().lower()


def prepare_jobs(raw):
    jobs = raw.copy()
    required = ["job_title", "job_description", "job_skill_set", "category"]
    jobs = jobs.dropna(subset=required).drop_duplicates().reset_index(drop=True)
    jobs["skills"] = jobs["job_skill_set"].apply(
        lambda text: sorted({normalize(s) for s in ast.literal_eval(text) if normalize(s)})
    )
    jobs["internship_candidate"] = jobs["job_title"].str.contains(
        r"\b(?:interns?|internships?)\b", case=False, na=False
    )
    jobs["early_career_candidate"] = jobs["job_title"].str.contains(
        r"\b(?:interns?|internships?|trainees?|entry[\s\-‐‑–—]*level)\b", case=False, na=False
    )
    # Deskripsi dipakai penuh; tidak mengarang skill, lokasi, atau tingkat pengalaman.
    jobs["content"] = (jobs["job_title"] + " " + jobs["skills"].str.join(" ")
                       + " " + jobs["job_description"]).apply(normalize)
    return jobs


def build_model(jobs):
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2),
                                 sublinear_tf=True, max_features=30000,
                                 token_pattern=r"(?u)\b[\w][\w.+#-]*")
    text_matrix = vectorizer.fit_transform(jobs["content"])
    skill_encoder = MultiLabelBinarizer(sparse_output=True)
    skill_matrix = skill_encoder.fit_transform(jobs["skills"]).tocsr()
    skill_neighbors = NearestNeighbors(metric="cosine", algorithm="brute").fit(skill_matrix)
    return {"jobs": jobs, "vectorizer": vectorizer, "text_matrix": text_matrix,
            "skill_encoder": skill_encoder, "skill_matrix": skill_matrix,
            "skill_neighbors": skill_neighbors}


def save_model(bundle, path=ARTIFACT):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, path)


def load_model(path=ARTIFACT):
    # Hanya muat artefak lokal yang dibuat proyek ini, bukan unggahan pengguna.
    return joblib.load(path)


def recommend(bundle, skills, interest="", category=None, scope="internship", method="tfidf", k=5):
    if scope not in {"internship", "early_career", "all"}:
        raise ValueError("Scope tidak dikenal")
    if method not in {"tfidf", "knn"}:
        raise ValueError("Metode tidak dikenal")
    jobs = bundle["jobs"]
    if category and category not in set(jobs["category"]):
        raise ValueError("Kategori tidak tersedia")
    profile_skills = sorted({normalize(s) for s in skills if normalize(s)})
    mask = pd.Series(True, index=jobs.index)
    if scope == "internship":
        mask &= jobs["internship_candidate"]
    elif scope == "early_career":
        mask &= jobs["early_career_candidate"]
    if category:
        mask &= jobs["category"].eq(category)
    indices = jobs.index[mask].to_numpy()
    vocabulary = set(bundle["skill_encoder"].classes_)
    unknown_skills = sorted(set(profile_skills) - vocabulary)
    response = {"results": [], "candidate_count": len(indices), "unknown_skills": unknown_skills,
                "method": method, "message": "", "scope": scope}
    if not len(indices):
        response["message"] = "Tidak ada kandidat pada filter ini. Coba kategori lain."
        return response
    if method == "tfidf":
        query = bundle["vectorizer"].transform([" ".join(profile_skills) + " " + normalize(interest)])
        if query.nnz == 0:
            response["message"] = "Keterampilan dan minat belum dikenali. Coba istilah pada katalog skill."
            return response
        scores = cosine_similarity(query, bundle["text_matrix"][indices]).ravel()
    else:
        # KNN memakai fitur biner skill, sehingga berbeda dari TF-IDF deskripsi.
        known = [s for s in profile_skills if s in vocabulary]
        if not known:
            response["message"] = "KNN memerlukan minimal satu skill yang cocok dengan katalog."
            return response
        query = bundle["skill_encoder"].transform([known])
        distances, order = bundle["skill_neighbors"].kneighbors(query, n_neighbors=len(jobs))
        all_scores = np.zeros(len(jobs))
        all_scores[order[0]] = np.clip(1 - distances[0], 0, 1)
        scores = all_scores[indices]
    # Ikatan skor diurutkan menggunakan job_id agar hasil deterministik.
    ranked = sorted(zip(indices, scores), key=lambda pair: (-pair[1], int(jobs.iloc[pair[0]]["job_id"])))
    for idx, score in ranked:
        if score <= 1e-12:
            continue
        row = jobs.iloc[idx]
        matched = sorted(set(profile_skills) & set(row["skills"]))
        missing = sorted(set(row["skills"]) - set(profile_skills))
        response["results"].append({
            "job_id": int(row["job_id"]), "job_title": row["job_title"],
            "category": row["category"], "job_description": row["job_description"],
            "score": round(float(np.clip(score, 0, 1)) * 100, 2),
            "matched_skills": matched, "missing_skills": missing,
            "internship_candidate": bool(row["internship_candidate"]),
            "explanation": (f"{len(matched)} skill cocok secara persis setelah normalisasi. "
                            + ("Peringkat memakai kemiripan teks profil dan pekerjaan."
                               if method == "tfidf" else "Peringkat memakai kemiripan himpunan skill.")),
        })
        if len(response["results"]) >= k:
            break
    if not response["results"]:
        response["message"] = "Tidak ada kecocokan positif pada filter ini. Coba skill atau kategori lain."
    return response
