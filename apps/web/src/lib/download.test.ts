import { describe, expect, it } from "vitest";
import { dataUrlToBlob } from "./download";

describe("dataUrlToBlob", () => {
  it("decodifica una data URL base64 con su tipo (sin fetch, que la CSP bloquea)", () => {
    // "hola" en base64.
    const blob = dataUrlToBlob("data:image/png;base64,aG9sYQ==");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(4);
  });

  it("acepta data URLs de texto (no base64)", () => {
    const blob = dataUrlToBlob("data:text/plain;charset=utf-8,hola%20mundo");
    expect(blob.type).toBe("text/plain");
    expect(blob.size).toBe("hola mundo".length);
  });
});
