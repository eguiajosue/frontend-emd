import { describe, expect, it, vi } from "vitest";
import {
  PartHttpError,
  uploadFileMultipart,
  UploadCancelledError,
  type MultipartApi,
  type PutPart,
} from "./multipartUpload";

const PART = 10;

function makeApi(size: number, overrides: Partial<MultipartApi> = {}) {
  const partCount = Math.ceil(size / PART);
  const api: MultipartApi = {
    init: vi.fn(async () => ({
      fileId: 7,
      partSize: PART,
      partCount,
      parts: Array.from({ length: partCount }, (_, i) => ({ partNumber: i + 1, url: `u${i + 1}` })),
    })),
    signParts: vi.fn(async (_id: number, nums: number[]) => nums.map((n: number) => ({ partNumber: n, url: `fresh${n}` }))),
    complete: vi.fn(async () => ({ ok: true })),
    abort: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
  return api;
}

const file = (size: number) => new File([new Uint8Array(size)], "a.zip", { type: "application/zip" });
const noWait = () => 0;

describe("uploadFileMultipart", () => {
  it("corta el archivo, sube cada parte y completa con los ETag ordenados", async () => {
    const api = makeApi(25);
    const sizes: Record<string, number> = {};
    const putPart: PutPart = async (url, blob, onProgress) => {
      sizes[url] = blob.size;
      onProgress(blob.size);
      return `"etag-${url}"`;
    };
    const progress = vi.fn();
    await uploadFileMultipart(file(25), api, { putPart, onProgress: progress, backoffMs: noWait });
    expect(sizes).toEqual({ u1: 10, u2: 10, u3: 5 });
    expect(api.complete).toHaveBeenCalledWith(7, [
      { partNumber: 1, etag: '"etag-u1"' },
      { partNumber: 2, etag: '"etag-u2"' },
      { partNumber: 3, etag: '"etag-u3"' },
    ]);
    expect(progress).toHaveBeenLastCalledWith({ loaded: 25, total: 25 });
    expect(api.abort).not.toHaveBeenCalled();
  });

  it("reintenta una parte que falla y pide URL nueva si la firmada venció (403)", async () => {
    const api = makeApi(10);
    const calls: string[] = [];
    const putPart: PutPart = async (url) => {
      calls.push(url);
      if (calls.length === 1) throw new PartHttpError(403);
      if (calls.length === 2) throw new Error("red");
      return '"ok"';
    };
    await uploadFileMultipart(file(10), api, { putPart, backoffMs: noWait });
    expect(calls).toEqual(["u1", "fresh1", "fresh1"]);
    expect(api.signParts).toHaveBeenCalledTimes(1);
    expect(api.complete).toHaveBeenCalled();
  });

  it("si una parte agota los reintentos aborta la subida en el servidor", async () => {
    const api = makeApi(20);
    const putPart: PutPart = async () => {
      throw new Error("sin red");
    };
    await expect(uploadFileMultipart(file(20), api, { putPart, maxAttempts: 2, backoffMs: noWait })).rejects.toThrow(
      "sin red"
    );
    expect(api.abort).toHaveBeenCalledWith(7);
    expect(api.complete).not.toHaveBeenCalled();
  });

  it("cancelar corta la subida y la aborta", async () => {
    const api = makeApi(30);
    const controller = new AbortController();
    const putPart: PutPart = (_url, _blob, _p, signal) =>
      new Promise((_resolve, reject) => {
        controller.abort();
        signal.addEventListener("abort", () => reject(new UploadCancelledError()));
        if (signal.aborted) reject(new UploadCancelledError());
      });
    await expect(
      uploadFileMultipart(file(30), api, { putPart, signal: controller.signal, backoffMs: noWait })
    ).rejects.toBeInstanceOf(UploadCancelledError);
    expect(api.abort).toHaveBeenCalledWith(7);
  });

  it("respeta la concurrencia máxima", async () => {
    const api = makeApi(60);
    let active = 0;
    let max = 0;
    const putPart: PutPart = async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return '"e"';
    };
    await uploadFileMultipart(file(60), api, { putPart, concurrency: 2, backoffMs: noWait });
    expect(max).toBe(2);
  });
});
