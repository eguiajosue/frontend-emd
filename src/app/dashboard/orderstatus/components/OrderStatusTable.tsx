import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import React from 'react'
import OrderCard from './OrderCard'

interface Order {
  id: number
  client: { first_name: string; last_name: string }
  user: { firstName: string; lastName: string }
  description: string
  creationDate: string
  deliveryDate: string
  status: string
}

const OrderStatusTable = ({ data }: { data: Order[] }) => {
  const statuses = ["pendiente", "en pruebas", "en proceso", "terminado", "entregado"]

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {statuses.map((status) => (
            <TableHead key={status} className="text-center font-bold">{status.toUpperCase()}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          {statuses.map((status) => (
            <TableCell key={status} className="align-top">
              {data
                .filter((order) => order.status === status)
                .map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  )
}

export default OrderStatusTable
