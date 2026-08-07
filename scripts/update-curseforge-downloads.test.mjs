import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchCombinedDownloads,
  formatDownloadCount,
  parseDownloadCount,
  replaceDownloadBadge,
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

test("replaces only the generated badge block in the README", () => {
  // Given
  const expectedBadge =
    "[curseforge-total-badge]: " +
    "https://img.shields.io/badge/" +
    "CurseForge_downloads-38k-F16436?style=flat-square";
  const readme = [
    "Before",
    "<!-- curseforge-downloads:start -->",
    "[curseforge-total-badge]: old-value",
    "<!-- curseforge-downloads:end -->",
    "After",
  ].join("\n");

  // When
  const updatedReadme = replaceDownloadBadge(readme, "38k");

  // Then
  assert.equal(
    updatedReadme,
    [
      "Before",
      "<!-- curseforge-downloads:start -->",
      expectedBadge,
      "<!-- curseforge-downloads:end -->",
      "After",
    ].join("\n"),
  );
});

test("rejects a README without the generated badge markers", () => {
  // Given
  const readme = "README without generated badge markers";

  // When
  const replaceMissingBlock = () => replaceDownloadBadge(readme, "38k");

  // Then
  assert.throws(replaceMissingBlock, /badge markers/i);
});
