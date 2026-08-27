import { makeApi } from "@zodios/core";
import { z } from "zod";
import { isZodType, prefixApi, withoutTransform } from "./zodios.utils";
import { Assert } from "@zodios/core/lib/utils.types";

const response = z.object({
  id: z.number(),
  name: z.string(),
});

const api = makeApi([
  {
    method: "get",
    path: "/",
    response,
  },
  {
    method: "get",
    path: "/foo",
    response,
  },
]);

describe("zodios utils", () => {
  it("should prefix api", () => {
    type Expected = [
      {
        method: "get";
        path: "/api/";
        response: typeof response;
      },
      {
        method: "get";
        path: "/api/foo";
        response: typeof response;
      }
    ];
    const prefix = "/api";
    const prefixedApi = prefixApi(prefix, api);
    const testApi: Assert<typeof prefixedApi, Expected> = true;
    expect(prefixedApi).toEqual([
      {
        method: "get",
        path: "/api/",
        response,
      },
      {
        method: "get",
        path: "/api/foo",
        response,
      },
    ]);
  });

  describe("isZodType", () => {
    it("should match a bare schema", () => {
      expect(isZodType(z.string(), "string")).toBe(true);
      expect(isZodType(z.number(), "string")).toBe(false);
    });

    it("should look through wrapper types", () => {
      expect(isZodType(z.string().optional(), "string")).toBe(true);
      expect(isZodType(z.string().nullable().default("a"), "string")).toBe(
        true
      );
    });

    it("should look through refinements", () => {
      expect(
        isZodType(
          z.string().refine((s) => s.length > 1),
          "string"
        )
      ).toBe(true);
    });

    it("should not match a transformed schema", () => {
      expect(
        isZodType(
          z.string().transform((s) => s.length),
          "string"
        )
      ).toBe(false);
    });
  });

  describe("withoutTransform", () => {
    it("should strip transforms", () => {
      const schema = withoutTransform(z.string().transform((s) => s.length));
      expect(schema.safeParse("hello")).toEqual({
        success: true,
        data: "hello",
      });
    });

    it("should strip preprocess", () => {
      const schema = withoutTransform(
        z.preprocess((x) => Number(x), z.number())
      );
      expect(schema.safeParse("42").success).toBe(false);
      expect(schema.safeParse(42)).toEqual({ success: true, data: 42 });
    });

    it("should return schemas without transforms unchanged", () => {
      const schema = z.string();
      expect(withoutTransform(schema)).toBe(schema);
    });
  });
});
