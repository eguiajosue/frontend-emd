"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import { columns, Order } from "./components/columns";

const OrdersPage = () => {
  const { data: session } = useSession();
  const { data, loading } = useCrud<Order>("orders");

  const role = session?.user?.role;
  const canCreate = role === "admin" || role === "recepcion";

  return (
    <div className="p-0 w-full">
      <div className="flex items-center justify-between">
        <Title title="Lista de Pedidos" />
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/orders/new">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Pedido
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
        </div>
      ) : (
        <div className="w-full overflow-auto">
          <DataTable columns={columns} data={data} />
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
