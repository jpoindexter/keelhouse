import { describe, expect, it } from "vitest";
import {
  browserHistoryCanGoBack,
  browserHistoryCanGoForward,
  detectLocalDevServerUrl,
  normalizeDetectedLocalDevServerUrl,
  normalizeBrowserPreviewRecords,
  normalizeBrowserPreviewUrl,
  pushBrowserHistory,
} from "./browserPreview";

describe("browser preview helpers", () => {
  it("normalizes localhost and absolute browser preview URLs", () => {
    expect(normalizeBrowserPreviewUrl("localhost:5173")).toBe("http://localhost:5173/");
    expect(normalizeBrowserPreviewUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(normalizeBrowserPreviewUrl("file:///tmp/demo.html")).toBe("file:///tmp/demo.html");
    expect(normalizeBrowserPreviewUrl("")).toBeNull();
    expect(normalizeBrowserPreviewUrl("javascript:alert(1)")).toBeNull();
  });

  it("normalizes detected local dev server URLs only", () => {
    expect(normalizeDetectedLocalDevServerUrl("localhost:5173")).toBe("http://localhost:5173/");
    expect(normalizeDetectedLocalDevServerUrl("http://127.0.0.1:3000/app")).toBe("http://127.0.0.1:3000/app");
    expect(normalizeDetectedLocalDevServerUrl("http://[::1]:8080/")).toBe("http://[::1]:8080/");
    expect(normalizeDetectedLocalDevServerUrl("http://0.0.0.0:4321,")).toBe("http://localhost:4321/");
    expect(normalizeDetectedLocalDevServerUrl("https://example.com:443")).toBeNull();
    expect(normalizeDetectedLocalDevServerUrl("file:///tmp/demo.html")).toBeNull();
    expect(normalizeDetectedLocalDevServerUrl("localhost")).toBeNull();
  });

  it("detects the newest local dev server URL from terminal output", () => {
    expect(detectLocalDevServerUrl("VITE ready in 120ms\nLocal: http://localhost:5173/\nNetwork: http://192.168.0.2:5173/")).toBe("http://localhost:5173/");
    expect(detectLocalDevServerUrl("old http://localhost:3000/\nnew localhost:4173")).toBe("http://localhost:4173/");
    expect(detectLocalDevServerUrl("docs at https://example.com:443")).toBeNull();
  });

  it("normalizes persisted preview records", () => {
    expect(normalizeBrowserPreviewRecords({ "/a": "localhost:3000", "/b": "javascript:bad", "": "https://bad.test" })).toEqual({
      "/a": "http://localhost:3000/",
    });
  });

  it("pushes browser history and truncates forward entries", () => {
    expect(pushBrowserHistory(["http://a.test/", "http://b.test/"], 0, "http://c.test/")).toEqual({
      history: ["http://a.test/", "http://c.test/"],
      index: 1,
    });
    expect(pushBrowserHistory(["http://a.test/"], 0, "http://a.test/")).toEqual({
      history: ["http://a.test/"],
      index: 0,
    });
  });

  it("reports browser history navigation availability", () => {
    expect(browserHistoryCanGoBack(0)).toBe(false);
    expect(browserHistoryCanGoBack(1)).toBe(true);
    expect(browserHistoryCanGoForward(["a", "b"], 0)).toBe(true);
    expect(browserHistoryCanGoForward(["a", "b"], 1)).toBe(false);
  });
});
