<script lang="ts">
	import HomePage from "./pages/HomePage.svelte";
	import LogsPage from "./pages/LogsPage.svelte";
	import SettingsPage from "./pages/SettingsPage.svelte";
	import TitleBar from "./components/TitleBar.svelte";
	import UpdatePage from "./pages/UpdatePage.svelte";
	import { appState, settingsState } from "./state/app.svelte";

	$effect(() => {
		document.documentElement.setAttribute("data-theme", settingsState.theme);
	});
</script>

<TitleBar />
<div class="app-content">
	{#if appState.page === "update"}
		<UpdatePage />
	{:else if appState.page === "settings"}
		<SettingsPage />
	{:else if appState.page === "logs"}
		<LogsPage />
	{:else}
		<HomePage />
	{/if}
</div>
