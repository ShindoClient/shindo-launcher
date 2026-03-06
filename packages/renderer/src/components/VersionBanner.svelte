<script lang="ts">
  import type { ResolvedVersionPresentation } from '../config/versionCatalog'
  import { t } from '../i18n'

  export let presentation: ResolvedVersionPresentation
</script>

<div
  class="version-banner"
  style={`background: ${presentation.backgroundImage};`}
>
  <div class="version-banner__overlay" />
  <div class="version-banner__content">
    <div class="version-banner__header">
      <span class="version-banner__tag">FEATURED VERSION</span>
      <div class="version-banner__badge" style={`background: ${presentation.accent}20; border-color: ${presentation.accent}; color: ${presentation.accent};`}>
        Minecraft {presentation.baseVersion}
      </div>
    </div>
    <h2 class="version-banner__title">{presentation.name}</h2>
    <p class="version-banner__headline">{presentation.headline}</p>
    {#if presentation.description}
      <p class="version-banner__description">{presentation.description}</p>
    {/if}
    <div class="version-banner__footer">
      <div class="version-banner__build">Build {presentation.buildLabel}</div>
      <div class="version-banner__status">Ready to play</div>
    </div>
  </div>
</div>

<style>
  .version-banner {
    position: relative;
    display: flex;
    height: 200px;
    width: 100%;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid rgba(30, 41, 59, 0.5);
    background-size: cover;
    background-position: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .version-banner__overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.7));
    backdrop-filter: blur(4px);
  }

  .version-banner__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    padding: 24px;
  }

  .version-banner__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .version-banner__tag {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #94a3b8;
    font-weight: 600;
  }

  .version-banner__badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .version-banner__title {
    font-size: 28px;
    font-weight: 700;
    color: white;
    margin: 0 0 8px 0;
  }

  .version-banner__headline {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #e2e8f0;
    font-weight: 500;
  }

  .version-banner__description {
    margin: 0;
    max-width: 600px;
    font-size: 14px;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .version-banner__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
  }

  .version-banner__build {
    font-size: 12px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #94a3b8;
    font-weight: 500;
  }

  .version-banner__status {
    font-size: 12px;
    font-weight: 600;
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
    padding: 4px 12px;
    border-radius: 20px;
  }
</style>
