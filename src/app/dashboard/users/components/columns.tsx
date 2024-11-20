"use client"

import { Button } from "@/components/ui/button"
import { ColumnDef } from "@tanstack/react-table"

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Users = {
  firstName: string;
  lastName: string;
  username: string;
}

export const columns: ColumnDef<Users>[] = [
  {
    accessorKey: "firstName",
    header: "Nombre",
  },
  {
    accessorKey: "lastName",
    header: "Apellido",
  },
  {
    accessorKey: "username",
    header: "Usuario",
  },
  {
    accessorKey: "role.name",
    header: "Rol",
  },
];
