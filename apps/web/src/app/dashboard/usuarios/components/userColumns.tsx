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
          <Badge variant="magenta" className="px-2">
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
    header: "Roles y áreas",
    cell: ({ row }) => {
      const roles = row.original.roles ?? [];
      const areas = row.original.areas ?? [];
      return (
        <div className="flex flex-wrap gap-1">
          {roles.length + areas.length > 0 ? (
            <>
              {roles.map((r) => (
                <span
                  key={`role-${r.id}`}
                  className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {getRoleLabel(r.name)}
                </span>
              ))}
              {areas.map((a) => (
                <span
                  key={`area-${a.id}`}
                  className="inline-flex items-center rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-medium text-cyan-ink"
                >
                  {a.name}
                </span>
              ))}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sin rol</span>
          )}
        </div>
      );
    },
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
