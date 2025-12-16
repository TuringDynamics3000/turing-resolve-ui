# Risk Brain Reporter — Dockerfile
#
# Author: TuringCore National Infrastructure Team
# Version: 1.0

FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binaries
RUN go build -o /bin/weekly-job ./cmd/weekly-job
RUN go build -o /bin/api ./cmd/api

# Runtime image
FROM alpine:latest

# Install dependencies
RUN apk add --no-cache ca-certificates

# Copy binaries
COPY --from=builder /bin/weekly-job /bin/weekly-job
COPY --from=builder /bin/api /bin/api

# Set entrypoint
ENTRYPOINT ["/bin/weekly-job"]
