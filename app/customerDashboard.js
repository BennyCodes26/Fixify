import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../config/firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const sampleData = {
  requestForms: [
    {
      id: '1',
      deviceType: 'Laptop',
      description: 'Screen not working',
      status: 'Pending',
      date: '2024-02-20',
    },
    {
      id: '2',
      deviceType: 'Phone',
      description: 'Battery issues',
      status: 'In Progress',
      date: '2024-02-19',
    },
  ],
  transactions: [
    {
      id: '1',
      type: 'Payment',
      amount: 150,
      date: '2024-02-20',
      status: 'Completed',
    },
    {
      id: '2',
      type: 'Refund',
      amount: 50,
      date: '2024-02-19',
      status: 'Pending',
    },
  ],
  messages: [
    {
      id: '1',
      sender: 'John Doe',
      message: 'Your request has been accepted',
      timestamp: '10:30 AM',
      unread: true,
    },
    {
      id: '2',
      sender: 'Jane Smith',
      message: 'When can you come?',
      timestamp: '09:15 AM',
      unread: false,
    },
  ],
};

const renderRequestItem = (request, onPress) => (
  <TouchableOpacity
    style={styles.requestCard}
    onPress={onPress}
  >
    <View style={styles.requestInfo}>
      <Text style={styles.requestTitle}>{request.deviceType}</Text>
      <Text style={styles.requestDescription}>{request.description}</Text>
      
      {/* Show progress bar for In Progress repairs */}
      {request.status === 'In Progress' && (
        <View style={styles.repairProgressContainer}>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${request.progressPercentage || 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {request.progressPercentage || 0}% Complete
          </Text>
          {request.lastUpdatedAt && (
            <Text style={styles.lastUpdateText}>
              Last updated: {request.lastUpdatedAt.toDate().toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {/* Show payment button for completed repairs */}
      {request.status === 'Completed' && !request.paymentCompleted && (
        <View style={styles.paymentRequiredContainer}>
          <Text style={styles.paymentRequiredText}>Payment Required</Text>
          <TouchableOpacity 
            style={styles.payNowButton}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: '/screens/PaymentScreen',
                params: { requestId: request.id }
              });
            }}
          >
            <Ionicons name="card-outline" size={18} color="#FFFFFF" />
            <Text style={styles.payNowButtonText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Show completed payment status */}
      {request.paymentCompleted && (
        <View style={styles.paymentCompleteContainer}>
          <View style={styles.paymentCompleteHeader}>
            <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
            <Text style={styles.paymentCompleteText}>Payment Complete</Text>
          </View>
          {!request.hasReview && (
            <TouchableOpacity 
              style={styles.rateRepairButton}
              onPress={(e) => {
                e.stopPropagation();
                router.push({
                  pathname: '/screens/RatingScreen',
                  params: { requestId: request.id }
                });
              }}
            >
              <Ionicons name="star-outline" size={16} color="#FFFFFF" />
              <Text style={styles.rateRepairText}>Rate Repair</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
    <View style={styles.requestStatus}>
      <Text style={[
        styles.statusText,
        request.status === 'Pending' ? styles.statusPending :
        request.status === 'Negotiating' ? styles.statusNegotiating :
        request.status === 'Accepted' ? styles.statusAccepted :
        request.status === 'In Progress' ? styles.statusInProgress :
        request.status === 'Completed' ? styles.statusCompleted :
        request.status === 'Paid' ? styles.statusPaid :
        request.status === 'Denied' ? styles.statusDenied :
        request.status === 'Declined' ? styles.statusDenied :
        styles.statusDefault
      ]}>
        {request.status}
      </Text>
      <Text style={styles.requestDate}>
        {request.createdAt?.toDate().toLocaleDateString() || 'N/A'}
      </Text>
    </View>
  </TouchableOpacity>
);

export default function CustomerDashboard() {
  const { tab = 'home' } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(tab);
  const [recentMessages, setRecentMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentRequests, setRecentRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let messageListener = null;
    let requestsListener = null;
    let notificationsListener = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchUserData(user.uid);
        
        // Set up messages listener
        messageListener = setupMessagesListener(user.uid);
        
        // Set up requests listener
        requestsListener = setupRequestsListener(user.uid);
        
        // Set up notifications listener
        notificationsListener = setupNotificationListener(user.uid);
        
        // Fetch transactions (not a real-time listener)
        fetchTransactions(user.uid);
      } else {
        setUser(null);
        setUserData(null);
        router.replace('/login');
      }
      setLoading(false);
    });

    // Cleanup function to remove all listeners
    return () => {
      unsubscribeAuth();
      if (messageListener) messageListener();
      if (requestsListener) requestsListener();
      if (notificationsListener) notificationsListener();
    };
  }, []);

  // Add useEffect to check and update technician names
  useEffect(() => {
    if (recentMessages.length > 0) {
      // Check and update technician names for messages
      const updateTechnicianNames = async () => {
        for (const message of recentMessages) {
          if (message.technicianId && (!message.technicianName || message.technicianName === 'Anonymous')) {
            const techData = await fetchTechnicianData(message.technicianId);
            if (techData && techData.name) {
              // Update the technician name in the database
              try {
                const requestRef = doc(db, 'repairRequests', message.id);
                await updateDoc(requestRef, {
                  technicianName: techData.name
                });
                console.log(`Updated technician name for request ${message.id} to ${techData.name}`);
              } catch (error) {
                console.error('Error updating technician name:', error);
              }
            }
          }
        }
      };
      
      updateTechnicianNames();
    }
  }, [recentMessages]);

  // Effect to update URL when tab changes
  useEffect(() => {
    // Update URL without navigating
    router.setParams({ tab: activeTab });
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const fetchUserData = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchTechnicianData = async (technicianId) => {
    if (!technicianId) return null;
    
    try {
      console.log('Fetching technician data for ID:', technicianId);
      const techDoc = await getDoc(doc(db, 'users', technicianId));
      if (techDoc.exists()) {
        const techData = techDoc.data();
        console.log('Technician data found:', techData);
        return techData;
      } else {
        console.log('No technician document found for ID:', technicianId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching technician data:', error);
      return null;
    }
  };

  const setupMessagesListener = (userId) => {
    try {
      const requestsRef = collection(db, 'repairRequests');
      const q = query(
        requestsRef,
        where('customerId', '==', userId),
        orderBy('lastMessageTime', 'desc'),
        limit(5)
      );

      return onSnapshot(q, (snapshot) => {
        const messagesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRecentMessages(messagesList);
      });
    } catch (error) {
      console.error('Error setting up messages listener:', error);
      return () => {}; // Return empty function in case of error
    }
  };

  const setupRequestsListener = (userId) => {
    try {
      const requestsRef = collection(db, 'repairRequests');
      const q = query(
        requestsRef,
        where('customerId', '==', userId),
        orderBy('lastMessageTime', 'desc'),
        limit(10)
      );

      return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Filter and sort requests to prioritize those needing payment
        const sortedRequests = requests.sort((a, b) => {
          // First, prioritize payment-required requests
          if (a.status === 'Completed' && !a.paymentCompleted && 
              (b.status !== 'Completed' || b.paymentCompleted)) {
            return -1;
          }
          if (b.status === 'Completed' && !b.paymentCompleted && 
              (a.status !== 'Completed' || a.paymentCompleted)) {
            return 1;
          }
          
          // Then, sort by last update time
          const timeA = a.lastUpdatedAt || a.completedAt || a.lastMessageTime || a.createdAt;
          const timeB = b.lastUpdatedAt || b.completedAt || b.lastMessageTime || b.createdAt;
          
          if (timeA && timeB) {
            return timeB.toDate() - timeA.toDate();
          }
          return 0;
        });
        
        setRecentRequests(sortedRequests);
      });
    } catch (error) {
      console.error('Error setting up requests listener:', error);
      return () => {}; // Return empty function in case of error
    }
  };

  const setupNotificationListener = (userId) => {
    try {
      // Keep track of shown notifications in memory
      const shownNotifications = new Set();
      
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('read', '==', false)
      );

      // Use this flag to prevent showing multiple alerts at the same time
      let isShowingNotification = false;

      return onSnapshot(q, async (snapshot) => {
        // Don't process if already showing a notification
        if (isShowingNotification) return;

        // Get all unread notifications
        const allUnreadNotifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        if (allUnreadNotifications.length === 0) return;
        
        // Group by type and requestId
        const groupedByType = {};
        
        // Group notifications by type and request
        allUnreadNotifications.forEach(notification => {
          const key = `${notification.type}_${notification.requestId}`;
          if (!groupedByType[key]) {
            groupedByType[key] = [];
          }
          groupedByType[key].push(notification);
        });
        
        // Find the first notification that hasn't been shown yet
        for (const [key, notifications] of Object.entries(groupedByType)) {
          // Skip if we've already shown this notification type
          if (shownNotifications.has(key)) {
            // Mark all of these as read silently
            notifications.forEach(notification => {
              markNotificationAsRead(notification.id);
            });
            continue;
          }
          
          // We found a notification type that hasn't been shown yet
          isShowingNotification = true;
          
          // Get most recent one
          const mostRecent = notifications[0];
          
          // Show the alert
          Alert.alert(
            mostRecent.title,
            mostRecent.message,
            [
              {
                text: 'View',
                onPress: async () => {
                  // Mark all notifications of this type as read
                  notifications.forEach(notification => {
                    markNotificationAsRead(notification.id);
                  });
                  
                  // Mark this notification type as shown
                  shownNotifications.add(key);
                  
                  // Reset flag after a delay
                  setTimeout(() => {
                    isShowingNotification = false;
                  }, 1000);
                  
                  // Navigate to request
                  if (mostRecent.requestId) {
                    router.push({
                      pathname: '/screens/CustomerRequestForm',
                      params: { requestId: mostRecent.requestId }
                    });
                  }
                }
              },
              {
                text: 'Dismiss',
                onPress: async () => {
                  // Mark all notifications of this type as read
                  notifications.forEach(notification => {
                    markNotificationAsRead(notification.id);
                  });
                  
                  // Mark this notification type as shown
                  shownNotifications.add(key);
                  
                  // Reset flag after a delay
                  setTimeout(() => {
                    isShowingNotification = false;
                  }, 1000);
                }
              }
            ],
            { cancelable: false }
          );
          
          // Only show one notification at a time
          break;
        }
      });
    } catch (error) {
      console.error('Error setting up notification listener:', error);
      return () => {}; // Return empty function in case of error
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      if (!notificationId) {
        console.error('No notification ID provided');
        return;
      }
      
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const fetchTransactions = async (userId) => {
    try {
      const transactionsRef = collection(db, 'transactions');
      // Use a simpler query that doesn't require a composite index
      const q = query(
        transactionsRef,
        where('customerId', '==', userId),
        // Don't use orderBy with where without creating an index first
        limit(5)
      );

      const querySnapshot = await getDocs(q);
      // Sort the results in memory instead
      const transactionsList = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          // Sort by createdAt in descending order
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB - dateA;
        });
        
      setTransactions(transactionsList);
      return () => {};
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return () => {};
    }
  };

  const handlePasswordChange = async () => {
    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        Alert.alert('Error', 'Please fill in all password fields');
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'New passwords do not match');
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        return;
      }

      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
      
      Alert.alert('Success', 'Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Current password is incorrect');
      } else {
        Alert.alert('Error', 'Failed to change password');
      }
    }
  };

  // Add a comprehensive utility function to fix technician names
  const fixAllTechnicianNames = async () => {
    try {
      setLoading(true);
      Alert.alert('Processing', 'Updating technician names...');
      
      // Get all repair requests from the database
      const requestsRef = collection(db, 'repairRequests');
      const snapshot = await getDocs(requestsRef);
      
      let updatedCount = 0;
      const totalRequests = snapshot.docs.length;
      
      for (const docSnapshot of snapshot.docs) {
        const request = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Only process requests that have a technician assigned
        if (request.technicianId) {
          // Fetch the technician's user data
          const techData = await fetchTechnicianData(request.technicianId);
          
          if (techData && techData.name && 
             (!request.technicianName || 
              request.technicianName === 'Anonymous' || 
              request.technicianName === 'Technician')) {
            
            // Update the technician name in the database
            const requestRef = doc(db, 'repairRequests', request.id);
            await updateDoc(requestRef, {
              technicianName: techData.name,
              // Also update lastMessageSender if it was set by the technician
              ...(request.lastMessageSender === 'Anonymous' || 
                 request.lastMessageSender === 'Technician' ? 
                 { lastMessageSender: techData.name } : {})
            });
            
            updatedCount++;
            console.log(`Updated technician name for request ${request.id} to ${techData.name}`);
            
            // Additionally update all messages in this request that were sent by this technician
            try {
              const messagesRef = collection(db, 'repairRequests', request.id, 'messages');
              const messagesSnapshot = await getDocs(messagesRef);
              
              for (const messageDoc of messagesSnapshot.docs) {
                const message = messageDoc.data();
                
                // Only update messages from this technician with Anonymous/Technician name
                if (message.senderId === request.technicianId && 
                    (message.senderName === 'Anonymous' || message.senderName === 'Technician')) {
                  
                  await updateDoc(doc(messagesRef, messageDoc.id), {
                    senderName: techData.name
                  });
                  
                  console.log(`Updated message sender name in request ${request.id}`);
                }
              }
            } catch (messageError) {
              console.error('Error updating messages:', messageError);
              // Continue with other requests even if message updates fail
            }
          }
        }
      }
      
      // Refresh the data display after updates
      if (user) {
        setupMessagesListener(user.uid);
        setupRequestsListener(user.uid);
      }
      
      Alert.alert('Success', `Updated ${updatedCount} out of ${totalRequests} requests with proper technician names.`);
    } catch (error) {
      console.error('Error fixing technician names:', error);
      Alert.alert('Error', 'Failed to update technician names: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  const renderHomeContent = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={24} color="#1e88e5" />
            <Text style={styles.statNumber}>{recentRequests.length}</Text>
            <Text style={styles.statLabel}>Active Requests</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash" size={24} color="#1e88e5" />
            <Text style={styles.statNumber}>${calculateTotalSpent()}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>
      </View>

      {/* Active Repairs Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Repairs</Text>
        {renderActiveRepairs()}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Requests</Text>
        {recentRequests.map((request) => (
          <React.Fragment key={request.id}>
            {renderRequestItem(
              request,
              () => router.push({
                pathname: '/screens/CustomerRequestForm',
                params: { requestId: request.id }
              })
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Messages</Text>
        {recentMessages.map((message) => (
          <TouchableOpacity
            key={message.id}
            style={styles.messageCard}
            onPress={() => router.push({
              pathname: '/screens/ChatScreen',
              params: { requestId: message.id }
            })}
          >
            <View style={styles.messageInfo}>
              <Text style={styles.messageSender}>
                {message.technicianName || 'Technician'}
              </Text>
              <Text style={styles.messageText}>{message.lastMessage || 'No messages yet'}</Text>
            </View>
            <View style={styles.messageMeta}>
              <Text style={styles.messageTime}>
                {message.lastMessageTime?.toDate().toLocaleDateString() || 'Just now'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderTransactionsContent = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        
        {transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          transactions.map((transaction) => (
            <TouchableOpacity
              key={transaction.id}
              style={styles.transactionCard}
              onPress={() => {
                if (transaction.status === 'Completed') {
                  router.push({
                    pathname: '/screens/InvoiceScreen',
                    params: { invoiceId: transaction.id }
                  });
                }
              }}
            >
              <View style={styles.transactionIconContainer}>
                <Ionicons name="card-outline" size={28} color="#1e88e5" />
              </View>
              
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>
                  {transaction.repairType} Repair Payment
                </Text>
                <Text style={styles.transactionDate}>
                  {transaction.createdAt?.toDate().toLocaleDateString() || 'Recent'}
                </Text>
                {transaction.description && (
                  <Text style={styles.transactionDescription} numberOfLines={1}>
                    {transaction.description}
                  </Text>
                )}
              </View>
              
              <View style={styles.transactionAmount}>
                <Text style={styles.amountText}>
                  ${transaction.amount}
                </Text>
                <Text style={[
                  styles.statusBadge,
                  transaction.status === 'Completed' ? styles.statusCompleted : styles.statusPending
                ]}>
                  {transaction.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderMessagesContent = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Messages</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#1e88e5" style={styles.loader} />
      ) : recentMessages.length === 0 ? (
        <Text style={styles.emptyText}>No messages yet</Text>
      ) : (
        <FlatList
          data={recentMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.messageCard}
              onPress={() => router.push({
                pathname: '/screens/ChatScreen',
                params: { requestId: item.id }
              })}
            >
              <View style={styles.messageInfo}>
                <Text style={styles.technicianName}>
                  {item.technicianName || 'Technician'}
                </Text>
                <Text style={styles.deviceType}>{item.deviceType}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage || 'No messages yet'}
                </Text>
              </View>
              <View style={styles.messageMeta}>
                <Text style={styles.messageTime}>
                  {item.lastMessageTime ? new Date(item.lastMessageTime.toDate()).toLocaleDateString() : 'Just now'}
                </Text>
                <View style={[
                  styles.statusBadge,
                  item.status === 'Pending' ? styles.pendingBadge :
                  item.status === 'Negotiating' ? styles.negotiatingBadge :
                  item.status === 'In Progress' ? styles.inProgressBadge :
                  styles.completedBadge
                ]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.messagesList}
        />
      )}
    </View>
  );

  const renderProfileContent = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle" size={80} color="#1e88e5" />
            </View>
            <Text style={styles.profileName}>{userData?.name || 'Customer'}</Text>
            <Text style={styles.profileEmail}>{userData?.email || user?.email || 'Not set'}</Text>
          </View>
          <View style={styles.profileDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="call" size={20} color="#666" />
              <Text style={styles.detailText}>{userData?.contactNumber || 'Not set'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.detailText}>{userData?.address || 'Not set'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => router.push('/customerProfile')}
        >
          <Text style={styles.settingText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => setShowPasswordModal(true)}
        >
          <Text style={styles.settingText}>Change Password</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="#ff3b30" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Function to calculate total spent
  const calculateTotalSpent = () => {
    const total = transactions.reduce((sum, transaction) => {
      return sum + (Number(transaction.amount) || 0);
    }, 0);
    return total.toFixed(0);
  };

  // Function to render active repairs (In Progress, Completed but not paid)
  const renderActiveRepairs = () => {
    // Get requests that are either In Progress or Completed but not yet paid
    const activeRepairs = recentRequests.filter(
      request => request.status === 'In Progress' || 
                (request.status === 'Completed' && !request.paymentCompleted)
    );

    console.log('Active repairs count:', activeRepairs.length);
    console.log('Completed repairs requiring payment:', 
      activeRepairs.filter(req => req.status === 'Completed').length);

    if (activeRepairs.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="construct-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No active repairs</Text>
        </View>
      );
    }

    return activeRepairs.map((request) => (
      <TouchableOpacity
        key={request.id}
        style={styles.activeRepairCard}
        onPress={() => router.push({
          pathname: '/screens/CustomerRequestForm',
          params: { requestId: request.id }
        })}
      >
        <View style={styles.activeRepairHeader}>
          <View>
            <Text style={styles.activeRepairTitle}>{request.deviceType}</Text>
            <Text style={styles.technicianName}>
              Technician: {request.technicianName || 'Not assigned'}
            </Text>
          </View>
          <View style={styles.statusBadgeContainer}>
            <Text style={[
              styles.statusBadge,
              request.status === 'In Progress' ? styles.inProgressBadge : styles.completedBadge
            ]}>
              {request.status}
            </Text>
          </View>
        </View>

        {request.status === 'In Progress' && (
          <View style={styles.progressSection}>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${request.progressPercentage || 0}%` }
                ]} 
              />
            </View>
            <View style={styles.progressDetails}>
              <Text style={styles.progressPercent}>{request.progressPercentage || 0}% Complete</Text>
              {request.lastUpdatedAt && (
                <Text style={styles.lastUpdatedText}>
                  Updated: {request.lastUpdatedAt.toDate().toLocaleString()}
                </Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.viewDetailsButton}
              onPress={() => router.push({
                pathname: '/screens/ChatScreen',
                params: { requestId: request.id }
              })}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
              <Text style={styles.viewDetailsText}>Message Technician</Text>
            </TouchableOpacity>
          </View>
        )}

        {request.status === 'Completed' && !request.paymentCompleted && (
          <View style={styles.paymentDueSection}>
            <View style={styles.paymentInfoRow}>
              <Text style={styles.paymentLabel}>Amount Due:</Text>
              <Text style={styles.paymentAmount}>${request.finalPrice || request.agreedPrice || 0}</Text>
            </View>
            {request.completedAt && (
              <Text style={styles.completedDateText}>
                Completed on: {request.completedAt.toDate().toLocaleString()}
              </Text>
            )}
            <Text style={styles.paymentDueText}>
              Your repair has been completed! Please complete payment.
            </Text>
            <TouchableOpacity 
              style={styles.paymentButton}
              onPress={() => router.push({
                pathname: '/screens/PaymentScreen',
                params: { requestId: request.id }
              })}
            >
              <Ionicons name="card-outline" size={18} color="#FFFFFF" />
              <Text style={styles.paymentButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeftSection}>
            <Image 
              source={require('../assets/onboarding1.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Welcome, {userData?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Customer'}</Text>
              <Text style={styles.headerSubtitle}>Fix things with Fixify</Text>
            </View>
          </View>
        </View>
      </View>

      {activeTab === 'home' && renderHomeContent()}
      {activeTab === 'transactions' && renderTransactionsContent()}
      {activeTab === 'messages' && renderMessagesContent()}
      {activeTab === 'profile' && renderProfileContent()}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModal}>
            <Text style={styles.modalTitle}>Change Password</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Current Password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="New Password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Confirm New Password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handlePasswordChange}
              >
                <Text style={styles.confirmButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.navigationBar}>
        <TouchableOpacity
          style={[styles.navButton, activeTab === 'home' && styles.activeNavButton]}
          onPress={() => setActiveTab('home')}
        >
          <Ionicons
            name="home"
            size={24}
            color={activeTab === 'home' ? '#1e88e5' : '#666666'}
          />
          <Text style={[
            styles.navButtonText,
            activeTab === 'home' && styles.activeNavButtonText
          ]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, activeTab === 'transactions' && styles.activeNavButton]}
          onPress={() => setActiveTab('transactions')}
        >
          <Ionicons
            name="receipt"
            size={24}
            color={activeTab === 'transactions' ? '#1e88e5' : '#666666'}
          />
          <Text style={[
            styles.navButtonText,
            activeTab === 'transactions' && styles.activeNavButtonText
          ]}>Transactions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, activeTab === 'messages' && styles.activeNavButton]}
          onPress={() => setActiveTab('messages')}
        >
          <Ionicons
            name="chatbubble"
            size={24}
            color={activeTab === 'messages' ? '#1e88e5' : '#666666'}
          />
          <Text style={[
            styles.navButtonText,
            activeTab === 'messages' && styles.activeNavButtonText
          ]}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, activeTab === 'profile' && styles.activeNavButton]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons
            name="person"
            size={24}
            color={activeTab === 'profile' ? '#1e88e5' : '#666666'}
          />
          <Text style={[
            styles.navButtonText,
            activeTab === 'profile' && styles.activeNavButtonText
          ]}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sendRequestButton}
          onPress={() => router.push('/screens/CustomerRequestForm')}
        >
          <Ionicons name="add" size={32} color="#1e88e5" />
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
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1e88e5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  requestCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 14,
    color: '#666',
  },
  requestStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusPending: {
    color: '#ffa000',
  },
  statusNegotiating: {
    color: '#ffb74d',
  },
  statusAccepted: {
    color: '#4caf50',
  },
  statusInProgress: {
    color: '#1e88e5',
  },
  statusCompleted: {
    color: '#4caf50',
  },
  statusPaid: {
    color: '#4caf50',
  },
  statusDenied: {
    color: '#f44336',
  },
  statusDefault: {
    color: '#9e9e9e',
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  transactionDescription: {
    fontSize: 14,
    color: '#666',
    opacity: 0.8,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  messageList: {
    padding: 16,
  },
  messageCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  messageInfo: {
    flex: 1,
  },
  technicianName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadMessage: {
    backgroundColor: '#f0f9ff',
  },
  profileCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  profileDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  logoutText: {
    fontSize: 16,
    color: '#ff3b30',
    marginLeft: 8,
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'relative',
  },
  navButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  activeNavButton: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  sendRequestButton: {
    position: 'absolute',
    top: -28,
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1,
  },
  navButtonText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  activeNavButtonText: {
    fontWeight: '500',
    color: '#1e88e5',
  },
  homeContent: {
    flex: 1,
  },
  welcomeSection: {
    padding: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: '#1e88e5',
  },
  requestsList: {
    padding: 16,
  },
  messageItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  messageContent: {
    flex: 1,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  messagesList: {
    paddingBottom: 16,
  },
  messagesContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  statusBadge: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  pendingBadge: {
    backgroundColor: '#ffd54f',
  },
  negotiatingBadge: {
    backgroundColor: '#ffb74d',
  },
  inProgressBadge: {
    backgroundColor: '#4caf50',
  },
  completedBadge: {
    backgroundColor: '#9e9e9e',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  repairProgressContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1e88e5',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  paymentRequiredContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff9c4',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentRequiredText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f57f17',
  },
  payNowButton: {
    backgroundColor: '#1e88e5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    gap: 4,
  },
  payNowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  paymentCompleteContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  paymentCompleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentCompleteText: {
    fontSize: 14,
    color: '#388e3c',
    fontWeight: '500',
    marginLeft: 6,
  },
  rateRepairButton: {
    backgroundColor: '#ff9800',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: 'flex-start',
    gap: 6,
  },
  rateRepairText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  activeRepairCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activeRepairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activeRepairTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  technicianName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusBadgeContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 'bold',
  },
  inProgressBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
  },
  completedBadge: {
    backgroundColor: '#e8f5e9',
    color: '#388e3c',
  },
  progressSection: {
    marginTop: 12,
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#999',
  },
  viewDetailsButton: {
    backgroundColor: '#1e88e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 6,
    gap: 6,
  },
  viewDetailsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  paymentDueSection: {
    marginTop: 12,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  paymentDueText: {
    fontSize: 14,
    color: '#f57f17',
    marginBottom: 12,
  },
  paymentButton: {
    backgroundColor: '#1e88e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 6,
    gap: 6,
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  completedDateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  passwordModal: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  viewTechnicianButton: {
    marginTop: 8,
    backgroundColor: '#e3f2fd',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  viewTechnicianText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '500',
  },
  messageSender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
}); 