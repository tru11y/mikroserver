# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM gradle:8.11-jdk21 AS build
WORKDIR /app
COPY gradle/ gradle/
COPY build.gradle.kts settings.gradle.kts ./
RUN gradle dependencies --no-daemon || true
COPY src/ src/
RUN gradle buildFatJar --no-daemon

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache wireguard-tools iproute2 && \
    addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY --from=build /app/build/libs/mikroserver.jar app.jar

# Non-root except nsenter needs to run as root for host namespace access
# The entrypoint script drops privileges after nsenter ops if needed
USER root

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["java", \
    "-XX:+UseG1GC", \
    "-XX:MaxGCPauseMillis=100", \
    "-XX:+UseStringDeduplication", \
    "-Xms256m", \
    "-Xmx512m", \
    "-Dlogback.configurationFile=logback-prod.xml", \
    "-jar", "app.jar"]
