import { stitch } from "@google/stitch-sdk";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case "projects":
      await listProjects();
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
      await createProject(args.join(" ") || "forthAMS Design");
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
forthAMS Stitch CLI
===================
Commands:
  projects                          List all Stitch projects
  create-project <name>             Create a new project
  generate <project-id> <prompt>    Generate a screen
  screens <project-id>              List screens in project
  export <project-id> <screen-id>   Export screen HTML + screenshot
  edit <project-id> <screen-id> <prompt>  Edit a screen
  variants <project-id> <screen-id> <prompt>  Generate variants
  batch <project-id> <prompt>       Generate with full DESIGN.md context

Examples:
  node stitch-cli.js projects
  node stitch-cli.js create-project "forthAMS Dashboard"
  node stitch-cli.js generate 12345 "Asset management dashboard with KPI cards"
  node stitch-cli.js export 12345 screen-id-here
      `);
  }
}

async function listProjects() {
  const projects = await stitch.projects();
  console.log(`\nFound ${projects.length} project(s):\n`);
  for (const p of projects) {
    console.log(`  ID: ${p.projectId}`);
    console.log(`  Link: https://stitch.withgoogle.com/projects/${p.projectId}`);
    console.log();
  }
}

async function createProject(title) {
  const result = await stitch.callTool("create_project", { title });
  console.log("Project created:", JSON.stringify(result, null, 2));
}

async function generateScreen(projectId, prompt) {
  const designPrompt = buildPrompt(prompt);
  console.log("Generating screen...");
  console.log("Prompt:", designPrompt.substring(0, 100) + "...");

  const project = stitch.project(projectId);
  const screen = await project.generate(designPrompt, "DESKTOP");

  const outputDir = join(PROJECT_ROOT, ".stitch", "exports", screen.screenId);
  mkdirSync(outputDir, { recursive: true });

  const html = await screen.getHtml();
  const image = await screen.getImage();

  const meta = {
    screenId: screen.screenId,
    projectId: screen.projectId,
    htmlUrl: html,
    imageUrl: image,
    prompt: designPrompt,
    exportedAt: new Date().toISOString(),
  };

  writeFileSync(join(outputDir, "meta.json"), JSON.stringify(meta, null, 2));

  console.log("\nScreen generated successfully!");
  console.log(`  Screen ID: ${screen.screenId}`);
  console.log(`  HTML URL: ${html}`);
  console.log(`  Image URL: ${image}`);
  console.log(`  Local meta: ${join(outputDir, "meta.json")}`);
  console.log(`\nView at: https://stitch.withgoogle.com/projects/${projectId}?node-id=${screen.screenId}`);
}

async function listScreens(projectId) {
  const project = stitch.project(projectId);
  const screens = await project.screens();
  console.log(`\nProject ${projectId} has ${screens.length} screen(s):\n`);
  for (const s of screens) {
    console.log(`  Screen ID: ${s.screenId}`);
    console.log(`  Link: https://stitch.withgoogle.com/projects/${projectId}?node-id=${s.screenId}`);
    console.log();
  }
}

async function exportScreen(projectId, screenId) {
  const project = stitch.project(projectId);
  const screen = await project.getScreen(screenId);

  const outputDir = join(PROJECT_ROOT, ".stitch", "exports", screenId);
  mkdirSync(outputDir, { recursive: true });

  const html = await screen.getHtml();
  const image = await screen.getImage();

  const meta = {
    screenId: screen.screenId,
    projectId: screen.projectId,
    htmlUrl: html,
    imageUrl: image,
    exportedAt: new Date().toISOString(),
  };

  writeFileSync(join(outputDir, "meta.json"), JSON.stringify(meta, null, 2));
  console.log("Exported:", JSON.stringify(meta, null, 2));
}

async function editScreen(projectId, screenId, prompt) {
  const project = stitch.project(projectId);
  const screen = await project.getScreen(screenId);
  const edited = await screen.edit(prompt);

  console.log("Screen edited!");
  console.log(`  New Screen ID: ${edited.screenId}`);
  const html = await edited.getHtml();
  console.log(`  HTML URL: ${html}`);
}

async function generateVariants(projectId, screenId, prompt) {
  const project = stitch.project(projectId);
  const screen = await project.getScreen(screenId);
  const variants = await screen.variants(prompt, {
    variantCount: 3,
    creativeRange: "EXPLORE",
    aspects: ["COLOR_SCHEME", "LAYOUT"],
  });

  console.log(`Generated ${variants.length} variant(s):\n`);
  for (const v of variants) {
    console.log(`  Variant ID: ${v.screenId}`);
    const html = await v.getHtml();
    console.log(`  HTML URL: ${html}`);
    console.log();
  }
}

async function batchGenerate(projectId, prompt) {
  const designPrompt = buildPrompt(prompt);
  const project = stitch.project(projectId);

  console.log("Batch generating...");
  const screen = await project.generate(designPrompt, "DESKTOP");

  const outputDir = join(PROJECT_ROOT, ".stitch", "exports", screen.screenId);
  mkdirSync(outputDir, { recursive: true });

  const html = await screen.getHtml();
  const image = await screen.getImage();

  writeFileSync(
    join(outputDir, "meta.json"),
    JSON.stringify({
      screenId: screen.screenId,
      projectId: screen.projectId,
      htmlUrl: html,
      imageUrl: image,
      prompt: designPrompt,
      exportedAt: new Date().toISOString(),
    }, null, 2)
  );

  console.log("Batch generation complete:", screen.screenId);
}

function buildPrompt(userPrompt) {
  const context = `Enterprise asset management system (AMS) with dark navy sidebar (#0a1628), white content area, blue (#3b82f6) accent color. Clean, professional, data-dense layout. Use Inter font family. Cards with subtle shadows. Mobile-responsive with collapsible sidebar. The design should use Material Design 3 principles adapted for an enterprise B2B application.`;
  return `${context}\n\n${userPrompt}`;
}

main().catch(console.error);
