APi server which is first layer of Exchange System
Features it should have are :

1. User Authentication
2. Redirect createOrder endpoint
3. Push to Queue
4. Generate OrderID

Structure :

Input from Frontend on /order POST endpoint :

```
    kind : buy | sell,
    type : limit | market,
    price : 0,
    quantity : 1,
    market : SOL-USDC
```

Send to Queue :

```
  +  userId : 8269207277,
  +  orderId : 31294823474983274,
    kind : buy | sell,
    type : limit | market,
    price : 0,
    quantity : 1,
    market : SOL-USDC
```
