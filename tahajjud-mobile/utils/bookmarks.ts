import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = 'bookmarked_duas';

export async function getBookmarkedDuas(): Promise<string[]> {
    try {
        const bookmarks = await AsyncStorage.getItem(BOOKMARKS_KEY);
        return bookmarks ? JSON.parse(bookmarks) : [];
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        return [];
    }
}

export async function isBookmarked(duaId: string): Promise<boolean> {
    try {
        const bookmarks = await getBookmarkedDuas();
        return bookmarks.includes(duaId);
    } catch (error) {
        return false;
    }
}

export async function toggleBookmark(duaId: string): Promise<boolean> {
    try {
        const bookmarks = await getBookmarkedDuas();
        const index = bookmarks.indexOf(duaId);

        if (index > -1) {
            // Remove bookmark
            bookmarks.splice(index, 1);
            await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
            return false;
        } else {
            // Add bookmark
            bookmarks.push(duaId);
            await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
            return true;
        }
    } catch (error) {
        console.error('Error toggling bookmark:', error);
        return false;
    }
}

export async function addBookmark(duaId: string): Promise<void> {
    try {
        const bookmarks = await getBookmarkedDuas();
        if (!bookmarks.includes(duaId)) {
            bookmarks.push(duaId);
            await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
        }
    } catch (error) {
        console.error('Error adding bookmark:', error);
    }
}

export async function removeBookmark(duaId: string): Promise<void> {
    try {
        const bookmarks = await getBookmarkedDuas();
        const filtered = bookmarks.filter(id => id !== duaId);
        await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Error removing bookmark:', error);
    }
}

export async function clearAllBookmarks(): Promise<void> {
    try {
        await AsyncStorage.removeItem(BOOKMARKS_KEY);
    } catch (error) {
        console.error('Error clearing bookmarks:', error);
    }
}
