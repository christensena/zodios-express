import express from "express";
import request from "supertest";
import z from "zod";
import { apiBuilder, makeErrors } from "@zodios/core";
import { zodiosContext } from "./zodios";

const user = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const errors = makeErrors([
  {
    status: "default",
    schema: z.object({
      error: z.object({
        code: z.string(),
        message: z.string(),
      }),
    }),
  },
]);

const userApi = apiBuilder({
  method: "get",
  path: "/users",
  parameters: [
    {
      name: "limit",
      type: "Query",
      schema: z.number().min(1).max(Infinity).default(Infinity),
    },
    {
      name: "offset",
      type: "Query",
      schema: z.number().min(0).max(Infinity).default(0),
    },
    {
      name: "active",
      type: "Query",
      schema: z.boolean().default(true),
    },
  ],
  response: z.array(user),
  errors,
})
  .addEndpoint({
    method: "get",
    path: "/users/:id",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.number(),
      },
    ],
    response: user,
    errors,
  })
  .addEndpoint({
    method: "get",
    path: "/objects/:id",
    parameters: [
      {
        name: "test",
        type: "Query",
        schema: z.object({
          test: z.string(),
        }),
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.object({
      test: z.string(),
    }),
  })
  .addEndpoint({
    method: "post",
    path: "/users",
    parameters: [
      {
        name: "user",
        type: "Body",
        schema: user.omit({ id: true }),
      },
    ],
    response: user,
  })
  .addEndpoint({
    method: "put",
    path: "/users/:id",
    parameters: [
      {
        name: "user",
        type: "Body",
        schema: user,
      },
      {
        name: "Authorization",
        type: "Header",
        schema: z.string().regex(/^Bearer\s+[a-zA-Z0-9]+$/),
      },
    ],
    response: user,
  })
  .addEndpoint({
    method: "delete",
    path: "/users/:id",
    response: user,
  })
  .build();

describe("router", () => {
  it("should get one user", async () => {
    const app = zodiosContext().app(userApi);
    app.get("/users/:id", (req, res, next) => {
      if (req.params.id >= 10) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        });
      }
      res.json({
        id: req.params.id,
        name: "john doe",
        email: "test@domain.com",
      });
    });
    const req = request(app);
    const result = await req.get("/users/3").expect(200);
    expect(result.body).toEqual({
      id: 3,
      name: "john doe",
      email: "test@domain.com",
    });
  });

  it("should infer boolean in query params", async () => {
    const app = zodiosContext().app(userApi);
    app.get("/users", (req, res, next) => {
      if (req.query.active) {
        return res.status(200).json([
          {
            id: 1,
            name: "john doe active",
            email: "test@domain.com",
          },
        ]);
      }
      res.json([
        {
          id: 1,
          name: "john doe",
          email: "test@domain.com",
        },
      ]);
    });
    const req = request(app);
    const result1 = await req.get("/users?active=false");
    expect(result1.statusCode).toBe(200);
    expect(result1.body).toEqual([
      {
        id: 1,
        name: "john doe",
        email: "test@domain.com",
      },
    ]);
    const result2 = await req.get("/users?active=true");
    expect(result2.statusCode).toBe(200);
    expect(result2.body).toEqual([
      {
        id: 1,
        name: "john doe active",
        email: "test@domain.com",
      },
    ]);
    const result3 = await req.get("/users");
    expect(result3.statusCode).toBe(200);
    expect(result3.body).toEqual([
      {
        id: 1,
        name: "john doe active",
        email: "test@domain.com",
      },
    ]);
  });

  it("should infer objects in query params", async () => {
    const app = zodiosContext().app(userApi);
    app.get("/objects/:id", (req, res, next) => {
      res.json(req.query.test);
    });
    const req = request(app);
    // passing a stringified object
    const result1 = await req.get(
      "/objects/hello?test=%7B%22test%22%3A%22test%22%7D"
    );
    expect(result1.statusCode).toBe(200);
    expect(result1.body).toEqual({
      test: "test",
    });
  });

  it("should not find user if id>10", async () => {
    const app = zodiosContext().app(userApi);
    app.get("/users/:id", (req, res, next) => {
      if (req.params.id >= 10) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        });
      }
      res.json({
        id: req.params.id,
        name: "john doe",
        email: "test@domain.com",
      });
    });
    const req = request(app);
    const result = await req.get("/users/10").expect(404);
    expect(result.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "User not found",
      },
    });
  });

  it("should get many users with context", async () => {
    const ctx = zodiosContext(
      z.object({
        user: z.object({
          id: z.number(),
          name: z.string(),
          email: z.string().email(),
        }),
      })
    );
    const app = ctx.app();
    const router = ctx.router(userApi);
    router.use((req, res, next) => {
      req.user = {
        id: 1,
        name: "john doe",
        email: "john.doe@domain.com",
      };
      next();
    });
    app.use(router);
    router.get("/users", (req, res, next) => {
      res.json([
        req.user,
        {
          id: 2,
          name: "jane doe",
          email: "jane.doe@domain.com",
        },
      ]);
    });
    const req = request(app);
    const result = await req.get("/users").expect(200);
    expect(result.body).toEqual([
      {
        id: 1,
        name: "john doe",
        email: "john.doe@domain.com",
      },
      {
        id: 2,
        name: "jane doe",
        email: "jane.doe@domain.com",
      },
    ]);
  });

  it("should return 400 error on bad path params", async () => {
    const app = zodiosContext().app(userApi);
    app.get("/users/:id", (req, res, next) => {
      res.json({
        id: req.params.id,
        name: "john doe",
        email: "john.doe@domain.com",
      });
    });
    const req = request(app);
    const result = await req.get("/users/hello").expect(400);
    expect(result.body).toEqual({
      context: "path.id",
      error: [
        {
          code: "invalid_type",
          expected: "number",
          message: "Invalid input: expected number, received string",
          path: [],
        },
      ],
    });
  });

  it("should return 400 error on bad query params", async () => {
    const app = zodiosContext().app(userApi);
    app.get("/users", (req, res, next) => {
      res.json([
        {
          id: 1,
          name: "john doe",
          email: "john.doe@domain.com",
        },
        {
          id: 2,
          name: "jane doe",
          email: "jane.doe@domain.com",
        },
      ]);
    });
    const req = request(app);
    const result = await req.get("/users?limit=0").expect(400);
    expect(result.body.context).toEqual("query.limit");
    expect(result.body.error).toEqual([
      expect.objectContaining({
        code: "too_small",
        inclusive: true,
        message: "Too small: expected number to be >=1",
        minimum: 1,
        path: [],
        origin: "number",
      }),
    ]);
  });
  it("should create a user", async () => {
    const app = zodiosContext().app(userApi);
    app.post("/users", (req, res, next) => {
      res.json({
        id: 1,
        ...req.body,
      });
    });
    const req = request(app);
    const result = await req.post("/users").send({
      name: "john doe",
      email: "john.doe@domain.com",
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      id: 1,
      name: "john doe",
      email: "john.doe@domain.com",
    });
  });

  it("should return 400 error when sending an invalid user", async () => {
    const app = zodiosContext().app(userApi);
    app.post("/users", (req, res, next) => {
      res.json({
        id: 1,
        ...req.body,
      });
    });
    const req = request(app);
    const result = await req.post("/users").send({
      name: "john doe",
      email: "john.doe",
    });
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      context: "body",
      error: [
        {
          code: "invalid_format",
          format: "email",
          origin: "string",
          message: "Invalid email address",
          pattern: expect.any(String),
          path: ["email"],
        },
      ],
    });
  });
  it("should succeed to put a user if authenticated", async () => {
    const app = zodiosContext().app(userApi);
    app.put("/users/:id", (req, res) => {
      res.json(req.body);
    });
    const req = request(app);
    const result = await req
      .put("/users/1")
      .send({
        id: 1,
        name: "john doe",
        email: "john.doe@domain.com",
      })
      .set("Authorization", "Bearer 12345");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      id: 1,
      name: "john doe",
      email: "john.doe@domain.com",
    });
  });
  it("should fail to put a user if not authenticated", async () => {
    const app = zodiosContext().app(userApi);
    app.put("/users/:id", (req, res) => {
      res.json(req.body);
    });
    const req = request(app);
    const result = await req.put("/users/1").send({
      id: 1,
      name: "john doe",
      email: "john.doe@domain.com",
    });
    expect(result.status).toBe(400);
  });
});

const zod4Api = apiBuilder({
  method: "get",
  path: "/search",
  parameters: [
    {
      name: "flag",
      type: "Query",
      schema: z.stringbool(),
    },
    {
      name: "since",
      type: "Query",
      schema: z.iso.datetime().optional(),
    },
    {
      name: "page",
      type: "Query",
      schema: z.coerce.number().optional(),
    },
    {
      name: "tag",
      type: "Query",
      schema: z
        .string()
        .refine((s) => s !== "forbidden")
        .optional(),
    },
    {
      name: "limit",
      type: "Query",
      schema: z.number().min(1).default(0),
    },
  ],
  response: z.any(),
})
  .addEndpoint({
    method: "get",
    path: "/prefault",
    parameters: [
      {
        name: "limit",
        type: "Query",
        schema: z.number().min(1).prefault(0),
      },
    ],
    response: z.any(),
  })
  .addEndpoint({
    method: "get",
    path: "/items/:id",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.int(),
      },
    ],
    response: z.any(),
  })
  .addEndpoint({
    method: "post",
    path: "/strict-items",
    parameters: [
      {
        name: "item",
        type: "Body",
        schema: z.strictObject({
          name: z.string(),
          email: z.email(),
        }),
      },
    ],
    response: z.any(),
  })
  .addEndpoint({
    method: "post",
    path: "/loose-items",
    parameters: [
      {
        name: "item",
        type: "Body",
        schema: z.looseObject({
          name: z.string(),
        }),
      },
    ],
    response: z.any(),
  })
  .addEndpoint({
    method: "put",
    path: "/profile",
    parameters: [
      {
        name: "profile",
        type: "Body",
        schema: z
          .object({
            name: z.string(),
          })
          .transform((o) => ({ ...o, name: o.name.toUpperCase() })),
      },
      {
        name: "Authorization",
        type: "Header",
        schema: z.templateLiteral(["Bearer ", z.string().regex(/^[a-z0-9]+$/)]),
      },
    ],
    response: z.any(),
  })
  .build();

function makeZod4App(transform: boolean) {
  const app = zodiosContext().app(zod4Api, { transform });
  app.get("/search", (req, res) => {
    res.json({ query: req.query, flagType: typeof req.query.flag });
  });
  app.get("/prefault", (req, res) => {
    res.json({ limit: req.query.limit });
  });
  app.get("/items/:id", (req, res) => {
    res.json({ id: req.params.id });
  });
  app.post("/strict-items", (req, res) => {
    res.json(req.body);
  });
  app.post("/loose-items", (req, res) => {
    res.json(req.body);
  });
  app.put("/profile", (req, res) => {
    res.json(req.body);
  });
  return app;
}

describe("zod 4", () => {
  describe("z.stringbool", () => {
    it("should keep the raw string when transform is disabled (pipe is stripped)", async () => {
      const result = await request(makeZod4App(false))
        .get("/search?flag=yes")
        .expect(200);
      expect(result.body.query.flag).toBe("yes");
      expect(result.body.flagType).toBe("string");
    });

    it("should parse to a boolean when transform is enabled", async () => {
      const result = await request(makeZod4App(true))
        .get("/search?flag=yes")
        .expect(200);
      expect(result.body.query.flag).toBe(true);
      expect(result.body.flagType).toBe("boolean");
    });

    it("should reject invalid values when transform is enabled", async () => {
      const result = await request(makeZod4App(true))
        .get("/search?flag=maybe")
        .expect(400);
      expect(result.body.context).toBe("query.flag");
      expect(result.body.error[0].code).toBe("invalid_value");
    });
  });

  describe("string formats", () => {
    it("should accept a valid z.iso.datetime query param", async () => {
      const result = await request(makeZod4App(false))
        .get("/search?flag=yes&since=2026-01-15T10:00:00Z")
        .expect(200);
      expect(result.body.query.since).toBe("2026-01-15T10:00:00Z");
    });

    it("should reject an invalid z.iso.datetime query param", async () => {
      const result = await request(makeZod4App(false))
        .get("/search?flag=yes&since=not-a-date")
        .expect(400);
      expect(result.body.context).toBe("query.since");
      expect(result.body.error[0].code).toBe("invalid_format");
    });

    it("should reject an invalid z.email body field", async () => {
      const result = await request(makeZod4App(false))
        .post("/strict-items")
        .send({ name: "widget", email: "not-an-email" })
        .expect(400);
      expect(result.body.error[0]).toMatchObject({
        code: "invalid_format",
        format: "email",
        path: ["email"],
      });
    });
  });

  describe("coercion and numeric formats", () => {
    it("should coerce a numeric query param with z.coerce.number", async () => {
      const result = await request(makeZod4App(false))
        .get("/search?flag=yes&page=2")
        .expect(200);
      expect(result.body.query.page).toBe(2);
    });

    it("should accept an integer path param with z.int", async () => {
      const result = await request(makeZod4App(false))
        .get("/items/42")
        .expect(200);
      expect(result.body.id).toBe(42);
    });

    it("should reject a non-integer path param with z.int", async () => {
      const result = await request(makeZod4App(false))
        .get("/items/4.2")
        .expect(400);
      expect(result.body.context).toBe("path.id");
      expect(result.body.error[0]).toMatchObject({
        code: "invalid_type",
        expected: "int",
      });
    });
  });

  describe("refinements", () => {
    // zod 4 refinements no longer wrap the schema, so unlike zod 3 they
    // survive transform stripping and are enforced in no-transform mode
    it("should enforce refinements even when transform is disabled", async () => {
      const result = await request(makeZod4App(false))
        .get("/search?flag=yes&tag=forbidden")
        .expect(400);
      expect(result.body.context).toBe("query.tag");
      expect(result.body.error[0].code).toBe("custom");
    });

    it("should accept values passing the refinement", async () => {
      const result = await request(makeZod4App(false))
        .get("/search?flag=yes&tag=allowed")
        .expect(200);
      expect(result.body.query.tag).toBe("allowed");
    });
  });

  describe("default and prefault", () => {
    it("should short-circuit .default() without validating it", async () => {
      // default(0) violates min(1) but zod 4 returns defaults unvalidated
      const result = await request(makeZod4App(false))
        .get("/search?flag=yes")
        .expect(200);
      expect(result.body.query.limit).toBe(0);
    });

    it("should validate .prefault() values through the schema", async () => {
      const result = await request(makeZod4App(false))
        .get("/prefault")
        .expect(400);
      expect(result.body.context).toBe("query.limit");
      expect(result.body.error[0].code).toBe("too_small");
    });

    it("should accept explicit values on a prefault param", async () => {
      const result = await request(makeZod4App(false))
        .get("/prefault?limit=5")
        .expect(200);
      expect(result.body.limit).toBe(5);
    });
  });

  describe("strict and loose objects", () => {
    it("should reject unrecognized keys with z.strictObject", async () => {
      const result = await request(makeZod4App(false))
        .post("/strict-items")
        .send({ name: "widget", email: "a@b.com", extra: 1 })
        .expect(400);
      expect(result.body.error[0]).toMatchObject({
        code: "unrecognized_keys",
        keys: ["extra"],
      });
    });

    it("should preserve unknown keys with z.looseObject", async () => {
      const result = await request(makeZod4App(false))
        .post("/loose-items")
        .send({ name: "widget", extra: 1 })
        .expect(200);
      expect(result.body).toEqual({ name: "widget", extra: 1 });
    });
  });

  describe("transforms", () => {
    it("should not apply body transforms when transform is disabled", async () => {
      const result = await request(makeZod4App(false))
        .put("/profile")
        .set("Authorization", "Bearer abc123")
        .send({ name: "john" })
        .expect(200);
      expect(result.body).toEqual({ name: "john" });
    });

    it("should apply body transforms when transform is enabled", async () => {
      const result = await request(makeZod4App(true))
        .put("/profile")
        .set("Authorization", "Bearer abc123")
        .send({ name: "john" })
        .expect(200);
      expect(result.body).toEqual({ name: "JOHN" });
    });
  });

  describe("z.templateLiteral", () => {
    it("should accept a matching header", async () => {
      await request(makeZod4App(false))
        .put("/profile")
        .set("Authorization", "Bearer abc123")
        .send({ name: "john" })
        .expect(200);
    });

    it("should reject a non-matching header", async () => {
      const result = await request(makeZod4App(false))
        .put("/profile")
        .set("Authorization", "Token abc123")
        .send({ name: "john" })
        .expect(400);
      expect(result.body.context).toBe("header.Authorization");
      expect(result.body.error[0]).toMatchObject({
        code: "invalid_format",
        format: "template_literal",
      });
    });
  });
});
