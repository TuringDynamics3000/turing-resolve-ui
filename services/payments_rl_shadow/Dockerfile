# Payments RL Shadow Consumer — Production Dockerfile
# Version: 1.0
# Base: Python 3.11 slim (Debian-based)

FROM python:3.11-slim

# Metadata
LABEL maintainer="TuringCore National Infrastructure Team"
LABEL version="1.0"
LABEL description="Payments RL Shadow Consumer - First Live B Domain"

# Set working directory
WORKDIR /app

# Install system dependencies (if needed for future ML models)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY consumer.py .
COPY __init__.py .

# Create non-root user for security
RUN useradd -m -u 1000 turingcore && \
    chown -R turingcore:turingcore /app

USER turingcore

# Health check (optional, checks if process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -f consumer.py || exit 1

# Default environment variables (override in deployment)
ENV KAFKA_BOOTSTRAP=localhost:9092
ENV RISK_BRAIN_PAYMENTS_RL_ENABLED=false
ENV RISK_BRAIN_GOV_AUTH=SHADOW_DISABLED

# Run consumer
CMD ["python", "consumer.py"]
