import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { auth, db } from '../../config/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

export default function ChatScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!requestId) {
      Alert.alert('Error', 'No request ID provided');
      router.back();
      return;
    }
    fetchRequest();
    setupMessagesListener();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      const requestRef = doc(db, 'repairRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        Alert.alert('Error', 'Request not found');
        router.back();
        return;
      }
      
      const requestData = requestDoc.data();
      
      // Check if technician name needs to be updated
      if (requestData.technicianId && 
          (!requestData.technicianName || 
           requestData.technicianName === 'Anonymous' || 
           requestData.technicianName === 'Technician')) {
        
        try {
          // Fetch the technician's user data
          const techDoc = await getDoc(doc(db, 'users', requestData.technicianId));
          
          if (techDoc.exists()) {
            const techData = techDoc.data();
            
            if (techData.name) {
              // Update the technician name in the database
              await updateDoc(requestRef, {
                technicianName: techData.name
              });
              
              // Update the local requestData
              requestData.technicianName = techData.name;
              console.log(`Updated technician name for request ${requestId} to ${techData.name}`);
            }
          }
        } catch (error) {
          console.error('Error updating technician name:', error);
        }
      }
      
      setRequest({ id: requestDoc.id, ...requestData });
      
      // Determine user role
      const user = auth.currentUser;
      if (user.uid === requestData.customerId) {
        setUserRole('customer');
      } else if (user.uid === requestData.technicianId) {
        setUserRole('technician');
      } else {
        Alert.alert('Error', 'You are not associated with this request');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching request:', error);
      Alert.alert('Error', 'Failed to load request details');
    }
  };

  const setupMessagesListener = () => {
    if (!requestId) return;

    const messagesRef = collection(db, 'repairRequests', requestId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(messageList);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    });

    return () => unsubscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to send messages');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        Alert.alert('Error', 'User data not found');
        return;
      }

      const userData = userDoc.data();
      // Get the role from the user document
      const role = userData.role || userData.userType || 'customer'; // Fallback to 'customer' if no role found
      
      // Get the sender's name
      let senderName = 'Anonymous';
      if (userData.name) {
        // Use full name
        senderName = userData.name;
      } else if (user.displayName) {
        // Fall back to display name if available
        senderName = user.displayName;
      }

      const messagesRef = collection(db, 'repairRequests', requestId, 'messages');
      
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: user.uid,
        senderName: senderName,
        senderRole: role,
        timestamp: new Date(),
      });

      // Update last message in request
      const requestRef = doc(db, 'repairRequests', requestId);
      await updateDoc(requestRef, {
        lastMessage: newMessage.trim(),
        lastMessageTime: new Date(),
        lastMessageSender: senderName,
      });

      setNewMessage('');
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // Function to add a system message
  const addSystemMessage = async (message) => {
    try {
      const messagesRef = collection(db, 'repairRequests', requestId, 'messages');
      
      await addDoc(messagesRef, {
        text: message,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'system',
        timestamp: new Date(),
        isSystemMessage: true
      });
    } catch (error) {
      console.error('Error adding system message:', error);
    }
  };

  const renderMessage = ({ item }) => {
    // Handle system messages
    if (item.isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
          <Text style={styles.systemMessageTimestamp}>
            {item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }
    
    const isCurrentUser = item.senderId === auth.currentUser?.uid;

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.sentMessage : styles.receivedMessage
      ]}>
        <Text style={[
          styles.senderName,
          isCurrentUser ? styles.sentSenderName : styles.receivedSenderName
        ]}>
          {item.senderName} ({item.senderRole})
        </Text>
        <Text style={[
          styles.messageText,
          isCurrentUser ? styles.sentMessageText : styles.receivedMessageText
        ]}>
          {item.text}
        </Text>
        <Text style={[
          styles.timestamp,
          isCurrentUser ? styles.sentTimestamp : styles.receivedTimestamp
        ]}>
          {item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {request?.deviceType || 'Loading...'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {request?.description || 'Loading description...'}
          </Text>
          <Text style={styles.statusText}>
            Status: {request?.status || 'Unknown'} | 
            Tech: {request?.technicianName || 'Not assigned'}
          </Text>
          {request?.technicianId && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  const techDoc = await getDoc(doc(db, 'users', request.technicianId));
                  if (techDoc.exists()) {
                    const techData = techDoc.data();
                    Alert.alert(
                      'Technician Info',
                      `ID: ${request.technicianId}\nName: ${techData.name || 'Not set'}\nSaved Name: ${request.technicianName || 'Not set'}`
                    );
                  } else {
                    Alert.alert('Tech Info', 'No technician document found');
                  }
                } catch (error) {
                  console.error('Error fetching technician data:', error);
                  Alert.alert('Error', 'Failed to fetch technician data');
                }
              }}
            >
              <Text style={styles.debugLink}>Debug Tech Info</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Action buttons based on user role and request status */}
        {request?.status === 'Negotiating' && (
          <View style={styles.actionButtons}>
            {/* For customers */}
            {userRole === 'customer' && (
              <TouchableOpacity
                style={styles.approveButton}
                onPress={async () => {
                  try {
                    const requestRef = doc(db, 'repairRequests', requestId);
                    await updateDoc(requestRef, {
                      status: 'Accepted',
                      approvedByCustomer: true,
                      approvedAt: new Date(),
                    });
                    
                    // Add system message
                    await addSystemMessage("✅ Customer has approved the negotiation. Technician can now start the repair.");
                    
                    // Send notification to technician
                    await addDoc(collection(db, 'notifications'), {
                      userId: request.technicianId,
                      title: 'Negotiation Approved',
                      message: `The customer has approved your negotiation for the ${request.deviceType} repair.`,
                      read: false,
                      createdAt: new Date(),
                      type: 'negotiation_approved',
                      requestId: requestId
                    });
                    
                    Alert.alert('Success', 'Negotiation approved. The technician can now start the repair.');
                  } catch (error) {
                    console.error('Error approving negotiation:', error);
                    Alert.alert('Error', 'Failed to approve negotiation. Please try again.');
                  }
                }}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
            )}
            
            {/* For technicians */}
            {userRole === 'technician' && request?.approvedByCustomer && (
              <TouchableOpacity
                style={styles.startRepairButton}
                onPress={async () => {
                  try {
                    const requestRef = doc(db, 'repairRequests', requestId);
                    const requestSnap = await getDoc(requestRef);
                    const requestData = requestSnap.data();
                    
                    // Prevent duplicate notifications if already in progress
                    if (requestData.status === 'In Progress') {
                      Alert.alert('Info', 'This repair is already in progress');
                      return;
                    }
                    
                    // Create a system message first (more reliable than updating status)
                    try {
                      await addSystemMessage("🔧 Technician has started the repair process.");
                    } catch (msgError) {
                      console.error('Error adding system message:', msgError);
                      // Continue even if system message fails
                    }
                    
                    // Try to update the status first
                    try {
                      await updateDoc(requestRef, {
                        status: 'In Progress',
                        repairStartedAt: new Date()
                      });
                    } catch (statusError) {
                      console.error('Error updating status:', statusError);
                      Alert.alert('Warning', 'The repair was started but there was an error updating the status');
                      // Don't proceed with notification if we couldn't update status
                      return;
                    }
                    
                    // Try to update the notification flag in a separate operation
                    try {
                      await updateDoc(requestRef, {
                        notificationSent: true
                      });
                    } catch (flagError) {
                      console.error('Error updating notification flag:', flagError);
                      // Continue even if flag update fails
                    }
                    
                    // Only create notification if not already sent
                    if (!requestData.notificationSent) {
                      try {
                        // Send notification to customer (only once)
                        await addDoc(collection(db, 'notifications'), {
                          userId: request.customerId,
                          title: 'Repair Started',
                          message: `Repair work has begun on your ${request.deviceType}.`,
                          read: false,
                          createdAt: new Date(),
                          type: 'repair_started',
                          requestId: requestId
                        });
                      } catch (notifError) {
                        console.error('Error sending notification:', notifError);
                        // Continue even if notification fails
                      }
                    }
                    
                    Alert.alert('Success', 'Repair marked as in progress');
                    
                    // Update local state to reflect the change
                    setRequest({
                      ...request,
                      status: 'In Progress',
                      repairStartedAt: new Date()
                    });
                  } catch (error) {
                    console.error('Error starting repair:', error);
                    Alert.alert('Error', 'Failed to update repair status. Please try again.');
                  }
                }}
              >
                <Text style={styles.startRepairButtonText}>Start Repair</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e88e5" style={styles.loader} />
      ) : (
        <>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            inverted={false}
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={newMessage.trim() ? "#1e88e5" : "#999"} 
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
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
    backgroundColor: '#1e88e5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E88E5',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  senderName: {
    fontSize: 12,
    marginBottom: 4,
  },
  sentSenderName: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  receivedSenderName: {
    color: '#666',
  },
  messageText: {
    fontSize: 16,
  },
  sentMessageText: {
    color: '#fff',
  },
  receivedMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  sentTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  receivedTimestamp: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginTop: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  approveButton: {
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    marginRight: 8,
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  startRepairButton: {
    padding: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  startRepairButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  systemMessageContainer: {
    alignSelf: 'center',
    marginVertical: 10,
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  systemMessageTimestamp: {
    fontSize: 10,
    marginTop: 4,
    color: '#999',
    textAlign: 'center',
  },
  debugLink: {
    fontSize: 12,
    color: '#fff',
    textDecorationLine: 'underline',
    opacity: 0.7,
    marginTop: 4,
  },
}); 