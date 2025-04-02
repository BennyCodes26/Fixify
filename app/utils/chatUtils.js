import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { auth } from '../../config/firebase';

export const createOrGetChat = async (customerId, technicianId) => {
  try {
    // Check if chat already exists
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('customerId', '==', customerId),
      where('technicianId', '==', technicianId)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Chat exists, return the first chat's ID
      return querySnapshot.docs[0].id;
    }

    // Get user details
    const customerDoc = await getDoc(doc(db, 'users', customerId));
    const technicianDoc = await getDoc(doc(db, 'users', technicianId));

    if (!customerDoc.exists() || !technicianDoc.exists()) {
      throw new Error('User not found');
    }

    const customerData = customerDoc.data();
    const technicianData = technicianDoc.data();

    // Create new chat
    const chatDoc = await addDoc(chatsRef, {
      customerId,
      technicianId,
      customerName: customerData.name,
      technicianName: technicianData.name,
      createdAt: new Date(),
      lastMessage: null,
      lastMessageTime: null,
    });

    return chatDoc.id;
  } catch (error) {
    console.error('Error creating/getting chat:', error);
    throw error;
  }
};

export const navigateToChat = (router, chatId) => {
  router.push(`/(tabs)/messages/${chatId}`);
};

export const startChatFromTechnicianProfile = async (technicianId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const chatId = await createOrGetChat(currentUser.uid, technicianId);
    return chatId;
  } catch (error) {
    console.error('Error starting chat from technician profile:', error);
    throw error;
  }
};

export const startChatFromServiceRequest = async (customerId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const chatId = await createOrGetChat(customerId, currentUser.uid);
    return chatId;
  } catch (error) {
    console.error('Error starting chat from service request:', error);
    throw error;
  }
}; 