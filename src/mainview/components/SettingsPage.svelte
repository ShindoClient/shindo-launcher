<script lang="ts">
	import { ArrowLeft, FolderOpen, HardDrive, Languages } from "@lucide/svelte";
	import type { Locale } from "../../shared/types";
	import { t } from "../i18n";
	import { getNativeApi } from "../services/native";
	import { savePersistedState } from "../services/persistence";
	import { appState, settingsState, snapshotState } from "../state/app.svelte";

	const locales: Locale[] = ["en", "pt", "de"];

	$effect(() => {
		void savePersistedState(snapshotState());
	});

	async function pickJava() {
		const api = await getNativeApi();
		const result = await api.selectJavaExecutable();
		if (result.path) {
			settingsState.javaPath = result.path;
			settingsState.javaMode = "manual";
		}
	}
</script>

<section class="settings-page">
	<header class="settings-header">
		<button class="nav-button" onclick={() => (appState.page = "home")}>
			<ArrowLeft size={16} />
			{t("nav.home")}
		</button>
		<h1>{t("nav.settings")}</h1>
	</header>

	<div class="settings-grid">
		<section class="settings-section">
			<div class="section-title">
				<HardDrive size={19} />
				<h2>{t("settings.memory")}</h2>
			</div>
			<label>
				Minimum RAM
				<input
					type="range"
					min="512"
					max="8192"
					step="256"
					bind:value={settingsState.ramMinMb}
				/>
				<span>{settingsState.ramMinMb} MB</span>
			</label>
			<label>
				Maximum RAM
				<input
					type="range"
					min="1024"
					max="16384"
					step="256"
					bind:value={settingsState.ramMaxMb}
				/>
				<span>{settingsState.ramMaxMb} MB</span>
			</label>
		</section>

		<section class="settings-section">
			<div class="section-title">
				<FolderOpen size={19} />
				<h2>{t("settings.java")}</h2>
			</div>
			<label class="radio-row">
				<input type="radio" bind:group={settingsState.javaMode} value="auto" />
				{t("settings.autoJava")}
			</label>
			<label class="radio-row">
				<input type="radio" bind:group={settingsState.javaMode} value="manual" />
				{t("settings.manualJava")}
			</label>
			<button class="secondary-action" onclick={pickJava}>
				<FolderOpen size={16} />
				{settingsState.javaPath ?? "Choose executable"}
			</button>
			{#if settingsState.javaMode === "manual"}
				<p class="warning">
					Manual Java is not recommended. Launch can fail if the selected
					executable is incompatible.
				</p>
			{/if}
		</section>

		<section class="settings-section">
			<div class="section-title">
				<Languages size={19} />
				<h2>{t("settings.language")}</h2>
			</div>
			<div class="segmented">
				{#each locales as locale}
					<button
						class:active={settingsState.locale === locale}
						onclick={() => (settingsState.locale = locale)}
					>
						{locale.toUpperCase()}
					</button>
				{/each}
			</div>
		</section>
	</div>
</section>
