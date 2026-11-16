import { describe, expect, it } from "vitest";
import { assetUrl, baseFromBaseUrl, withBase } from "./assetUrl";

describe("baseFromBaseUrl", () => {
  it("maps the root base to an empty prefix", () => {
    expect(baseFromBaseUrl("/")).toBe("");
  });

  it("strips the trailing slash from a subpath base", () => {
    expect(baseFromBaseUrl("/PlayRoom/")).toBe("/PlayRoom");
    expect(baseFromBaseUrl("/PlayRoom")).toBe("/PlayRoom");
  });
});

describe("withBase", () => {
  it("leaves root-relative paths unchanged under the root base", () => {
    expect(withBase("/", "/games/a/thumb.webp")).toBe("/games/a/thumb.webp");
  });

  it("prefixes root-relative paths with a subpath base without a double slash", () => {
    expect(withBase("/PlayRoom/", "/games/a/thumb.webp")).toBe("/PlayRoom/games/a/thumb.webp");
    expect(withBase("/PlayRoom", "/ruffle/")).toBe("/PlayRoom/ruffle/");
  });

  it("leaves absolute https URLs unchanged", () => {
    expect(withBase("/PlayRoom/", "https://cdn.example.com/g/game.swf")).toBe(
      "https://cdn.example.com/g/game.swf",
    );
  });

  it("leaves protocol-relative URLs unchanged", () => {
    expect(withBase("/PlayRoom/", "//cdn.example.com/x.swf")).toBe("//cdn.example.com/x.swf");
  });
});

describe("assetUrl", () => {
  it("uses the build base (root in the test environment)", () => {
    expect(assetUrl("/games/a/game.swf")).toBe("/games/a/game.swf");
    expect(assetUrl("/ruffle/ruffle.js")).toBe("/ruffle/ruffle.js");
  });

  it("leaves https URLs unchanged", () => {
    expect(assetUrl("https://example.com/a.swf")).toBe("https://example.com/a.swf");
  });
});
