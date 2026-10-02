import React from "react";

interface TitleProps {
  title: string;
  /** Una línea que explica la pantalla, debajo del título. */
  description?: React.ReactNode;
}

/**
 * Título de pantalla. Usa el rol `text-page-title` (globals.css): mismo
 * tamaño y peso en todas las pantallas.
 */
const Title = ({ title, description }: TitleProps) => {
  return (
    <div className="space-y-1 pb-2">
      <h1 className="text-page-title">{title}</h1>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
    </div>
  );
};

export default Title;
