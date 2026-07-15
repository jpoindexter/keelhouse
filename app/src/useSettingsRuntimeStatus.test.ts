import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./useSettingsRuntimeStatus.ts", import.meta.url), "utf8");

describe("useSettingsRuntimeStatus", () => {
  it("owns each settings-time runtime probe and cancellation guard", () => {
    expect(source).toContain('invoke<unknown>("source_control_status")');
    expect(source).toContain('invoke<unknown>("agent_connections_status")');
    expect(source).toContain('invoke<string | null>("git_remote_url"');
    expect(source.match(/cancelled = true/g)).toHaveLength(2);
  });
});
