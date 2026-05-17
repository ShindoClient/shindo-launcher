<script lang="ts">
    import { getLoginRpc } from "./rpc.svelte";

    const rpc = getLoginRpc();

    // Auth config is fetched from bun via RPC — we cannot use views:// query
    // strings because CEF resolves them as part of the file path.
    let authUrl = $state("");
    let redirectUri = $state("https://login.live.com/oauth20_desktop.srf");
    let webviewReady = $state(false);

    $effect(() => {
        rpc.request
            .getAuthConfig()
            .then((config) => {
                redirectUri = config.redirectUri;
                authUrl = config.authUrl;
                webviewReady = true;
                console.log("[LOGIN] Auth config received, loading:", authUrl);
            })
            .catch((err) => {
                console.error("[LOGIN] Failed to get auth config:", err);
            });
    });

    let webviewEl = $state<any>(null);

    $effect(() => {
        if (!webviewEl) return;

        webviewEl.on("host-message", async (event: CustomEvent) => {
            const msg = event.detail;
            console.log("[LOGIN] host-message:", msg);
            if (msg?.type === "oauth-redirect" && typeof msg.url === "string") {
                try {
                    await rpc.request.notifyOAuthRedirect({ url: msg.url });
                } catch (err) {
                    console.error("[LOGIN] notifyOAuthRedirect failed:", err);
                }
            }
        });

        webviewEl.on("did-commit-navigation", async (event: CustomEvent) => {
            const url: string = event.detail?.url ?? event.detail ?? "";
            if (redirectUri && url.startsWith(redirectUri)) {
                try {
                    await rpc.request.notifyOAuthRedirect({ url });
                } catch {
                    /* already handled by host-message */
                }
            }
        });
    });

    async function handleCancel() {
        try {
            await rpc.request.cancelOAuth();
        } catch {
            /**/
        }
    }
</script>

<div class="container">
    <div class="titlebar">
        <span>Sign in with Microsoft</span>
        <button class="close-btn" onclick={handleCancel} title="Cancel"
            >✕</button
        >
    </div>

    {#if webviewReady}
        <electrobun-webview
            bind:this={webviewEl}
            renderer="cef"
            partition="ms-login"
            preload="preload.js"
            masks=".titlebar"
            src={authUrl}
        ></electrobun-webview>
    {:else}
        <div class="loading">Loading…</div>
    {/if}
</div>

<style>
    :global(*) {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    :global(html),
    :global(body) {
        width: 100%;
        height: 100%;
        background: #1a1a1a;
        overflow: hidden;
    }
    :global(#app) {
        width: 100%;
        height: 100%;
    }

    .container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
    }

    .titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        height: 36px;
        background: #111;
        flex-shrink: 0;
        -webkit-app-region: drag;
        app-region: drag;
        user-select: none;
        position: relative;
        z-index: 1;
    }
    .titlebar span {
        font-size: 13px;
        color: #aaa;
    }

    .close-btn {
        -webkit-app-region: no-drag;
        app-region: no-drag;
        background: none;
        border: none;
        color: #888;
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 4px;
    }
    .close-btn:hover {
        background: #c0392b;
        color: #fff;
    }

    electrobun-webview {
        flex: 1;
        width: 100%;
        display: block;
    }

    .loading {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #555;
        font-size: 14px;
    }
</style>
