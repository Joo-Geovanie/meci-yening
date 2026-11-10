"""Unduh snapshot Hugging Face tanpa menimpa berkas mentah yang sudah ada."""
from pathlib import Path
from urllib.request import urlopen
from datetime import datetime, timezone
import hashlib
import io
import json
import pandas as pd

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw"
REPO = "batuhanmtl/job-skill-set"
# Revision dikunci agar hasil unduhan dapat direproduksi.
REVISION = "78e2e843eada1d3c901bc7fb123eaf2dc1c3c36f"
BASE_URL = f"https://huggingface.co/datasets/{REPO}/resolve/{REVISION}"


def download_dataset():
    RAW.mkdir(parents=True, exist_ok=True)
    parquet_path = RAW / "job_skill_set_train.parquet"
    csv_path = RAW / "job_skill_set_train.csv"
    metadata_path = RAW / "metadata.json"
    card_path = RAW / "source_README.md"
    if any(path.exists() for path in [parquet_path, csv_path, metadata_path, card_path]):
        raise FileExistsError("Berkas raw sudah ada. Unduhan dihentikan agar tidak menimpa data.")

    url = f"{BASE_URL}/data/train-00000-of-00001.parquet"
    with urlopen(url, timeout=120) as response:
        parquet_bytes = response.read()
    with urlopen(f"{BASE_URL}/README.md", timeout=60) as response:
        card_bytes = response.read()
    data = pd.read_parquet(io.BytesIO(parquet_bytes))
    # Tidak ada filter, normalisasi, penghapusan duplikat, atau perubahan kolom.
    csv_bytes = data.to_csv(index=False, lineterminator="\n").encode("utf-8")
    restored = pd.read_csv(io.BytesIO(csv_bytes), keep_default_na=False)
    pd.testing.assert_frame_equal(data, restored, check_dtype=False)

    metadata = {
        "dataset": REPO, "revision": REVISION, "split": "train",
        "source_url": url, "downloaded_at_utc": datetime.now(timezone.utc).isoformat(),
        "rows": len(data), "columns": data.columns.tolist(),
        "sha256_parquet": hashlib.sha256(parquet_bytes).hexdigest(),
        "sha256_csv": hashlib.sha256(csv_bytes).hexdigest(),
        "conversion": "Parquet ke CSV UTF-8, index=False; tanpa pembersihan data",
    }
    # Mode xb/x menolak penimpaan, termasuk jika skrip dijalankan ulang.
    for path, content in [(parquet_path, parquet_bytes), (csv_path, csv_bytes), (card_path, card_bytes)]:
        with path.open("xb") as file:
            file.write(content)
    with metadata_path.open("x", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2)
    print(f"Berhasil: {csv_path}\nUkuran dataset: {data.shape}")


if __name__ == "__main__":
    download_dataset()
