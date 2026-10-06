// @vitest-environment jsdom
// (renderHook necesita DOM; el resto de `src/**/*.test.ts` corre en node
// per environmentMatchGlobs, así que este archivo pide jsdom por sí solo
// en vez de renombrarse a .test.tsx o tocar la config compartida.)
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useChatTyping,
  markUserTyping,
  markUserStoppedTyping,
} from "./useChatTyping";

describe("useChatTyping", () => {
  it("no devuelve nada para una conversación sin actividad", () => {
    const { result } = renderHook(() => useChatTyping(1));
    expect(result.current).toEqual([]);
  });

  it("agrega el usuario cuando llega markUserTyping y se refleja en el hook", () => {
    const { result } = renderHook(() => useChatTyping(2));
    act(() => markUserTyping(2, 42));
    expect(result.current).toContain(42);
  });

  it("lo saca cuando llega markUserStoppedTyping", () => {
    const { result } = renderHook(() => useChatTyping(3));
    act(() => markUserTyping(3, 7));
    expect(result.current).toContain(7);
    act(() => markUserStoppedTyping(3, 7));
    expect(result.current).not.toContain(7);
  });

  it("no mezcla el estado de conversaciones distintas", () => {
    const { result: r1 } = renderHook(() => useChatTyping(10));
    const { result: r2 } = renderHook(() => useChatTyping(11));
    act(() => markUserTyping(10, 1));
    expect(r1.current).toContain(1);
    expect(r2.current).not.toContain(1);
  });
});
