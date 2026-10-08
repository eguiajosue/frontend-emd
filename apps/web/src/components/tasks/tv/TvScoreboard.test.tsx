import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { bestDayLabel, onTimeRate, TvScoreboard } from "./TvScoreboard";

describe("marcador del Modo TV", () => {
  it("muestra hoy, a tiempo, racha y mejor día", () => {
    render(
      <TvScoreboard
        data={{ today: { done: 7, onTime: 7 }, week: { done: 40, onTime: 38 }, bestDay: { date: "2026-10-05", done: 12 }, streakDays: 4 }}
      />
    );
    expect(screen.getByRole("region", { name: "Marcador del equipo" })).toHaveTextContent("7Terminadas hoy");
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("Días seguidos sin atrasos")).toBeInTheDocument();
    expect(screen.getByText("12 el lunes")).toBeInTheDocument();
  });

  it("marca el récord cuando hoy iguala o supera el mejor día", () => {
    render(
      <TvScoreboard data={{ today: { done: 12, onTime: 12 }, week: { done: 12, onTime: 12 }, bestDay: { date: "2026-10-08", done: 12 }, streakDays: 1 }} />
    );
    expect(screen.getByText("Terminadas hoy · ¡récord!")).toBeInTheDocument();
  });

  it("sin datos no inventa porcentajes", () => {
    expect(onTimeRate({ done: 0, onTime: 0 })).toBeNull();
    expect(bestDayLabel(null)).toBeNull();
  });
});
