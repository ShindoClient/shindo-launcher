import {
	appState,
	getActiveAccount,
	getIsSelectedInstalled,
	getSelectedRelease,
	launcherState,
	settingsState,
	snapshotState,
	versionState,
} from "../state/app.svelte";
import { getNativeApi } from "./native";
import { savePersistedState } from "./persistence";

export async function installSelectedRelease() {
	const selectedRelease = getSelectedRelease();
	if (!selectedRelease) throw new Error("No version selected");
	const api = await getNativeApi();
	launcherState.status = "downloading";
	const result = await api.downloadClient({
		release: selectedRelease,
		versionJsonUrl: selectedRelease.versionJsonUrl,
	});
	versionState.installedVersions[selectedRelease.id] =
		selectedRelease.clientVersion;
	await savePersistedState(snapshotState());
	return result;
}

export async function launchSelectedRelease() {
	appState.error = "";
	const selectedRelease = getSelectedRelease();
	const activeAccount = getActiveAccount();
	if (!selectedRelease) {
		appState.error = "No version selected";
		return;
	}
	if (!activeAccount) {
		appState.error = "Add an account before launching";
		return;
	}

	try {
		if (!getIsSelectedInstalled()) {
			await installSelectedRelease();
		}
		launcherState.status = "launching";
		const api = await getNativeApi();
		await api.ensureJava({ javaVersion: selectedRelease.javaVersion });
		await api.launchGame({
			version: selectedRelease,
			account: activeAccount,
			settings: settingsState,
		});
		launcherState.status = "running";
	} catch (error) {
		launcherState.status = "idle";
		appState.error = error instanceof Error ? error.message : "Launch failed";
	}
}
