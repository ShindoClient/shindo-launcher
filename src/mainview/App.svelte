<script lang="ts">
	import HomePage from "./components/HomePage.svelte";
	import LogsPage from "./components/LogsPage.svelte";
	import SettingsPage from "./components/SettingsPage.svelte";
	import TitleBar from "./components/TitleBar.svelte";
	import UpdatePage from "./components/UpdatePage.svelte";
	import { appState } from "./state/app.svelte";
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
