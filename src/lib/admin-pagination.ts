export const ADMIN_PAGE_SIZE = 100;

export async function collectServerPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = 500): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Invalid page size");
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

export const pageRange = (page: number, pageSize = ADMIN_PAGE_SIZE) => ({
  from: Math.max(0, page) * pageSize,
  to: Math.max(0, page) * pageSize + pageSize - 1,
});
