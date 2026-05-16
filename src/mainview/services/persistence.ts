import type { PersistedState } from "../../shared/types";
import { defaultSettings } from "../state/app.svelte";
import { getNativeApi } from "./native";

export async function loadPersistedState(): Promise<PersistedState> {
	const api = await getNativeApi();
	const state = await api.getState();
	return {
		settings: { ...defaultSettings, ...state.settings },
		accounts: state.accounts ?? [],
		installedVersions: state.installedVersions ?? {},
	};
}

export async function savePersistedState(state: PersistedState) {
	const api = await getNativeApi();
	await api.saveState(state);
}
