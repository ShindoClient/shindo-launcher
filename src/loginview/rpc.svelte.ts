import type { LoginRpcSchema } from "../shared/loginTypes";

// Module-level reference set once by main.ts before Svelte mounts.
// Components import getLoginRpc() to make RPC calls.
let _rpc: ReturnType<
  typeof import("electrobun/view").default.Electroview.defineRPC<LoginRpcSchema>
> | null = null;

export function setLoginRpc(rpc: typeof _rpc): void {
  _rpc = rpc;
}

export function getLoginRpc() {
  if (!_rpc) throw new Error("Login RPC not initialized");
  return _rpc;
}
