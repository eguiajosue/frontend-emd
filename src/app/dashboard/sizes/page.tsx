"use client";

import { SimpleNamedEntityPage } from "@/components/crud/SimpleNamedEntityPage";

const SizesPage = () => (
  <SimpleNamedEntityPage
    endpoint="sizes"
    title="Lista de Tamaños"
    createLabel="Nuevo Tamaño"
    allowedRoles={["admin", "recepcion"]}
  />
);

export default SizesPage;
