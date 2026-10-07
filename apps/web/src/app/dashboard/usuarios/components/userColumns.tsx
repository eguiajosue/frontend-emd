"use client";

import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { Users2 } from "lucide-react";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import type { User } from "@/types";
import { getRoleLabel } from "@/lib/roles";

export const getUserColumns = ({
  onEdit,
  onDelete,
  canEdit,
}: CrudColumnsArgs<User>): ColumnDef<User>[] => [
  {
    accessorKey: "firstName",
    header: "Nombre",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.firstName}</span>
        {row.original.isSharedAccount && (
          <Badge variant="outline" className="border-primary/20 bg-primary/10 px-2 text-primary">
            <Users2 className="h-3 w-3" />
            Área
          </Badge>
        )}
        {row.original.branch && (
          <Badge variant="outline" className="px-2">
            {row.original.branch.name}
          </Badge>
        )}
      </div>
    ),
  },
  { accessorKey: "lastName", header: "Apellido" },
  { accessorKey: "username", header: "Usuario" },
  {
    id: "roles",
    header: "Roles",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.roles && row.original.roles.length > 0 ? (
          row.original.roles.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {getRoleLabel(r.name)}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Sin rol</span>
        )}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => (
      <RowActions
        canEdit={canEdit}
        onEdit={() => onEdit(row.original)}
        onDelete={() => onDelete(row.original.id)}
      />
    ),
  },
];
