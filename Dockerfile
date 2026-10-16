# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS ui-build
WORKDIR /source/src/Jackett.UI
COPY src/Jackett.UI/package.json src/Jackett.UI/package-lock.json ./
RUN npm ci
COPY src/Jackett.UI ./
RUN mkdir -p ../Jackett.Common/Content && npm run build

FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS app-build
ARG TARGETARCH
ARG JACKETT_VERSION=0.24.2856-modern.5
WORKDIR /source
COPY . .
COPY --from=ui-build /source/src/Jackett.Common/Content/UI ./src/Jackett.Common/Content/UI
RUN case "$TARGETARCH" in \
      amd64) runtime_id="linux-musl-x64" ;; \
      arm64) runtime_id="linux-musl-arm64" ;; \
      arm) runtime_id="linux-musl-arm" ;; \
      *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac && \
    dotnet publish src/Jackett.Server/Jackett.Server.csproj \
      --framework net9.0 \
      --configuration Release \
      --runtime "$runtime_id" \
      --self-contained true \
      /p:Version="$JACKETT_VERSION" \
      --output /publish

FROM lscr.io/linuxserver/jackett:latest
RUN find /app/Jackett -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
COPY --from=app-build --chown=abc:users /publish/ /app/Jackett/
