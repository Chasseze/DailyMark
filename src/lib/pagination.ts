/** Reads bounded pages with stable ordering; never relies on the API row cap. */
export async function readAllPages<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 500,
) {
  const data: T[] = [];
  for (let offset = 0; ; offset += size) {
    const page = await query(offset, offset + size - 1);
    if (page.error) return { data, error: page.error };
    data.push(...(page.data ?? []));
    if (!page.data || page.data.length < size) return { data, error: null };
  }
}
