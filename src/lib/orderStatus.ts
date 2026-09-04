export const statusMap: { [key: number]: string } = {
  1: "pendiente",
  2: "en pruebas",
  3: "en proceso",
  4: "terminado",
  5: "entregado",
};

export const statusOptions = Object.entries(statusMap).map(([id, name]) => ({
  value: Number(id),
  label: name,
}));
