import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

export default function TechnicianMessages() {
  const [messages, setMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const router = useRouter();

  useEffect(() => {
    // Load initial messages
    loadMessages();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      // Subscribe to chat messages
      const unsubscribe = subscribeToChat(selectedChat.id);
      return () => unsubscribe();
    }
  }, [selectedChat]);

  const loadMessages = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const loadedMessages = await Promise.all(
        querySnapshot.docs.map(async (chatDoc) => {
          const chatData = chatDoc.data();
          const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
          
          // Get user data
          const userDocRef = doc(db, 'users', otherUserId);
          const userDocSnap = await getDoc(userDocRef);
          const userData = userDocSnap.data();

          return {
            id: chatDoc.id,
            customerId: otherUserId,
            customerName: userData?.name || 'Unknown User',
            lastMessage: chatData.lastMessage || '',
            timestamp: chatData.lastMessageTime?.toDate() || new Date(),
            unread: chatData.unreadCount?.[currentUser.uid] > 0,
          };
        })
      );

      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  const subscribeToChat = (chatId) => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      }));
      setChatMessages(newMessages);
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const usersRef = collection(db, 'users');
      console.log('Fetching users from Firebase...');
      
      // Get all users first
      const querySnapshot = await getDocs(usersRef);
      console.log('Total users found:', querySnapshot.size);
      
      // Log all users for debugging
      querySnapshot.docs.forEach(doc => {
        console.log('User data:', {
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Filter users locally for better search results
      const results = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => {
          // Exclude current user
          if (user.id === auth.currentUser?.uid) {
            console.log('Excluding current user:', user.name);
            return false;
          }
          
          // Search in name and email
          const searchLower = searchQuery.toLowerCase();
          const nameMatch = user.name?.toLowerCase().includes(searchLower);
          const emailMatch = user.email?.toLowerCase().includes(searchLower);
          
          console.log('Checking user:', {
            name: user.name,
            email: user.email,
            matches: nameMatch || emailMatch
          });
          
          return nameMatch || emailMatch;
        });
      
      console.log('Filtered results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const startNewChat = async (user) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Create a new chat document
      const chatRef = doc(collection(db, 'chats'));
      await setDoc(chatRef, {
        participants: [currentUser.uid, user.id],
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [user.id]: 0
        },
        createdAt: serverTimestamp()
      });

      // Add to messages list
      const newChat = {
        id: chatRef.id,
        customerId: user.id,
        customerName: user.name,
        lastMessage: '',
        timestamp: new Date(),
        unread: false
      };

      setMessages(prev => [newChat, ...prev]);
      setSelectedChat(newChat);
      setSearchQuery('');
      setSearchResults([]);

      Alert.alert('Success', `Started new chat with ${user.name}`);
    } catch (error) {
      console.error('Error starting new chat:', error);
      Alert.alert('Error', 'Failed to start new chat');
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const messageRef = collection(db, 'chats', selectedChat.id, 'messages');
      await addDoc(messageRef, {
        text: messageText.trim(),
        senderId: currentUser.uid,
        timestamp: serverTimestamp()
      });

      // Update last message in chat
      const chatRef = doc(db, 'chats', selectedChat.id);
      await setDoc(chatRef, {
        lastMessage: messageText.trim(),
        lastMessageTime: serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [selectedChat.customerId]: 1
        }
      }, { merge: true });

      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleBack = () => {
    if (selectedChat) {
      setSelectedChat(null);
      setMessageText('');
    } else {
      router.push('/technicianDashboard?tab=messages');
    }
  };

  const renderSearchResults = () => (
    <View style={styles.searchResultsContainer}>
      <Text style={styles.searchResultsTitle}>Search Results</Text>
      {isSearching ? (
        <ActivityIndicator size="large" color="#1e88e5" />
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchResultItem}
              onPress={() => startNewChat(item)}
            >
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {item.name?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultName}>{item.name}</Text>
                <Text style={styles.searchResultType}>{item.userType}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.noResultsText}>No users found</Text>
          }
        />
      )}
    </View>
  );

  const renderChatList = () => (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.chatItem,
            item.unread && styles.unreadChat,
          ]}
          onPress={() => setSelectedChat(item)}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {item.customerName.charAt(0)}
            </Text>
          </View>
          <View style={styles.chatInfo}>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
          <View style={styles.chatMeta}>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {item.unread && <View style={styles.unreadBadge} />}
          </View>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.chatList}
    />
  );

  const renderChatView = () => (
    <View style={styles.chatView}>
      <FlatList
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.senderId === auth.currentUser?.uid
              ? styles.sentMessage
              : styles.receivedMessage,
          ]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.messageList}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.messageInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={!messageText.trim()}
        >
          <Ionicons
            name="send"
            size={24}
            color={messageText.trim() ? '#1e88e5' : '#999'}
          />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {selectedChat && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color="#1e88e5" />
          </TouchableOpacity>
        )}
        <Text style={[
          styles.headerTitle,
          !selectedChat && styles.centeredTitle
        ]}>
          {selectedChat ? selectedChat.customerName : 'Messages'}
        </Text>
      </View>

      {!selectedChat && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.trim()) {
                  handleSearch();
                } else {
                  setSearchResults([]);
                }
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {searchQuery.length > 0 ? renderSearchResults() : selectedChat ? renderChatView() : renderChatList()}

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => router.push('/technicianDashboard')}
        >
          <Ionicons name="home-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => router.push('/technicianDashboard?tab=transactions')}
        >
          <Ionicons name="card-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navButton, styles.activeNavButton]} 
          onPress={() => {}}
        >
          <Ionicons name="chatbubble-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => router.push('/technicianDashboard?tab=profile')}
        >
          <Ionicons name="person-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  centeredTitle: {
    flex: 1,
    textAlign: 'center',
  },
  chatList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  unreadChat: {
    backgroundColor: '#f0f9ff',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1e88e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1e88e5',
  },
  chatView: {
    flex: 1,
  },
  messageList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1e88e5',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  searchResultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchResultInfo: {
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  searchResultType: {
    fontSize: 14,
    color: '#666',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1e88e5',
    paddingVertical: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
  },
  activeNavButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
}); 