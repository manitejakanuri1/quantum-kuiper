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
    // Get a single document
    async getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as T) : null;
    },

    // Get all documents in a collection
    async getCollection<T>(collectionName: string, constraints: QueryConstraint[] = []): Promise<T[]> {
        const q = query(collection(db, collectionName), ...constraints);
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    },

    // Create or update a document
    async setDocument(collectionName: string, docId: string, data: any): Promise<void> {
        const docRef = doc(db, collectionName, docId);
        await setDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now(),
        }, { merge: true });
    },

    // Update specific fields
    async updateDocument(collectionName: string, docId: string, data: any): Promise<void> {
        const docRef = doc(db, collectionName, docId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now(),
        });
    },

    // Delete a document
    async deleteDocument(collectionName: string, docId: string): Promise<void> {
        const docRef = doc(db, collectionName, docId);
        await deleteDoc(docRef);
    },

    // Query with conditions
    async queryDocuments<T>(
        collectionName: string,
        conditions: Array<{ field: string; operator: WhereFilterOp; value: any }>,
        orderByField?: string,
        limitCount?: number
    ): Promise<T[]> {
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
