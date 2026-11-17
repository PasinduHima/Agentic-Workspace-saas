"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Wraps a server action with loading, data and error state. `fn` calls the action and resolves
 * to its result, or to undefined if it threw (the error is toasted), so callers can just
 * `if (!result) return`. `loading` is null until the first call.
 */
export function useFetch<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const [data, setData] = useState<Result | undefined>(undefined);
  const [loading, setLoading] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fn = async (...args: Args): Promise<Result | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await action(...args);
      setData(result);
      return result;
    } catch (caught) {
      const err = caught instanceof Error ? caught : new Error(String(caught));
      setError(err);
      // Next replaces thrown server action messages with a generic one in production.
      toast.error(err.message || "Something went wrong. Try again.");
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  return { fn, data, loading, error, setData };
}
