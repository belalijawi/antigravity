import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersonalDua {
    id: string;
    title: string;
    arabic?: string;
    transliteration?: string;
    translation?: string;
    notes?: string;
    createdAt: number;
}

const STORAGE_KEY = 'personal_duas';

export const getPersonalDuas = async (): Promise<PersonalDua[]> => {
    try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
        console.error('Error loading personal duas', e);
        return [];
    }
};

export const savePersonalDua = async (dua: PersonalDua): Promise<void> => {
    try {
        const currentDuas = await getPersonalDuas();
        const updatedDuas = [dua, ...currentDuas];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDuas));
    } catch (e) {
        console.error('Error saving personal dua', e);
    }
};

export const updatePersonalDua = async (updatedDua: PersonalDua): Promise<void> => {
    try {
        const currentDuas = await getPersonalDuas();
        const updatedList = currentDuas.map(d => d.id === updatedDua.id ? updatedDua : d);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
        console.error('Error updating personal dua', e);
    }
};

export const deletePersonalDua = async (id: string): Promise<void> => {
    try {
        const currentDuas = await getPersonalDuas();
        const filteredDuas = currentDuas.filter(d => d.id !== id);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredDuas));
    } catch (e) {
        console.error('Error deleting personal dua', e);
    }
};
