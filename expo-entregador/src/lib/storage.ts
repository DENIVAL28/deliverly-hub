import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "entregador_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  return AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getGpsAtivo(token: string): Promise<boolean> {
  const val = await AsyncStorage.getItem(`gps_ativo_${token}`);
  return val === "1";
}

export async function setGpsAtivo(token: string, ativo: boolean): Promise<void> {
  if (ativo) {
    await AsyncStorage.setItem(`gps_ativo_${token}`, "1");
  } else {
    await AsyncStorage.removeItem(`gps_ativo_${token}`);
  }
}
