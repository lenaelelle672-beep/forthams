import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { execFileSync, spawn } from "child_process";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const STITCH_MCP_URL = process.env.STITCH_HOST || "https://stitch.googleapis.com/mcp";

configureProxyForNodeFetch();

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case "projects":
      await listProjects();
      break;
    case "auth":
      await diagnoseAuth();
      break;
    case "proxy-check":
      await checkLocalOAuthProxy();
      break;
    case "generate":
      if (!args[0]) {
        console.error("Usage: stitch-cli.js generate <project-id> <prompt>");
        process.exit(1);
      }
      await generateScreen(args[0], args.slice(1).join(" "));
      break;
    case "screens":
      if (!args[0]) {
        console.error("Usage: stitch-cli.js screens <project-id>");
        process.exit(1);
      }
      await listScreens(args[0]);
      break;
    case "export":
      if (!args[0]) {
        console.error("Usage: stitch-cli.js export <project-id> <screen-id>");
        process.exit(1);
      }
      await exportScreen(args[0], args[1]);
      break;
    case "edit":
      if (!args[0]) {
        console.error("Usage: stitch-cli.js edit <project-id> <screen-id> <prompt>");
        process.exit(1);
      }
      await editScreen(args[0], args[1], args.slice(2).join(" "));
      break;
    case "variants":
      if (!args[0]) {
        console.error("Usage: stitch-cli.js variants <project-id> <screen-id> <prompt>");
        process.exit(1);
      }
      await generateVariants(args[0], args[1], args.slice(2).join(" "));
      break;
    case "create-project":
      await createProject(args.join(" ") || "UNIVIEW 固定资产 Design");
      break;
    case "batch":
      if (!args[0]) {
        console.error("Usage: stitch-cli.js batch <project-id> <prompt-file>");
        process.exit(1);
      }
      await batchGenerate(args[0], args[1]);
      break;
    default:
      console.log(`
UNIVIEW 固定资产 Stitch CLI
===========================
  Commands:
  projects                          List all Stitch projects
  auth                              Diagnose Stitch auth without printing secrets
  proxy-check                       Verify local API-Key-protected proxy -> OAuth upstream
  create-project <name>             Create a new project
  generate <project-id> <prompt>    Generate a screen
  screens <project-id>              List screens in project
  export <project-id> <screen-id>   Export screen HTML + screenshot
  edit <project-id> <screen-id> <prompt>  Edit a screen
  variants <project-id> <screen-id> <prompt>  Generate variants
  batch <project-id> <prompt>       Generate with full DESIGN.md context

Examples:
  node stitch-cli.js projects
  node stitch-cli.js create-project "UNIVIEW 固定资产 Dashboard"
  node stitch-cli.js generate 12345 "UNIVIEW 资产运维中心，复刻无阴影卡片、资产健康指数和产品图图标"
  node stitch-cli.js export 12345 screen-id-here
      `);
  }
}

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

function getStitchAuthSource(authMode = process.env.STITCH_AUTH_MODE) {
  const accessToken = process.env.STITCH_ACCESS_TOKEN || readGcloudValue(["auth", "application-default", "print-access-token"]);
  const projectId =
    process.env.STITCH_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    readGcloudValue(["config", "get-value", "project"]);

  return {
    authMode: authMode || "auto",
    accessToken,
    projectId,
    apiKey: process.env.STITCH_API_KEY || "",
  };
}

function getStitchUrl(options = {}) {
  const url = new URL(STITCH_MCP_URL);
  const source = getStitchAuthSource(options.authMode);

  if (
    options.authMode === "api-key" &&
    source.apiKey &&
    (options.apiKeyTransport === "query" || options.apiKeyTransport === "both")
  ) {
    url.searchParams.set("key", source.apiKey);
  }

  return url;
}

function getStitchAuthHeaders(authMode = process.env.STITCH_AUTH_MODE, apiKeyTransport = "header") {
  const source = getStitchAuthSource(authMode);

  if (authMode !== "api-key") {
    if (source.accessToken && source.projectId) {
      return {
        Authorization: `Bearer ${source.accessToken}`,
        "X-Goog-User-Project": source.projectId,
      };
    }
  }

  if (source.apiKey) {
    if (authMode === "api-key" && apiKeyTransport === "query") {
      return {};
    }
    return { "X-Goog-Api-Key": source.apiKey };
  }

  throw new Error("Missing Stitch credentials. Set STITCH_API_KEY or configure gcloud application-default auth.");
}

async function callStitchTool(name, args = {}, options = {}) {
  const { response, payload, text } = await callStitchRpc("tools/call", { name, arguments: args }, options);

  const result = payload.result;
  if (!response.ok || result?.isError) {
    const message = result?.content?.map((item) => item.text || "").join("\n") || text;
    throw new Error(`Stitch tool ${name} failed (${response.status}): ${message}`);
  }

  if (result?.structuredContent && Object.keys(result.structuredContent).length > 0) {
    return result.structuredContent;
  }

  const textContent = result?.content?.find((item) => item.type === "text")?.text;
  if (!textContent) {
    return {};
  }

  try {
    return JSON.parse(textContent);
  } catch {
    return { text: textContent };
  }
}

async function callStitchRpc(method, params = {}, options = {}) {
  const response = await fetch(getStitchUrl(options), {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...getStitchAuthHeaders(options.authMode, options.apiKeyTransport),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Stitch returned non-JSON response (${response.status}): ${text.slice(0, 400)}`);
  }

  return { response, payload, text };
}

function sanitizeError(error) {
  return String(error?.message || error)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer <redacted>")
    .replace(/(AQ\.)[A-Za-z0-9_-]+/g, "$1<redacted>")
    .replace(/("downloadUrl"\s*:\s*")[^"]+/gi, "$1<redacted>")
    .replace(/(downloadUrl\s*[=:]\s*)https?:\/\/\S+/gi, "$1<redacted>")
    .replace(/https:\/\/(?:contribution\.usercontent\.google\.com|lh3\.googleusercontent\.com)\/\S+/gi, "<redacted-url>")
    .replace(/([?&](?:key|token|access_token|opi|c)=)[^&\s]+/gi, "$1<redacted>");
}

function redactForLog(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      if (/downloadUrl|accessToken|apiKey|authorization/i.test(key)) {
        return [key, "<redacted>"];
      }
      return [key, redactForLog(nestedValue)];
    }),
  );
}

async function probeAuth(authMode, apiKeyTransport) {
  try {
    const raw = await callStitchTool("list_projects", {}, { authMode, apiKeyTransport });
    return {
      ok: true,
      projectCount: (raw.projects || []).length,
    };
  } catch (error) {
    return {
      ok: false,
      message: sanitizeError(error),
    };
  }
}

async function probeApiKeyTransports() {
  const transports = ["header", "query", "both"];
  const entries = await Promise.all(
    transports.map(async (transport) => [transport, await probeAuth("api-key", transport)]),
  );

  return Object.fromEntries(entries);
}

async function probeApiKeyProtocol() {
  return {
    initialize: await probeRpc(
      "initialize",
      {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "forthams-stitch-cli", version: "0.0.1" },
      },
      { authMode: "api-key", apiKeyTransport: "header" },
    ),
    toolsList: await probeRpc("tools/list", {}, { authMode: "api-key", apiKeyTransport: "header" }),
  };
}

async function probeRpc(method, params, options) {
  try {
    const { response, payload } = await callStitchRpc(method, params, options);
    const result = payload.result || {};
    return {
      ok: response.ok && !payload.error,
      status: response.status,
      summary: summarizeRpcResult(result, payload.error),
    };
  } catch (error) {
    return {
      ok: false,
      message: sanitizeError(error),
    };
  }
}

function summarizeRpcResult(result, error) {
  if (error) {
    return sanitizeError(error.message || error);
  }

  if (Array.isArray(result.tools)) {
    return `tools:${result.tools.length}`;
  }

  if (result.serverInfo) {
    return `server:${result.serverInfo.name || "unknown"} protocol:${result.protocolVersion || "unknown"}`;
  }

  return Object.keys(result).join(",") || "ok";
}

async function diagnoseAuth() {
  const source = getStitchAuthSource();
  const apiKeyTransports = source.apiKey ? await probeApiKeyTransports() : {};
  const apiKeyProtocol = source.apiKey ? await probeApiKeyProtocol() : {};
  const proxyUrl =
    process.env.STITCH_DISABLE_PROXY === "1"
      ? ""
      : process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy ||
        "";

  const report = {
    endpoint: STITCH_MCP_URL,
    configuredAuthMode: process.env.STITCH_AUTH_MODE || "auto",
    proxyEnabled: Boolean(proxyUrl),
    credentials: {
      hasAccessToken: Boolean(source.accessToken),
      accessTokenLength: source.accessToken.length,
      hasUserProject: Boolean(source.projectId),
      userProjectSetByEnv: Boolean(process.env.STITCH_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT),
      hasApiKey: Boolean(source.apiKey),
      apiKeyLength: source.apiKey.length,
    },
    probes: {
      oauth: await probeAuth("oauth"),
      apiKeyProtocol,
      apiKey: source.apiKey
        ? apiKeyTransports.header
        : { ok: false, message: "Skipped: STITCH_API_KEY is not set." },
      apiKeyTransports,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

async function checkLocalOAuthProxy() {
  const source = getStitchAuthSource();
  if (!source.apiKey) {
    throw new Error("Missing STITCH_API_KEY for local proxy inbound check.");
  }

  const port = Number(process.env.STITCH_PROXY_PORT || 17923);
  const proxy = spawn(process.execPath, [join(__dirname, "stitch-oauth-mcp-proxy.js"), String(port)], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      STITCH_PROXY_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs = await waitForProxyReady(proxy);
  const proxyUrl = `http://127.0.0.1:${port}/mcp`;

  try {
    const toolsList = await callLocalProxyRpc(proxyUrl, source.apiKey, "tools/list", {});
    const listProjects = await callLocalProxyRpc(proxyUrl, source.apiKey, "tools/call", {
      name: "list_projects",
      arguments: {},
    });
    const projects = readToolResult(listProjects.payload)?.projects || [];

    console.log(
      JSON.stringify(
        {
          proxy: {
            ok: true,
            url: proxyUrl,
            inboundKeyRequired: true,
            startup: logs.startup,
          },
          toolsList: {
            ok: toolsList.response.ok && !toolsList.payload.error,
            status: toolsList.response.status,
            summary: summarizeRpcResult(toolsList.payload.result || {}, toolsList.payload.error),
          },
          listProjects: {
            ok: listProjects.response.ok && !listProjects.payload.error && !listProjects.payload.result?.isError,
            status: listProjects.response.status,
            projectCount: projects.length,
            projectTitles: projects.map((project) => project.title || "(untitled)"),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    proxy.kill("SIGTERM");
  }
}

function waitForProxyReady(proxy) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      proxy.kill("SIGTERM");
      reject(new Error(`Timed out waiting for local Stitch proxy. ${sanitizeError(stderr || stdout)}`));
    }, 10000);

    proxy.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const line = stdout
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith("{") && entry.includes('"status":"listening"'));
      if (line) {
        clearTimeout(timeout);
        resolve({ startup: JSON.parse(line) });
      }
    });

    proxy.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proxy.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    proxy.once("exit", (code) => {
      if (!stdout.includes('"status":"listening"')) {
        clearTimeout(timeout);
        reject(new Error(`Local Stitch proxy exited with code ${code}. ${sanitizeError(stderr || stdout)}`));
      }
    });
  });
}

async function callLocalProxyRpc(proxyUrl, apiKey, method, params) {
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Local proxy returned non-JSON response (${response.status}): ${sanitizeError(text.slice(0, 400))}`);
  }

  return { response, payload };
}

function readToolResult(payload) {
  const result = payload?.result || {};
  if (result.structuredContent && Object.keys(result.structuredContent).length > 0) {
    return result.structuredContent;
  }

  const textContent = result.content?.find((item) => item.type === "text")?.text;
  if (!textContent) {
    return {};
  }

  try {
    return JSON.parse(textContent);
  } catch {
    return { text: textContent };
  }
}

async function writeResultExport(outputDir, name, result) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, `${name}.json`), JSON.stringify(result, null, 2));
  await downloadScreenFiles(outputDir, name, result);

  const outputComponents = result.outputComponents || [];
  const design = outputComponents.find((item) => item.design)?.design;
  if (design) {
    writeFileSync(join(outputDir, "suite-design.json"), JSON.stringify(design, null, 2));
    for (const [index, screen] of (design.screens || []).entries()) {
      const baseName = `screen-${String(index + 1).padStart(2, "0")}`;
      writeFileSync(join(outputDir, `${baseName}.json`), JSON.stringify(screen, null, 2));
      await downloadScreenFiles(outputDir, baseName, screen);
    }
  }
}

function extensionForMime(mimeType, fallback = ".bin") {
  const type = (mimeType || "").split(";")[0].trim().toLowerCase();
  const byMime = {
    "text/html": ".html",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  return byMime[type] || fallback;
}

async function downloadFile(downloadUrl, outputPath) {
  if (!downloadUrl) {
    return null;
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${basename(outputPath)}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, bytes);
  return outputPath;
}

async function downloadScreenFiles(outputDir, baseName, screen) {
  const htmlFile = screen?.htmlCode;
  const screenshotFile = screen?.screenshot;

  if (htmlFile?.downloadUrl) {
    const htmlPath = join(outputDir, `${baseName}${extensionForMime(htmlFile.mimeType, ".html")}`);
    await downloadFile(htmlFile.downloadUrl, htmlPath);
  }

  if (screenshotFile?.downloadUrl) {
    const response = await fetch(screenshotFile.downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed (${response.status}) for ${baseName} screenshot`);
    }
    const mimeType = response.headers.get("content-type") || screenshotFile.mimeType || "image/png";
    const outputPath = join(outputDir, `${baseName}${extensionForMime(mimeType, ".png")}`);
    writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  }
}

async function listProjects() {
  const raw = await callStitchTool("list_projects", {});
  const projects = raw.projects || [];
  console.log(`\nFound ${projects.length} project(s):\n`);
  for (const p of projects) {
    const id = p.projectId || p.name?.replace("projects/", "");
    console.log(`  ID: ${id}`);
    console.log(`  Title: ${p.title || "(untitled)"}`);
    console.log(`  Link: https://stitch.withgoogle.com/projects/${id}`);
    console.log();
  }
}

async function createProject(title) {
  const result = await callStitchTool("create_project", { title });
  console.log("Project created:", JSON.stringify(redactForLog(result), null, 2));
}

async function generateScreen(projectId, prompt) {
  const designPrompt = buildPrompt(prompt);
  console.log("Generating screen...");
  console.log("Prompt:", designPrompt.substring(0, 100) + "...");

  const result = await callStitchTool("generate_screen_from_text", {
    projectId,
    prompt: designPrompt,
    deviceType: "DESKTOP",
    modelId: "GEMINI_3_1_PRO",
  });

  const outputDir = join(PROJECT_ROOT, ".stitch", "exports", `${projectId}-${result.sessionId || Date.now()}`);
  await writeResultExport(outputDir, "generate-result", {
    ...result,
    prompt: designPrompt,
    exportedAt: new Date().toISOString(),
  });

  console.log("\nScreen generated successfully!");
  console.log(`  Project ID: ${projectId}`);
  console.log(`  Session ID: ${result.sessionId || "(none)"}`);
  console.log(`  Local export: ${outputDir}`);
  console.log(`\nView at: https://stitch.withgoogle.com/projects/${projectId}`);
}

async function listScreens(projectId) {
  const raw = await callStitchTool("list_screens", { projectId });
  const screens = raw.screens || raw.screenInstances || [];
  console.log(`\nProject ${projectId} has ${screens.length} screen(s):\n`);
  for (const s of screens) {
    const id = s.screenId || s.id || s.name?.split("/").pop();
    console.log(`  Screen ID: ${id}`);
    console.log(`  Title: ${s.title || s.displayName || "(untitled)"}`);
    console.log(`  Link: https://stitch.withgoogle.com/projects/${projectId}?node-id=${id}`);
    console.log();
  }
}

async function exportScreen(projectId, screenId) {
  const result = await callStitchTool("get_screen", {
    name: `projects/${projectId}/screens/${screenId}`,
    projectId,
    screenId,
  });

  const outputDir = join(PROJECT_ROOT, ".stitch", "exports", screenId);
  await writeResultExport(outputDir, "screen", {
    ...result,
    exportedAt: new Date().toISOString(),
  });
  console.log("Exported:", JSON.stringify(redactForLog(result), null, 2));
}

async function editScreen(projectId, screenId, prompt) {
  const result = await callStitchTool("edit_screens", {
    projectId,
    selectedScreenIds: [screenId],
    prompt,
    deviceType: "DESKTOP",
    modelId: "GEMINI_3_1_PRO",
  });

  console.log("Screen edited!");
  console.log(JSON.stringify(redactForLog(result), null, 2));
}

async function generateVariants(projectId, screenId, prompt) {
  const result = await callStitchTool("generate_variants", {
    projectId,
    selectedScreenIds: [screenId],
    prompt,
    deviceType: "DESKTOP",
    modelId: "GEMINI_3_1_PRO",
    variantOptions: {
      variantCount: 3,
      creativeRange: "EXPLORE",
      aspects: ["COLOR_SCHEME", "LAYOUT"],
    },
  });

  console.log("Generated variants:", JSON.stringify(redactForLog(result), null, 2));
}

async function batchGenerate(projectId, prompt) {
  const promptText = existsSync(prompt) ? readFileSync(prompt, "utf8") : prompt;
  const designPrompt = buildPrompt(promptText);

  console.log("Batch generating...");
  const result = await callStitchTool("generate_screen_from_text", {
    projectId,
    prompt: designPrompt,
    deviceType: "DESKTOP",
    modelId: "GEMINI_3_1_PRO",
  });

  const outputDir = join(PROJECT_ROOT, ".stitch", "exports", `${projectId}-${result.sessionId || basename(prompt) || Date.now()}`);
  await writeResultExport(outputDir, "batch-result", {
    ...result,
    prompt: designPrompt,
    exportedAt: new Date().toISOString(),
  });

  console.log("Batch generation complete:", outputDir);
}

function buildPrompt(userPrompt) {
  if (process.env.STITCH_RAW_PROMPT === "1") {
    return userPrompt;
  }

  const context = `
UNIVIEW 固定资产平台 product-suite design direction.

Visual language:
- High-end B2B industrial command center for fixed assets, MES connectivity, device status, maintenance work orders, asset lifecycle, safety posture, and data monitoring.
- Use the approved IMAGE2 product-asset style: blue-white 3D industrial illustrations, CNC machines, robotic arms, conveyors, AGVs, holographic telemetry panels, duotone equipment icons, crisp circular gauges, and precise IoT signal details.
- Brand text must be UNIVIEW; product text must be 固定资产平台 or 固定资产. Do not use legacy codenames or old brand marks in generated UI.
- Palette: deep navy header/frame (#061b38), luminous primary blue (#1677ff), cyan data accent (#23d3e6), cool white surfaces (#f7fbff/#ffffff), pale blue borders (#dbeafe), and restrained status colors.
- Typography: Inter for Latin/numerals and PingFang SC/Microsoft YaHei for Chinese. Keep dashboards dense, legible, and operator-focused.

Layout and components:
- Desktop-first command-center layout with a 56-64px top navigation and a compact icon sidebar. Page tabs should switch between 智能制造总览、数据监控中心、资产运维中心、安全态势工作台.
- Cards should match the reference image style: white or glass-white surfaces, 1px light-blue borders, 8-12px radius, no visible drop shadows on primary cards. Use tonal layering, outlines, and subtle dividers instead of decorative shadows.
- KPI cards should include a small high-detail 3D icon/illustration, strong numeric value, concise Chinese label, and optional trend/progress detail.
- Data pages should use ring gauges, line/bar charts, ranked tables, status pills, device maps, maintenance queues, and asset distribution views.
- Product image panels must be crisp and integrated into the card composition; avoid cropped, blurry, generic stock-like imagery.
- LOGIN5 is the dedicated design-draft login page and must be a professional login experience using the immersive smart-factory background and a clear login form. LOGIN4 remains a current implementation route. Neither login page should show bottom KPI cards such as 资产总数、在线运行、待保数, or 异常预警.

Interaction intent:
- Sidebar/menu items switch business context and keep visual state obvious.
- Top tabs switch the major product modules.
- Use familiar icons for actions, compact hover states, and data-dense enterprise ergonomics.
`;
  return `${context}\n\n${userPrompt}`;
}

main().catch((error) => {
  console.error(sanitizeError(error));
  process.exitCode = 1;
});
