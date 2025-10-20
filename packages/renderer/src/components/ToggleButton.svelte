<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let checked = false
  export let disabled = false
  export let label: string | undefined

  const dispatch = createEventDispatcher<{ change: boolean }>()

  function toggle() {
    if (disabled) return
    const next = !checked
    checked = next
    dispatch('change', next)
  }
</script>

<button
  type="button"
  class={`toggle ${checked ? 'toggle--on' : 'toggle--off'} ${disabled ? 'toggle--disabled' : ''}`}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  on:click={toggle}
>
  <span class="toggle__thumb" />
  <span class="toggle__track">
    <slot />
  </span>
</button>

<style>
  .toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(30, 64, 175, 0.55);
    background: rgba(15, 23, 42, 0.7);
    transition: background 150ms ease, border-color 150ms ease;
  }

  .toggle--on {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.6));
    border-color: rgba(34, 197, 94, 0.8);
  }

  .toggle--off {
    background: rgba(30, 41, 59, 0.85);
  }

  .toggle__track {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
  }

  .toggle__thumb {
    position: absolute;
    z-index: 1;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #f8fafc;
    top: 2px;
    left: 2px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.35);
    transition: transform 150ms ease;
    transform: translateX(0);
  }

  .toggle--on .toggle__thumb {
    transform: translateX(24px);
  }

  .toggle--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle:not(.toggle--disabled) {
    cursor: pointer;
  }

  .toggle:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.75);
    outline-offset: 2px;
  }
</style>
