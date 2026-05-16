<script lang="ts">
	import { ArrowLeft, ChevronDown, FolderOpen, HardDrive, Languages, Moon, Sun, Contrast } from "@lucide/svelte";
	import type { Locale, Theme } from "../../shared/types";
	import { t } from "../i18n";
	import { getNativeApi } from "../services/native";
	import { savePersistedState } from "../services/persistence";
	import { appState, settingsState, snapshotState } from "../state/app.svelte";

	const localeOptions: { value: Locale; label: string; flag: string }[] = [
		{ value: "en", label: "English", flag: "🇺🇸" },
		{ value: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
		{ value: "pt-PT", label: "Português (Portugal)", flag: "🇵🇹" },
		{ value: "de", label: "Deutsch", flag: "🇩🇪" },
	];

	let langOpen = $state(false);

	const currentLocale = $derived(
		localeOptions.find((o) => o.value === settingsState.locale) ?? localeOptions[0],
	);

	function closeLangMenu() {
		langOpen = false;
	}

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

<svelte:window onclick={closeLangMenu} />

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
			<div class="lang-dropdown" role="combobox" aria-haspopup="listbox" aria-expanded={langOpen} aria-controls="lang-menu">
				<button
					class="lang-trigger"
					onclick={(e) => {
						e.stopPropagation();
						langOpen = !langOpen;
					}}
				>
					<span class="lang-flag">{currentLocale.flag}</span>
					<span class="lang-label">{currentLocale.label}</span>
					<span class="chevron-wrap" class:open={langOpen}><ChevronDown size={14} /></span>
				</button>
				{#if langOpen}
					<div id="lang-menu" class="lang-menu" role="listbox">
						{#each localeOptions as opt}
							<button
								role="option"
								aria-selected={opt.value === settingsState.locale}
								class:active={opt.value === settingsState.locale}
								onclick={(e) => {
									e.stopPropagation();
									settingsState.locale = opt.value;
									langOpen = false;
								}}
							>
								<span class="lang-flag">{opt.flag}</span>
								<span class="lang-label">{opt.label}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<section class="settings-section">
			<div class="section-title">
				<Contrast size={19} />
				<h2>{t("settings.theme")}</h2>
			</div>
			<div class="theme-grid">
				<button
					class="theme-option"
					class:active={settingsState.theme === "dark"}
					onclick={() => (settingsState.theme = "dark" as Theme)}
				>
					<Moon size={18} />
					<span>{t("settings.theme.dark")}</span>
				</button>
				<button
					class="theme-option"
					class:active={settingsState.theme === "light"}
					onclick={() => (settingsState.theme = "light" as Theme)}
				>
					<Sun size={18} />
					<span>{t("settings.theme.light")}</span>
				</button>
				<button
					class="theme-option"
					class:active={settingsState.theme === "high-contrast"}
					onclick={() => (settingsState.theme = "high-contrast" as Theme)}
				>
					<Contrast size={18} />
					<span>{t("settings.theme.highContrast")}</span>
				</button>
			</div>
		</section>
	</div>
</section>
