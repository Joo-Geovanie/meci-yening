"""Uji perilaku; skenario ini bukan bukti evaluasi relevansi akademik."""
import hashlib
import json
from pathlib import Path
import pandas as pd
import pytest
import numpy as np
from fastapi.testclient import TestClient
from backend.main import app
from model.recommender import load_model, recommend
from model.evaluation import evaluate_rankings

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def bundle():
    return load_model()


@pytest.mark.parametrize("method", ["tfidf", "knn"])
def test_filter_ranking_and_explanations(bundle, method):
    result = recommend(bundle, ["communication", "recruitment"], category="HR", method=method)
    assert result["results"]
    assert all(item["category"] == "HR" and item["internship_candidate"] for item in result["results"])
    assert [x["score"] for x in result["results"]] == sorted([x["score"] for x in result["results"]], reverse=True)
    for item in result["results"]:
        source = bundle["jobs"].set_index("job_id").loc[item["job_id"]]
        assert set(item["matched_skills"]) == set(source.skills) & {"communication", "recruitment"}
        assert not set(item["matched_skills"]) & set(item["missing_skills"])


@pytest.mark.parametrize("method", ["tfidf", "knn"])
def test_unknown_input_does_not_return_arbitrary_jobs(bundle, method):
    result = recommend(bundle, ["zzzzunrecognizedskillzzzz"], method=method)
    assert result["results"] == []
    assert result["message"]


def test_raw_unchanged():
    meta = json.loads((ROOT / "data/raw/metadata.json").read_text())
    for extension in ["csv", "parquet"]:
        content = (ROOT / f"data/raw/job_skill_set_train.{extension}").read_bytes()
        assert hashlib.sha256(content).hexdigest() == meta[f"sha256_{extension}"]


def test_evaluation_rejects_missing_labels(bundle):
    candidates = bundle["jobs"].loc[bundle["jobs"]["internship_candidate"]]
    profiles = [{"profile_id": "test", "skills": ["communication"], "interest": "HR"}]
    labels = pd.DataFrame({"profile_id": "test", "job_id": candidates["job_id"], "relevance": None})
    with pytest.raises(ValueError, match="label"):
        evaluate_rankings(bundle, profiles, labels)


def test_api_validation_and_catalog():
    with TestClient(app) as client:
        assert client.get("/health").json()["rows"] == 1167
        assert client.get("/catalog").json()["internship_candidates"] == 25
        assert client.get("/jobs?limit=0").status_code == 422
        assert client.post("/recommend", json={"skills": []}).status_code == 422
        assert client.post("/recommend", json={"skills": ["   "]}).status_code == 422
        assert client.post("/recommend", json={"skills": ["python"], "category": "invalid"}).status_code == 422
        response = client.post("/recommend", json={"skills": ["python", "sql", "data analysis"], "k": 5})
        assert response.status_code == 200
        assert 0 < len(response.json()["results"]) <= 5
        assert client.get("/jobs?limit=2&offset=1166").json()["items"][0]["job_id"]


def test_catalog_preview_contains_only_real_internship_candidates(bundle):
    with TestClient(app) as client:
        catalog = client.get("/catalog").json()
    expected = bundle["jobs"].loc[bundle["jobs"]["internship_candidate"]]
    assert {row["job_id"] for row in catalog["preview_jobs"]} == set(expected["job_id"])
    assert sum(catalog["category_counts"].values()) == len(expected)
    assert all("score" not in row and row["skills"] for row in catalog["preview_jobs"])
    assert set(catalog["suggested_skills"]) <= set(expected["skills"].explode())


def test_metric_formula_on_explicit_test_fixture(bundle, monkeypatch):
    # Label buatan hanya untuk unit test rumus, tidak disimpan sebagai data penelitian.
    ids = bundle["jobs"].loc[bundle["jobs"]["internship_candidate"], "job_id"].tolist()
    labels = pd.DataFrame({"profile_id": "test", "job_id": ids, "relevance": 0,
                           "assessor": "unit-test", "reason": "fixture untuk verifikasi rumus"})
    labels.loc[0:1, "relevance"] = 2
    labels.loc[2, "relevance"] = 1
    monkeypatch.setattr("model.evaluation.recommend", lambda *args, **kwargs: {
        "results": [{"job_id": ids[3]}, {"job_id": ids[0]}, {"job_id": ids[2]}]
    })
    metrics = evaluate_rankings(bundle, [{"profile_id": "test", "skills": ["test"], "interest": ""}], labels)
    expected_ndcg = (3/np.log2(3) + 1/np.log2(4)) / (3 + 3/np.log2(3) + 1/np.log2(4))
    assert np.allclose(metrics["precision_at_k"], 0.2)
    assert np.allclose(metrics["recall_at_k"], 0.5)
    assert np.allclose(metrics["ndcg_at_k"], expected_ndcg)
