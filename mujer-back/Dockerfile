# syntax=docker/dockerfile:1

FROM golang:1.24-bookworm AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/mujer-alerta-api \
    .

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /out/mujer-alerta-api /app/mujer-alerta-api
COPY --from=builder /src/config /app/config

ENV PORT=8080

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/app/mujer-alerta-api"]
