"""Metrik ranking hanya dijalankan setelah label manusia lengkap."""
import numpy as np
import pandas as pd
from model.recommender import recommend


def evaluate_rankings(bundle, profiles, labels, k=5, extra_rankings=None):
    candidate_ids = set(bundle["jobs"].loc[bundle["jobs"]["internship_candidate"], "job_id"])
    expected = {(p["profile_id"], int(job_id)) for p in profiles for job_id in candidate_ids}
    pairs = list(zip(labels["profile_id"], labels["job_id"]))
    if len(pairs) != len(set(pairs)) or set(pairs) != expected:
        raise ValueError("Pasangan penilaian harus tepat satu per profil dan kandidat.")
    if not labels["relevance"].isin([0, 1, 2]).all():
        raise ValueError("Seluruh label harus diisi 0, 1, atau 2 oleh penilai.")
    for col in ["assessor", "reason"]:
        if labels[col].fillna("").str.strip().eq("").any():
            raise ValueError("Identitas penilai dan alasan wajib lengkap.")
    extra_rankings = extra_rankings or {}
    records = []
    for method in ["tfidf", "knn", *extra_rankings]:
        for profile in profiles:
            relevance = labels.loc[labels["profile_id"].eq(profile["profile_id"])].set_index("job_id")["relevance"]
            if method in extra_rankings:
                ranked_ids = extra_rankings[method][profile["profile_id"]][:k]
            else:
                result = recommend(bundle, profile["skills"], profile["interest"], method=method, k=k)
                ranked_ids = [item["job_id"] for item in result["results"]]
            if len(ranked_ids) != len(set(ranked_ids)) or not set(ranked_ids) <= candidate_ids:
                raise ValueError("Ranking berisi ID duplikat atau di luar kandidat penilaian.")
            grades = [float(relevance.loc[job_id]) for job_id in ranked_ids]
            grades += [0] * (k-len(grades))
            grades = np.array(grades)
            total_relevant = int(relevance.eq(2).sum())
            hits = int((grades == 2).sum())
            discounts = np.log2(np.arange(2, k+2))
            dcg = ((2**grades-1)/discounts).sum()
            ideal = sorted(relevance.tolist(), reverse=True)[:k]
            ideal += [0] * (k-len(ideal))
            idcg = ((2**np.array(ideal)-1)/discounts).sum()
            records.append({"method": method, "profile_id": profile["profile_id"],
                            "precision_at_k": hits/k,
                            "recall_at_k": hits/total_relevant if total_relevant else np.nan,
                            "ndcg_at_k": dcg/idcg if idcg else np.nan})
    return pd.DataFrame(records)
