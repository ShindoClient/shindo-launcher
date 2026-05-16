// RPC schema for the Microsoft OAuth login window.
// Used by both the bun side (account.ts) and the webview side (login/main.ts).

export type LoginRpcSchema = {
  bun: {
    requests: {
      // Called by loginview on mount to get the Microsoft OAuth URL.
      // We cannot pass it via views:// query strings — CEF treats the query
      // as part of the file path instead of a proper query string.
      getAuthConfig: {
        params: undefined;
        response: { authUrl: string; redirectUri: string };
      };
      // Sent by the preload script when it detects the OAuth redirect URL.
      notifyOAuthRedirect: {
        params: { url: string };
        response: { ok: boolean };
      };
      // Sent by the cancel button in the login page.
      cancelOAuth: { params: undefined; response: { ok: boolean } };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};
