import { describe, expect, it } from "vitest";
import {
  browserHistoryCanGoBack,
  browserHistoryCanGoForward,
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
