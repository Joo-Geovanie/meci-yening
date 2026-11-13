"""Baca CV di memori; hanya skill katalog yang diteruskan ke rekomendasi."""
from io import BytesIO
import re
from zipfile import ZipFile
from xml.etree import ElementTree
from pypdf import PdfReader
from model.recommender import normalize

MAX_CV_BYTES = 5_000_000  # 5 MB desimal, sama dengan frontend dan Storage.
MIME_TYPES = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "txt": "text/plain"}


def extract_skills(data, extension, vocabulary):
    if not data or len(data) > MAX_CV_BYTES:
        raise ValueError("CV harus berisi data dan maksimal 5 MB (5.000.000 byte).")
    if extension not in MIME_TYPES:
        raise ValueError("Gunakan CV PDF, DOCX, atau TXT.")
    try:
        if extension == "pdf":
            if not data.startswith(b"%PDF-"):
                raise ValueError("Isi file bukan PDF.")
            reader = PdfReader(BytesIO(data))
            if reader.is_encrypted or len(reader.pages) > 30:
                raise ValueError("PDF harus tanpa password dan maksimal 30 halaman.")
            parts = []
            for page in reader.pages:
                content = page.get_contents()
                if content and len(content.get_data()) > 10_000_000:
                    raise ValueError("Isi halaman PDF terlalu kompleks.")
                parts.append(page.extract_text() or "")
            text = "\n".join(parts)
        elif extension == "docx":
            with ZipFile(BytesIO(data)) as archive:
                if sum(item.file_size for item in archive.infolist()) > 20_000_000:
                    raise ValueError("Isi DOCX setelah dibuka terlalu besar.")
                xml = archive.read("word/document.xml")
                if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
                    raise ValueError("Struktur DOCX tidak didukung.")
                root = ElementTree.fromstring(xml)
                text = " ".join(root.itertext())
        else:
            text = data.decode("utf-8-sig")
            if "\x00" in text:
                raise ValueError("TXT harus berupa teks UTF-8.")
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("CV tidak dapat dibaca. Gunakan PDF teks, DOCX, atau TXT UTF-8 yang valid.") from error
    if not text.strip():
        raise ValueError("Teks CV tidak ditemukan. PDF hasil scan perlu OCR terlebih dahulu.")
    text = normalize(text)
    if len(text) > 100_000:
        raise ValueError("Teks CV terlalu panjang (maksimal 100.000 karakter).")
    # Batas kata mencegah 'java' cocok dengan 'javascript'; tanda +/# tetap diperiksa.
    skills = sorted(skill for skill in vocabulary if re.search(r"(?<![\w+#])" + re.escape(skill) + r"(?![\w+#])", text))
    return {"skills": skills[:50], "detected_count": len(skills), "character_count": len(text)}
