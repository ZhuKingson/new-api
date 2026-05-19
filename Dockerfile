FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS frontend-builder

ARG BUILD_CLASSIC=true
ARG FRONTEND_NODE_OPTIONS=--max-old-space-size=1024
ENV NODE_OPTIONS=${FRONTEND_NODE_OPTIONS}

WORKDIR /build

# default frontend
COPY web/default/package.json web/default/bun.lock ./web/default/
RUN cd web/default && bun install --frozen-lockfile
COPY ./web/default ./web/default
COPY ./VERSION ./VERSION
RUN cd web/default && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

# classic frontend (optional in dev to reduce CPU usage)
COPY web/classic/package.json web/classic/bun.lock ./web/classic/
RUN if [ "${BUILD_CLASSIC}" = "true" ]; then cd web/classic && bun install --frozen-lockfile; fi
COPY ./web/classic ./web/classic
RUN if [ "${BUILD_CLASSIC}" = "true" ]; then \
      cd web/classic && VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build; \
    else \
      mkdir -p /build/web/classic/dist && \
      echo '<!doctype html><html><head><title>classic disabled</title></head><body>classic frontend build skipped</body></html>' > /build/web/classic/dist/index.html; \
    fi

FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder2
ENV GO111MODULE=on CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=frontend-builder /build/web/default/dist ./web/default/dist
COPY --from=frontend-builder /build/web/classic/dist ./web/classic/dist
RUN go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$(cat VERSION)'" -o new-api

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=builder2 /build/new-api /
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md /licenses/
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/new-api"]
