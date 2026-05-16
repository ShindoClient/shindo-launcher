import { mount } from "svelte";
import Electrobun from "electrobun/view";
import type { LoginRpcSchema } from "../shared/loginTypes";
import App from "./App.svelte";
import { setLoginRpc } from "./rpc.svelte";

// Initialize Electroview RPC before mounting Svelte.
// The login window only needs bun-side request handlers (notifyOAuthRedirect,
// cancelOAuth) — no messages flow from bun to the webview.
const rpc = Electrobun.Electroview.defineRPC<LoginRpcSchema>({
  maxRequestTime: Infinity,
  handlers: { messages: {} },
});

new Electrobun.Electroview({ rpc });

// Expose rpc to Svelte components via a module-level store
setLoginRpc(rpc);

mount(App, { target: document.getElementById("app")! });
