import express from "express";

const tradesRouter = express.Router();

tradesRouter.get("/", async (req, res) => {
  res.send("Trades route");
});

export default tradesRouter;
