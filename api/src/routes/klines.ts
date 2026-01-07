import express from "express";

const klinesRouter = express.Router();

klinesRouter.get("/", async (req, res) => {
  res.send("Klines route");
});

export default klinesRouter;
