"use client";

import { SimpleNamedEntityPage } from "@/components/crud/SimpleNamedEntityPage";

const ColorsPage = () => (
  <SimpleNamedEntityPage
    endpoint="colors"
    title="Lista de Colores"
    createLabel="Nuevo Color"
    allowedRoles={["admin", "recepcion"]}
  />
);

export default ColorsPage;
