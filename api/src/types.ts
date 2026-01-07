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
