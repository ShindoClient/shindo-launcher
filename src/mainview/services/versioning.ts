import type {
  ClientRelease,
  ReleaseChannel,
  VersioningDocument,
} from "../../shared/types";

export const VERSIONING_URL =
  "https://cdn.shindoclient.com/data/meta/versioning.json";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asChannel(value: unknown): ReleaseChannel {
  if (value === "dev" || value === "snapshot") return value;
  return "stable";
}

function asJavaVersion(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function releaseFromUnknown(input: unknown, index: number): ClientRelease {
  const item = asRecord(input);
  const minecraftVersion = asString(
    item.minecraftVersion ?? item.minecraft ?? item.mcVersion,
    "1.8.9",
  );
  const clientVersion = asString(
    item.clientVersion ?? item.version,
    `remote-${index}`,
  );

  const assetsIndex = asString(item.assetsIndex, "1.8");
  return {
    id: asString(item.id ?? item.name, `${minecraftVersion}-${clientVersion}`),
    channel: asChannel(item.channel),
    minecraftVersion,
    assetsIndex,
    clientVersion,
    versionJsonUrl: asString(
      item.versionJsonUrl ?? item.version_json ?? item.jsonUrl,
    ),
    clientUrl: asString(item.clientUrl ?? item.url ?? item.downloadUrl),
    checksum: asString(item.checksum ?? item.sha256),
    javaVersion: asJavaVersion(item.javaVersion ?? item.java),
    bannerUrl: asString(item.bannerUrl ?? item.banner),
    notes: asString(item.notes),
    createdAt: asString(item.createdAt ?? item.date),
  };
}

function releasesFromV3Version(input: unknown): ClientRelease[] {
  const version = asRecord(input);
  const builds = Array.isArray(version.builds) ? version.builds : [];
  const minecraftVersion = asString(
    version.minecraftVersion ?? version.baseVersion,
    "1.8.9",
  );
  const assetsIndex = asString(version.assetsIndex, "1.8");
  const javaVersion = asJavaVersion(version.javaId);
  const bannerUrl = asString(version.bannerUrl);

  return builds.map((buildInput, index) => {
    const build = asRecord(buildInput);
    const artifacts = asRecord(build.artifacts);
    const buildId = asString(build.buildId, `${asString(version.id)}-${index}`);
    const versionJsonPath = asString(artifacts.versionJsonPath);
    const jsonVersionId = versionJsonPath
      ? versionJsonPath.replace(/\.json$/i, "")
      : `${asString(version.id, "ShindoClient")}-${buildId}`;
    const channel = asChannel(build.type);
    const semver = asString(build.semver, buildId);
    const label = asString(build.label, channel);
    return {
      id: jsonVersionId,
      channel,
      minecraftVersion,
      assetsIndex,
      clientVersion: `${semver} (${buildId})`,
      versionJsonUrl: asString(
        artifacts.jsonUrl ?? artifacts.versionJsonUrl ?? artifacts.versionUrl,
      ),
      clientUrl: asString(
        artifacts.jarUrl ?? artifacts.legacyJarUrl ?? artifacts.packageUrl,
      ),
      javaVersion,
      bannerUrl,
      notes: label,
      createdAt: asString(build.releasedAt),
    };
  });
}

export async function fetchVersioning(): Promise<VersioningDocument> {
  const response = await fetch(VERSIONING_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Versioning request failed: ${response.status}`);
  }
  const raw = (await response.json()) as unknown;
  const root = asRecord(raw);
  const source = Array.isArray(root.releases)
    ? root.releases
    : Array.isArray(raw)
      ? raw
      : [];
  const v3Versions = Array.isArray(root.versions) ? root.versions : [];

  const releases = [
    ...source.map(releaseFromUnknown),
    ...v3Versions.flatMap(releasesFromV3Version),
  ].filter((release) => release.id);
  if (releases.length === 0) {
    throw new Error("Versioning document has no releases");
  }

  return {
    releases: releases.sort((a, b) => {
      const aTime = Date.parse(a.createdAt ?? "");
      const bTime = Date.parse(b.createdAt ?? "");
      return (
        (Number.isFinite(bTime) ? bTime : 0) -
        (Number.isFinite(aTime) ? aTime : 0)
      );
    }),
    assets: asRecord(root.assets) as VersioningDocument["assets"],
  };
}
