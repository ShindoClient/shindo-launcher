import type { ReleaseChannel } from './config';

export interface VersionBuild {
  build: number;
  buildId: string;
  buildNumber: number;
  semver: string;
  label: string;
  type: ReleaseChannel;
  versionBase: number;
  packageUrl: string | null;
  jarUrl: string | null;
  legacyJarUrl: string | null;
  versionUrl: string | null;
  versionJsonPath: string | null;
  releasedAt: string | null;
}

export interface VersionEntry {
  id: string;
  name: string;
  enabled: boolean;
  minecraftVersion: string;
  baseVersion: string | null;
  assetsIndex: string | null;
  bannerUrl: string | null;
  latestBuild: number | null;
  latestBuildId: string | null;
  latestSemver: string | null;
  latestType: ReleaseChannel | null;
  builds: VersionBuild[];
}

export interface VersionCatalog {
  updatedAt: string | null;
  defaultVersionId: string;
  entries: VersionEntry[];
}

export interface ClientState {
  version: string | null;
  baseVersion: string | null;
  versionId: string;
  clientDir: string;
  versionJsonPath: string | null;
  clientPackagePath: string | null;
  assetsIndex: string | null;
}

export interface ClientUpdateResult extends ClientState {
  updated: boolean;
}

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size?: number;
  contentType?: string;
}
