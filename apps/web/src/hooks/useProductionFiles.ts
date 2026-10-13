"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, unwrapList } from "@/lib/api";
import { ENDPOINTS } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import {
  uploadFileMultipart,
  type InitResult,
  type MultipartApi,
  type PartUrl,
  type UploadOptions,
} from "@/lib/multipartUpload";

/**
 * Archivos finales de producción de un pedido (zip/eps/svg/dxf/imágenes, hasta
 * varios GB). Se suben por partes directo al bucket y se bajan por URL firmada;
 * el backend sólo firma y registra (docs/production-files.md del backend).
 */

export interface ProductionFile {
  id: number;
  orderId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  notes: string | null;
  uploadedById: number;
  createdAt: string;
  completedAt: string | null;
}

/** Extensiones que acepta el backend (se valida también allá). */
export const PRODUCTION_FILE_ACCEPT = ".zip,.eps,.svg,.dxf,.ai,.pdf,.jpg,.jpeg,.png";
export const PRODUCTION_FILE_MAX_BYTES = 5 * 1024 ** 3;

export function productionFilesKey(orderId: number) {
  return ["orderProductionFiles", orderId] as const;
}

const base = (orderId: number) => `${ENDPOINTS.orders}/${orderId}/production-files`;

export function useProductionFiles(orderId: number, options?: { enabled?: boolean }) {
  const token = useAuthToken();
  const query = useQuery<ProductionFile[]>({
    queryKey: productionFilesKey(orderId),
    enabled: Boolean(token) && (options?.enabled ?? true),
    queryFn: async () => unwrapList(await request<ProductionFile[]>(base(orderId), { token })),
    meta: { silentError: true },
  });
  return { files: query.data ?? [], isLoading: query.isLoading, isError: query.isError };
}

export function useUploadProductionFile(orderId: number) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, ...options }: { file: File } & Pick<UploadOptions, "notes" | "signal" | "onProgress">) => {
      const api: MultipartApi = {
        init: (body) => request<InitResult>(`${base(orderId)}/uploads`, { token, method: "POST", body }),
        signParts: async (fileId, partNumbers) =>
          (
            await request<{ parts: PartUrl[] }>(`${base(orderId)}/uploads/${fileId}/parts`, {
              token,
              method: "POST",
              body: { partNumbers },
            })
          ).parts,
        complete: (fileId, parts) =>
          request(`${base(orderId)}/uploads/${fileId}/complete`, { token, method: "POST", body: { parts } }),
        abort: (fileId) => request(`${base(orderId)}/uploads/${fileId}`, { token, method: "DELETE" }),
      };
      return uploadFileMultipart(file, api, options);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productionFilesKey(orderId) }),
    // La sección muestra su propio error y la barra de progreso.
    meta: { ownErrorToast: true },
  });
}

export function useDeleteProductionFile(orderId: number) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: number) => request<void>(`${base(orderId)}/${fileId}`, { token, method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productionFilesKey(orderId) }),
  });
}

/** Pide la URL firmada y arranca la descarga directa desde el bucket. */
export async function startProductionDownload(token: string | undefined, orderId: number, fileId: number) {
  const { url, fileName } = await request<{ url: string; fileName: string }>(
    `${base(orderId)}/${fileId}/download`,
    { token }
  );
  // La URL ya fuerza `attachment`: una navegación normal baja el archivo sin
  // cargarlo en memoria (un blob de 1 GB+ reventaría la pestaña).
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}
