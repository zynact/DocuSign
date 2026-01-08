FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

COPY web/package.json ./
RUN npm i

COPY web .

RUN npm run build

FROM golang:1.25.4-alpine AS backend-builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o inkra main.go

# ======================
# Runtime stage
# ======================
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=backend-builder /app/inkra /app/inkra

COPY --from=frontend-builder /app/static /app/static

RUN mkdir -p docs/uploads docs/signed data

# Volumes for persistence
VOLUME ["/app/app.db", "/app/docs"]

CMD ["/app/inkra"]
