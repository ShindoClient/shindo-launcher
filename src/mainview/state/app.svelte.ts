import type {
	AccountProfile,
	AppPage,
	ClientRelease,
	LauncherSettings,
	LauncherStatus,
	LogEntry,
	PersistedState,
	ProgressPayload,
	ReleaseChannel,
	VersioningDocument,
} from "../../shared/types";

export const defaultSettings: LauncherSettings = {
	channel: "stable",
	ramMinMb: 1024,
	ramMaxMb: 4096,
	javaMode: "auto",
	locale: "en",
};

export const appState = $state({
	page: "update" as AppPage,
	error: "",
	isVersionPanelOpen: false,
	isAccountMenuOpen: false,
});

export const updateState = $state({
	isChecking: false,
	label: "Preparing launcher",
	progress: { current: 0, total: 100, label: "Queued" } as ProgressPayload,
});

export const launcherState = $state({
	status: "idle" as LauncherStatus,
	progress: { current: 0, total: 100, label: "Ready" } as ProgressPayload,
});

export const versionState = $state({
	document: null as VersioningDocument | null,
	releases: [] as ClientRelease[],
	installedVersions: {} as Record<string, string>,
});

export const accountState = $state({
	accounts: [] as AccountProfile[],
	activeAccountId: undefined as string | undefined,
});

export const settingsState = $state<LauncherSettings>({ ...defaultSettings });

export const logState = $state({
	entries: [] as LogEntry[],
});

export function pushLog(entry: LogEntry) {
	logState.entries = [...logState.entries.slice(-499), entry];
}

export function getSelectedRelease() {
	const candidates = versionState.releases.filter(
		(release) => release.channel === settingsState.channel,
	);
	if (settingsState.selectedVersionId) {
		const manual = candidates.find(
			(release) => release.id === settingsState.selectedVersionId,
		);
		if (manual) return manual;
	}
	return candidates[0] ?? versionState.releases[0] ?? null;
}

export function getActiveAccount() {
	return (
		accountState.accounts.find(
			(account) => account.id === accountState.activeAccountId,
		) ?? accountState.accounts[0] ?? null
	);
}

export function getBannerUrl() {
	const selectedRelease = getSelectedRelease();
	if (!selectedRelease) return "";
	return (
		selectedRelease.bannerUrl ??
		versionState.document?.assets?.banners?.[selectedRelease.minecraftVersion] ??
		`https://cdn.shindoclient.com/assets/banners/${selectedRelease.minecraftVersion}.jpg`
	);
}

export function getIsSelectedInstalled() {
	const selectedRelease = getSelectedRelease();
	if (!selectedRelease) return false;
	return (
		versionState.installedVersions[selectedRelease.id] ===
		selectedRelease.clientVersion
	);
}

export function hydrateState(state: PersistedState) {
	Object.assign(settingsState, { ...defaultSettings, ...state.settings });
	accountState.accounts = state.accounts.slice(0, 6);
	accountState.activeAccountId = state.settings.activeAccountId;
	versionState.installedVersions = state.installedVersions;
}

export function snapshotState(): PersistedState {
	return {
		settings: {
			...settingsState,
			activeAccountId: accountState.activeAccountId,
		},
		accounts: accountState.accounts.slice(0, 6),
		installedVersions: { ...versionState.installedVersions },
	};
}

export function setChannel(channel: ReleaseChannel) {
	settingsState.channel = channel;
	settingsState.selectedVersionId = undefined;
}
