"use strict";

process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const request = require("supertest");
const app = require("../src/index.js");

test("GET /health returns OK", async () => {
  const res = await request(app).get("/health").expect(200).expect("Content-Type", /json/);
  assert.equal(res.body.ok, true);
});

test("POST /auth/login validates body", async () => {
  const res = await request(app).post("/auth/login").send({});
  assert.equal(res.status, 400);
});
