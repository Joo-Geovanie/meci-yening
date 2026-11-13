# Frontend dibangun sekali, lalu disajikan oleh FastAPI pada domain yang sama.
FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_URL=/api
RUN npm run build

FROM python:3.14-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 REQUIRE_FRONTEND=1
COPY requirements-runtime.txt ./
RUN pip install --no-cache-dir -r requirements-runtime.txt
COPY backend/ ./backend/
COPY model/recommender.py ./model/recommender.py
COPY model/artifacts/recommender.joblib ./model/artifacts/recommender.joblib
COPY --from=frontend /build/frontend/dist ./frontend/dist
CMD ["python", "-m", "backend.serve"]
