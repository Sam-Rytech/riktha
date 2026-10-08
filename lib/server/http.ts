import "server-only";
import { ZodError } from "zod";
import { AuthError } from "./auth";

/** Wraps a route handler: maps known errors to JSON responses with the right status. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return Response.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
      console.error(e);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
