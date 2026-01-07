export type messageType =
  | "CREATE_ORDER"
  | "DELETE_ORDER"
  | "GET_OPEN_ORDERS"
  | "ON_RAMP"
  | "GET_DEPTH";
export type messageFromApiServer = {
  clientId: string;
  message: {
    type: messageType;
    data: {
      kind: "buy" | "sell";
      type: "Limit" | "Market";
      price: number;
      quantity: number;
      market: string;
    };
  };
};
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
export type UserBalance = {
  // key is the asset ex: SOL, USD, INR
  [key: string]: {
    balance: {
      available: number;
      locked: number;
    };
  };
};
// fill means how much of the order was filled
export interface Fill {
  otherUserId: string;
  qty: number;
  price: number;
  tradeId: number;
  markerOrderId: string;
}
