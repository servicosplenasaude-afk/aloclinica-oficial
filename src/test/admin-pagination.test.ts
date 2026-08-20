import { describe, expect, it, vi } from "vitest";
import { collectServerPages, pageRange } from "@/lib/admin-pagination";

describe("admin pagination", () => {
  it("uses inclusive PostgREST ranges", () => expect(pageRange(2, 100)).toEqual({ from: 200, to: 299 }));
  it("collects beyond 1000 rows", async () => {
    const source = Array.from({ length: 1_205 }, (_, id) => id);
    const fetchPage = vi.fn(async (from: number, to: number) => source.slice(from, to + 1));
    expect(await collectServerPages(fetchPage, 500)).toHaveLength(1_205);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});
