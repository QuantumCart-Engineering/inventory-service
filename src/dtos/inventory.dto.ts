export interface CreateInventoryRequest {
  productId: string;
  initialQuantity: number;
}

export interface ReserveInventoryRequest {
  productId: string;
  orderId: string;
  quantity: number;
}

export interface ConfirmInventoryRequest {
  orderId: string;
}

export interface ReleaseInventoryRequest {
  orderId: string;
}

export interface InventoryReservationRecord {
  id: string;
  product_id: string;
  order_id: string;
  quantity: number;
  status: "RESERVED" | "CONFIRMED" | "RELEASED";
}

export interface ReserveInventoryResponse {
  inventory: {
    id: string;
    product_id: string;
    available_quantity: number;
    reserved_quantity: number;
  };

  reservation: InventoryReservationRecord;
}