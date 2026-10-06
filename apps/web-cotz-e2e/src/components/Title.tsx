interface TitleProps {
  title: string;
}

/**
 * Título de pantalla. Usa el rol `text-page-title` (globals.css): mismo
 * tamaño y peso en todas las pantallas. Sin bajada: el título alcanza.
 */
const Title = ({ title }: TitleProps) => {
  return (
    <div className="pb-2">
      <h1 className="text-page-title">{title}</h1>
    </div>
  );
};

export default Title;
