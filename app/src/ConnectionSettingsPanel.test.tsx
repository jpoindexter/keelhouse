// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionSettingsPanel } from "./ConnectionSettingsPanel";
import { DEFAULT_AI_CONNECTION_SETTINGS, providerSecretKey } from "./connectionSettings";

afterEach(cleanup);

const renderPanel = (overrides: Partial<Parameters<typeof ConnectionSettingsPanel>[0]> = {}) => {
  const onChange = vi.fn();
  const onSaveSecret = vi.fn().mockResolvedValue(undefined);
  const onDeleteSecret = vi.fn().mockResolvedValue(undefined);
  const onValidateTarget = vi.fn().mockResolvedValue({ ok: true, message: "Valid" });
  render(
    <ConnectionSettingsPanel
      settings={structuredClone(DEFAULT_AI_CONNECTION_SETTINGS)}
      workspacePath="/repo"
      secretPresence={{}}
      onChange={onChange}
      onSaveSecret={onSaveSecret}
      onDeleteSecret={onDeleteSecret}
      onValidateTarget={onValidateTarget}
      {...overrides}
    />,
  );
  return { onChange, onSaveSecret, onDeleteSecret, onValidateTarget };
};

describe("ConnectionSettingsPanel", () => {
  it("sends provider keys to the Keychain callback without adding them to settings", async () => {
    const { onChange, onSaveSecret } = renderPanel();
    fireEvent.change(screen.getByLabelText("Gemini API key"), { target: { value: "qa-secret" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save key" })[1]);

    await waitFor(() => expect(onSaveSecret).toHaveBeenCalledWith(providerSecretKey("gemini"), "qa-secret"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stores secret environment metadata with a blank persisted value", async () => {
    const { onChange, onSaveSecret } = renderPanel();
    fireEvent.change(screen.getByLabelText("Environment variable name"), { target: { value: "API_TOKEN" } });
    fireEvent.change(screen.getByLabelText("Environment variable value"), { target: { value: "qa-secret" } });
    fireEvent.click(screen.getByLabelText("Secret"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onSaveSecret).toHaveBeenCalledTimes(1));
    const next = onChange.mock.calls[0][0];
    expect(next.environmentByProject["/repo"][0]).toMatchObject({ name: "API_TOKEN", value: "", secret: true });
    expect(JSON.stringify(next)).not.toContain("qa-secret");
  });
});
