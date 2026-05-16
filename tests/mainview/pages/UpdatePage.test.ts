import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/svelte";
import UpdatePage from "$mainview/pages/UpdatePage.svelte";
import { appState, updateState, versionState } from "$mainview/state/app.svelte";

vi.mock("$mainview/services/native", () => ({
	getNativeApi: vi.fn().mockResolvedValue({
		checkLauncherUpdate: vi.fn().mockResolvedValue({ ok: true }),
		getState: vi.fn().mockResolvedValue({}),
		saveState: vi.fn().mockResolvedValue({ ok: true }),
		getAccounts: vi.fn().mockResolvedValue({ accounts: [], activeAccountId: null, limit: 6 }),
	}),
}));

vi.mock("$mainview/services/persistence", () => ({
	loadPersistedState: vi.fn().mockResolvedValue({
		settings: {},
		accounts: [],
		installedVersions: {},
	}),
	savePersistedState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("$mainview/services/accounts", () => ({
	loadAccounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("$mainview/services/versioning", () => ({
	fetchVersioning: vi.fn().mockResolvedValue({
		releases: [
			{
				id: "test-1.0",
				channel: "stable",
				minecraftVersion: "1.20",
				clientVersion: "1.0.0",
				assetsIndex: "1.20",
				javaVersion: 17,
			},
		],
	}),
}));

beforeEach(() => {
	appState.error = "";
	appState.page = "update";
	updateState.isChecking = true;
	updateState.label = "Preparing launcher";
	updateState.progress = { current: 0, total: 100, label: "Starting" };
	versionState.releases = [];
});

afterEach(() => {
	cleanup();
});

describe("UpdatePage", () => {
	it("renders title and progress bar", () => {
		render(UpdatePage);
		expect(screen.getByText("Shindo Launcher")).toBeInTheDocument();
		expect(screen.getByLabelText("Update progress")).toBeInTheDocument();
	});

	it("shows progress label", () => {
		render(UpdatePage);
		expect(screen.getByText("Starting")).toBeInTheDocument();
	});

	it("shows error and retry button when appState.error is set", async () => {
		render(UpdatePage);

		appState.error = "Network error";

		await waitFor(() => {
			expect(screen.getByText("Network error")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
		});
	});
});
