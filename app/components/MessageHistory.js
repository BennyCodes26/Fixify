import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, getDocs, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MessageHistory() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Please log in to view messages');
        return;
      }

      // Get user's role
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      const isCustomer = userData?.role === 'customer';

      // Query chats based on user's role
      const chatsQuery = query(
        collection(db, 'chats'),
        where(isCustomer ? 'customerId' : 'technicianId', '==', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
      );

      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chatList = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const chatData = doc.data();
            // Get the other user's ID based on current user's role
            const otherUserId = chatData.customerId === currentUser.uid 
              ? chatData.technicianId 
              : chatData.customerId;
            
            try {
              const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
              const otherUserData = otherUserDoc.data() || {};
              
              return {
                id: doc.id,
                ...chatData,
                otherUserName: otherUserData.firstName || otherUserData.name || 'Unknown User',
                otherUserRole: otherUserData.role || otherUserData.userType || 'user',
                otherUserAvatar: otherUserData.avatarEmoji || '👤',
                lastMessageTime: chatData.lastMessageTime || chatData.createdAt,
              };
            } catch (error) {
              console.error('Error fetching other user:', error);
              return {
                id: doc.id,
                ...chatData,
                otherUserName: 'Unknown User',
                otherUserRole: 'user',
                otherUserAvatar: '👤',
                lastMessageTime: chatData.lastMessageTime || chatData.createdAt,
              };
            }
          })
        );

        setChats(chatList);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError('Failed to load messages. Please try again later.');
      setLoading(false);
    }
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => router.push(`/(tabs)/messages/${item.id}`)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{item.otherUserAvatar}</Text>
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.otherUserName}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </Text>
      </View>
      <Text style={styles.timestamp}>
        {item.lastMessageTime?.toDate().toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>No messages yet</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 16,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e53935',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
}); 