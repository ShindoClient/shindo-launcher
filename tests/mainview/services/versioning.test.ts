import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchVersioning } from "$mainview/services/versioning";

beforeEach(() => {
	vi.restoreAllMocks();
});

describe("fetchVersioning", () => {
	it("parses v2-style versioning document", async () => {
		const mockData = {
			releases: [
				{
					id: "1.20-1.0",
					channel: "stable",
					minecraftVersion: "1.20",
					clientVersion: "1.0",
					javaVersion: 17,
				},
			],
		};
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData),
		});

		const doc = await fetchVersioning();
		expect(doc.releases).toHaveLength(1);
		expect(doc.releases[0].minecraftVersion).toBe("1.20");
	});

	it("parses v3-style versioning document (versions + builds)", async () => {
		const mockData = {
			versions: [
				{
					id: "v1.20",
					minecraftVersion: "1.20",
					assetsIndex: "1.20",
					javaId: 21,
					bannerUrl: "https://example.com/banner.jpg",
					builds: [
						{
							buildId: "123",
							type: "stable",
							semver: "1.0.0",
							releasedAt: "2025-01-01T00:00:00Z",
							artifacts: {
								versionJsonPath: "1.20/123.json",
								jsonUrl: "https://example.com/1.20/123.json",
							},
						},
					],
				},
			],
		};
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData),
		});

		const doc = await fetchVersioning();
		expect(doc.releases).toHaveLength(1);
		expect(doc.releases[0].clientVersion).toContain("1.0.0");
		expect(doc.releases[0].minecraftVersion).toBe("1.20");
		expect(doc.releases[0].javaVersion).toBe(21);
	});

	it("throws on HTTP error", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
		});

		await expect(fetchVersioning()).rejects.toThrow("Versioning request failed");
	});

	it("throws on empty releases array", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ releases: [] }),
		});

		await expect(fetchVersioning()).rejects.toThrow("no releases");
	});

	it("parses raw array format", async () => {
		const mockData = [
			{ id: "raw-1", channel: "stable", minecraftVersion: "1.21", clientVersion: "2.0", javaVersion: 21 },
			{ id: "raw-2", channel: "dev", minecraftVersion: "1.21.1", clientVersion: "2.1", javaVersion: 21 },
		];
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData),
		});

		const doc = await fetchVersioning();
		expect(doc.releases).toHaveLength(2);
	});

	it("handles alternative field names (minecraft, version, etc.)", async () => {
		const mockData = {
			releases: [
				{
					minecraft: "1.20",
					version: "1.0",
					channel: "dev",
					java: 17,
				},
			],
		};
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData),
		});

		const doc = await fetchVersioning();
		expect(doc.releases[0].minecraftVersion).toBe("1.20");
		expect(doc.releases[0].clientVersion).toBe("1.0");
	});

	it("throws when root is not an object", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve("invalid"),
		});
		await expect(fetchVersioning()).rejects.toThrow("no releases");
	});
});
