<script lang="ts">
	import { RefreshCcw } from "@lucide/svelte";
	import { t } from "../i18n";
	import { getNativeApi } from "../services/native";
	import {
		loadPersistedState,
		savePersistedState,
	} from "../services/persistence";
	import { loadAccounts } from "../services/accounts";
	import { fetchVersioning } from "../services/versioning";
	import {
		appState,
		getSelectedRelease,
		hydrateState,
		snapshotState,
		updateState,
		versionState,
	} from "../state/app.svelte";

	let started = $state(false);

	async function runUpdateCheck() {
		appState.error = "";
		updateState.isChecking = true;
		updateState.progress = { current: 0, total: 100, label: "Starting" };
		try {
			updateState.label = "Loading local preferences";
			hydrateState(await loadPersistedState());
			await loadAccounts();

			updateState.label = "Checking launcher update";
			updateState.progress = { current: 15, total: 100, label: "Launcher" };
			const api = await getNativeApi();
			await api.checkLauncherUpdate();

			updateState.label = "Reading version metadata";
			updateState.progress = { current: 35, total: 100, label: "Versioning" };
			const document = await fetchVersioning();
			versionState.document = document;
			versionState.releases = document.releases;

			updateState.label = "Validating selected channel";
			updateState.progress = { current: 75, total: 100, label: "Validation" };
			const selectedRelease = getSelectedRelease();
			if (selectedRelease && versionState.installedVersions[selectedRelease.id] !== selectedRelease.clientVersion) {
				updateState.label = "Client update required";
			}

			updateState.progress = { current: 100, total: 100, label: "Ready" };
			await savePersistedState(snapshotState());
			appState.page = "home";
		} catch (error) {
			appState.error =
				error instanceof Error ? error.message : "Update check failed";
		} finally {
			updateState.isChecking = false;
		}
	}

	$effect(() => {
		if (!started) {
			started = true;
			void runUpdateCheck();
		}
	});
</script>

<section class="update-page">
	<div class="loader" aria-hidden="true"></div>
	<h1>{t("update.title")}</h1>
	<p>{updateState.label}</p>
	<div class="progress" aria-label="Update progress">
		<span
			style={`width: ${(updateState.progress.current / updateState.progress.total) * 100}%`}
		></span>
	</div>
	<small>{updateState.progress.label}</small>
	{#if appState.error}
		<div class="error">{appState.error}</div>
		<button class="retry" onclick={runUpdateCheck}>
			<RefreshCcw size={16} />
			{t("update.retry")}
		</button>
	{/if}
</section>
