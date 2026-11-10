"""Jalankan notebook dari awal sampai akhir dan simpan output setelah berhasil."""
from pathlib import Path
import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parent
path = ROOT / "notebook" / "machine_learning.ipynb"
notebook = nbformat.read(path, as_version=4)
nbformat.validate(notebook)
NotebookClient(notebook, timeout=600, kernel_name="python3",
               resources={"metadata": {"path": str(ROOT)}}).execute()
nbformat.write(notebook, path)
print("Notebook selesai; seluruh output disimpan.")
