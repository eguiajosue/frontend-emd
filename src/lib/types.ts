// Tipos compartidos que antes vivían junto a pantallas de gestión de catálogo
// (colores, tallas, tipos de producto, productos) que fueron removidas de la UI.
// Se mantienen aquí porque otras pantallas (ej. creación de pedidos) siguen
// usando estos tipos para poblar selectores opcionales.

export type Product = {
  id: number;
  productTypeId: number;
  colorId?: number;
  sizeId?: number;
  code?: string;
  quantity: number;
  productType?: { name: string };
  color?: { name: string };
  size?: { name: string };
};
