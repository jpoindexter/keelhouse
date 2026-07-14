// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerModelPicker } from "./ComposerModelPicker";

afterEach(cleanup);

const renderPicker = () => {
  const onSelect = vi.fn().mockResolvedValue(undefined);
  const onManageModels = vi.fn();
  render(
    <ComposerModelPicker
      provider="codex"
      model=""
      configuredModels={{ codex: "gpt-5.6-sol", claude: "sonnet" }}
      onManageModels={onManageModels}
      onSelect={onSelect}
    />,
  );
  return { onManageModels, onSelect };
};

describe("ComposerModelPicker", () => {
  it("opens into focused search and filters provider groups", async () => {
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: /gpt-5.6-sol/i }));
    const search = screen.getByRole("textbox", { name: "Search models" });
    await waitFor(() => expect(document.activeElement).toBe(search));
    fireEvent.change(search, { target: { value: "claude" } });
    expect(screen.queryByText("Codex default")).toBeNull();
    expect(screen.getByText("Claude default")).toBeTruthy();
  });

  it("selects a model with the keyboard and restores trigger focus", async () => {
    const { onSelect } = renderPicker();
    const trigger = screen.getByRole("button", { name: /gpt-5.6-sol/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search models" }), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search models" }), { key: "Enter" });
    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("accepts a custom model ID and opens provider settings", async () => {
    const { onManageModels, onSelect } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: /gpt-5.6-sol/i }));
    fireEvent.click(screen.getByRole("button", { name: "Custom model ID" }));
    fireEvent.change(screen.getByLabelText("Custom Codex model ID"), { target: { value: "local-model" } });
    fireEvent.click(screen.getByRole("button", { name: "Use model" }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("codex", "local-model"));

    fireEvent.click(screen.getByRole("button", { name: /gpt-5.6-sol/i }));
    fireEvent.click(screen.getByRole("button", { name: "Provider settings" }));
    expect(onManageModels).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    renderPicker();
    const trigger = screen.getByRole("button", { name: /gpt-5.6-sol/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search models" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Choose model" })).toBeNull());
  });
});
