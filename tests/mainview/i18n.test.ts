import { describe, it, expect, beforeEach } from "vitest";
import { t } from "$mainview/i18n";
import { settingsState } from "$mainview/state/app.svelte";

beforeEach(() => {
	settingsState.locale = "en";
});

describe("t()", () => {
	it("returns English translations by default", () => {
		expect(t("nav.home")).toBe("Home");
		expect(t("nav.settings")).toBe("Settings");
		expect(t("home.launch")).toBe("Launch");
		expect(t("update.title")).toBe("Shindo Launcher");
	});

	it("returns pt-BR translations", () => {
		settingsState.locale = "pt-BR";
		expect(t("nav.home")).toBe("Início");
		expect(t("home.launch")).toBe("Jogar");
		expect(t("update.retry")).toBe("Tentar novamente");
	});

	it("returns pt-PT translations", () => {
		settingsState.locale = "pt-PT";
		expect(t("nav.home")).toBe("Início");
		expect(t("nav.settings")).toBe("Definições");
	});

	it("returns German translations", () => {
		settingsState.locale = "de";
		expect(t("nav.home")).toBe("Startseite");
		expect(t("home.running")).toBe("Läuft");
		expect(t("settings.memory")).toBe("Arbeitsspeicher");
	});

	it("falls back to English key when locale has no entry", () => {
		settingsState.locale = "pt-BR";
		expect(t("nav.home")).toBe("Início");
	});

	it("returns the raw key when not found in any dictionary", () => {
		expect(t("nonexistent.key")).toBe("nonexistent.key");
	});
});
