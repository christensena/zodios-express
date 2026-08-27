import { z } from "zod";

type MapPrefixPath<
  T extends readonly unknown[],
  PrefixValue extends string,
  ACC extends unknown[] = []
> = T extends readonly [infer Head, ...infer Tail]
  ? MapPrefixPath<
      Tail,
      PrefixValue,
      [
        ...ACC,
        {
          [K in keyof Head]: K extends "path"
            ? Head[K] extends string
              ? `${PrefixValue}${Head[K]}`
              : Head[K]
            : Head[K];
        }
      ]
    >
  : ACC;

export function prefixApi<Prefix extends string, Api extends readonly any[]>(
  prefix: Prefix,
  api: Api
) {
  return api.map((endpoint) => ({
    ...endpoint,
    path: `${prefix}${endpoint.path}`,
  })) as MapPrefixPath<Api, Prefix>;
}

// zod 4: refinements no longer wrap the schema, so only wrapper types
// (optional, nullable, default, ...) need unwrapping via def.innerType.
export function isZodType(t: z.ZodType, type: string): boolean {
  const def: any = (t as any).def;
  if (def?.type === type) {
    return true;
  }
  if (def?.innerType) {
    return isZodType(def.innerType, type);
  }
  return false;
}

// zod 4: transform/preprocess are pipes; the transform side has def.type "transform"
export function withoutTransform(t: z.ZodType): z.ZodType {
  const def: any = (t as any).def;
  if (def?.type === "pipe") {
    const inner = def.in?.def?.type === "transform" ? def.out : def.in;
    return withoutTransform(inner);
  }
  return t;
}
