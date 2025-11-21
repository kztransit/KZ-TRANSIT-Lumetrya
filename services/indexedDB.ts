import { UserData } from '../types';
import { initialUserData } from './mockData';

const DB_NAME = 'LumetryaDB';
const DB_VERSION = 1;
const STORE_NAME = 'userDataStore';
const USER_DATA_KEY = 'currentUserData';

let db: IDBDatabase | null = null;

// Function to initialize the database
const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error("IndexedDB error:", request.error);
            reject("Error opening DB");
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// Function to save user data
export const saveUserDataToDB = async (userData: UserData): Promise<void> => {
    try {
        const dbInstance = await initDB();
        const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const dataToStore = { id: USER_DATA_KEY, ...userData };
        const request = store.put(dataToStore);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error("Error saving data to IndexedDB:", request.error);
                reject("Error saving data");
            };
        });
    } catch (error) {
        console.error("Could not initiate DB transaction for saving:", error);
        return Promise.reject(error);
    }
};

// Function to load user data
export const loadUserDataFromDB = async (): Promise<UserData> => {
    try {
        const dbInstance = await initDB();
        const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(USER_DATA_KEY);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                if (request.result) {
                    const { id, ...userData } = request.result;
                    // Validate data structure to prevent loading corrupted data
                    if (
                        typeof userData === 'object' &&
                        userData !== null &&
                        'reports' in userData && Array.isArray(userData.reports) &&
                        'proposals' in userData && Array.isArray(userData.proposals) &&
                        'campaigns' in userData && Array.isArray(userData.campaigns) &&
                        'links' in userData && Array.isArray(userData.links)
                    ) {
                        console.log("Successfully loaded user data from IndexedDB.");
                        // Add properties for backward compatibility if they don't exist
                        if (!('files' in userData) || !Array.isArray((userData as any).files)) {
                            (userData as UserData).files = [];
                        }
                         if (!('payments' in userData) || !Array.isArray((userData as any).payments)) {
                            (userData as UserData).payments = [];
                        }
                        if (!userData.companyProfile || !('aiSystemInstruction' in userData.companyProfile)) {
                            (userData as UserData).companyProfile = initialUserData.companyProfile;
                        }
                        if (userData.companyProfile && !('companyName' in userData.companyProfile)) {
                            (userData as UserData).companyProfile.companyName = initialUserData.companyProfile.companyName;
                        }
                        if (userData.companyProfile && typeof userData.companyProfile.darkModeEnabled === 'undefined') {
                            (userData as UserData).companyProfile.darkModeEnabled = false;
                        }
                         if (!('otherReports' in userData) || !Array.isArray((userData as any).otherReports)) {
                            (userData as UserData).otherReports = [];
                        }
                        if (userData.companyProfile && typeof userData.companyProfile.language === 'undefined') {
                            (userData as UserData).companyProfile.language = 'ru';
                        }
                        resolve(userData as UserData);
                    } else {
                        const errorMsg = "Data in IndexedDB has an invalid structure.";
                        console.warn(errorMsg, userData);
                        reject(new Error(errorMsg)); // Reject if data is corrupt
                    }
                } else {
                    // This is the case for a fresh start, no data exists.
                    console.log("No saved data found in IndexedDB. Initializing with default data.");
                    saveUserDataToDB(initialUserData).then(() => resolve(initialUserData));
                }
            };
            
            request.onerror = () => {
                // This handles actual DB read errors.
                console.error("Error fetching data from IndexedDB:", request.error);
                reject(request.error);
            };
        });

    } catch (error) {
        console.error("Failed to initialize DB for loading.", error);
        return Promise.reject(error); // Propagate initialization errors
    }
};