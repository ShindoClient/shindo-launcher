<script lang="ts">
	import { Home, ListTree, Minus, Settings, X } from "@lucide/svelte";
	import { getNativeApi } from "../services/native";
	import { appState } from "../state/app.svelte";

	const launcherVersion = import.meta.env.VITE_APP_VERSION ?? "0.2.9";
	const navDisabled = $derived(appState.page === "update");

	let isDragging = $state(false);
	let lastScreenX = 0;
	let lastScreenY = 0;
	let headerEl = $state<HTMLElement | null>(null);

	async function minimize() {
		const api = await getNativeApi();
		await api.minimizeWindow();
	}

	async function close() {
		const api = await getNativeApi();
		await api.closeWindow();
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement)?.closest(".electrobun-webkit-app-region-no-drag")) return;
		headerEl?.setPointerCapture(e.pointerId);
		isDragging = true;
		lastScreenX = e.screenX;
		lastScreenY = e.screenY;
		e.preventDefault();
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const dx = e.screenX - lastScreenX;
		const dy = e.screenY - lastScreenY;
		if (dx === 0 && dy === 0) return;
		lastScreenX = e.screenX;
		lastScreenY = e.screenY;
		getNativeApi().then((api) => api.moveWindow({ dx, dy }));
	}

	function onPointerUp() {
		isDragging = false;
	}
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} />

<header bind:this={headerEl} class="titlebar" role="banner" onpointerdown={onPointerDown}>
	<div class="titlebar-brand">
		<img src="./brand/logo.png" alt="" />
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
			<span class="nav-label" class:visible={appState.page === "home"}>Home</span>
		</button>
		<button
			class:active={appState.page === "settings"}
			disabled={navDisabled}
			onclick={() => (appState.page = "settings")}
		>
			<Settings size={15} />
			<span class="nav-label" class:visible={appState.page === "settings"}>Settings</span>
		</button>
		<button
			class:active={appState.page === "logs"}
			disabled={navDisabled}
			onclick={() => (appState.page = "logs")}
		>
			<ListTree size={15} />
			<span class="nav-label" class:visible={appState.page === "logs"}>Logs</span>
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
