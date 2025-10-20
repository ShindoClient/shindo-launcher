<script lang="ts">
  import Minus from 'lucide-svelte/icons/minus'
  import X from 'lucide-svelte/icons/x'
  import Settings from 'lucide-svelte/icons/settings'
  import logoUrl from '../assets/logo.png'
  import { appStore } from '../store/appStore'

  const TITLE = 'Shindo Launcher'
  const { setScreen } = appStore

  function minimize() {
    window.shindo.minimizeWindow().catch((error) => console.error('Failed to minimize window', error))
  }

  function close() {
    window.shindo.closeWindow().catch((error) => console.error('Failed to close window', error))
  }

  function toggleSettings(event: MouseEvent) {
    event.stopPropagation()
    const currentScreen = $appStore.screen
    setScreen(currentScreen === 'settings' ? 'home' : 'settings')
  }

  $: isSettingsOpen = $appStore.screen === 'settings'
</script>

<header class="title-bar">
  <div class="title-left">
    <img class="logo" src={logoUrl} alt="Logotipo do Shindo Launcher" draggable="false" />
    <span class="title-text">{TITLE}</span>
  </div>
  <div class="title-controls" role="group" aria-label="Controles da janela">
    <button
      type="button"
      class={`control-button settings ${isSettingsOpen ? 'active' : ''}`}
      title={isSettingsOpen ? 'Voltar' : 'Configurações'}
      aria-label="Abrir configuracoes"
      aria-pressed={isSettingsOpen}
      on:click|stopPropagation={toggleSettings}
    >
      <Settings class="icon" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="control-button"
      title="Minimizar"
      aria-label="Minimizar"
      on:click|stopPropagation={minimize}
    >
      <Minus class="icon" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="control-button close"
      title="Fechar"
      aria-label="Fechar"
      on:click|stopPropagation={close}
    >
      <X class="icon" aria-hidden="true" />
    </button>
  </div>
</header>

<style>
  .title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 18px;
    background: linear-gradient(90deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.92) 100%);
    border-bottom: 1px solid rgba(59, 130, 246, 0.18);
    color: #e2e8f0;
    -webkit-app-region: drag;
    -webkit-user-select: none;
    user-select: none;
    backdrop-filter: blur(12px);
  }

  .title-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .logo {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    -webkit-app-region: no-drag;
  }

  .title-text {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    -webkit-app-region: no-drag;
  }

  .control-button {
    width: 36px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1px solid rgba(59, 130, 246, 0.25);
    background: rgba(15, 23, 42, 0.55);
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
  }

  .control-button:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 2px;
  }

  .icon {
    width: 16px;
    height: 16px;
  }

  .control-button:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .control-button:active {
    transform: translateY(1px);
  }

  .control-button.close:hover {
    background: rgba(239, 68, 68, 0.27);
    border-color: rgba(239, 68, 68, 0.45);
  }

  .control-button.settings {
    width: 38px;
    background: rgba(37, 99, 235, 0.15);
    border-color: rgba(59, 130, 246, 0.35);
  }

  .control-button.settings:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.55);
  }

  .control-button.settings.active {
    background: rgba(129, 140, 248, 0.35);
    border-color: rgba(99, 102, 241, 0.75);
    color: #e0e7ff;
  }
</style>
