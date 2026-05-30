import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface Chat {
  id: string;
  title: string;
  userId: string;
  createdAt: any;
  lastMessage?: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: any;
  type?: 'text' | 'document-analysis';
  metadata?: any;
}

export async function createChat(userId: string, title: string = 'New Conversation'): Promise<string> {
  const path = 'chats';
  try {
    const docRef = await addDoc(collection(db, path), {
      userId,
      title,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return "";
  }
}

export async function addMessage(chatId: string, role: 'user' | 'assistant', content: string, type: 'text' | 'document-analysis' = 'text', metadata?: any) {
  const path = `chats/${chatId}/messages`;
  try {
    const data: any = {
      chatId,
      role,
      content,
      type,
      createdAt: serverTimestamp(),
    };

    if (metadata !== undefined) {
      // Filter out undefined values to prevent Firestore errors
      const filteredMetadata: any = {};
      Object.keys(metadata).forEach(key => {
        if (metadata[key] !== undefined) {
          filteredMetadata[key] = metadata[key];
        }
      });
      data.metadata = filteredMetadata;
    }

    await addDoc(collection(db, path), data);
    
    // Update last message in chat
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      lastMessage: content.substring(0, 100),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
  const path = 'chats';
  const q = query(
    collection(db, path),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
    callback(chats);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export function subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
  const path = `chats/${chatId}/messages`;
  const q = query(
    collection(db, path),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
    callback(messages);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function deleteChat(chatId: string) {
    const path = `chats/${chatId}`;
    try {
        await deleteDoc(doc(db, 'chats', chatId));
    } catch(error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
}
