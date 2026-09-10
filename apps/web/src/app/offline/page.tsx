export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-100 text-center p-6">
      <h1 className="text-4xl font-extrabold text-gray-800">Sin conexión</h1>
      <p className="text-sm mt-2 text-gray-500 max-w-sm">
        No hay red en este momento. Los pedidos y tareas cargados
        anteriormente siguen disponibles; el resto se sincronizará solo en
        cuanto vuelva la conexión.
      </p>
    </div>
  );
}
