"use client";

import { SimpleNamedEntityPage } from "@/components/crud/SimpleNamedEntityPage";

const RolesPage = () => (
  <SimpleNamedEntityPage
    entity="roles"
    title="Lista de Roles"
    createLabel="Nuevo Rol"
    allowedRoles={["admin"]}
  />
);

export default RolesPage;
