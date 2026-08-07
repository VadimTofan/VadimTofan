import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchCombinedDownloads,
  formatDownloadCount,
  parseDownloadCount,
  replaceDownloadText,
} from "./update-curseforge-downloads.mjs";

test("parses exact and abbreviated download counts from Shields badges", () => {
  // Given
  const exactBadge = '<svg aria-label="downloads: 930"></svg>';
  const thousandsBadge = '<svg aria-label="downloads: 37k"></svg>';
  const millionsBadge = '<svg aria-label="downloads: 1.2M"></svg>';

  // When
  const exactDownloads = parseDownloadCount(exactBadge);
  const thousandsDownloads = parseDownloadCount(thousandsBadge);
  const millionsDownloads = parseDownloadCount(millionsBadge);

  // Then
  assert.equal(exactDownloads, 930);
  assert.equal(thousandsDownloads, 37_000);
  assert.equal(millionsDownloads, 1_200_000);
});

test("rejects a badge without a valid download count", () => {
  // Given
  const invalidBadge = '<svg aria-label="downloads: unavailable"></svg>';

  // When
  const parseInvalidBadge = () => parseDownloadCount(invalidBadge);

  // Then
  assert.throws(parseInvalidBadge, /download count/i);
});

test("combines download counts only when every project request succeeds", async () => {
  // Given
  const projectIds = ["first", "second"];
  const badges = new Map([
    ["first", '<svg aria-label="downloads: 37k"></svg>'],
    ["second", '<svg aria-label="downloads: 930"></svg>'],
  ]);
  const fetchBadge = async (url) => {
    const projectId = url.match(/dt\/(.+?)\?/)?.[1];
    const badge = badges.get(projectId);

    return {
      ok: true,
      text: async () => badge,
    };
  };

  // When
  const combinedDownloads = await fetchCombinedDownloads(
    projectIds,
    fetchBadge,
  );

  // Then
  assert.equal(combinedDownloads, 37_930);
});

test("stops without a partial total when a project request fails", async () => {
  // Given
  const projectIds = ["first", "second"];
  const fetchBadge = async (url) => ({
    ok: !url.includes("second"),
    status: 503,
    text: async () => '<svg aria-label="downloads: 37k"></svg>',
  });

  // When
  const fetchAllProjects = () =>
    fetchCombinedDownloads(projectIds, fetchBadge);

  // Then
  await assert.rejects(fetchAllProjects, /second.*503/i);
});

test("formats the combined count for a compact profile badge", () => {
  // Given
  const combinedDownloads = 38_066;

  // When
  const formattedDownloads = formatDownloadCount(combinedDownloads);

  // Then
  assert.equal(formattedDownloads, "38k");
});

test("replaces only the generated inline download text in the README", () => {
  // Given
  const readme = [
    "- Maintaining multiple World of Warcraft addons — ",
    "[CurseForge][curseforge-profile] · ",
    "<!-- curseforge-downloads:start -->",
    "37k downloads",
    "<!-- curseforge-downloads:end -->",
  ].join("");

  // When
  const updatedReadme = replaceDownloadText(readme, "38k");

  // Then
  assert.equal(
    updatedReadme,
    [
      "- Maintaining multiple World of Warcraft addons — ",
      "[CurseForge][curseforge-profile] · ",
      "<!-- curseforge-downloads:start -->",
      "38k downloads",
      "<!-- curseforge-downloads:end -->",
    ].join(""),
  );
});

test("rejects a README without the generated download markers", () => {
  // Given
  const readme = "README without generated badge markers";

  // When
  const replaceMissingBlock = () => replaceDownloadText(readme, "38k");

  // Then
  assert.throws(replaceMissingBlock, /download markers/i);
});
