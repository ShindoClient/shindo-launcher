import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import SettingsPage from "$mainview/pages/SettingsPage.svelte";
import { settingsState } from "$mainview/state/app.svelte";

vi.mock("$mainview/services/native", () => ({
	getNativeApi: vi.fn().mockResolvedValue({
		selectJavaExecutable: vi.fn().mockResolvedValue({ path: "/usr/bin/java" }),
		minimizeWindow: vi.fn(),
		closeWindow: vi.fn(),
		moveWindow: vi.fn(),
	}),
}));

vi.mock("$mainview/services/persistence", () => ({
	savePersistedState: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
	settingsState.locale = "en";
	settingsState.theme = "dark";
	settingsState.ramMinMb = 1024;
	settingsState.ramMaxMb = 4096;
	settingsState.javaMode = "auto";
});

afterEach(() => {
	cleanup();
});

describe("SettingsPage", () => {
	it("renders all settings sections", () => {
		render(SettingsPage);
		expect(screen.getByText("Memory")).toBeInTheDocument();
		expect(screen.getByText("Java")).toBeInTheDocument();
		expect(screen.getByText("Language")).toBeInTheDocument();
		expect(screen.getByText("Theme")).toBeInTheDocument();
	});

	it("renders RAM sliders with correct values", () => {
		render(SettingsPage);
		expect(screen.getByText("1024 MB")).toBeInTheDocument();
		expect(screen.getByText("4096 MB")).toBeInTheDocument();
	});

	it("highlights the active theme button", () => {
		render(SettingsPage);
		const darkBtn = screen.getByText("Dark");
		const lightBtn = screen.getByText("Light");
		const highContrastBtn = screen.getByText("High Contrast");

		expect(darkBtn.closest("button")).toHaveClass("active");
		expect(lightBtn.closest("button")).not.toHaveClass("active");
		expect(highContrastBtn.closest("button")).not.toHaveClass("active");
	});

	it("switches theme when a theme button is clicked", () => {
		render(SettingsPage);
		const lightBtn = screen.getByText("Light");
		lightBtn.click();
		expect(settingsState.theme).toBe("light");
	});

	it("renders current locale as default language", () => {
		render(SettingsPage);
		expect(screen.getByText("English")).toBeInTheDocument();
	});

	it("renders language dropdown trigger with current locale label", () => {
		render(SettingsPage);
		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveTextContent("English");
	});

	it("renders Java mode radio buttons", () => {
		render(SettingsPage);
		expect(screen.getByText("Automatic Temurin runtime")).toBeInTheDocument();
		expect(screen.getByText("Manual Java executable")).toBeInTheDocument();
	});
});
