import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import TitleBar from "$mainview/components/TitleBar.svelte";
import { appState } from "$mainview/state/app.svelte";

vi.mock("$mainview/services/native", () => ({
  getNativeApi: vi.fn().mockResolvedValue({
    minimizeWindow: vi.fn().mockResolvedValue({ ok: true }),
    closeWindow: vi.fn().mockResolvedValue({ ok: true }),
    moveWindow: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

beforeEach(() => {
  appState.page = "home";
});

afterEach(() => {
  cleanup();
});

describe("TitleBar", () => {
  it("renders the brand name and version", () => {
    render(TitleBar);
    expect(screen.getByText("Shindo Launcher")).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(TitleBar);
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /settings/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logs/i })).toBeInTheDocument();
  });

  it("highlights the active page navigation button", () => {
    render(TitleBar);
    const homeBtn = screen.getByRole("button", { name: /home/i });
    expect(homeBtn).toHaveClass("active");
  });

  it("renders window action buttons", () => {
    render(TitleBar);
    expect(screen.getByLabelText("Minimize")).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });

  it("changes page when a nav button is clicked", () => {
    render(TitleBar);
    const settingsBtn = screen.getByRole("button", { name: /settings/i });
    settingsBtn.click();
    expect(appState.page).toBe("settings");
  });

  it("disables nav buttons during update", () => {
    appState.page = "update";
    render(TitleBar);
    const homeBtn = screen.getByRole("button", { name: /home/i });
    const settingsBtn = screen.getByRole("button", { name: /settings/i });
    const logsBtn = screen.getByRole("button", { name: /logs/i });
    expect(homeBtn).toBeDisabled();
    expect(settingsBtn).toBeDisabled();
    expect(logsBtn).toBeDisabled();
  });
});
