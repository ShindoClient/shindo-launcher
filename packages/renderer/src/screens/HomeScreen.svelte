<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    AccountProfile,
    LauncherConfig,
    ReleaseChannel,
    VersionCatalogEntry,
    VersionBuildCatalogEntry,
  } from '@shindo/shared';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronUp from 'lucide-svelte/icons/chevron-up';
  import Plus from 'lucide-svelte/icons/plus';
  import Shield from 'lucide-svelte/icons/shield';
  import Loader2 from 'lucide-svelte/icons/loader-2';
  import User from 'lucide-svelte/icons/user';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import X from 'lucide-svelte/icons/x';
  import { appStore } from '../store/appStore';
  import { resolveVersionPresentation } from '../config/versionCatalog';
  import bannerUrl from '../assets/Banner.png';

  const {
    launch,
    stopClient,
    applyConfigPatch,
    selectAccount,
    removeAccount,
    addMicrosoftAccount,
    addOfflineAccount,
  } = appStore;

  $: state = $appStore;
  $: config = state.config;
  $: clientState = state.clientState;
  $: launching = state.launching;
  $: clientRunning = state.clientRunning;
  $: launcherStatus = state.launcherStatus;
  $: update = state.update;
  $: updateStatus = update.status;
  $: accountsState = $appStore.accounts;
  $: activeAccount = accountsState.entries.find(
    (entry) => entry.id === accountsState.activeAccountId,
  );
  $: noAccountSelected = !activeAccount;
  $: canAddMore = accountsState.entries.length < accountsState.limit;
  $: isUpdating = updateStatus !== 'completed';

  function minotarHead(id?: string | null, size = 96): string {
    const safeId = id && id.trim() ? id : 'Steve';
    return `https://minotar.net/helm/${safeId}/${size}`;
  }

  function accountAvatar(account: AccountProfile | null | undefined, size = 96): string {
    if (!account) return minotarHead(undefined, size);
    return minotarHead(account.uuid || account.username, size);
  }

  function currentLanguage(conf: LauncherConfig | null): 'pt' | 'en' {
    return conf?.language === 'pt' ? 'pt' : 'en';
  }

  function makeVersionLabel(entry: VersionCatalogEntry): string {
    return `SHINDO ${entry.minecraftVersion}`;
  }

  function getBuildTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      stable: 'STABLE',
      snapshot: 'SNAPSHOT',
      dev: 'DEV',
      legacy: 'LEGACY',
    };
    return labels[type] || type.toUpperCase();
  }

  function getBuildTypeColor(type: string): string {
    const colors: Record<string, string> = {
      stable: '#22c55e',
      snapshot: '#f59e0b',
      dev: '#ef4444',
      legacy: '#8b5cf6',
    };
    return colors[type] || '#6366f1';
  }

  function makeBuildDisplayLabel(build: VersionBuildCatalogEntry): string {
    return `${build.semver} (${build.buildId}-${build.type})`;
  }

  function cardBackground(entry: VersionCatalogEntry): string {
    const gradient = 'linear-gradient(135deg, rgba(17, 24, 39, 0.55), rgba(2, 6, 23, 0.9))';
    const img = entry.bannerUrl || bannerUrl;
    return `${gradient}, url(${img})`;
  }

  $: avatarUrl = accountAvatar(activeAccount);
  $: selectedVersionId = config?.versionId ?? clientState?.versionId ?? 'ShindoClient';
  $: selectedVersionPresentation = resolveVersionPresentation(clientState);
  $: versionCatalog = state.versionCatalog;
  $: allVersionCards = versionCatalog?.entries ?? [];
  $: enabledVersionCards = allVersionCards.filter((entry) => entry.enabled !== false);
  $: versionCards = enabledVersionCards.length > 0 ? enabledVersionCards : allVersionCards;
  $: selectedVersionMeta =
    versionCards.find((entry) => entry.id === selectedVersionId) ||
    versionCards.find((entry) => entry.id === versionCatalog?.defaultVersionId) ||
    null;
  $: selectedBuildValue = config?.selectedBuild ?? null;
  $: buildOptions = selectedVersionMeta?.builds ?? [];
  $: filteredBuildOptions = selectedBuildType === 'all'
    ? buildOptions
    : buildOptions.filter((b) => b.type === selectedBuildType);
  $: selectedBuildOption =
    buildOptions.find((entry) => entry.build === selectedBuildValue) || buildOptions[0] || null;
  $: versionBannerBackground = selectedVersionMeta?.bannerUrl || bannerUrl;

  let accountMenuOpen = false;
  let versionPanelOpen = false;
  let accountDropdownRef: HTMLDivElement | null = null;
  let versionPanelRef: HTMLDivElement | null = null;
  let addPanelOpen = false;
  let addPanelMode: 'options' | 'offline' = 'options';
  let offlineName = '';
  let removeConfirmId: string | null = null;
  let selectedBuildType: 'stable' | 'snapshot' | 'dev' | 'all' = 'all';
  $: if (config?.releaseChannel && selectedBuildType === 'all') {
    selectedBuildType = config.releaseChannel;
  }

  onMount(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountDropdownRef && !accountDropdownRef.contains(target)) {
        accountMenuOpen = false;
      }
      if (versionPanelRef && !versionPanelRef.contains(target)) {
        versionPanelOpen = false;
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  });

  function toggleAccountMenu(event: MouseEvent) {
    event.stopPropagation();
    accountMenuOpen = !accountMenuOpen;
  }

  async function handleSelectAccount(accountId: string) {
    accountMenuOpen = false;
    if (accountId === accountsState.activeAccountId) return;
    try {
      await selectAccount(accountId);
    } catch {
      // handled by store
    }
  }

  async function handleRemoveAccount(accountId: string, event: MouseEvent) {
    event.stopPropagation();
    if (removeConfirmId !== accountId) {
      removeConfirmId = accountId;
      setTimeout(() => {
        if (removeConfirmId === accountId) {
          removeConfirmId = null;
        }
      }, 3500);
      return;
    }

    removeConfirmId = null;
    try {
      await removeAccount(accountId);
    } catch {
      // handled by store
    }
  }

  function openAddPanel() {
    if (!canAddMore) return;
    accountMenuOpen = false;
    addPanelOpen = true;
    addPanelMode = 'options';
    offlineName = '';
  }

  function closeAddPanel() {
    addPanelOpen = false;
    addPanelMode = 'options';
    offlineName = '';
  }

  async function handleMicrosoftLogin() {
    if (!canAddMore) return;
    closeAddPanel();
    try {
      await addMicrosoftAccount();
    } catch {
      // handled by store
    }
  }

  async function handleOfflineSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!offlineName.trim() || !canAddMore) return;

    try {
      await addOfflineAccount(offlineName.trim());
      closeAddPanel();
    } catch {
      // handled by store
    }
  }

  function handlePanelOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeAddPanel();
    }
  }

  async function handleVersionSelect(versionId: string) {
    if (versionId === selectedVersionId) {
      versionPanelOpen = false;
      return;
    }
    versionPanelOpen = false;
    const target = versionCards.find((entry) => entry.id === versionId);
    const nextBuild = target?.builds?.[0]?.build ?? null;
    await applyConfigPatch({ versionId, selectedBuild: nextBuild });
  }

  async function handleBuildSelect(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    const nextBuild = Number.isFinite(value) && value > 0 ? value : null;
    await applyConfigPatch({ selectedBuild: nextBuild });
  }

  async function handleChannelSelect(type: 'stable' | 'snapshot' | 'dev' | 'all') {
    selectedBuildType = type;
    if (type === 'all') return;
    const releaseChannel = type as ReleaseChannel;
    await applyConfigPatch({ releaseChannel, selectedBuild: null });
  }

  function normalizeStatusText(input: string): string {
    const text = (input || '').trim();
    if (!text) return '';
    if (text.length > 30) {
      return `${text.slice(0, 30).toUpperCase()}...`;
    }
    return text.toUpperCase();
  }

  $: language = currentLanguage(config);
  $: readyLabel = language === 'pt' ? 'INICIAR JOGO' : 'START GAME';
  $: stopLabel = language === 'pt' ? 'PARAR' : 'CLOSE';

  $: updateLabel = (() => {
    const msg = (update.message || '').toLowerCase();
    if (language === 'pt') {
      if (msg.includes('baixando') || msg.includes('download')) return 'BAIXANDO...';
      if (msg.includes('sincronizando') || msg.includes('sync')) return 'SINCRONIZANDO...';
      if (msg.includes('java') || msg.includes('runtime')) return 'PREPARANDO JAVA...';
      if (msg.includes('launcher')) return 'ATUALIZANDO LAUNCHER...';
      return 'ATUALIZANDO...';
    }
    if (msg.includes('baixando') || msg.includes('download')) return 'DOWNLOADING...';
    if (msg.includes('sincronizando') || msg.includes('sync')) return 'SYNCING...';
    if (msg.includes('java') || msg.includes('runtime')) return 'PREPARING JAVA...';
    if (msg.includes('launcher')) return 'UPDATING LAUNCHER...';
    return 'UPDATING...';
  })();

  $: launchButtonLabel = (() => {
    if (clientRunning) return stopLabel;
    if (isUpdating) return updateLabel;
    if (launching) return language === 'pt' ? 'INICIANDO...' : 'LAUNCHING...';
    if (noAccountSelected) return language === 'pt' ? 'SELECIONE UMA CONTA' : 'SELECT AN ACCOUNT';
    return readyLabel;
  })();

  $: launchButtonClass = (() => {
    if (clientRunning) return 'state-running';
    if (isUpdating) return 'state-updating';
    if (launching) return 'state-launching';
    if (noAccountSelected) return 'state-disabled';
    return 'state-ready';
  })();

  $: launchButtonDisabled = !clientRunning && (isUpdating || launching || noAccountSelected);
  $: launchHint = clientRunning
    ? normalizeStatusText(launcherStatus)
    : normalizeStatusText(selectedBuildOption?.label || selectedVersionPresentation.optionLabel);

  async function handleLaunchPrimaryAction() {
    if (clientRunning) {
      await stopClient();
      return;
    }
    if (launchButtonDisabled) return;
    launch().catch(() => undefined);
  }
</script>

<style lang="scss">
  @use '../styles/variables' as v;
  .home-container {
    width: 100%;
    height: 100%;
    background:
      radial-gradient(circle at 20% 10%, rgba(59, 130, 246, 0.08), transparent 42%), #05070f;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .hero-space {
    flex: 1;
  }

  .account-section {
    position: absolute;
    top: 20px;
    right: 30px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    width: max-content;
  }

  .account-toggle {
    min-width: 270px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 8px 14px;
    color: #ffffff;
    cursor: pointer;
  }

  .account-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .account-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .account-name {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  .account-type {
    font-size: 11px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  .account-chevron {
    width: 16px;
    height: 16px;
    color: #d1d5db;
  }

  .account-chevron.open {
    transform: rotate(180deg);
  }

  .account-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 10px);
    width: 270px;
    min-width: 270px;
    background: rgba(15, 23, 42, 0.96);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 12px;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.4),
      inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    overflow: hidden;
  }

  .account-dropdown-header {
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .account-empty {
    padding: 14px;
    font-size: 13px;
    color: #9ca3af;
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
  }

  .account-option {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 10px;
    color: #ffffff;
    cursor: pointer;
  }

  .account-option.active {
    border-color: rgba(59, 130, 246, 0.45);
    background: rgba(59, 130, 246, 0.12);
  }

  .account-option-avatar {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  .account-option-name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .account-active-badge {
    font-size: 10px;
    font-weight: 700;
    color: #60a5fa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .account-remove {
    height: 34px;
    min-width: 34px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    border-radius: 8px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
  }

  .account-remove.confirm {
    min-width: 62px;
    color: #fee2e2;
    border-color: rgba(248, 113, 113, 0.6);
  }

  .account-remove-icon {
    width: 14px;
    height: 14px;
  }

  .account-add-option {
    width: calc(100% - 20px);
    margin: 8px 10px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(34, 197, 94, 0.14);
    border: 1px solid rgba(34, 197, 94, 0.35);
    border-radius: 8px;
    color: #86efac;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .account-add-option:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .account-add-icon {
    width: 14px;
    height: 14px;
  }

  .status-chip {
    position: absolute;
    left: 28px;
    top: 26px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    z-index: 20;
  }

  .status-chip-error {
    background: rgba(239, 68, 68, 0.14);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .status-chip-icon {
    width: 14px;
    height: 14px;
  }

  .launcher-bar-wrap {
    position: absolute;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    width: min(940px, calc(100% - 90px));
    z-index: 25;
  }

  .version-banner {
    height: 152px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background-size: cover;
    background-position: center;
    margin-bottom: 12px;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    box-shadow: 0 20px 36px rgba(0, 0, 0, 0.38);
  }

  .version-banner-content {
    width: 100%;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: linear-gradient(180deg, rgba(2, 6, 23, 0), rgba(2, 6, 23, 0.75));
  }

  .version-banner-name {
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .version-banner-meta {
    font-size: 12px;
    font-weight: 700;
    color: rgba(229, 231, 235, 0.92);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .launcher-bar {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .launch-button {
    flex: 1;
    min-height: 76px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
    transition:
      transform 0.18s ease,
      filter 0.18s ease,
      opacity 0.2s ease;
  }

  .launch-button:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: saturate(1.05);
  }

  .launch-main-text {
    font-family: 'Poppins', sans-serif;
    font-size: 34px;
    line-height: 1;
    font-weight: 800;
    color: #ffffff;
  }

  .launch-sub-text {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.86);
    letter-spacing: 0.05em;
  }

  .launch-button.state-ready {
    background: linear-gradient(135deg, #1fe673 0%, #13be67 100%);
  }

  .launch-button.state-updating {
    background: linear-gradient(135deg, #7b3ff2 0%, #5b25cd 100%);
  }

  .launch-button.state-launching {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  }

  .launch-button.state-running {
    background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  }

  .launch-button.state-disabled {
    background: linear-gradient(135deg, #4b5563 0%, #1f2937 100%);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .version-toggle {
    width: 56px;
    min-width: 56px;
    height: 76px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 12px;
    background: rgba(13, 18, 36, 0.92);
    color: #e5e7eb;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .version-toggle-icon {
    width: 22px;
    height: 22px;
  }

  .version-selector-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 92px;
    background: rgba(8, 12, 26, 0.97);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 16px;
    padding: 14px;
    box-shadow: 0 24px 40px rgba(0, 0, 0, 0.45);
    max-height: min(62vh, 520px);
    overflow: auto;
  }

  .version-build-toolbar {
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .version-build-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9ca3af;
    font-weight: 700;
  }

  .version-build-select {
    min-width: 240px;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(148, 163, 184, 0.35);
    color: #e5e7eb;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 10px;
    outline: none;
  }

  .version-type-tabs {
    display: flex;
    gap: 6px;
  }

  .type-tab {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.25);
    color: #9ca3af;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .type-tab:hover {
    background: rgba(30, 41, 59, 0.85);
    border-color: rgba(148, 163, 184, 0.45);
    color: #e5e7eb;
  }

  .type-tab.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
    color: #6366f1;
  }

  .type-tab.stable.active {
    background: rgba(34, 197, 94, 0.2);
    border-color: #22c55e;
    color: #22c55e;
  }

  .type-tab.snapshot.active {
    background: rgba(245, 158, 11, 0.2);
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .type-tab.dev.active {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #ef4444;
  }

  .build-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }

  .build-card {
    position: relative;
    background: rgba(15, 23, 42, 0.7);
    border: 2px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    padding: 14px 16px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .build-card:hover {
    background: rgba(30, 41, 59, 0.85);
    border-color: var(--type-color, #6366f1);
    transform: translateY(-1px);
  }

  .build-card.selected {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--type-color, #6366f1);
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
  }

  .build-card-type {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--type-color, #6366f1);
  }

  .build-card-version {
    font-size: 16px;
    font-weight: 800;
    color: #f9fafb;
  }

  .build-card-id {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
  }

  .build-card-label {
    font-size: 11px;
    color: #6b7280;
  }

  .version-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .version-card {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    min-height: 118px;
    overflow: hidden;
    cursor: pointer;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 200px rgba(10, 15, 30, 0.22);
  }

  .version-card::before {
    content: '';
    position: absolute;
    inset: 0;
    backdrop-filter: contrast(0.9) saturate(1.2);
    opacity: 0.55;
  }

  .version-card-label {
    position: relative;
    z-index: 1;
    font-size: 38px;
    line-height: 1;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
  }

  .version-card-build {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 1;
    color: #f3f4f6;
    font-size: 11px;
    letter-spacing: 0.08em;
    font-weight: 800;
    text-transform: uppercase;
  }

  .version-card.selected {
    border-color: rgba(34, 197, 94, 0.85);
    box-shadow:
      inset 0 0 0 2px rgba(34, 197, 94, 0.55),
      0 0 0 1px rgba(34, 197, 94, 0.45);
  }

  .panel-overlay {
    position: absolute;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .panel-card {
    width: 100%;
    max-width: 430px;
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 24px 56px rgba(0, 0, 0, 0.5);
    padding: 22px;
    position: relative;
  }

  .panel-close {
    position: absolute;
    top: 10px;
    right: 10px;
    border: none;
    background: transparent;
    color: #9ca3af;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    cursor: pointer;
  }

  .panel-close-icon {
    width: 16px;
    height: 16px;
  }

  .panel-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
  }

  .panel-subtitle {
    margin: 8px 0 18px;
    font-size: 13px;
    color: #9ca3af;
  }

  .panel-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .panel-action {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 12px 14px;
    color: #f9fafb;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .panel-action.microsoft {
    background: rgba(34, 197, 94, 0.16);
    border-color: rgba(34, 197, 94, 0.38);
  }

  .panel-action.offline {
    background: rgba(59, 130, 246, 0.17);
    border-color: rgba(59, 130, 246, 0.38);
  }

  .panel-action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .panel-action-icon {
    width: 16px;
    height: 16px;
  }

  .panel-action-icon.spinning {
    animation: spin 1.1s linear infinite;
  }

  .offline-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .offline-input {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.04);
    color: #f9fafb;
    border-radius: 10px;
    padding: 11px 12px;
    outline: none;
    font-size: 14px;
    box-sizing: border-box;
  }

  .offline-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .secondary-btn,
  .primary-btn {
    border: none;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    padding: 10px 14px;
    cursor: pointer;
  }

  .secondary-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
  }

  .primary-btn {
    background: #2563eb;
    color: #ffffff;
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 1180px) {
    .version-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .version-card-label {
      font-size: 32px;
    }
  }

  @media (max-width: 880px) {
    .launcher-bar-wrap {
      width: calc(100% - 32px);
      bottom: 14px;
    }

    .version-banner {
      height: 124px;
    }

    .version-banner-name {
      font-size: 15px;
    }

    .version-grid {
      grid-template-columns: 1fr;
    }

    .version-build-toolbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .version-build-select {
      width: 100%;
      min-width: 0;
    }

    .launch-main-text {
      font-size: 24px;
    }

    .launch-sub-text {
      font-size: 10px;
    }
  }

</style>

<div class="home-container">
  <div class="account-section" bind:this={accountDropdownRef}>
    <button
      type="button"
      class="account-toggle"
      on:click={toggleAccountMenu}
      aria-expanded={accountMenuOpen}
      aria-label="Open account menu"
    >
      <img
        class="account-avatar"
        src={avatarUrl}
        alt={activeAccount?.username || 'No account'}
        draggable="false"
      />
      <div class="account-info">
        <span class="account-name">{activeAccount?.username || 'No account selected'}</span>
        <span class="account-type">
          {activeAccount
            ? activeAccount.type === 'microsoft'
              ? 'Microsoft'
              : 'Offline'
            : 'Choose or add an account'}
        </span>
      </div>
      <ChevronDown class={`account-chevron ${accountMenuOpen ? 'open' : ''}`} />
    </button>

    {#if accountMenuOpen}
      <div class="account-dropdown">
        <div class="account-dropdown-header">
          Accounts {accountsState.entries.length}/{accountsState.limit}
        </div>

        {#if accountsState.entries.length === 0}
          <div class="account-empty">No saved accounts</div>
        {:else}
          {#each accountsState.entries as account}
            <div class="account-row">
              <button
                type="button"
                class={`account-option ${account.id === accountsState.activeAccountId ? 'active' : ''}`}
                on:click={() => handleSelectAccount(account.id)}
              >
                <img
                  class="account-option-avatar"
                  src={accountAvatar(account, 48)}
                  alt={account.username}
                  draggable="false"
                />
                <span class="account-option-name">{account.username}</span>
                {#if account.id === accountsState.activeAccountId}
                  <span class="account-active-badge">Active</span>
                {/if}
              </button>
              <button
                type="button"
                class={`account-remove ${removeConfirmId === account.id ? 'confirm' : ''}`}
                on:click={(event) => handleRemoveAccount(account.id, event)}
                title={removeConfirmId === account.id ? 'Confirm remove' : 'Remove account'}
              >
                {#if removeConfirmId === account.id}
                  Confirm
                {:else}
                  <Trash2 class="account-remove-icon" />
                {/if}
              </button>
            </div>
          {/each}
        {/if}

        <button
          type="button"
          class="account-add-option"
          on:click={openAddPanel}
          disabled={!canAddMore}
        >
          <Plus class="account-add-icon" />
          <span>{canAddMore ? 'Add account' : 'Account limit reached'}</span>
        </button>
      </div>
    {/if}
  </div>

  <div class="hero-space" />

  {#if accountsState.error}
    <div class="status-chip status-chip-error">
      <AlertTriangle class="status-chip-icon" />
      <span>{accountsState.error}</span>
    </div>
  {/if}

  <div class="launcher-bar-wrap" bind:this={versionPanelRef}>
    {#if versionPanelOpen}
      <div class="version-selector-panel">
        {#if selectedVersionMeta && selectedVersionMeta.builds.length > 0}
          <div class="version-build-toolbar">
            <span class="version-build-label">Filter</span>
            <div class="version-type-tabs">
              <button
                type="button"
                class={`type-tab ${selectedBuildType === 'all' ? 'active' : ''}`}
                on:click={() => handleChannelSelect('all')}
              >
                All
              </button>
              <button
                type="button"
                class={`type-tab stable ${selectedBuildType === 'stable' ? 'active' : ''}`}
                on:click={() => handleChannelSelect('stable')}
              >
                Stable
              </button>
              <button
                type="button"
                class={`type-tab snapshot ${selectedBuildType === 'snapshot' ? 'active' : ''}`}
                on:click={() => handleChannelSelect('snapshot')}
              >
                Snapshot
              </button>
              <button
                type="button"
                class={`type-tab dev ${selectedBuildType === 'dev' ? 'active' : ''}`}
                on:click={() => handleChannelSelect('dev')}
              >
                Dev
              </button>
            </div>
          </div>
        {/if}
        <div class="build-grid">
          {#each filteredBuildOptions as build}
            <button
              type="button"
              class={`build-card ${selectedBuildValue === build.build ? 'selected' : ''}`}
              style={`--type-color: ${getBuildTypeColor(build.type)};`}
              on:click={() => applyConfigPatch({ selectedBuild: build.build })}
            >
              <span class="build-card-type">{getBuildTypeLabel(build.type)}</span>
              <span class="build-card-version">{build.semver}</span>
              <span class="build-card-id">{build.buildId}</span>
              <span class="build-card-label">{build.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div
      class="version-banner"
      style={`background-image: linear-gradient(180deg, rgba(2, 6, 23, 0.12), rgba(2, 6, 23, 0.72)), url(${versionBannerBackground});`}
    >
      <div class="version-banner-content">
        <span class="version-banner-name">{selectedVersionMeta?.name || 'Shindo Client'}</span>
        <span class="version-banner-meta">
          MC {selectedVersionMeta?.minecraftVersion || selectedVersionPresentation.baseVersion}
          {#if selectedBuildOption}
            {' · '}{selectedBuildOption.semver} ({selectedBuildOption.buildId}-{selectedBuildOption.type})
          {/if}
        </span>
      </div>
    </div>

    <div class="launcher-bar">
      <button
        type="button"
        class={`launch-button ${launchButtonClass}`}
        on:click={handleLaunchPrimaryAction}
        disabled={launchButtonDisabled}
      >
        <span class="launch-main-text">{launchButtonLabel}</span>
        <span class="launch-sub-text">{launchHint}</span>
      </button>

      <button
        type="button"
        class="version-toggle"
        on:click|stopPropagation={() => (versionPanelOpen = !versionPanelOpen)}
        aria-label="Open version selector"
        title="Version selector"
      >
        <ChevronUp class="version-toggle-icon" />
      </button>
    </div>
  </div>

  {#if addPanelOpen}
    <div
      class="panel-overlay"
      on:click|self={closeAddPanel}
      on:keydown={handlePanelOverlayKeydown}
      role="button"
      tabindex="0"
      aria-label="Close add account panel"
    >
      <div class="panel-card">
        <button
          type="button"
          class="panel-close"
          on:click={closeAddPanel}
          aria-label="Close add account panel"
        >
          <X class="panel-close-icon" />
        </button>

        {#if addPanelMode === 'options'}
          <h3 class="panel-title">Add account</h3>
          <p class="panel-subtitle">Choose the login type</p>
          <div class="panel-actions">
            <button
              type="button"
              class="panel-action microsoft"
              on:click={handleMicrosoftLogin}
              disabled={accountsState.loginInProgress}
            >
              {#if accountsState.loginInProgress}
                <Loader2 class="panel-action-icon spinning" />
                <span>Opening Microsoft login...</span>
              {:else}
                <Shield class="panel-action-icon" />
                <span>Login with Microsoft</span>
              {/if}
            </button>

            <button
              type="button"
              class="panel-action offline"
              on:click={() => (addPanelMode = 'offline')}
            >
              <User class="panel-action-icon" />
              <span>Login offline</span>
            </button>
          </div>
        {:else}
          <h3 class="panel-title">Offline account</h3>
          <p class="panel-subtitle">Type the username (max 16 chars)</p>
          <form class="offline-form" on:submit={handleOfflineSubmit}>
            <input
              type="text"
              bind:value={offlineName}
              maxlength="16"
              class="offline-input"
              placeholder="Username"
              disabled={accountsState.loading}
            />
            <div class="offline-form-actions">
              <button
                type="button"
                class="secondary-btn"
                on:click={() => (addPanelMode = 'options')}
              >
                Back
              </button>
              <button
                type="submit"
                class="primary-btn"
                disabled={!offlineName.trim() || accountsState.loading}
              >
                {accountsState.loading ? 'Adding...' : 'Add offline account'}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}
</div>
