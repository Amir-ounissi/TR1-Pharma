import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "./supabase";

const CHANNEL_ID = "tr1-field-reminders";
const WINDOW_DAYS = 7;
const REMINDER_MINUTES = 30;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type AgendaReminderEvent = {
  event_key: string;
  source_kind: string;
  source_id: string;
  event_type: string;
  title: string;
  start_at: string;
  pharmacy_name: string | null;
  city: string | null;
  status: string;
};

export type FieldReminderState = {
  enabled: boolean;
  permission: string;
  scheduledCount: number;
};

async function scopedKey(kind: "enabled" | "scheduled", brandId: string) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Votre session TR1 a expiré. Reconnectez-vous.");
  return `tr1:field-reminders:v1:${kind}:${userId}:${brandId}`;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Rappels terrain TR1",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
  });
}

async function readEnabled(brandId: string) {
  return (await AsyncStorage.getItem(await scopedKey("enabled", brandId))) === "true";
}

async function readScheduledIds(brandId: string) {
  const raw = await AsyncStorage.getItem(await scopedKey("scheduled", brandId));
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [] as string[];
  }
}

async function cancelStoredReminders(brandId: string) {
  const ids = await readScheduledIds(brandId);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.removeItem(await scopedKey("scheduled", brandId));
}

export async function getFieldReminderState(brandId: string): Promise<FieldReminderState> {
  const [{ status }, enabled, ids] = await Promise.all([
    Notifications.getPermissionsAsync(),
    readEnabled(brandId),
    readScheduledIds(brandId),
  ]);
  return { enabled, permission: status, scheduledCount: ids.length };
}

export async function enableFieldReminders(brandId: string): Promise<FieldReminderState> {
  await ensureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Autorisez les notifications dans les réglages du téléphone pour activer les rappels terrain.");
  await AsyncStorage.setItem(await scopedKey("enabled", brandId), "true");
  const scheduledCount = await syncFieldReminders(brandId, true);
  return { enabled: true, permission: permission.status, scheduledCount };
}

export async function disableFieldReminders(brandId: string): Promise<FieldReminderState> {
  await cancelStoredReminders(brandId);
  await AsyncStorage.setItem(await scopedKey("enabled", brandId), "false");
  const { status } = await Notifications.getPermissionsAsync();
  return { enabled: false, permission: status, scheduledCount: 0 };
}

export async function refreshFieldReminders(brandId: string) {
  if (!(await readEnabled(brandId))) return 0;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return 0;
  return syncFieldReminders(brandId, false);
}

async function syncFieldReminders(brandId: string, ensureChannel: boolean) {
  if (ensureChannel) await ensureAndroidChannel();
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + WINDOW_DAYS);
  const { data, error } = await supabase.rpc("get_my_field_agenda", {
    start_date: localDate(now),
    end_date: localDate(end),
    brand_filter: brandId,
  });
  if (error) throw new Error("Les rappels n’ont pas pu être synchronisés avec votre agenda TR1.");

  await cancelStoredReminders(brandId);
  const identifiers: string[] = [];
  const blockedStatuses = new Set(["cancelled", "rejected", "no_show", "completed"]);

  for (const event of (data ?? []) as AgendaReminderEvent[]) {
    if (!event.start_at || blockedStatuses.has(String(event.status))) continue;
    const startsAt = new Date(event.start_at);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= now.getTime() + 5 * 60_000) continue;

    const idealReminderAt = startsAt.getTime() - REMINDER_MINUTES * 60_000;
    const triggerAt = Math.max(idealReminderAt, Date.now() + 60_000);
    const seconds = Math.max(1, Math.round((triggerAt - Date.now()) / 1000));
    const minutesBeforeStart = Math.max(1, Math.round((startsAt.getTime() - triggerAt) / 60_000));
    const reminderTitle = minutesBeforeStart >= 2 ? `TR1 · dans ${minutesBeforeStart} min` : "TR1 · rendez-vous imminent";
    const place = [event.pharmacy_name, event.city].filter(Boolean).join(" · ");

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminderTitle,
        body: place ? `${event.title} · ${place}` : event.title,
        data: {
          kind: "field_agenda",
          brandId,
          eventKey: event.event_key,
          sourceKind: event.source_kind,
          sourceId: event.source_id,
          eventType: event.event_type,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: CHANNEL_ID,
      },
    });
    identifiers.push(identifier);
  }

  await AsyncStorage.setItem(await scopedKey("scheduled", brandId), JSON.stringify(identifiers));
  return identifiers.length;
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
