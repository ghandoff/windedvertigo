import AsyncStorage from '@react-native-async-storage/async-storage';

const MEMBER_KEY = 'pocket_prompts_member_id';

export async function get_member_id(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(MEMBER_KEY);
  } catch {
    return null;
  }
}

export async function set_member_id(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(MEMBER_KEY, id);
  } catch (e) {
    console.warn('[storage] failed to save member id:', e);
  }
}
