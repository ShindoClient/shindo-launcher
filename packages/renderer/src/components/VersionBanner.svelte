<script lang="ts">
  import type { ResolvedVersionPresentation } from '../config/versionCatalog'

  export let presentation: ResolvedVersionPresentation
</script>

<div
  class="version-banner"
  style={`background-image: ${presentation.backgroundImage};`}
>
  <div class="version-banner__overlay" />
  <div class="version-banner__content">
    <span class="version-banner__tag">Destacado</span>
    <div class="version-banner__heading">
      <h2 class="version-banner__title">{presentation.name}</h2>
      <span
        class="version-banner__badge"
        style={`border-color: ${presentation.accent}; color: ${presentation.accent};`}
      >
        Minecraft {presentation.baseVersion}
      </span>
    </div>
    <p class="version-banner__headline">{presentation.headline}</p>
    {#if presentation.description}
      <p class="version-banner__description">{presentation.description}</p>
    {/if}
    <p class="version-banner__build">Build {presentation.buildLabel}</p>
  </div>
</div>

<style>
  .version-banner {
    position: relative;
    display: flex;
    height: 14.5rem;
    width: 100%;
    overflow: hidden;
    border-radius: 1.5rem;
    border: 1px solid rgba(15, 23, 42, 0.75);
    background-size: cover;
    background-position: center;
    box-shadow: 0 20px 45px -22px rgba(15, 23, 42, 0.85);
  }

  .version-banner__overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(145deg, rgba(15, 23, 42, 0.78), rgba(15, 23, 42, 0.6));
    backdrop-filter: blur(6px);
  }

  .version-banner__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    padding: 2.5rem 2.25rem;
    gap: 0.75rem;
  }

  .version-banner__tag {
    font-size: 0.6875rem;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: rgba(203, 213, 225, 0.85);
  }

  .version-banner__heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .version-banner__title {
    font-size: clamp(1.9rem, 2.3vw, 2.4rem);
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .version-banner__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.95rem;
    border-radius: 999px;
    border: 1px solid currentColor;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.32em;
    background: rgba(15, 23, 42, 0.4);
  }

  .version-banner__headline {
    margin: 0.15rem 0 0;
    font-size: 0.95rem;
    color: rgba(226, 232, 240, 0.92);
  }

  .version-banner__description {
    margin: 0;
    max-width: 38rem;
    font-size: 0.9rem;
    color: rgba(203, 213, 225, 0.9);
  }

  .version-banner__build {
    margin-top: 0.5rem;
    font-size: 0.7rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(148, 163, 184, 0.75);
  }
</style>
