"use client";

import { SimpleNamedEntityPage } from "@/components/crud/SimpleNamedEntityPage";

const ProductTypesPage = () => (
  <SimpleNamedEntityPage
    endpoint="product-types"
    title="Lista de Tipos de Producto"
    createLabel="Nuevo Tipo de Producto"
    allowedRoles={["admin", "recepcion"]}
  />
);

export default ProductTypesPage;
