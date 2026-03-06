<script lang="ts">
  import { onMount } from 'svelte'
  import Play from 'lucide-svelte/icons/play'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { appStore } from '../store/appStore'
  import { resolveVersionPresentation } from '../config/versionCatalog'
  import { t } from '../i18n'
  import bannerUrl from '../assets/Banner.png'

  const { launch, applyConfigPatch } = appStore

  $: state = $appStore
  $: config = state.config
  $: clientState = state.clientState
  $: launching = state.launching
  $: launcherStatus = state.launcherStatus
  $: playStatusLabel = noAccountSelected ? $t('home.status.accountRequired') : launcherStatus
  $: update = state.update
  $: updateStatus = update.status
  $: accountsState = $appStore.accounts
  $: activeAccount = accountsState.entries.find((entry) => entry.id === accountsState.activeAccountId)
  $: noAccountSelected = !activeAccount

  function minotarHead(id?: string | null, size = 96): string {
    const safeId = id && id.trim() ? id : 'Steve'
    return `https://minotar.net/helm/${safeId}/${size}`
  }

  function resolveAvatar(): string {
    if (!activeAccount) {
      return minotarHead()
    }
    return minotarHead(activeAccount.uuid || activeAccount.username, 96)
  }

  $: avatarUrl = resolveAvatar()
  $: versionPresentation = resolveVersionPresentation(clientState)

  $: versionOptions = clientState
    ? [{ id: clientState.versionId, label: versionPresentation.optionLabel }]
    : []
  $: selectedVersionId = config?.versionId ?? clientState?.versionId ?? ''
  $: selectedVersionLabel =
    versionOptions.find((option) => option.id === selectedVersionId)?.label ?? $t('home.selectVersion')

  $: playDisabled = launching || updateStatus !== 'completed' || noAccountSelected

  let versionMenuOpen = false
  let dropdownRef: HTMLDivElement | null = null

  onMount(() => {
    const handleClick = (event: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
        versionMenuOpen = false
      }
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  })

  function toggleVersionMenu(event: MouseEvent) {
    event.stopPropagation()
    versionMenuOpen = !versionMenuOpen
  }

  async function selectVersion(optionId: string) {
    versionMenuOpen = false
    if (optionId !== selectedVersionId) {
      await applyConfigPatch({ versionId: optionId })
    }
  }

  function handlePlay() {
    launch().catch(() => undefined)
  }
</script>

<div class="home-container">
  <!-- Account info no canto superior direito -->
  <div class="account-section">
    {#if activeAccount}
      <div class="account-card">
        <img
          class="account-avatar"
          src={avatarUrl}
          alt={activeAccount.username}
          draggable="false"
        />
        <div class="account-info">
          <span class="account-name">{activeAccount.username}</span>
          <span class="account-type">{activeAccount.type === 'microsoft' ? 'Microsoft' : 'Offline'}</span>
        </div>
      </div>
    {:else}
      <button
        type="button"
        class="add-account-btn"
        on:click={() => $appStore.setScreen('accounts')}
      >
        ADD ACCOUNT
      </button>
    {/if}
  </div>

  <!-- Área central com o botão LAUNCH -->
  <div class="launch-area">
    <!-- Banner de fundo atrás do botão -->
    <div class="banner-background">
      <img src={bannerUrl} alt="Banner" class="banner-image" />
      <div class="banner-overlay"></div>
    </div>

    <!-- Botão LAUNCH grande -->
    <button
      type="button"
      class="launch-button"
      on:click={handlePlay}
      disabled={playDisabled}
    >
      <div class="launch-content">
        <span class="launch-text">{launching ? 'LAUNCHING...' : 'LAUNCH'}</span>
        <span class="launch-version">{selectedVersionLabel}</span>
      </div>
      <div class="launch-icon">
        <Play class="play-icon" />
      </div>
    </button>

    <!-- Seletor de versão pequeno abaixo do botão -->
    <div class="version-selector" bind:this={dropdownRef}>
      <button
        type="button"
        class="version-button"
        on:click={toggleVersionMenu}
      >
        <span>{selectedVersionLabel}</span>
        <ChevronDown class={`chevron ${versionMenuOpen ? 'open' : ''}`} />
      </button>
      
      {#if versionOptions.length > 0 && versionMenuOpen}
        <div class="version-dropdown">
          {#each versionOptions as option}
            <button
              type="button"
              class="version-option"
              on:click={() => selectVersion(option.id)}
            >
              <span>{option.label}</span>
              {#if option.id === selectedVersionId}
                <span class="active-badge">ACTIVE</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Status message -->
    {#if updateStatus !== 'completed'}
      <div class="update-status">
        <div class="pulse-dot"></div>
        <span>UPDATE IN PROGRESS...</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .home-container {
    width: 100%;
    height: 100%;
    background: #000000;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .account-section {
    position: absolute;
    top: 20px;
    right: 30px;
    z-index: 10;
  }

  .account-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 16px;
  }

  .account-avatar {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .account-info {
    display: flex;
    flex-direction: column;
  }

  .account-name {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
  }

  .account-type {
    font-size: 11px;
    color: #888888;
  }

  .add-account-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 20px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-account-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .launch-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 40px;
  }

  .banner-background {
    position: absolute;
    width: 600px;
    height: 300px;
    border-radius: 20px;
    overflow: hidden;
    z-index: 1;
  }

  .banner-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
  }

  .launch-button {
    position: relative;
    z-index: 2;
    width: 500px;
    height: 80px;
    background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
    border: none;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 8px 30px rgba(0, 255, 136, 0.3);
  }

  .launch-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 255, 136, 0.4);
  }

  .launch-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .launch-button:disabled {
    background: linear-gradient(135deg, #333333 0%, #222222 100%);
    cursor: not-allowed;
    box-shadow: none;
  }

  .launch-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .launch-text {
    font-size: 28px;
    font-weight: 800;
    color: #000000;
    letter-spacing: 1px;
  }

  .launch-version {
    font-size: 13px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.6);
  }

  .launch-icon {
    width: 50px;
    height: 50px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play-icon {
    width: 24px;
    height: 24px;
    color: #000000;
  }

  .version-selector {
    position: relative;
    margin-top: 20px;
    z-index: 3;
  }

  .version-button {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 20px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.2s;
  }

  .version-button:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .chevron {
    width: 16px;
    height: 16px;
    transition: transform 0.2s;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .version-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }

  .version-option {
    width: 100%;
    background: none;
    border: none;
    padding: 12px 20px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background 0.2s;
  }

  .version-option:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .active-badge {
    font-size: 10px;
    font-weight: 700;
    color: #00ff88;
  }

  .update-status {
    position: absolute;
    bottom: 30px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 165, 0, 0.1);
    border: 1px solid rgba(255, 165, 0, 0.3);
    border-radius: 8px;
    padding: 12px 24px;
    color: #ffaa00;
    font-size: 12px;
    font-weight: 600;
    z-index: 3;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    background: #ffaa00;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }
</style>
