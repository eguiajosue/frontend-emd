import { NotFoundScreen } from "@/components/feedback/ErrorScreen";

/** 404 dentro del área privada: conserva el sidebar y sólo reemplaza el contenido. */
export default function DashboardNotFound() {
  return (
    <NotFoundScreen
      title="Esta sección no existe"
      description="La pantalla que buscas no existe o se movió. Usa el menú o vuelve al inicio."
    />
  );
}
