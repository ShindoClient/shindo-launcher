<script lang="ts">
	import { Trash2 } from "@lucide/svelte";
	import { logState } from "../state/app.svelte";

	function clearLogs() {
		logState.entries = [];
	}

	function formatTime(timestamp: number) {
		return new Intl.DateTimeFormat("en", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}).format(timestamp);
	}
</script>

<section class="logs-page">
	<header class="logs-header">
		<div>
			<h1>Launch Logs</h1>
			<p>Minecraft process output and launcher-core events.</p>
		</div>
		<button onclick={clearLogs}>
			<Trash2 size={16} />
			Clear
		</button>
	</header>

	<div class="log-console">
		{#if logState.entries.length === 0}
			<div class="empty-logs">No launch logs yet.</div>
		{:else}
			{#each logState.entries as entry}
				<div class={`log-line ${entry.level}`}>
					<time>{formatTime(entry.timestamp)}</time>
					<strong>{entry.level}</strong>
					<span>{entry.message}</span>
				</div>
			{/each}
		{/if}
	</div>
</section>
