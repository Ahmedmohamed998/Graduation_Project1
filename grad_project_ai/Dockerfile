# ── Stage 1: build / install heavy deps ───────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# System libs needed at build time
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: production image ──────────────────────────────────────────────
FROM python:3.11-slim AS runner

WORKDIR /app

# Runtime system deps:
#  - tesseract-ocr   → pytesseract OCR
#  - poppler-utils   → pdf2image (PDF → images)
#  - libgomp1        → scikit-learn / numpy OpenMP
#  - libssl3         → Azure Speech SDK TLS/SSL stack
#  - libasound2      → Azure Speech SDK audio layer (required even without mic)
#  - ca-certificates → TLS certificate verification
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ara \
    tesseract-ocr-eng \
    poppler-utils \
    libgomp1 \
    libssl3 \
    libasound2 \
    ca-certificates \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy app source (exclude venv, __pycache__, data artifacts)
COPY . .
RUN rm -rf venv __pycache__ .git data/*.csv data/*.json 2>/dev/null || true

# Non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 8000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
