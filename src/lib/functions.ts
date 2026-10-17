import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

/**
 * Calls a Supabase edge function and surfaces its own `{ error }` message,
 * instead of supabase-js's generic "non-2xx status code".
 */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await (error.context as Response).json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    throw new Error(error.message);
  }
  if (data === null) throw new Error(`${name} returned nothing`);
  return data;
}
