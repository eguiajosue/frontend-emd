"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { columns } from "./components/columns";
import { DataTable } from "./components/datatable";
import { Skeleton } from "@/components/ui/skeleton";
import Title from "@/components/Title";
import { authFetch, authHeaders, AuthFetchError } from "@/lib/authFetch";

const Users = () => {
  const { data: session } = useSession();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Función para obtener usuarios de la API
  const getUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users`, {
        method: "GET",
        headers: authHeaders(session?.user?.token),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setData(data);
    } catch (error) {
      if (error instanceof AuthFetchError) return;
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user?.token) {
      getUsers();
    }
  }, [session, getUsers]);

  return (
    <div className="p-0 w-full">
      <Title title={"Lista de Usuarios"} />

      {loading ? (
        // Muestra skeletons mientras se cargan los datos
        <div className="space-y-4">
          {/* Skeleton para la tabla */}
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
        </div>
      ) : (
        // Tabla de datos una vez cargados
        <div className="w-full overflow-auto">
          <DataTable columns={columns} data={data} />
        </div>
      )}
    </div>
  );
};

export default Users;
