<script lang="ts">
  import { appStore } from '../store/appStore';
  import Home from 'lucide-svelte/icons/home';
  import Settings from 'lucide-svelte/icons/settings';

  const { setScreen } = appStore;

  const navItems: Array<{
    id: 'home' | 'settings';
    label: string;
    icon: typeof Home;
    screen: 'home' | 'settings';
  }> = [
    { id: 'home', label: 'Home', icon: Home, screen: 'home' },
    { id: 'settings', label: 'Settings', icon: Settings, screen: 'settings' },
  ];

  function handleNavClick(screen: 'home' | 'settings') {
    setScreen(screen);
  }
</script>

<style>
  .sidebar {
    width: 80px;
    background: #000000;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
  }

  .sidebar-header {
    padding: 24px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .logo-section {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .nav-menu {
    flex: 1;
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .nav-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 12px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .nav-item.selected {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .nav-icon {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .nav-icon :global(svg) {
    width: 24px;
    height: 24px;
  }

  .nav-indicator {
    position: absolute;
    bottom: -6px;
    width: 6px;
    height: 6px;
    background: #3b82f6;
    border-radius: 50%;
    box-shadow: 0 0 8px #3b82f6;
  }
</style>

<div class="sidebar">
  <div class="sidebar-header">
    <div class="logo-section">
      <div class="logo">S</div>
    </div>
  </div>

  <nav class="nav-menu">
    {#each navItems as item}
      <button
        class="nav-item {$appStore.screen === item.screen ? 'selected' : ''}"
        on:click={() => handleNavClick(item.screen)}
        aria-label={item.label}
      >
        <span class="nav-icon">
          <svelte:component this={item.icon} />
        </span>
        {#if $appStore.screen === item.screen}
          <div class="nav-indicator"></div>
        {/if}
      </button>
    {/each}
  </nav>
</div>
