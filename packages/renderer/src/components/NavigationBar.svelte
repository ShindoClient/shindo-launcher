<script lang="ts">
  import Home from 'lucide-svelte/icons/home';
  import Settings from 'lucide-svelte/icons/settings';
  import { appStore } from '../store/appStore';
  import { t } from '../i18n';

  const { setScreen } = appStore;

  const NAV_ITEMS: Array<{ id: 'home' | 'settings'; label: string }> = [
    { id: 'home', label: 'nav.home' },
    { id: 'settings', label: 'nav.settings' },
  ];

  function getIcon(id: 'home' | 'settings') {
    return id === 'home' ? Home : Settings;
  }
</script>

<style lang="scss">
  @use '../styles/variables' as v;
  .navigation-bar {
    display: flex;
    justify-content: center;
    width: 100%;
    padding: 12px 0;
  }

  .navigation-inner {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 6px;
    background: rgba(17, 24, 39, 0.45);
    backdrop-filter: blur(8px);
  }

  .nav-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    border-radius: 999px;
    padding: 8px 14px;
    color: #9ca3af;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-item:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }

  .nav-item.active {
    color: #ffffff;
    background: rgba(59, 130, 246, 0.28);
    box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.35);
  }

  .nav-icon {
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .nav-icon :global(svg) {
    width: 14px;
    height: 14px;
  }
</style>

<nav class="navigation-bar">
  <div class="navigation-inner">
    {#each NAV_ITEMS as item}
      <button
        type="button"
        class="nav-item"
        class:active={$appStore.screen === item.id}
        on:click={() => setScreen(item.id)}
      >
        <span class="nav-icon">
          <svelte:component this={getIcon(item.id)} />
        </span>
        <span>{$t(item.label)}</span>
      </button>
    {/each}
  </div>
</nav>
