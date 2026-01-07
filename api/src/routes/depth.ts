import express from "express";

const depthRouter = express.Router();

depthRouter.get("/", async (req, res) => {
  res.send("Depth route");
});

export default depthRouter;
