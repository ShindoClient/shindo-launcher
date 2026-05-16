import type { Locale } from "../shared/types";
import { settingsState } from "./state/app.svelte";

const dictionaries: Record<Locale, Record<string, string>> = {
	en: {
		"nav.home": "Home",
		"nav.settings": "Settings",
		"update.title": "Shindo Launcher",
		"update.retry": "Retry",
		"home.launch": "Launch",
		"home.downloading": "Downloading",
		"home.launching": "Launching",
		"home.running": "Running",
		"home.noAccount": "Add account before launch",
		"accounts.microsoft": "Microsoft",
		"accounts.offline": "Offline",
		"accounts.nickname": "Nickname",
		"settings.memory": "Memory",
		"settings.java": "Java",
		"settings.language": "Language",
		"settings.manualJava": "Manual Java executable",
		"settings.autoJava": "Automatic Temurin runtime",
	},
	pt: {},
	de: {},
};

export function t(key: string) {
	return dictionaries[settingsState.locale][key] ?? dictionaries.en[key] ?? key;
}
