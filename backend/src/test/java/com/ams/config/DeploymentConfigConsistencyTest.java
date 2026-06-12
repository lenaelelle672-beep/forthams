package com.ams.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DeploymentConfigConsistencyTest {

    private static final Path REPO_ROOT = resolveRepoRoot();

    @Test
    void singleContainerImageShouldServeSpaThroughNginxAndProxyApiToInternalBackend() throws IOException {
        String dockerfile = read("Dockerfile");
        String nginx = read("docker/single-container-nginx.conf");
        String entrypoint = read("docker/single-container-entrypoint.sh");

        assertThat(dockerfile).contains("FROM node:20-alpine AS frontend-builder");
        assertThat(dockerfile).contains("FROM maven:3.9-eclipse-temurin-17 AS backend-builder");
        assertThat(dockerfile).contains("apt-get install -y --no-install-recommends curl nginx tini");
        assertThat(dockerfile).contains("COPY --from=frontend-builder /build/frontend/dist /app/static");
        assertThat(dockerfile).contains("COPY docker/single-container-nginx.conf /etc/nginx/conf.d/default.conf");
        assertThat(dockerfile).contains("HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3");
        assertThat(dockerfile).contains("http://localhost:8080/api/health");
        assertThat(dockerfile).contains("ENTRYPOINT [\"tini\", \"--\", \"/app/entrypoint.sh\"]");

        assertThat(nginx).contains("listen 8080;");
        assertThat(nginx).contains("root /app/static;");
        assertThat(nginx).contains("location ^~ /api/");
        assertThat(nginx).contains("proxy_pass http://127.0.0.1:8081/api/;");
        assertThat(nginx).contains("try_files $uri $uri/ /index.html;");

        assertThat(entrypoint).contains("java_port=\"${JAVA_PORT:-8081}\"");
        assertThat(entrypoint).contains("java -jar /app/app.jar --server.port=\"${java_port}\"");
        assertThat(entrypoint).contains("nginx -g 'daemon off;'");
    }

    @Test
    void splitContainerDeploymentShouldKeepFrontendProxyAndBackendHealthAligned() throws IOException {
        String backendDockerfile = read("backend/Dockerfile");
        String frontendDockerfile = read("frontend/Dockerfile");
        String frontendNginx = read("frontend/nginx.conf");
        String compose = read("docker-compose.yml");

        assertThat(backendDockerfile).contains("EXPOSE 8080");
        assertThat(backendDockerfile).contains("http://localhost:8080/api/health");
        assertThat(backendDockerfile).contains("ENTRYPOINT [\"java\", \"-jar\", \"app.jar\"]");

        assertThat(frontendDockerfile).contains("COPY frontend/package*.json ./");
        assertThat(frontendDockerfile).contains("RUN npm ci");
        assertThat(frontendDockerfile).contains("COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf");
        assertThat(frontendDockerfile).contains("HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3");

        assertThat(frontendNginx).contains("listen 80;");
        assertThat(frontendNginx).contains("location ^~ /api/");
        assertThat(frontendNginx).contains("proxy_pass http://backend:8080/api/;");
        assertThat(frontendNginx).contains("try_files $uri $uri/ /index.html;");

        assertThat(compose).contains("context: ./backend");
        assertThat(compose).contains("dockerfile: frontend/Dockerfile");
        assertThat(compose).contains("\"8080:8080\"");
        assertThat(compose).contains("\"3000:80\"");
        assertThat(compose).contains("./backend/src/main/resources/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro");
        assertThat(compose).contains("MYSQL_USER: ${DB_USERNAME}");
        assertThat(compose).contains("MYSQL_PASSWORD: ${DB_PASSWORD}");
        assertThat(compose).contains("DB_URL: jdbc:mysql://mysql:3306/ams_db");
        assertThat(compose).contains("condition: service_healthy");
    }

    @Test
    void nginxConfigsShouldProtectApiRoutesFromStaticAssetRegex() throws IOException {
        String singleContainerNginx = read("docker/single-container-nginx.conf");
        String splitFrontendNginx = read("frontend/nginx.conf");

        assertApiProxyPrecedesStaticFallback(singleContainerNginx);
        assertApiProxyPrecedesStaticFallback(splitFrontendNginx);
    }

    @Test
    void ciWorkflowShouldBuildAndSmokeDockerDeploymentArtifacts() throws IOException {
        String workflow = read(".github/workflows/ci.yml");

        assertThat(workflow).contains("MYSQL_ROOT_PASSWORD: ci-root-password");
        assertThat(workflow).contains("DB_USERNAME: ams_user");
        assertThat(workflow).contains("DB_PASSWORD: ci-db-password");
        assertThat(workflow).contains("JWT_SECRET: ci-jwt-secret-for-container-build-only");
        assertThat(workflow).contains("docker-config-build:");
        assertThat(workflow).contains("name: Docker Config & Build");
        assertThat(workflow).contains("timeout-minutes: 30");
        assertThat(workflow).contains("Docker Compose Config");
        assertThat(workflow).contains("docker compose config --quiet");
        assertThat(workflow).contains("Docker Compose Build");
        assertThat(workflow).contains("docker compose build backend frontend");
        assertThat(workflow).contains("Docker Compose Runtime Smoke");
        assertThat(workflow).contains("docker compose -p forthams-ci up -d mysql redis backend frontend");
        assertThat(workflow).contains("curl -fsS http://localhost:8080/api/health");
        assertThat(workflow).contains("curl -fsS http://localhost:3000/");
        assertThat(workflow).contains("curl -fsS http://localhost:3000/workflows");
        assertThat(workflow).contains("curl -fsS http://localhost:3000/api/health");
        assertThat(workflow).contains("grep -q '<div id=\"root\"'");
        assertThat(workflow).contains("docker compose -p forthams-ci down -v --remove-orphans || true");
        assertThat(workflow).contains("Single Container Docker Build");
        assertThat(workflow).contains("docker build -t forthams-single:ci .");
        assertThat(workflow).contains("Single Container Runtime Smoke");
        assertThat(workflow).contains("docker compose -p forthams-single-ci up -d mysql redis");
        assertThat(workflow).contains("docker run --rm --network forthams-single-ci_default mysql:8.0");
        assertThat(workflow).contains("mysql -h mysql -u \"${DB_USERNAME}\" -p\"${DB_PASSWORD}\" ams_db -e \"SELECT 1\"");
        assertThat(workflow).contains("docker run -d --name forthams-single-ci");
        assertThat(workflow).contains("--network forthams-single-ci_default");
        assertThat(workflow).contains("-p 18080:8080");
        assertThat(workflow).contains("forthams-single:ci");
        assertThat(workflow).contains("curl -fsS http://localhost:18080/api/health");
        assertThat(workflow).contains("curl -fsS http://localhost:18080/");
        assertThat(workflow).contains("curl -fsS http://localhost:18080/workflows");
        assertThat(workflow).contains("docker rm -f forthams-single-ci 2>/dev/null || true");
        assertThat(workflow).contains("docker compose -p forthams-single-ci down -v --remove-orphans || true");
    }

    private static void assertApiProxyPrecedesStaticFallback(String nginxConfig) {
        assertThat(nginxConfig).contains("location ^~ /api/");
        assertThat(nginxConfig).contains("location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$");

        int apiLocation = nginxConfig.indexOf("location ^~ /api/");
        int assetLocation = nginxConfig.indexOf("location ~* \\.");

        assertThat(apiLocation).isGreaterThanOrEqualTo(0);
        assertThat(assetLocation).isGreaterThan(apiLocation);
    }

    private static String read(String relativePath) throws IOException {
        return Files.readString(REPO_ROOT.resolve(relativePath)).replace("\r\n", "\n");
    }

    private static Path resolveRepoRoot() {
        Path cwd = Path.of("").toAbsolutePath().normalize();
        if (Files.exists(cwd.resolve("docker-compose.yml")) && Files.exists(cwd.resolve("backend/pom.xml"))) {
            return cwd;
        }
        if (Files.exists(cwd.resolve("pom.xml")) && Files.exists(cwd.getParent().resolve("docker-compose.yml"))) {
            return cwd.getParent();
        }
        throw new IllegalStateException("Cannot locate forthAMS repository root from " + cwd);
    }
}
