"use client";

import Link from "next/link";

const ForbiddenPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center">
      <h1 className="text-4xl font-bold text-red-500">403 - Acceso Denegado</h1>
      <p className="text-lg mt-4">No tienes permiso para acceder a esta página.</p>
      <Link href="/">
        <a className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Volver al Inicio
        </a>
      </Link>
    </div>
  );
};

export default ForbiddenPage;
