"use client"

import React, { useEffect, useState } from 'react'
import OrderStatusTable from './components/OrderStatusTable'
import { useSession } from 'next-auth/react';
import Title from '@/components/Title';
import { Switch } from '@/components/ui/switch';

const statusMap: { [key: number]: string } = {
  1: "pendiente",
  2: "en pruebas",
  3: "en proceso",
  4: "terminado",
  5: "entregado",
}

const OrderStatus = () => {
  const { data: session } = useSession();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const getOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/orders`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.user?.token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      // Mapear cada order para agregar el campo de status
      const mappedData = data.map((order: { statusId: number }) => ({
        ...order,
        status: statusMap[order.statusId] || "DESCONOCIDO" // Asigna el nombre del estado o "DESCONOCIDO"
      }));

      setData(mappedData);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.token) {
      getOrders();
    }
  }, [session]);

  if (loading) {
    return <p>Loading...</p>
  }

  return (
    <div className="p-6">
      <Title title='Estatus de Ordenes'/>
      <OrderStatusTable data={data} />
    </div>
  )
}

export default OrderStatus
