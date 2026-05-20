// Transform raw JSON libraries to unified schema for the bundled default
// prompt library. Run from the project root with:
//   node scripts/transform-prompt-libraries.mjs <ai-library.json> <research-library.json>
//
// Reads two third-party meta-prompt JSONs and writes the merged + deduplicated
// result to data/prompt-libraries/default-prompts.json.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Helper to generate title from template (first 60 chars)
function generateTitle(template) {
  const cleaned = template.replace(/\{[^}]+\}/g, "…").trim();
  return cleaned.length > 60 ? cleaned.substring(0, 57) + "..." : cleaned;
}

// Transform a single library
function transformLibrary(sourceData) {
  const transformed = [];

  for (const category of sourceData.categories) {
    for (const item of category.items) {
      const prompt = {
        title: generateTitle(item.template),
        content: item.template,
        category: category.name,
        tags: item.tags || [],
        variables: item.variables || [],
        isFavorite: false,
        useCount: 0,
        lastUsed: null,
      };

      transformed.push(prompt);
    }
  }

  return transformed;
}

// Merge and deduplicate by title
function mergeLibraries(lib1, lib2) {
  const merged = [...lib1, ...lib2];
  const seen = new Set();
  const unique = [];

  for (const prompt of merged) {
    const key = prompt.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(prompt);
    }
  }

  return unique;
}

async function main() {
  try {
    const [, , aiPath, researchPath] = process.argv;

    if (!aiPath || !researchPath) {
      console.error(
        "Usage: node scripts/transform-prompt-libraries.mjs <ai-library.json> <research-library.json>",
      );
      process.exit(1);
    }

    console.log("Reading source files...");

    const aiData = JSON.parse(fs.readFileSync(aiPath, "utf8"));
    const researchData = JSON.parse(fs.readFileSync(researchPath, "utf8"));

    console.log(`AI Library: ${aiData.total_templates} templates`);
    console.log(`Research Library: ${researchData.total_templates} templates`);

    console.log("\nTransforming libraries...");
    const aiTransformed = transformLibrary(aiData);
    const researchTransformed = transformLibrary(researchData);

    console.log(`Transformed AI: ${aiTransformed.length} prompts`);
    console.log(`Transformed Research: ${researchTransformed.length} prompts`);

    const combined = mergeLibraries(aiTransformed, researchTransformed);
    console.log(`Combined (deduplicated): ${combined.length} prompts`);

    const outputPath = path.join(projectRoot, "data/prompt-libraries/default-prompts.json");

    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          version: "1.0",
          title: "Default Prompt Library",
          description: "Curated meta-prompts for AI workflows, research, coding, and analysis",
          count: combined.length,
          prompts: combined,
        },
        null,
        2,
      ),
    );

    console.log("\nTransformation complete!");
    console.log(`  - ${path.relative(projectRoot, outputPath)} (${combined.length} prompts)`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
