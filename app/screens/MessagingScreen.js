import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { auth, db } from '../../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';

export default function MessagingScreen() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [technicians, setTechnicians] = useState([
    {
      id: '1',
      name: 'John Smith',
      specialty: 'Plumbing',
      rating: 4.8,
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    {
      id: '2',
      name: 'Sarah Lee',
      specialty: 'Electrical',
      rating: 4.9,
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    {
      id: '3',
      name: 'Mike Johnson',
      specialty: 'HVAC',
      rating: 4.7,
      avatar: 'https://randomuser.me/api/portraits/men/46.jpg',
    },
    {
      id: '4',
      name: 'Emma Wilson',
      specialty: 'Appliance Repair',
      rating: 4.5,
      avatar: 'https://randomuser.me/api/portraits/women/63.jpg',
    },
  ]);

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

  const searchTechnicians = async (searchText) => {
    if (!searchText.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const results = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => {
          const isTechnician = 
            user.role === 'technician' || 
            user.userType === 'technician' ||
            user.type === 'technician';
          
          const searchLower = searchText.toLowerCase();
          const firstName = (user.firstName || '').toLowerCase();
          const name = (user.name || '').toLowerCase();
          const matches = firstName.includes(searchLower) || name.includes(searchLower);
          
          return isTechnician && matches;
        });

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching technicians:', error);
      Alert.alert('Error', 'Failed to search technicians');
    } finally {
      setIsSearching(false);
    }
  };

  const startNewChat = async (technicianId) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to start a chat');
        return;
      }

      // Check if chat already exists
      const existingChatsQuery = query(
        collection(db, 'chats'),
        where('customerId', '==', currentUser.uid),
        where('technicianId', '==', technicianId)
      );

      const existingChats = await getDocs(existingChatsQuery);
      
      if (!existingChats.empty) {
        router.push(`/(tabs)/messages/${existingChats.docs[0].id}`);
        return;
      }

      // Create new chat
      const newChatRef = await addDoc(collection(db, 'chats'), {
        customerId: currentUser.uid,
        technicianId: technicianId,
        createdAt: serverTimestamp(),
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.uid,
      });

      router.push(`/(tabs)/messages/${newChatRef.id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat');
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

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => startNewChat(item.id)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{item.avatarEmoji || '👤'}</Text>
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>
          {item.firstName || item.name || 'Unknown Technician'}
        </Text>
        <Text style={styles.searchResultRole}>Technician</Text>
        {item.specialties && item.specialties.length > 0 && (
          <Text style={styles.specialties} numberOfLines={1}>
            {item.specialties.join(', ')}
          </Text>
        )}
      </View>
      <Ionicons name="chatbubble-outline" size={24} color="#1e88e5" />
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messaging</Text>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search technicians..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchTechnicians(text);
          }}
        />
      </View>
      
      {/* Search Results Modal */}
      <Modal
        visible={isSearching}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Results</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No technicians found</Text>
              }
            />
          </View>
        </View>
      </Modal>
      
      {/* Conversations List */}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Search for technicians to start a conversation
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#1E88E5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
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
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 16,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  searchResultRole: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  specialties: {
    fontSize: 12,
    color: '#1e88e5',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
}); 