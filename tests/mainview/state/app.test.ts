import { describe, it, expect, beforeEach } from "vitest";
import {
	getSelectedRelease,
	getActiveAccount,
	getBannerUrl,
	getIsSelectedInstalled,
	setChannel,
	pushLog,
	snapshotState,
	hydrateState,
	versionState,
	settingsState,
	accountState,
	logState,
	defaultSettings,
} from "$mainview/state/app.svelte";
import type { ClientRelease, AccountProfile } from "$shared/types";

function resetState() {
	versionState.releases = [];
	versionState.installedVersions = {};
	versionState.document = null;
	Object.assign(settingsState, { ...defaultSettings });
	accountState.accounts = [];
	accountState.activeAccountId = undefined;
	logState.entries = [];
}

const mkRelease = (overrides: Partial<ClientRelease>): ClientRelease => ({
	id: "test-id",
	channel: "stable",
	minecraftVersion: "1.20",
	clientVersion: "1.0.0",
	assetsIndex: "1.20",
	javaVersion: 17,
	...overrides,
});

const mkAccount = (overrides: Partial<AccountProfile>): AccountProfile => ({
	id: "acc-1",
	type: "offline",
	username: "Player",
	createdAt: 1000,
	lastUsedAt: 1000,
	...overrides,
});

beforeEach(() => resetState());

describe("getSelectedRelease", () => {
	it("returns null when no releases", () => {
		expect(getSelectedRelease()).toBeNull();
	});

	it("returns the first release of the current channel", () => {
		versionState.releases = [
			mkRelease({ id: "s1", channel: "stable" }),
			mkRelease({ id: "d1", channel: "dev" }),
		];
		settingsState.channel = "stable";
		expect(getSelectedRelease()?.id).toBe("s1");
	});

	it("filters by channel", () => {
		versionState.releases = [
			mkRelease({ id: "d1", channel: "dev" }),
			mkRelease({ id: "s1", channel: "stable" }),
			mkRelease({ id: "d2", channel: "dev" }),
		];
		settingsState.channel = "dev";
		const result = getSelectedRelease();
		expect(result?.id).toBe("d1");
	});

	it("respects selectedVersionId within the channel", () => {
		versionState.releases = [
			mkRelease({ id: "a", channel: "stable" }),
			mkRelease({ id: "b", channel: "stable" }),
		];
		settingsState.selectedVersionId = "b";
		expect(getSelectedRelease()?.id).toBe("b");
	});

	it("falls back to first channel release when selectedVersionId is stale", () => {
		versionState.releases = [
			mkRelease({ id: "a", channel: "stable" }),
		];
		settingsState.selectedVersionId = "nonexistent";
		expect(getSelectedRelease()?.id).toBe("a");
	});

	it("returns first release overall when channel has no releases", () => {
		versionState.releases = [
			mkRelease({ id: "s1", channel: "stable" }),
			mkRelease({ id: "d1", channel: "dev" }),
		];
		settingsState.channel = "snapshot";
		expect(getSelectedRelease()?.id).toBe("s1");
	});
});

describe("getActiveAccount", () => {
	it("returns null when no accounts", () => {
		expect(getActiveAccount()).toBeNull();
	});

	it("returns account matching activeAccountId", () => {
		accountState.accounts = [
			mkAccount({ id: "a", username: "Alice" }),
			mkAccount({ id: "b", username: "Bob" }),
		];
		accountState.activeAccountId = "b";
		expect(getActiveAccount()?.username).toBe("Bob");
	});

	it("falls back to first account when activeAccountId is stale", () => {
		accountState.accounts = [
			mkAccount({ id: "a", username: "Alice" }),
		];
		accountState.activeAccountId = "nonexistent";
		expect(getActiveAccount()?.username).toBe("Alice");
	});
});

describe("getBannerUrl", () => {
	it("returns empty string when no release selected", () => {
		expect(getBannerUrl()).toBe("");
	});

	it("uses release.bannerUrl when present", () => {
		versionState.releases = [
			mkRelease({ id: "r1", bannerUrl: "https://example.com/banner.jpg" }),
		];
		expect(getBannerUrl()).toBe("https://example.com/banner.jpg");
	});

	it("uses document banner fallback", () => {
		versionState.releases = [mkRelease({ id: "r1", minecraftVersion: "1.20" })];
		versionState.document = {
			releases: [],
			assets: { banners: { "1.20": "https://cdn/doc/banner.jpg" } },
		};
		expect(getBannerUrl()).toBe("https://cdn/doc/banner.jpg");
	});

	it("uses CDN fallback", () => {
		versionState.releases = [mkRelease({ id: "r1", minecraftVersion: "1.20" })];
		expect(getBannerUrl()).toBe(
			"https://cdn.shindoclient.com/assets/banners/1.20.jpg",
		);
	});
});

describe("getIsSelectedInstalled", () => {
	it("returns false when no release selected", () => {
		expect(getIsSelectedInstalled()).toBe(false);
	});

	it("returns true when installed version matches", () => {
		versionState.releases = [
			mkRelease({ id: "r1", clientVersion: "1.0" }),
		];
		versionState.installedVersions["r1"] = "1.0";
		expect(getIsSelectedInstalled()).toBe(true);
	});

	it("returns false when installed version differs", () => {
		versionState.releases = [
			mkRelease({ id: "r1", clientVersion: "1.0" }),
		];
		versionState.installedVersions["r1"] = "0.9";
		expect(getIsSelectedInstalled()).toBe(false);
	});
});

describe("setChannel", () => {
	it("changes channel and clears selectedVersionId", () => {
		settingsState.channel = "stable";
		settingsState.selectedVersionId = "some-id";
		setChannel("dev");
		expect(settingsState.channel).toBe("dev");
		expect(settingsState.selectedVersionId).toBeUndefined();
	});
});

describe("pushLog", () => {
	it("appends a log entry", () => {
		pushLog({
			id: "1", level: "info", message: "hello", timestamp: 100,
		});
		expect(logState.entries).toHaveLength(1);
		expect(logState.entries[0].message).toBe("hello");
	});

	it("keeps at most 500 entries (drops oldest)", () => {
		for (let i = 0; i < 600; i++) {
			pushLog({ id: `${i}`, level: "info", message: `msg-${i}`, timestamp: i });
		}
		expect(logState.entries).toHaveLength(500);
		expect(logState.entries[0].message).toBe("msg-100");
	});
});

describe("snapshotState / hydrateState", () => {
	it("roundtrips state correctly", () => {
		versionState.releases = [mkRelease({ id: "r1" })];
		versionState.installedVersions = { r1: "1.0" };
		accountState.accounts = [mkAccount({ id: "a1", username: "Test" })];
		accountState.activeAccountId = "a1";
		settingsState.locale = "pt-BR";
		settingsState.channel = "dev";

		const snapshot = snapshotState();
		expect(snapshot.settings.locale).toBe("pt-BR");
		expect(snapshot.settings.channel).toBe("dev");
		expect(snapshot.settings.activeAccountId).toBe("a1");
		expect(snapshot.accounts).toHaveLength(1);
		expect(snapshot.installedVersions).toEqual({ r1: "1.0" });

		settingsState.locale = "en";
		settingsState.channel = "stable";
		hydrateState(snapshot);
		expect(settingsState.locale).toBe("pt-BR");
		expect(settingsState.channel).toBe("dev");
		expect(accountState.accounts[0].username).toBe("Test");
		expect(accountState.activeAccountId).toBe("a1");
	});
});
