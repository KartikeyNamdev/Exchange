import express from "express";

const tickerRouter = express.Router();

tickerRouter.get("/", async (req, res) => {
  res.send("Ticker route");
});

export default tickerRouter;
