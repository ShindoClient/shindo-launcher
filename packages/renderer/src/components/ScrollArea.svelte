<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  export let className = ''

  let viewport: HTMLDivElement
  let handleHeight = 0
  let handleOffset = 0
  let dragging = false
  let dragStartY = 0
  let dragStartScrollTop = 0

  function updateScrollbar() {
    if (!viewport) return
    const { scrollHeight, clientHeight, scrollTop } = viewport
    if (scrollHeight <= 0 || clientHeight <= 0) {
      handleHeight = 0
      handleOffset = 0
      return
    }
    const maxScrollTop = scrollHeight - clientHeight
    const availableTrack = clientHeight - getHandleSize(clientHeight, scrollHeight)
    handleHeight = getHandleSize(clientHeight, scrollHeight)
    handleOffset = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * availableTrack : 0
  }

  function getHandleSize(clientHeight: number, scrollHeight: number): number {
    const ratio = clientHeight / scrollHeight
    const size = clientHeight * ratio
    return Math.max(32, Math.min(clientHeight, size))
  }

  function onScroll() {
    updateScrollbar()
  }

  function onWheel(event: WheelEvent) {
    if (!viewport) return
    event.preventDefault()
    viewport.scrollTop += event.deltaY
  }

  function onTrackPointerDown(event: PointerEvent) {
    if (!viewport) return
    const track = event.currentTarget as HTMLElement
    const rect = track.getBoundingClientRect()
    const offset = event.clientY - rect.top
    const targetTop = offset - handleHeight / 2
    scrollToHandlePosition(targetTop)
  }

  function onHandlePointerDown(event: PointerEvent) {
    if (!viewport) return
    dragging = true
    dragStartY = event.clientY
    dragStartScrollTop = viewport.scrollTop
    viewport.classList.add('scroll-area--dragging')
    window.addEventListener('pointermove', onHandlePointerMove, { passive: false })
    window.addEventListener('pointerup', onHandlePointerUp, { once: true })
  }

  function onHandlePointerMove(event: PointerEvent) {
    if (!dragging || !viewport) return
    event.preventDefault()
    const { scrollHeight, clientHeight } = viewport
    const maxScrollTop = scrollHeight - clientHeight
    if (maxScrollTop <= 0) return

    const deltaPixels = event.clientY - dragStartY
    const handleTravel = clientHeight - handleHeight
    if (handleTravel <= 0) return

    const scrollDelta = (deltaPixels / handleTravel) * maxScrollTop
    viewport.scrollTop = dragStartScrollTop + scrollDelta
  }

  function onHandlePointerUp() {
    dragging = false
    viewport?.classList.remove('scroll-area--dragging')
    window.removeEventListener('pointermove', onHandlePointerMove)
  }

  function scrollToHandlePosition(handlePosition: number) {
    if (!viewport) return
    const { scrollHeight, clientHeight } = viewport
    const maxScrollTop = scrollHeight - clientHeight
    const handleTravel = clientHeight - handleHeight
    if (handleTravel <= 0 || maxScrollTop <= 0) return
    const ratio = handlePosition / handleTravel
    viewport.scrollTop = ratio * maxScrollTop
  }

  let resizeObserver: ResizeObserver | null = null

  onMount(() => {
    if (viewport) {
      updateScrollbar()
      resizeObserver = new ResizeObserver(() => updateScrollbar())
      resizeObserver.observe(viewport)
    }
  })

  onDestroy(() => {
    resizeObserver?.disconnect()
    window.removeEventListener('pointermove', onHandlePointerMove)
    window.removeEventListener('pointerup', onHandlePointerUp)
  })
</script>

<div class={`scroll-area ${className}`}>
  <div
    class="scroll-area__viewport"
    bind:this={viewport}
    on:scroll={onScroll}
    on:wheel={onWheel}
  >
    <div class="scroll-area__content">
      <slot />
    </div>
  </div>
  <div class="scroll-area__track" on:pointerdown={onTrackPointerDown} aria-hidden="true">
    <div
      class="scroll-area__handle"
      style={`height: ${handleHeight}px; transform: translateY(${handleOffset}px);`}
      on:pointerdown|stopPropagation={onHandlePointerDown}
    />
  </div>
</div>

<style>
  .scroll-area {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .scroll-area__viewport {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: auto;
    scrollbar-width: none;
  }

  .scroll-area__viewport::-webkit-scrollbar {
    display: none;
  }

  .scroll-area__content {
    position: relative;
  }

  .scroll-area__track {
    position: absolute;
    top: 0;
    right: 10px;
    bottom: 0;
    width: 12px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.35);
    border: 1px solid rgba(30, 64, 175, 0.55);
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .scroll-area__track:hover {
    background: rgba(30, 64, 175, 0.25);
  }

  .scroll-area__handle {
    width: 100%;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.9), rgba(59, 130, 246, 0.55));
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    touch-action: none;
    cursor: grab;
  }

  .scroll-area--dragging .scroll-area__handle {
    cursor: grabbing;
  }
</style>
