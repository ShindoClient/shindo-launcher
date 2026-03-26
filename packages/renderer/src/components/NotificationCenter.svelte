<script lang="ts">
  import notifications, { dismissNotification } from '../store/notificationStore';

  const toneMap: Record<string, string> = {
    info: 'border-blue-500 bg-slate-900/60 text-blue-100',
    warning: 'border-amber-500 bg-amber-900/50 text-amber-100',
  };
</script>

<div class="notification-center" aria-live="polite">
  {#each $notifications as notification (notification.id)}
    <div class={`notification ${toneMap[notification.severity] ?? toneMap.info}`}>
      <div class="notification-content">
        <p class="text-xs uppercase tracking-[0.2em] text-white/60">
          {notification.severity.toUpperCase()}
        </p>
        <p class="text-sm">{notification.message}</p>
      </div>
      <button
        type="button"
        class="notification-close"
        aria-label="Dismiss notification"
        on:click={() => dismissNotification(notification.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>

<style>
  .notification-center {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(320px, calc(100% - 2rem));
  }

  .notification {
    border: 1px solid;
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: 0 20px 40px rgba(2, 6, 23, 0.85);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: rgba(15, 23, 42, 0.92);
    animation: slideUp 0.5s ease forwards;
  }

  .notification-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .notification-content p {
    margin: 0;
  }

  .notification-close {
    border: none;
    background: transparent;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }

  @keyframes slideUp {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
