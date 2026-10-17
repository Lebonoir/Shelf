import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { makeKey, remember, rowToItem, type CatalogItem, type Source } from './catalog';
import type { Enums, Tables, TablesUpdate } from './database.types';
import { supabase } from './supabase';

export type ReadStatus = Enums<'read_status'>;

export type LibraryEntry = Omit<Tables<'library_entries'>, 'title_id'> & {
  titleId: string;
  item: CatalogItem;
};

export const STATUS_ORDER: ReadStatus[] = ['reading', 'planned', 'completed', 'on_hold', 'dropped'];

export const STATUS_LABEL: Record<ReadStatus, string> = {
  reading: 'Reading',
  planned: 'Up next',
  completed: 'Finished',
  on_hold: 'Paused',
  dropped: 'Dropped',
};

const LIBRARY_KEY = ['library'] as const;

async function loadLibrary(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from('library_entries')
    .select('*, title:titles(*)')
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return data.map(({ title, title_id, ...entry }) => {
    const item = rowToItem(title);
    remember([item]);
    return { ...entry, titleId: title_id, item };
  });
}

export function useLibrary() {
  return useQuery({ queryKey: LIBRARY_KEY, queryFn: loadLibrary });
}

/** The library entry for a catalog key, if the title is on the shelf. */
export function useEntry(key: string) {
  const library = useLibrary();
  return {
    ...library,
    data: library.data?.find((entry) => entry.item.key === key) ?? null,
  };
}

/** Finds or creates the shared `titles` row for a catalog item. */
async function ensureTitle(item: CatalogItem): Promise<string> {
  const existing = await supabase
    .from('titles')
    .select('id')
    .eq('source', item.source)
    .eq('source_id', item.sourceId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const inserted = await supabase
    .from('titles')
    .insert({
      source: item.source,
      source_id: item.sourceId,
      medium: item.medium,
      title: item.title,
      authors: item.authors,
      cover_url: item.coverUrl,
      synopsis: item.synopsis,
      genres: item.genres,
      year: item.year,
      total_units: item.totalUnits,
      unit: item.unit,
    })
    .select('id')
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

export function useAddToShelf() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, status }: { item: CatalogItem; status: ReadStatus }) => {
      const titleId = await ensureTitle(item);
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('library_entries').insert({
        title_id: titleId,
        status,
        started_at: status === 'reading' ? today : null,
        finished_at: status === 'completed' ? today : null,
        progress: status === 'completed' && item.totalUnits ? item.totalUnits : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}

export function useUpdateEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'library_entries'> }) => {
      const { error } = await supabase.from('library_entries').update(patch).eq('id', id);
      if (error) throw error;
    },
    // Optimistic so steppers and ratings feel instant.
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: LIBRARY_KEY });
      const previous = client.getQueryData<LibraryEntry[]>(LIBRARY_KEY);
      client.setQueryData<LibraryEntry[]>(LIBRARY_KEY, (entries) =>
        entries?.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(LIBRARY_KEY, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}

export function useRemoveEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('library_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}

/** Status changes also stamp start/finish dates the way a reader would expect. */
export function statusPatch(entry: LibraryEntry, status: ReadStatus): TablesUpdate<'library_entries'> {
  const today = new Date().toISOString().slice(0, 10);
  const patch: TablesUpdate<'library_entries'> = { status };
  if (status === 'reading' && !entry.started_at) patch.started_at = today;
  if (status === 'completed') {
    patch.finished_at = today;
    if (entry.item.totalUnits) patch.progress = entry.item.totalUnits;
  }
  return patch;
}

export const libraryKeys = (entries: LibraryEntry[] | undefined) =>
  new Set(entries?.map((e) => e.item.key) ?? []);

export { makeKey, type Source };
