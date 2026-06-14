import http from "http";
import { execFileSync } from "child_process";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const DEFAULT_REMOTE_URL = "https://stitch.googleapis.com/mcp";
const remoteUrl = process.env.STITCH_PROXY_REMOTE_URL || DEFAULT_REMOTE_URL;
const host = process.env.STITCH_PROXY_HOST || "127.0.0.1";
const port = Number(process.env.STITCH_PROXY_PORT || process.argv[2] || 17892);
const inboundKey = process.env.STITCH_PROXY_API_KEY || process.env.STITCH_API_KEY || "";

configureProxyForNodeFetch();

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      writeCors(response, 204);
      response.end();
      return;
    }

    if (request.method !== "POST") {
      writeJson(response, 405, { error: "Method not allowed" });
      return;
    }

    if (inboundKey && request.headers["x-goog-api-key"] !== inboundKey) {
      writeJson(response, 401, { error: "Missing or invalid local Stitch proxy key." });
      return;
    }

    const body = await readRequestBody(request);
    const accessToken = readGcloudValue(["auth", "application-default", "print-access-token"]);
    const projectId =
      process.env.STITCH_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      readGcloudValue(["config", "get-value", "project"]);

    if (!accessToken || !projectId) {
      writeJson(response, 500, {
        error: "Missing OAuth credentials. Run gcloud auth application-default login and set a Google Cloud project.",
      });
      return;
    }

    const upstream = await fetch(remoteUrl, {
      method: "POST",
      headers: {
        Accept: request.headers.accept || "application/json, text/event-stream",
        "Content-Type": request.headers["content-type"] || "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Goog-User-Project": projectId,
      },
      body,
    });

    const upstreamBody = await upstream.arrayBuffer();
    response.writeHead(upstream.status, {
      "Access-Control-Allow-Origin": "http://127.0.0.1",
      "Access-Control-Allow-Headers": "Content-Type, X-Goog-Api-Key",
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    response.end(Buffer.from(upstreamBody));
  } catch (error) {
    writeJson(response, 500, { error: sanitizeError(error) });
  }
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      status: "listening",
      url: `http://${host}:${port}/mcp`,
      remoteUrl,
      inboundKeyRequired: Boolean(inboundKey),
    }),
  );
});

function configureProxyForNodeFetch() {
  if (process.env.STITCH_DISABLE_PROXY === "1") {
    return;
  }

  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (!proxyUrl) {
    return;
  }

  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

function readGcloudValue(args) {
  try {
    return execFileSync("gcloud", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10000,
    }).trim();
  } catch {
    return "";
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function writeCors(response, statusCode) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "http://127.0.0.1",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Goog-Api-Key",
    "Cache-Control": "no-store",
  });
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "http://127.0.0.1",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Goog-Api-Key",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function sanitizeError(error) {
  return String(error?.message || error)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer <redacted>")
    .replace(/(AQ\.)[A-Za-z0-9_-]+/g, "$1<redacted>")
    .replace(/([?&](?:key|token|access_token)=)[^&\s]+/gi, "$1<redacted>");
}
