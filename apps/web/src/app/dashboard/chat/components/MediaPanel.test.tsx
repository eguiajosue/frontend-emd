import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaPanel } from "./MediaPanel";
import type { ChatMessage } from "@/types";

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 1,
    conversationId: 1,
    body: "",
    createdAt: "2026-01-01T10:00:00.000Z",
    senderId: 10,
    ...overrides,
  } as ChatMessage;
}

describe("MediaPanel", () => {
  it("muestra el estado vacío cuando no hay adjuntos", () => {
    render(<MediaPanel messages={[makeMessage({ body: "hola" })]} />);
    expect(
      screen.getByText(/van a aparecer acá/i)
    ).toBeInTheDocument();
  });

  it("agrupa imágenes, videos y archivos por separado", () => {
    render(
      <MediaPanel
        messages={[
          makeMessage({
            id: 1,
            attachment: {
              filename: "foto.png",
              mimeType: "image/png",
              size: 1024,
              dataUrl: "data:image/png;base64,abc",
            },
          }),
          makeMessage({
            id: 2,
            attachment: {
              filename: "clip.mp4",
              mimeType: "video/mp4",
              size: 2048,
              dataUrl: "data:video/mp4;base64,abc",
            },
          }),
          makeMessage({
            id: 3,
            attachment: {
              filename: "reporte.pdf",
              mimeType: "application/pdf",
              size: 4096,
              dataUrl: "data:application/pdf;base64,abc",
            },
          }),
        ]}
      />
    );

    expect(screen.getByText("Imágenes")).toBeInTheDocument();
    expect(screen.getByText("Videos")).toBeInTheDocument();
    expect(screen.getByText("Archivos")).toBeInTheDocument();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("reporte.pdf")).toBeInTheDocument();
  });

  it("no muestra secciones sin adjuntos de ese tipo", () => {
    render(
      <MediaPanel
        messages={[
          makeMessage({
            id: 1,
            attachment: {
              filename: "reporte.pdf",
              mimeType: "application/pdf",
              size: 4096,
              dataUrl: "data:application/pdf;base64,abc",
            },
          }),
        ]}
      />
    );
    expect(screen.queryByText("Imágenes")).not.toBeInTheDocument();
    expect(screen.queryByText("Videos")).not.toBeInTheDocument();
    expect(screen.getByText("Archivos")).toBeInTheDocument();
  });
});
