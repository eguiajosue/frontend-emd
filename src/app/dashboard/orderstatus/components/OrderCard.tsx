import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import React from 'react'

function calculateProgress(creationDate: string, deliveryDate: string): { progress: number; color: string } {
  const now = new Date()
  const create = new Date(creationDate)
  const deliver = new Date(deliveryDate)
  const total = deliver.getTime() - create.getTime()
  const elapsed = now.getTime() - create.getTime()
  const progress = Math.min(Math.max((elapsed / total) * 100, 0), 100)

  const hue = ((1 - progress / 100) * 120).toString(10)
  return { progress, color: `hsl(${hue}, 100%, 50%)` }
}

const OrderCard = ({ order }: { order: { client: { first_name: string; last_name: string }; user: { firstName: string; lastName: string }; description: string; creationDate: string; deliveryDate: string; } }) => {

  const dateFormat: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

  return (
    <Card className="mb-4 shadow-sm rounded-xl border transition-transform duration-300 hover:scale-105" role="article">
      <CardHeader>
        <CardTitle className="text-md font-bold text-pink-600" aria-label="Nombre del Cliente">
          {order.client?.first_name} {order.client?.last_name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-1" aria-label="Creado por">
          <b>Creado por: </b>{order.user?.firstName} {order.user?.lastName}
        </p>
        <p className="text-sm mb-2 truncate">{order.description}</p>
        <div className="flex justify-between text-xs text-muted-foreground mb-2 flex-col md:flex-row">
          <span aria-label="Fecha de Creación">
            <b>Creación:</b> {new Date(order.creationDate).toLocaleDateString("es-MX", dateFormat)}
          </span>
          <span aria-label="Fecha de Entrega">
            <b>Entrega:</b> {new Date(order.deliveryDate).toLocaleDateString("es-MX", dateFormat)}
          </span>
        </div>
        <Progress
          value={calculateProgress(order.creationDate, order.deliveryDate).progress}
          color={calculateProgress(order.creationDate, order.deliveryDate).color}
        />
      </CardContent>
    </Card>
  )
}

export default OrderCard
