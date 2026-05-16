<script lang="ts">
	import { Home, ListTree, Minus, Settings, X } from "@lucide/svelte";
	import { getNativeApi } from "../services/native";
	import { appState } from "../state/app.svelte";

	const launcherVersion = import.meta.env.VITE_APP_VERSION ?? "0.2.9";
	const navDisabled = $derived(appState.page === "update");

	async function minimize() {
		const api = await getNativeApi();
		await api.minimizeWindow();
	}

	async function close() {
		const api = await getNativeApi();
		await api.closeWindow();
	}
</script>

<header class="titlebar electrobun-webkit-app-region-drag">
	<div class="titlebar-brand">
		<img src="/brand/logo.png" alt="" />
		<span>Shindo Launcher</span>
		<small>v{launcherVersion}</small>
	</div>

	<nav class="titlebar-nav electrobun-webkit-app-region-no-drag">
		<button
			class:active={appState.page === "home"}
			disabled={navDisabled}
			onclick={() => (appState.page = "home")}
		>
			<Home size={15} />
			Home
		</button>
		<button
			class:active={appState.page === "settings"}
			disabled={navDisabled}
			onclick={() => (appState.page = "settings")}
		>
			<Settings size={15} />
			Settings
		</button>
		<button
			class:active={appState.page === "logs"}
			disabled={navDisabled}
			onclick={() => (appState.page = "logs")}
		>
			<ListTree size={15} />
			Logs
		</button>
	</nav>

	<div class="window-actions electrobun-webkit-app-region-no-drag">
		<button aria-label="Minimize" onclick={minimize}>
			<Minus size={17} />
		</button>
		<button class="close" aria-label="Close" onclick={close}>
			<X size={17} />
		</button>
	</div>
</header>
