import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null, якщо бекенд не налаштований — сайт працює в соло-режимі
export const supabase = url && key ? createClient(url, key) : null;
