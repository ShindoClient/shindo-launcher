import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/svelte";
import LogsPage from "$mainview/pages/LogsPage.svelte";
import { logState } from "$mainview/state/app.svelte";

beforeEach(() => {
	logState.entries = [];
});

afterEach(() => {
	cleanup();
});

describe("LogsPage", () => {
	it("shows empty message when no logs", () => {
		render(LogsPage);
		expect(screen.getByText("No launch logs yet.")).toBeInTheDocument();
	});

	it("renders log entries", () => {
		const now = Date.now();
		logState.entries = [
			{ id: "1", level: "info", message: "Game started", timestamp: now },
			{ id: "2", level: "error", message: "Something failed", timestamp: now },
		];
		render(LogsPage);
		expect(screen.getByText("Game started")).toBeInTheDocument();
		expect(screen.getByText("Something failed")).toBeInTheDocument();
	});

	it("shows log levels", () => {
		logState.entries = [
			{ id: "1", level: "warn", message: "Warning message", timestamp: Date.now() },
		];
		render(LogsPage);
		expect(screen.getByText("warn")).toBeInTheDocument();
	});

	it("clears logs when clear button is clicked", async () => {
		logState.entries = [
			{ id: "1", level: "info", message: "Temporary log", timestamp: Date.now() },
		];
		render(LogsPage);
		expect(screen.getByText("Temporary log")).toBeInTheDocument();

		const clearBtn = screen.getByRole("button", { name: /clear/i });
		clearBtn.click();

		await waitFor(() => {
			expect(screen.getByText("No launch logs yet.")).toBeInTheDocument();
		});
	});
});
