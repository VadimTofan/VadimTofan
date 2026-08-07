import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_IDS = ["1488089", "1492196", "1509727", "1521504"];
const BADGE_START = "<!-- curseforge-downloads:start -->";
const BADGE_END = "<!-- curseforge-downloads:end -->";

export function parseDownloadCount(badge) {
  const countMatch = badge.match(
    /aria-label="downloads:\s*([\d,.]+)\s*([kKmM]?)"/,
  );

  if (!countMatch) {
    throw new Error("Could not find a valid download count in the badge.");
  }

  const numericValue = Number.parseFloat(countMatch[1].replaceAll(",", ""));
  const suffix = countMatch[2].toLowerCase();
  const multipliers = {
    "": 1,
    k: 1_000,
    m: 1_000_000,
  };

  return Math.round(numericValue * multipliers[suffix]);
}

export async function fetchCombinedDownloads(projectIds, fetchBadge = fetch) {
  let combinedDownloads = 0;

  for (const projectId of projectIds) {
    const badgeUrl =
      `https://img.shields.io/curseforge/dt/${projectId}` +
      "?style=flat-square&label=downloads";
    const response = await fetchBadge(badgeUrl);

    if (!response.ok) {
      throw new Error(
        `CurseForge project ${projectId} returned HTTP ${response.status}.`,
      );
    }

    const badge = await response.text();
    const projectDownloads = parseDownloadCount(badge);

    combinedDownloads += projectDownloads;
  }

  return combinedDownloads;
}

export function formatDownloadCount(downloads) {
  if (downloads < 1_000) {
    return String(downloads);
  }

  if (downloads < 1_000_000) {
    return `${Math.round(downloads / 1_000)}k`;
  }

  const millions = Math.round(downloads / 100_000) / 10;

  return `${millions}M`;
}

export function replaceDownloadBadge(readme, formattedDownloads) {
  const startIndex = readme.indexOf(BADGE_START);
  const endIndex = readme.indexOf(BADGE_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("Could not find the CurseForge badge markers in README.md.");
  }

  const badgeUrl =
    "https://img.shields.io/badge/CurseForge_downloads-" +
    `${formattedDownloads}-F16436?style=flat-square`;
  const generatedBlock = [
    BADGE_START,
    `[curseforge-total-badge]: ${badgeUrl}`,
    BADGE_END,
  ].join("\n");
  const blockEndIndex = endIndex + BADGE_END.length;

  return (
    readme.slice(0, startIndex) +
    generatedBlock +
    readme.slice(blockEndIndex)
  );
}

async function updateReadme() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const readmePath = resolve(scriptDirectory, "../README.md");
  const readme = await readFile(readmePath, "utf8");
  const combinedDownloads = await fetchCombinedDownloads(PROJECT_IDS);
  const formattedDownloads = formatDownloadCount(combinedDownloads);
  const updatedReadme = replaceDownloadBadge(readme, formattedDownloads);

  if (updatedReadme === readme) {
    console.log(
      `CurseForge downloads are already current: ${formattedDownloads}`,
    );
    return;
  }

  await writeFile(readmePath, updatedReadme);
  console.log(`Updated CurseForge downloads to ${formattedDownloads}.`);
}

const executedFile = pathToFileURL(resolve(process.argv[1])).href;

if (executedFile === import.meta.url) {
  await updateReadme();
}
