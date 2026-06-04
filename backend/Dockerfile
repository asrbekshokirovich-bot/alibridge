# ============================================
# ALI BRIDGE — Backend Dockerfile (optimized)
# ============================================

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=0 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System dependencies (minimal - no tesseract)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    libssl-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app


# ---------- Development stage ----------
FROM base AS development

# Copy requirements first (cache layer)
COPY requirements.txt ./

# Install with pip (much faster than poetry)
# --retries/--timeout: beqaror tarmoq (PyPI) uchun bardoshlilik
RUN pip install --upgrade pip && \
    pip install --retries 10 --timeout 120 -r requirements.txt

# Copy source code (mounted in docker-compose)
COPY . .

RUN mkdir -p /app/logs

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ---------- Production stage ----------
FROM base AS production

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install --retries 10 --timeout 120 -r requirements.txt

COPY . .
RUN mkdir -p /app/logs

RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*"]
