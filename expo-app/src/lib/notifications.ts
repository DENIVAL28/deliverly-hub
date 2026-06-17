import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";

export async function registerExpoPushToken(empresaId: string, userId: string): Promise<void> {
  if (!Device.isDevice) return; // não funciona em emulador

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || projectId === "SEU_PROJECT_ID_AQUI") {
    console.warn("Configure o projectId do Expo em app.json > extra.eas.projectId");
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await supabase.from("expo_push_tokens").upsert(
      { empresa_id: empresaId, user_id: userId, token },
      { onConflict: "token" }
    );
  } catch (e) {
    console.error("Erro ao registrar push token:", e);
  }
}

export async function removeExpoPushToken(userId: string): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId || projectId === "SEU_PROJECT_ID_AQUI") return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("expo_push_tokens").delete().eq("token", token).eq("user_id", userId);
  } catch {}
}
