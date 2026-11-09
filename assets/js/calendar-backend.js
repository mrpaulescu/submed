// ============================================================================
// SubMed Calendar Backend — Supabase data access for calendar.html
// Uses the shared Supabase singleton and relies on RLS for data isolation.
// ============================================================================

import { supabase } from './supabase-client.js';

const EVENT_TYPES = new Set([
  'study',
  'personal',
  'exam',
  'appointment',
  'work',
  'other',
]);

const EVENT_COLUMNS =
  'id, user_id, day, name, start_min, duration_min, event_type, notes, created_at';

function assertDate(value, label = 'Data') {
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
    throw new Error(`${label} nu este validă.`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} nu este validă.`);
  }

  return value;
}

function normaliseEvent(input = {}) {
  const day = assertDate(input.day, 'Data activității');
  const name = String(input.name ?? '').trim();
  const startMin = Number(input.startMin);
  const durationMin = Number(input.durationMin);
  const eventType = String(input.eventType || 'personal').trim().toLowerCase();
  const notes = String(input.notes ?? '').trim();

  if (!name || name.length > 100) {
    throw new Error('Titlul trebuie să conțină între 1 și 100 de caractere.');
  }
  if (!Number.isInteger(startMin) || startMin < 0 || startMin > 1439) {
    throw new Error('Ora de început nu este validă.');
  }
  if (
    !Number.isInteger(durationMin) ||
    durationMin < 5 ||
    durationMin > 720 ||
    startMin + durationMin > 1440
  ) {
    throw new Error('Durata trebuie să fie între 5 minute și 12 ore și să se încheie în aceeași zi.');
  }
  if (!EVENT_TYPES.has(eventType)) {
    throw new Error('Tipul activității nu este valid.');
  }
  if (notes.length > 500) {
    throw new Error('Notițele pot avea cel mult 500 de caractere.');
  }

  return {
    day,
    name,
    start_min: startMin,
    duration_min: durationMin,
    event_type: eventType,
    notes: notes || null,
  };
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data?.user?.id) {
    throw new Error('Sesiunea a expirat. Autentifică-te din nou.');
  }

  return data.user;
}

export const CalendarBackend = Object.freeze({
  /**
   * Return all events belonging to the current user in an inclusive date range.
   * Dates are local calendar dates (YYYY-MM-DD), not UTC timestamps.
   */
  async listEvents(fromDay, toDay) {
    const from = assertDate(fromDay, 'Data de început');
    const to = assertDate(toDay, 'Data de sfârșit');

    if (from > to) {
      throw new Error('Intervalul calendarului nu este valid.');
    }

    const user = await requireUser();
    const { data, error } = await supabase
      .from('user_day_events')
      .select(EVENT_COLUMNS)
      .eq('user_id', user.id)
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true })
      .order('start_min', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createEvent(input) {
    const user = await requireUser();
    const payload = normaliseEvent(input);

    const { data, error } = await supabase
      .from('user_day_events')
      .insert({ user_id: user.id, ...payload })
      .select(EVENT_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  async updateEvent(id, input) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Identificatorul activității lipsește.');
    }

    const user = await requireUser();
    const payload = normaliseEvent(input);

    const { data, error } = await supabase
      .from('user_day_events')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(EVENT_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('Activitatea nu mai există sau nu îți aparține.');
    }

    return data;
  },

  async deleteEvent(id) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Identificatorul activității lipsește.');
    }

    const user = await requireUser();
    const { data, error } = await supabase
      .from('user_day_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id');

    if (error) throw error;
    if (!data?.length) {
      throw new Error('Activitatea nu mai există sau nu îți aparține.');
    }

    return true;
  },
});

export default CalendarBackend;