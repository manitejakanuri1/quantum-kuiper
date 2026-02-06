// Firestore Client Wrapper
// Provides both client-side and server-side Firestore access

import {
    getFirestore,
    Firestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    WhereFilterOp,
    QueryConstraint,
    Timestamp
} from 'firebase/firestore';
import { app } from './firebase';

// Client-side Firestore instance
export const db: Firestore = getFirestore(app);

// Server-side admin instance (lazy loaded)
let adminDb: any = null;

export async function getAdminDb() {
    if (adminDb) return adminDb;

    // Only initialize on server
    if (typeof window === 'undefined') {
        const admin = await import('firebase-admin');

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID || 'talk-to-site-a9ad9',
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
            });
        }

        adminDb = admin.firestore();
    }

    return adminDb;
}

// Helper functions for common operations
export const firestoreHelpers = {
    // Determine which DB to use (Client or Admin)
    async getDbInstance() {
        if (typeof window === 'undefined') {
            return await getAdminDb();
        }
        return db;
    },

    // Get a single document
    async getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
        if (typeof window === 'undefined') {
            const adminDb = await getAdminDb();
            const docSnap = await adminDb.collection(collectionName).doc(docId).get();
            return docSnap.exists ? (docSnap.data() as T) : null;
        } else {
            const docRef = doc(db, collectionName, docId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? (docSnap.data() as T) : null;
        }
    },

    // Get all documents in a collection
    async getCollection<T>(collectionName: string, constraints: any[] = []): Promise<T[]> {
        if (typeof window === 'undefined') {
            const adminDb = await getAdminDb();
            let ref = adminDb.collection(collectionName);

            // Note: constraints (orderBy, etc.) are complex to translate between SDKs
            // For now, we'll keep it simple for server-side if constraints are passed
            const snapshot = await ref.get();
            return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as T));
        } else {
            const q = query(collection(db, collectionName), ...constraints);
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        }
    },

    // Create or update a document
    async setDocument(collectionName: string, docId: string, data: any): Promise<void> {
        if (typeof window === 'undefined') {
            const adminDb = await getAdminDb();
            await adminDb.collection(collectionName).doc(docId).set({
                ...data,
                updatedAt: new Date(), // Admin SDK uses native Date for Timestamps
            }, { merge: true });
        } else {
            const docRef = doc(db, collectionName, docId);
            await setDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now(),
            }, { merge: true });
        }
    },

    // Update specific fields
    async updateDocument(collectionName: string, docId: string, data: any): Promise<void> {
        if (typeof window === 'undefined') {
            const adminDb = await getAdminDb();
            await adminDb.collection(collectionName).doc(docId).update({
                ...data,
                updatedAt: new Date(),
            });
        } else {
            const docRef = doc(db, collectionName, docId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now(),
            });
        }
    },

    // Delete a document
    async deleteDocument(collectionName: string, docId: string): Promise<void> {
        if (typeof window === 'undefined') {
            const adminDb = await getAdminDb();
            await adminDb.collection(collectionName).doc(docId).delete();
        } else {
            const docRef = doc(db, collectionName, docId);
            await deleteDoc(docRef);
        }
    },

    // Query with conditions
    async queryDocuments<T>(
        collectionName: string,
        conditions: Array<{ field: string; operator: WhereFilterOp; value: any }>,
        orderByField?: string,
        limitCount?: number
    ): Promise<T[]> {
        if (typeof window === 'undefined') {
            const adminDb = await getAdminDb();
            let ref = adminDb.collection(collectionName);

            for (const c of conditions) {
                // Admin SDK uses '==' instead of lowercase but some aliases exist
                // We'll normalize to Admin's expected operators if needed
                ref = ref.where(c.field, c.operator as any, c.value);
            }

            if (orderByField) {
                ref = ref.orderBy(orderByField);
            }

            if (limitCount) {
                ref = ref.limit(limitCount);
            }

            const snapshot = await ref.get();
            return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as T));
        } else {
            const constraints: QueryConstraint[] = conditions.map(c =>
                where(c.field, c.operator, c.value)
            );

            if (orderByField) {
                constraints.push(orderBy(orderByField));
            }

            if (limitCount) {
                constraints.push(limit(limitCount));
            }

            return this.getCollection<T>(collectionName, constraints);
        }
    },
};

// Export common Firestore functions
export {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
};
