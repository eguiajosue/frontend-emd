"use client";

import React, { useMemo, useState } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { History, Users, Building2 } from "lucide-react";
import Title from "@/components/Title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CrudPage, type CrudColumnsArgs } from "@/components/crud/CrudPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import type { Client, Company } from "@/types";
import { getClientColumns } from "@/app/dashboard/clients/components/columns";
import { getCompanyColumns } from "@/app/dashboard/companies/components/columns";
import { ClientOrdersDialog } from "@/components/clients/ClientOrdersDialog";

const clientSchema = z.object({
  first_name: z.string().min(1, "El nombre es requerido"),
  last_name: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  companyId: z.number().optional(),
});

const companySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
});

const companyFields: FieldConfig[] = [
  { name: "name", label: "Nombre" },
  { name: "phone", label: "Teléfono" },
  { name: "email", label: "Email", type: "email" },
  { name: "address", label: "Dirección" },
  { name: "location", label: "Ubicación" },
];

/**
 * Pantalla unificada de "Clientes": pestañas Clientes / Empresas (antes dos
 * pantallas separadas en /dashboard/clients y /dashboard/companies).
 */
function initialTabFromUrl(): "clientes" | "empresas" {
  if (typeof window === "undefined") return "clientes";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "empresas" ? "empresas" : "clientes";
}

const ClientesPage = () => {
  const { canManageOperations } = usePermissions();
  const { data: companies } = useEntityList<Company>("companies");
  const [tab, setTab] = useState<"clientes" | "empresas">(initialTabFromUrl);
  const [ordersClientId, setOrdersClientId] = useState<number | null>(null);

  // Reusa las columnas base de Clientes y le agrega una acción "Ver pedidos"
  // (historial de pedidos del cliente, GET /clients/:id/orders).
  const clientColumnsWithOrders = useMemo(
    () =>
      (args: CrudColumnsArgs<Client>): ColumnDef<Client>[] => {
        const base = getClientColumns(args);
        return [
          ...base.slice(0, -1),
          {
            id: "viewOrders",
            header: "",
            cell: ({ row }) => (
              <Button
                size="icon"
                variant="ghost"
                title="Ver pedidos del cliente"
                aria-label="Ver pedidos del cliente"
                onClick={() => setOrdersClientId(row.original.id)}
              >
                <History className="h-4 w-4" />
              </Button>
            ),
          },
          ...base.slice(-1),
        ];
      },
    []
  );

  const clientFields: FieldConfig[] = useMemo(
    () => [
      { name: "first_name", label: "Nombre" },
      { name: "last_name", label: "Apellido" },
      { name: "phone", label: "Teléfono" },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Dirección" },
      {
        name: "companyId",
        label: "Empresa",
        type: "select",
        options: companies.map((c) => ({ value: c.id, label: c.name })),
      },
    ],
    [companies]
  );

  const handleTabChange = (value: string) => {
    const next = value === "empresas" ? "empresas" : "clientes";
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-4">
      <Title title="Clientes" />
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">
          <CrudPage<Client>
            entity="clients"
            title="Clientes"
            createLabel="Nuevo Cliente"
            canEdit={canManageOperations}
            fields={clientFields}
            schema={clientSchema}
            columns={clientColumnsWithOrders}
            emptyMessage="Todavía no cargaste ningún cliente"
            emptyDescription="Cuando sumes el primero, vas a poder ver su historial de pedidos acá mismo."
            emptyIcon={Users}
            deleteDescription="Esta acción eliminará al cliente de forma permanente."
            dialogTitle={(editing) => (editing ? "Editar Cliente" : "Nuevo Cliente")}
            hideTitle
            initialValues={(editing) =>
              editing
                ? {
                    first_name: editing.first_name,
                    last_name: editing.last_name,
                    phone: editing.phone ?? "",
                    email: editing.email ?? "",
                    address: editing.address ?? "",
                    companyId: editing.companyId ?? undefined,
                  }
                : {}
            }
          />
        </TabsContent>

        <TabsContent value="empresas">
          <CrudPage<Company>
            entity="companies"
            title="Empresas"
            createLabel="Nueva Empresa"
            canEdit={canManageOperations}
            fields={companyFields}
            schema={companySchema}
            columns={getCompanyColumns}
            emptyMessage="Ninguna empresa registrada por ahora"
            emptyDescription="Agrupá a tus clientes corporativos creando la primera empresa."
            emptyIcon={Building2}
            deleteDescription="Esta acción eliminará la empresa de forma permanente."
            dialogTitle={(editing) => (editing ? "Editar Empresa" : "Nueva Empresa")}
            hideTitle
            initialValues={(editing) =>
              editing
                ? {
                    name: editing.name,
                    phone: editing.phone ?? "",
                    email: editing.email ?? "",
                    address: editing.address ?? "",
                    location: editing.location ?? "",
                  }
                : {}
            }
          />
        </TabsContent>
      </Tabs>

      <ClientOrdersDialog
        clientId={ordersClientId}
        onClose={() => setOrdersClientId(null)}
      />
    </div>
  );
};

export default ClientesPage;
