export type SendDataToEngine = {
  type: string;
  data: {
    kind: string;
    type: string;
    price: number;
    quantity: number;
    market: string;
  };
};
export type recieveDataFromEngine = {
  id: string;
  status: "success" | "error";
  data?: any;
  error?: string;
};
export function verifyOrder(order: any): boolean {
  if (
    typeof order.kind !== "string" ||
    typeof order.type !== "string" ||
    typeof order.price !== "number" ||
    typeof order.quantity !== "number" ||
    typeof order.market !== "string"
  ) {
    return false;
  } else return true;
}
