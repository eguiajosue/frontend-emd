"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const NotFound = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-center p-6">
      <h1 className="text-8xl font-extrabold text-gray-800">404</h1>
      <p className="text-lg mt-4 font-medium text-gray-700">
        Página no encontrada
      </p>
      <p className="text-sm mt-2 text-gray-500">
        Parece que la página que buscas no existe. Por favor, verifica la URL o regresa a la página principal.
      </p>
      <Button
        className="mt-6 py-3 px-6 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
        onClick={() => router.push("/dashboard")}
      >
        Volver al inicio
      </Button>
    </div>
  );
};

export default NotFound;
