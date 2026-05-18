<script lang="ts">
	import {
		ChevronUp,
		Play,
		Plus,
		Trash2,
		User,
	} from "@lucide/svelte";
	import type { ReleaseChannel } from "../../shared/types";
	import { t } from "../i18n";
	import {
		activateAccount,
		addMicrosoftAccount,
		addOfflineAccount,
		removeAccount,
	} from "../services/accounts";
	import { launchSelectedRelease } from "../services/launcher";
	import {
		accountState,
		appState,
		getActiveAccount,
		getBannerUrl,
		getIsSelectedInstalled,
		getSelectedRelease,
		launcherState,
		setChannel,
		settingsState,
		versionState,
	} from "../state/app.svelte";

	const channels: ReleaseChannel[] = ["stable", "dev", "snapshot"];
	let offlineInput = $state("");
	let accountModal = $state<"none" | "choose" | "offline">("none");
	let microsoftLoginInProgress = $state(false);
	let accountError = $state<string | null>(null);

	const longestUsername = $derived.by(() => {
		const names = accountState.accounts.map((a) => a.username.length);
		return Math.max(names.length > 0 ? Math.max(...names) : 0, "Account".length, "Add account".length);
	});
	const dropdownWidth = $derived(`${Math.max(longestUsername * 7 + 52, 200)}px`);

	const launchLabel = $derived(
		{
			idle: t("home.launch"),
			downloading: t("home.downloading"),
			launching: t("home.launching"),
			running: t("home.running"),
		}[launcherState.status],
	);

	const launchSubLabel = $derived.by(() => {
		const activeAccount = getActiveAccount();
		const selectedRelease = getSelectedRelease();
		if (!activeAccount) return t("home.noAccount");
		if (launcherState.status === "downloading") {
			return `${launcherState.progress.label} ${launcherState.progress.current}%`;
		}
		if (launcherState.status === "running") return activeAccount.username;
		if (!getIsSelectedInstalled()) return "Client update required";
		return `${selectedRelease?.minecraftVersion ?? "-"} ${settingsState.channel}`;
	});

	async function addOffline() {
		accountError = null;
		try {
			await addOfflineAccount(offlineInput);
			offlineInput = "";
			accountModal = "none";
			appState.isAccountMenuOpen = false;
		} catch (error) {
			accountError = error instanceof Error ? error.message : String(error);
		}
	}

	async function addMicrosoft() {
		accountError = null;
		microsoftLoginInProgress = true;
		accountModal = "none";
		appState.isAccountMenuOpen = false;
		try {
			// Delegates entirely to the native (bun) process:
			// opens the Microsoft OAuth BrowserWindow, waits for completion,
			// and returns the updated accounts state.
			await addMicrosoftAccount();
		} catch (error) {
			// User cancelled or login failed — surface the message.
			const message = error instanceof Error ? error.message : String(error);
			if (message !== "Login cancelled by user.") {
				accountError = message;
			}
		} finally {
			microsoftLoginInProgress = false;
		}
	}
</script>

<section class="home-page">
	<header class="topbar">
		<div></div>
		<div class="account" style="min-width: {dropdownWidth}">
			<button
				class="account-button"
				onclick={() =>
					(appState.isAccountMenuOpen = !appState.isAccountMenuOpen)}
			>
				{#if getActiveAccount()?.type === "offline"}
					<img class="avatar-small" src="https://mc-heads.net/avatar/steve" alt="" />
				{:else if getActiveAccount()?.skinUrl}
					<img class="avatar-small" src={getActiveAccount()!.skinUrl!} alt="" />
				{:else}
					<User size={17} />
				{/if}
				<span>{getActiveAccount()?.username ?? "Account"}</span>
			</button>
			{#if appState.isAccountMenuOpen}
				<div class="account-menu">
					{#each accountState.accounts as account, i}
						<div class="account-row">
							<button
								class:active={account.id === accountState.activeAccountId}
								onclick={() => {
									activateAccount(account.id);
									appState.isAccountMenuOpen = false;
								}}
							>
								<span class="account-info">
									{#if account.type === "offline"}
										<img class="avatar-tiny" src="https://mc-heads.net/avatar/steve" alt="" />
									{:else}
										<img class="avatar-tiny" src={account.skinUrl} alt="" />
									{/if}
									<span>{account.username}</span>
								</span>
								<small>{account.type}</small>
							</button>
							<button
								class="account-delete"
								aria-label="Remove account"
								onclick={(e) => {
									e.stopPropagation();
									removeAccount(account.id);
								}}
							>
								<Trash2 size={13} />
							</button>
						</div>
						{#if i < accountState.accounts.length - 1}
							<hr class="account-divider">
						{/if}
					{/each}
					<button class="add-account-btn" onclick={() => (accountModal = "choose")}>
						<Plus size={15} />
						Add account
					</button>
				</div>
			{/if}
		</div>
	</header>

	{#if accountError}
		<div class="error-banner">{accountError}</div>
	{/if}

	{#if microsoftLoginInProgress}
		<div class="login-progress-banner">Opening Microsoft login...</div>
	{/if}

	<div class="hero">
		<img src={getBannerUrl()} alt="" />
	</div>

	<div class="launch-zone">
		{#if appState.error}
			<div class="error">{appState.error}</div>
		{/if}
		<div class="launch-combo">
			<button
				class={`launch-button ${launcherState.status}`}
				onclick={launchSelectedRelease}
				disabled={launcherState.status !== "idle"}
			>
				<Play size={30} />
				<span>
					<strong>{launchLabel}</strong>
					<small>{launchSubLabel}</small>
				</span>
			</button>
			<a
				class="discord-button"
				href="https://discord.com/invite/uU56tvtXMU"
				target="_blank"
				rel="noreferrer noopener"
			>
				Discord
			</a>
			<button
				class="selector-button"
				onclick={() =>
					(appState.isVersionPanelOpen = !appState.isVersionPanelOpen)}
			>
				<ChevronUp size={22} />
			</button>
		</div>
		{#if appState.isVersionPanelOpen}
			<div class="version-panel">
				<div class="channel-tabs">
					{#each channels as channel}
						<button
							class:active={settingsState.channel === channel}
							onclick={() => setChannel(channel)}
						>
							{channel}
						</button>
					{/each}
				</div>
				<div class="release-list">
					{#each versionState.releases.filter((release) => release.channel === settingsState.channel) as release}
						<button
							class:active={release.id === getSelectedRelease()?.id}
							onclick={() => (settingsState.selectedVersionId = release.id)}
						>
							<span>{release.clientVersion}</span>
							<small>
								Minecraft {release.minecraftVersion} · Java {release.javaVersion}
							</small>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if accountModal !== "none"}
		<button
			class="modal-backdrop"
			aria-label="Close dialog"
			onclick={() => (accountModal = "none")}
		></button>
		<div class="account-modal">
			{#if accountModal === "choose"}
				<h2>Add account</h2>
				<p>Select login type.</p>
				<div class="modal-actions">
					<button
						onclick={addMicrosoft}
						disabled={microsoftLoginInProgress}
					>
						{microsoftLoginInProgress ? "Opening Microsoft login..." : t("accounts.microsoft")}
					</button>
					<button onclick={() => (accountModal = "offline")}>
						{t("accounts.offline")}
					</button>
				</div>
			{:else}
				<h2>{t("accounts.offline")}</h2>
				<p>Enter username for offline profile.</p>
				<input
					class="modal-input"
					bind:value={offlineInput}
					placeholder={t("accounts.nickname")}
				/>
				<button class="login-button" onclick={addOffline}>Login</button>
			{/if}
		</div>
	{/if}
</section>
