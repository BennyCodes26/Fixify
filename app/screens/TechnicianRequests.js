import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { auth, db } from '../../config/firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, getDoc, setDoc, serverTimestamp, startAfter, limit } from 'firebase/firestore';

export default function TechnicianRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('pending'); // 'pending', 'negotiating', 'accepted', 'inProgress', 'completed'
  const [price, setPrice] = useState('');
  const [negotiatingRequest, setNegotiatingRequest] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [progressUpdate, setProgressUpdate] = useState('');
  const [progressPercentage, setProgressPercentage] = useState(50);
  const progressUpdateRef = useRef(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const completionNotesRef = useRef(null);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [repairDuration, setRepairDuration] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);
  const [cashPaymentRequest, setCashPaymentRequest] = useState(null);
  const [lastDocumentSnapshot, setLastDocumentSnapshot] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreRequests, setHasMoreRequests] = useState(true);
  const QUERY_LIMIT = 20; // Smaller batch size to prevent BloomFilter issues

  useEffect(() => {
    // Reset pagination when tab changes
    setLastDocumentSnapshot(null);
    setHasMoreRequests(true);
    fetchRequests(true);
  }, [selectedTab]);

  const fetchRequests = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
        setRequests([]);
      } else {
        setIsLoadingMore(true);
      }

      if (isInitialLoad || hasMoreRequests) {
        const requestsRef = collection(db, 'repairRequests');
        let q;

        // Create the base query depending on selected tab
        switch (selectedTab) {
          case 'pending':
            q = query(requestsRef, where('status', '==', 'Pending'));
            break;
          case 'negotiating':
            q = query(requestsRef, 
              where('technicianId', '==', auth.currentUser.uid),
              where('status', '==', 'Negotiating')
            );
            break;
          case 'accepted':
            q = query(requestsRef, 
              where('technicianId', '==', auth.currentUser.uid),
              where('status', '==', 'Accepted')
            );
            break;
          case 'inProgress':
            q = query(requestsRef, 
              where('technicianId', '==', auth.currentUser.uid),
              where('status', '==', 'In Progress')
            );
            break;
          case 'completed':
            q = query(requestsRef, 
              where('technicianId', '==', auth.currentUser.uid),
              where('status', 'in', ['Completed', 'Paid'])
            );
            break;
          case 'service':
            q = query(requestsRef, 
              where('technicianId', '==', auth.currentUser.uid),
              where('status', '==', 'ServiceRequest')
            );
            break;
          default:
            q = query(requestsRef, where('status', '==', 'Pending'));
        }

        // Add pagination using the last document snapshot
        if (lastDocumentSnapshot && !isInitialLoad) {
          q = query(q, startAfter(lastDocumentSnapshot), limit(QUERY_LIMIT));
        } else {
          q = query(q, limit(QUERY_LIMIT));
        }

        const querySnapshot = await getDocs(q);
        
        // Check if there are more results to load
        setHasMoreRequests(querySnapshot.docs.length === QUERY_LIMIT);
        
        // Save the last document for pagination
        if (querySnapshot.docs.length > 0) {
          setLastDocumentSnapshot(querySnapshot.docs[querySnapshot.docs.length - 1]);
        }

        const requestsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort by emergency status and creation time
        requestsData.sort((a, b) => {
          if (a.emergency && !b.emergency) return -1;
          if (!a.emergency && b.emergency) return 1;
          return b.createdAt.toDate() - a.createdAt.toDate();
        });

        // Append new data or set as new data based on whether this is initial load
        setRequests(prev => isInitialLoad ? requestsData : [...prev, ...requestsData]);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('Error', 'Failed to fetch requests. Please try again.');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Function to load more requests when scrolling to the end
  const loadMoreRequests = () => {
    if (!isLoadingMore && hasMoreRequests) {
      fetchRequests(false);
    }
  };

  const getTechnicianName = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return 'Technician';
      
      console.log('Current user ID:', user.uid);
      console.log('Current user displayName:', user.displayName);
      
      // Get the user document from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      console.log('User document exists:', userDoc.exists());
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data from Firestore:', userData);
        
        // Get the full name from user data
        if (userData.name) {
          console.log('Name from user data:', userData.name);
          // Use the full name
          return userData.name;
        }
      }
      
      // Fallback to display name if user document doesn't exist or has no name
      return user.displayName || 'Technician';
    } catch (error) {
      console.error('Error getting technician name:', error);
      return 'Technician';
    }
  };

  const handleStartNegotiation = async (requestId) => {
    try {
      const techName = await getTechnicianName();
      const requestRef = doc(db, 'repairRequests', requestId);
      await updateDoc(requestRef, {
        status: 'Negotiating',
        technicianId: auth.currentUser.uid,
        technicianName: techName,
        negotiationStartedAt: new Date(),
      });

      // Navigate to chat screen
      router.push({
        pathname: '/screens/ChatScreen',
        params: { requestId }
      });
    } catch (error) {
      console.error('Error starting negotiation:', error);
      Alert.alert('Error', 'Failed to start negotiation. Please try again.');
    }
  };

  const handleDenyRequest = async (requestId) => {
    try {
      const techName = await getTechnicianName();
      const requestRef = doc(db, 'repairRequests', requestId);
      await updateDoc(requestRef, {
        status: 'Denied',
        technicianId: auth.currentUser.uid,
        technicianName: techName,
        deniedAt: new Date(),
      });

      Alert.alert('Success', 'Request denied successfully');
      fetchRequests();
    } catch (error) {
      console.error('Error denying request:', error);
      Alert.alert('Error', 'Failed to deny request. Please try again.');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const requestRef = doc(db, 'repairRequests', requestId);
      
      // Check if request is already accepted to prevent duplicates
      const requestSnap = await getDoc(requestRef);
      const requestData = requestSnap.data();
      
      if (requestData.status === 'Accepted') {
        Alert.alert('Info', 'This request is already accepted');
        return;
      }
      
      // Get technician name
      const techName = await getTechnicianName();
      
      // Update the request status to Accepted
      await updateDoc(requestRef, {
        status: 'Accepted',
        technicianId: auth.currentUser.uid,
        technicianName: techName,
        acceptedAt: new Date(),
        acceptNotificationSent: true
      });

      // Only send notification if not already sent
      if (!requestData.acceptNotificationSent) {
        // Add notification in notifications collection
        await addDoc(collection(db, 'notifications'), {
          userId: requestData.customerId,
          title: 'Request Accepted',
          message: `Your repair request for ${requestData.deviceType} has been accepted by a technician.`,
          read: false,
          createdAt: new Date(),
          type: 'request_accepted',
          requestId: requestId
        });
      }

      Alert.alert('Success', 'Request accepted successfully');
      fetchRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    }
  };

  const handleAcceptServiceRequest = async (requestId) => {
    try {
      const requestRef = doc(db, 'repairRequests', requestId);
      
      // Check if already accepted
      const requestSnap = await getDoc(requestRef);
      const requestData = requestSnap.data();
      
      if (requestData.status === 'Accepted') {
        Alert.alert('Info', 'This service request is already accepted');
        return;
      }
      
      // Get technician name
      const techName = await getTechnicianName();
      
      // Update status
      await updateDoc(requestRef, {
        status: 'Accepted',
        technicianId: auth.currentUser.uid,
        technicianName: techName,
        acceptedAt: new Date(),
        acceptNotificationSent: true
      });

      // Only send notification if not already sent
      if (!requestData.acceptNotificationSent) {
        // Add notification in notifications collection
        await addDoc(collection(db, 'notifications'), {
          userId: requestData.customerId,
          title: 'Service Request Accepted',
          message: `Your service request for ${requestData.deviceType} has been accepted by the technician.`,
          read: false,
          createdAt: new Date(),
          type: 'service_request_accepted',
          requestId: requestId
        });
      }

      Alert.alert('Success', 'Service request accepted successfully');
      fetchRequests();
    } catch (error) {
      console.error('Error accepting service request:', error);
      Alert.alert('Error', 'Failed to accept service request. Please try again.');
    }
  };

  const handleDeclineServiceRequest = async (requestId) => {
    try {
      const techName = await getTechnicianName();
      const requestRef = doc(db, 'repairRequests', requestId);
      await updateDoc(requestRef, {
        status: 'Declined',
        technicianId: auth.currentUser.uid,
        technicianName: techName,
        declinedAt: new Date(),
      });

      Alert.alert('Success', 'Service request declined successfully');
      fetchRequests();
    } catch (error) {
      console.error('Error declining service request:', error);
      Alert.alert('Error', 'Failed to decline service request. Please try again.');
    }
  };

  const handleStartRepair = async (requestId) => {
    try {
      const requestRef = doc(db, 'repairRequests', requestId);
      
      // Check if already in progress to prevent duplicate actions
      const requestSnap = await getDoc(requestRef);
      const requestData = requestSnap.data();
      
      if (requestData.status === 'In Progress') {
        Alert.alert('Info', 'This repair is already in progress');
        return;
      }
      
      // First, create a system message
      const messagesRef = collection(db, 'repairRequests', requestId, 'messages');
      await addDoc(messagesRef, {
        text: "🔧 Technician has started the repair process.",
        senderId: 'system',
        senderName: 'System',
        senderRole: 'system',
        timestamp: new Date(),
        isSystemMessage: true
      });
      
      // Then update the request status
      await updateDoc(requestRef, {
        status: 'In Progress',
        repairStartedAt: new Date(),
        // Add a flag to track if notification was sent
        notificationSent: true
      });
      
      // Only create notification if not already sent
      if (!requestData.notificationSent) {
        // Send notification to customer (only once)
        await addDoc(collection(db, 'notifications'), {
          userId: requestData.customerId,
          title: 'Repair Started',
          message: `Repair work has begun on your ${requestData.deviceType}.`,
          read: false,
          createdAt: new Date(),
          type: 'repair_started',
          requestId: requestId
        });
      }

      Alert.alert('Success', 'Repair marked as in progress');
      fetchRequests();
    } catch (error) {
      console.error('Error starting repair:', error);
      Alert.alert('Error', 'Failed to update repair status. Please try again.');
    }
  };

  const handleCompleteRepair = (item) => {
    setCurrentRequest(item);
    // Pre-fill the final price with agreed price if available
    setFinalPrice(item.agreedPrice ? item.agreedPrice.toString() : '');
    setCompletionNotes('');
    setRepairDuration('');
    setCompletionModalVisible(true);
  };

  const submitRepairCompletion = async () => {
    if (!finalPrice || isNaN(parseFloat(finalPrice))) {
      Alert.alert('Error', 'Please enter a valid final price');
      return;
    }
    
    try {
      const requestRef = doc(db, 'repairRequests', currentRequest.id);
      
      // Check if repair is already completed to prevent duplicate notifications
      if (currentRequest.status === 'Completed') {
        Alert.alert('Already Completed', 'This repair has already been marked as completed.');
        setCompletionModalVisible(false);
        return;
      }
      
      // Check if a completion notification has already been sent
      if (currentRequest.completionNotificationSent) {
        Alert.alert('Notice', 'A completion notification has already been sent to the customer.');
      }
      
      // Create system message
      await addDoc(collection(db, 'messages'), {
        requestId: currentRequest.id,
        text: `Repair has been completed! Final price: $${finalPrice}`,
        senderId: 'system',
        timestamp: serverTimestamp(),
        systemMessage: true
      });
      
      // Update the request with all required fields for payment processing
      await updateDoc(requestRef, {
        status: 'Completed',
        completedAt: serverTimestamp(),
        completionNotes: completionNotes,
        repairDuration: repairDuration ? parseFloat(repairDuration) : null,
        finalPrice: parseFloat(finalPrice),
        agreedPrice: parseFloat(finalPrice), // Ensure the agreed price matches the final price
        completionNotificationSent: true,
        paymentCompleted: false, // Explicitly set payment status to false
        paymentRequired: true, // Flag to indicate payment is needed
        lastUpdatedAt: serverTimestamp() // Update the timestamp for reactive components
      });
      
      // Send notification to customer if not already sent
      if (!currentRequest.completionNotificationSent) {
        await addDoc(collection(db, 'notifications'), {
          userId: currentRequest.customerId,
          title: 'Repair Completed',
          message: `Your ${currentRequest.deviceType} repair has been completed! Please review and complete payment.`,
          read: false,
          createdAt: serverTimestamp(),
          type: 'repair_completed',
          requestId: currentRequest.id
        });
      }
      
      setCompletionModalVisible(false);
      Alert.alert(
        'Success',
        'Repair has been marked as completed. The customer will be notified for payment.',
        [{ text: 'OK' }]
      );
      
      // Refresh the list
      fetchRequests();
      
    } catch (error) {
      console.error('Error completing repair:', error);
      Alert.alert('Error', 'Failed to complete the repair. Please try again.');
    }
  };

  const handleUpdateProgress = async () => {
    try {
      if (!selectedRequest) {
        Alert.alert('Error', 'No request selected');
        return;
      }

      if (!progressUpdate.trim()) {
        Alert.alert('Error', 'Please provide a progress update description');
        return;
      }

      const requestRef = doc(db, 'repairRequests', selectedRequest.id);
      
      // Create a new progress update entry using a regular Date object instead of serverTimestamp
      const newUpdate = {
        percentage: progressPercentage,
        text: progressUpdate,
        timestamp: new Date() // Use regular Date object instead of serverTimestamp()
      };
      
      // Update the request with new progress info
      await updateDoc(requestRef, {
        progressPercentage: progressPercentage,
        lastUpdatedAt: serverTimestamp(), // This is fine since it's not in an array
        progressUpdates: Array.isArray(selectedRequest.progressUpdates) 
          ? [...selectedRequest.progressUpdates, newUpdate] 
          : [newUpdate]
      });
      
      // Send notification to customer
      await addDoc(collection(db, 'notifications'), {
        userId: selectedRequest.customerId,
        title: 'Repair Progress Update',
        message: `Your ${selectedRequest.deviceType} repair is ${progressPercentage}% complete.`,
        read: false,
        createdAt: serverTimestamp(),
        type: 'repair_progress',
        requestId: selectedRequest.id
      });

      // Close modal and reset form
      setShowProgressModal(false);
      setProgressUpdate('');
      
      // Show success message
      Alert.alert('Success', 'Progress has been updated successfully');
      
      // Refresh the requests list
      fetchRequests();
      
    } catch (error) {
      console.error('Error updating progress:', error);
      Alert.alert('Error', 'Failed to update progress. Please try again.');
    }
  };
  
  const navigateToChat = (requestId) => {
    router.push({
      pathname: '/screens/ChatScreen',
      params: { requestId: requestId }
    });
  };

  const openProgressModal = (item) => {
    setSelectedRequest(item);
    setProgressPercentage(item.progressPercentage || 50);
    setShowProgressModal(true);
    
    // Focus the text input after the modal is visible
    setTimeout(() => {
      if (progressUpdateRef.current) {
        progressUpdateRef.current.focus();
      }
    }, 100);
  };

  const openCompletionModal = (item) => {
    setSelectedRequest(item);
    setCompletionNotes('');
    setShowCompletionModal(true);
    
    // Focus the text input after the modal is visible
    setTimeout(() => {
      if (completionNotesRef.current) {
        completionNotesRef.current.focus();
      }
    }, 100);
  };

  const renderProgressModal = () => (
    <Modal
      visible={showProgressModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowProgressModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContentWrapper}>
          <Text style={styles.modalTitle}>Update Repair Progress</Text>
          
          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Progress Percentage ({progressPercentage}%)</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={progressPercentage}
                onValueChange={setProgressPercentage}
                minimumTrackTintColor="#4a6ee0"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#4a6ee0"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>0%</Text>
                <Text style={styles.sliderLabel}>50%</Text>
                <Text style={styles.sliderLabel}>100%</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Progress Update</Text>
            <TextInput
              ref={progressUpdateRef}
              style={styles.progressInput}
              placeholder="Describe what you've done or what's left to do..."
              value={progressUpdate}
              onChangeText={setProgressUpdate}
              multiline
              numberOfLines={4}
            />
          </View>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setShowProgressModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalSubmitButton]}
              onPress={handleUpdateProgress}
            >
              <Text style={styles.modalSubmitText}>Update Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderCompletionModal = () => (
    <Modal
      visible={completionModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setCompletionModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContentWrapper}>
          <Text style={styles.modalTitle}>Complete Repair</Text>
          
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Final Price ($):</Text>
            <TextInput
              style={styles.modalInput}
              value={finalPrice}
              onChangeText={setFinalPrice}
              keyboardType="numeric"
              placeholder="Enter final price"
            />
          </View>
          
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Repair Duration (hours):</Text>
            <TextInput
              style={styles.modalInput}
              value={repairDuration}
              onChangeText={setRepairDuration}
              keyboardType="numeric"
              placeholder="Enter repair duration in hours"
            />
          </View>
          
          <View style={styles.modalSection}>  
            <Text style={styles.modalLabel}>Completion Notes:</Text>
            <TextInput
              style={styles.modalTextArea}
              value={completionNotes}
              onChangeText={setCompletionNotes}
              placeholder="Describe what you fixed and any other notes"
              multiline
              numberOfLines={4}
            />
          </View>
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setCompletionModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalSubmitButton]}
              onPress={submitRepairCompletion}
            >
              <Text style={styles.modalSubmitText}>Complete Repair</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderProgressUpdates = (item) => {
    if (!item.progressUpdates || item.progressUpdates.length === 0) {
      return <Text style={styles.noUpdatesText}>No progress updates yet</Text>;
    }

    // Sort updates by timestamp (newest first)
    const sortedUpdates = [...item.progressUpdates].sort((a, b) => 
      b.timestamp.toDate() - a.timestamp.toDate()
    );

    return (
      <View style={styles.progressUpdatesContainer}>
        {sortedUpdates.map((update, index) => (
          <View key={index} style={styles.progressUpdate}>
            <View style={styles.progressUpdateHeader}>
              <Text style={styles.progressUpdateTimestamp}>
                {update.timestamp.toDate().toLocaleString()}
              </Text>
              <View style={styles.progressPercentageBadge}>
                <Text style={styles.progressPercentageText}>{update.percentage}%</Text>
              </View>
            </View>
            <Text style={styles.progressUpdateText}>{update.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderRequestItem = ({ item }) => (
    <View style={[
      styles.requestCard,
      item.emergency && styles.emergencyCard
    ]}>
      <View style={styles.requestHeader}>
        <View>
          <Text style={styles.deviceType}>{item.deviceType}</Text>
          <Text style={styles.customerName}>Customer: {item.customerName}</Text>
        </View>
        {item.emergency && (
          <View style={styles.emergencyBadge}>
            <Ionicons name="warning" size={16} color="#fff" />
            <Text style={styles.emergencyText}>Emergency</Text>
          </View>
        )}
        
        {/* Payment status badges */}
        {item.status === 'Completed' && !item.paymentCompleted && (
          <View style={styles.paymentPendingBadge}>
            <Ionicons name="time-outline" size={14} color="#f57c00" />
            <Text style={styles.paymentPendingText}>Payment Pending</Text>
          </View>
        )}
        
        {item.status === 'Paid' && (
          <View style={styles.paymentCompletedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#4caf50" />
            <Text style={styles.paymentCompletedText}>Payment Received</Text>
          </View>
        )}
      </View>

      <Text style={styles.description}>{item.description}</Text>
      
      <View style={styles.locationContainer}>
        <Ionicons name="location" size={16} color="#666" />
        <Text style={styles.locationText}>{item.location?.address || 'Location not specified'}</Text>
      </View>

      <View style={styles.timestampContainer}>
        <Ionicons name="time" size={16} color="#666" />
        <Text style={styles.timestamp}>
          {item.createdAt?.toDate().toLocaleString() || 'Date not available'}
        </Text>
      </View>

      {item.agreedPrice && (
        <View style={styles.priceContainer}>
          <Ionicons name="cash" size={16} color="#4caf50" />
          <Text style={styles.priceText}>
            Agreed Price: ${item.agreedPrice}
          </Text>
        </View>
      )}
      
      {/* Progress information for in-progress repairs */}
      {selectedTab === 'inProgress' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${item.progressPercentage || 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {item.progressPercentage || 0}% Complete
          </Text>
          
          {/* Display last updated time if available */}
          {item.lastUpdatedAt && (
            <Text style={styles.lastUpdateText}>
              Last updated: {item.lastUpdatedAt.toDate().toLocaleString()}
            </Text>
          )}
          
          {/* Progress updates section */}
          {item.progressUpdates && item.progressUpdates.length > 0 && (
            <View style={styles.progressDetailsContainer}>
              <Text style={styles.progressDetailsTitle}>Progress Updates:</Text>
              {renderProgressUpdates(item)}
            </View>
          )}
        </View>
      )}

      {selectedTab === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptRequest(item.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.negotiateButton]}
            onPress={() => handleStartNegotiation(item.id)}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Chat Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDenyRequest(item.id)}
          >
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Deny</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {selectedTab === 'negotiating' && (
        <View style={styles.actionButtons}>
          {item.approvedByCustomer && (
            <View style={styles.approvedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
              <Text style={styles.approvedText}>Approved by Customer</Text>
            </View>
          )}
          <TouchableOpacity 
            style={[styles.actionButton, styles.negotiateButton]}
            onPress={() => handleStartNegotiation(item.id)}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Continue Chat</Text>
          </TouchableOpacity>
          
          {item.approvedByCustomer && (
            <TouchableOpacity
              style={[styles.actionButton, styles.inProgressButton]}
              onPress={() => handleStartRepair(item.id)}
            >
              <Ionicons name="construct" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Start Repair</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {selectedTab === 'service' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptServiceRequest(item.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDeclineServiceRequest(item.id)}
          >
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {selectedTab === 'accepted' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.inProgressButton]}
            onPress={() => handleStartRepair(item.id)}
          >
            <Ionicons name="construct" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Start Repair</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.negotiateButton]}
            onPress={() => handleStartNegotiation(item.id)}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Chat Customer</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedTab === 'inProgress' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.updateButton]}
            onPress={() => openProgressModal(item)}
          >
            <Ionicons name="refresh-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Update Progress</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleCompleteRepair(item)}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Mark Completed</Text>
          </TouchableOpacity>
         
          <TouchableOpacity 
            style={[styles.actionButton, styles.negotiateButton]}
            onPress={() => handleStartNegotiation(item.id)}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Chat Customer</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {selectedTab === 'completed' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.negotiateButton]}
            onPress={() => handleStartNegotiation(item.id)}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Chat Customer</Text>
          </TouchableOpacity>
          
          {item.status === 'Completed' && !item.paymentCompleted && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.confirmPaymentButton]}
              onPress={() => openCashPaymentModal(item)}
            >
              <Ionicons name="cash" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Confirm Cash Payment</Text>
            </TouchableOpacity>
          )}
          
          {item.status === 'Paid' && !item.fundsCollected && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.collectButton]}
              onPress={() => handleCollectFunds(item)}
            >
              <Ionicons name="cash" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Collect Funds</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const handleCollectFunds = async (request) => {
    try {
      // Update the repair request to mark funds as collected
      const requestRef = doc(db, 'repairRequests', request.id);
      await updateDoc(requestRef, {
        fundsCollected: true,
        fundsCollectedAt: serverTimestamp()
      });
      
      // Create a notification for the technician
      await addDoc(collection(db, 'notifications'), {
        userId: auth.currentUser.uid,
        title: 'Funds Collected',
        message: `You have collected the payment for ${request.deviceType} repair.`,
        read: false,
        createdAt: serverTimestamp(),
        type: 'funds_collected',
        requestId: request.id
      });
      
      Alert.alert(
        'Success',
        'Funds have been collected and transferred to your account.',
        [{ text: 'OK' }]
      );
      
      // Refresh the list
      fetchRequests();
      
    } catch (error) {
      console.error('Error collecting funds:', error);
      Alert.alert('Error', 'Failed to collect funds. Please try again.');
    }
  };

  const handleConfirmCashPayment = async () => {
    try {
      if (!cashPaymentRequest) {
        Alert.alert('Error', 'No request selected');
        return;
      }

      setLoading(true);
      
      // Get technician name
      const techName = await getTechnicianName();
      
      // Create a transaction document
      const transactionData = {
        requestId: cashPaymentRequest.id,
        customerId: cashPaymentRequest.customerId,
        technicianId: auth.currentUser.uid,
        amount: cashPaymentRequest.agreedPrice,
        paymentMethod: 'cash',
        status: 'Completed',
        createdAt: serverTimestamp(),
        repairType: cashPaymentRequest.deviceType,
        description: cashPaymentRequest.description,
        paymentDetails: {
          method: 'Cash on Hand',
          collectedByTechnician: true
        },
      };
      
      // Add transaction to Firestore
      const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update request status
      await updateDoc(doc(db, 'repairRequests', cashPaymentRequest.id), {
        status: 'Paid',
        paymentCompleted: true,
        paymentDate: serverTimestamp(),
        transactionId: transactionRef.id
      });
      
      // Create an invoice
      const invoiceData = {
        transactionId: transactionRef.id,
        requestId: cashPaymentRequest.id,
        customerId: cashPaymentRequest.customerId,
        customerName: cashPaymentRequest.customerName,
        technicianId: auth.currentUser.uid,
        technicianName: techName,
        amount: cashPaymentRequest.agreedPrice,
        paymentMethod: 'cash',
        deviceType: cashPaymentRequest.deviceType,
        description: cashPaymentRequest.description,
        completionNotes: cashPaymentRequest.completionNotes,
        createdAt: serverTimestamp(),
        paidAt: serverTimestamp(),
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      };
      
      const invoiceRef = await addDoc(collection(db, 'invoices'), invoiceData);
      
      // Add notification for customer
      await addDoc(collection(db, 'notifications'), {
        userId: cashPaymentRequest.customerId,
        title: 'Payment Confirmed',
        message: `Your cash payment of $${cashPaymentRequest.agreedPrice} for ${cashPaymentRequest.deviceType} repair has been confirmed.`,
        read: false,
        createdAt: serverTimestamp(),
        type: 'payment_confirmed',
        requestId: cashPaymentRequest.id
      });
      
      Alert.alert('Success', 'Cash payment has been confirmed and recorded.');
      setShowCashPaymentModal(false);
      setCashPaymentRequest(null);
      fetchRequests();
    } catch (error) {
      console.error('Error confirming cash payment:', error);
      Alert.alert('Error', 'Failed to confirm payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openCashPaymentModal = (request) => {
    setCashPaymentRequest(request);
    setShowCashPaymentModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e88e5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Repair Requests</Text>
      </View>
      
      <View style={styles.tabBarContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContainer}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'pending' && styles.activeTab
            ]}
            onPress={() => setSelectedTab('pending')}
          >
            <Text style={[
              styles.tabText,
              selectedTab === 'pending' && styles.activeTabText
            ]}>New</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'negotiating' && styles.activeTab
            ]}
            onPress={() => setSelectedTab('negotiating')}
          >
            <Text style={[
              styles.tabText,
              selectedTab === 'negotiating' && styles.activeTabText
            ]}>Negotiating</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'service' && styles.activeTab
            ]}
            onPress={() => setSelectedTab('service')}
          >
            <Text style={[
              styles.tabText,
              selectedTab === 'service' && styles.activeTabText
            ]}>Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'accepted' && styles.activeTab
            ]}
            onPress={() => setSelectedTab('accepted')}
          >
            <Text style={[
              styles.tabText,
              selectedTab === 'accepted' && styles.activeTabText
            ]}>Accepted</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'inProgress' && styles.activeTab
            ]}
            onPress={() => setSelectedTab('inProgress')}
          >
            <Text style={[
              styles.tabText,
              selectedTab === 'inProgress' && styles.activeTabText
            ]}>In Progress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'completed' && styles.activeTab
            ]}
            onPress={() => setSelectedTab('completed')}
          >
            <Text style={[
              styles.tabText,
              selectedTab === 'completed' && styles.activeTabText
            ]}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.selectedTabLabel}>
        <Text style={styles.selectedTabText}>
          {selectedTab === 'pending' ? 'New Requests' :
           selectedTab === 'negotiating' ? 'Negotiating Requests' :
           selectedTab === 'service' ? 'Service Requests' :
           selectedTab === 'accepted' ? 'Accepted Requests' :
           selectedTab === 'inProgress' ? 'In Progress Requests' :
           'Completed Requests'}
        </Text>
      </View>

      {loading && requests.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e88e5" />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          onEndReached={loadMoreRequests}
          onEndReachedThreshold={0.3}
          ListFooterComponent={() => 
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#1e88e5" />
                <Text style={styles.footerText}>Loading more...</Text>
              </View>
            ) : !hasMoreRequests && requests.length > 0 ? (
              <Text style={styles.endOfListText}>No more requests</Text>
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No {selectedTab === 'pending' ? 'new' : 
                   selectedTab === 'negotiating' ? 'negotiating' :
                   selectedTab === 'service' ? 'service' :
                   selectedTab === 'accepted' ? 'accepted' :
                   selectedTab === 'inProgress' ? 'in progress' : 'completed'} requests found
              </Text>
            </View>
          )}
        />
      )}

      {renderProgressModal()}
      {renderCompletionModal()}

      {/* Cash Payment Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCashPaymentModal}
        onRequestClose={() => setShowCashPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Payment</Text>
              <TouchableOpacity
                onPress={() => setShowCashPaymentModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <Text style={styles.cashPaymentDetails}>
                Confirm cash payment received:
              </Text>
              
              {cashPaymentRequest && (
                <View style={styles.paymentInfoCard}>
                  <View style={styles.paymentInfoRow}>
                    <Text style={styles.paymentInfoLabel}>Device:</Text>
                    <Text style={styles.paymentInfoValue}>{cashPaymentRequest.deviceType}</Text>
                  </View>
                  <View style={styles.paymentInfoRow}>
                    <Text style={styles.paymentInfoLabel}>Customer:</Text>
                    <Text style={styles.paymentInfoValue}>{cashPaymentRequest.customerName}</Text>
                  </View>
                  <View style={styles.paymentInfoRow}>
                    <Text style={styles.paymentInfoLabel}>Amount:</Text>
                    <Text style={styles.paymentInfoValue}>${cashPaymentRequest.agreedPrice}</Text>
                  </View>
                </View>
              )}
              
              <View style={styles.noteContainer}>
                <Ionicons name="information-circle" size={20} color="#ffa000" />
                <Text style={styles.noteText}>
                  This confirms you've received the full cash payment.
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCashPaymentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmCashPayment}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 16,
    paddingHorizontal: 20,
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
  tabBarContainer: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabScrollContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 6,
    backgroundColor: '#f0f0f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  activeTab: {
    backgroundColor: '#1e88e5',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emergencyCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  deviceType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 6,
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emergencyText: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 15,
    color: '#555',
    marginLeft: 8,
    flex: 1,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timestamp: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f1f8e9',
    borderRadius: 10,
  },
  priceText: {
    fontSize: 16,
    color: '#4caf50',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  progressContainer: {
    marginTop: 15,
    marginBottom: 20,
    backgroundColor: '#f8f9fc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eaedf5',
  },
  lastUpdateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  progressDetailsContainer: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#eaedf5',
    paddingTop: 14,
  },
  progressDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  progressUpdatesContainer: {
    marginBottom: 12,
  },
  progressUpdate: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#eaedf5',
  },
  progressUpdateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressUpdateTimestamp: {
    fontSize: 13,
    color: '#999',
  },
  progressPercentageBadge: {
    backgroundColor: '#eef3fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  progressPercentageText: {
    fontSize: 13,
    color: '#4a6ee0',
    fontWeight: 'bold',
  },
  progressUpdateText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 20,
  },
  noUpdatesText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 10,
  },
  inProgressButton: {
    backgroundColor: '#f6a035',
  },
  declineButton: {
    backgroundColor: '#f44336',
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecf8f3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1eee1',
  },
  approvedText: {
    fontSize: 14,
    color: '#2a9d8f',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  collectButton: {
    backgroundColor: '#2a9d8f',
  },
  selectedTabLabel: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedTabText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentWrapper: {
    backgroundColor: '#f0f4f8',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modalSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e3e8f0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 0,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4a6ee0',
  },
  modalInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#333',
  },
  modalTextArea: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 24,
    minHeight: 120,
    textAlignVertical: 'top',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: '#f1f3f5',
  },
  confirmButton: {
    backgroundColor: '#4a6ee0',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5e6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  paymentPendingText: {
    fontSize: 12,
    color: '#f6a035',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  paymentCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecf8f3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1eee1',
  },
  paymentCompletedText: {
    fontSize: 12,
    color: '#2a9d8f',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  sliderContainer: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  progressInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 0,
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalCancelButton: {
    backgroundColor: '#f1f3f5',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  modalSubmitButton: {
    backgroundColor: '#4a6ee0',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4a6ee0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentInfoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  paymentInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cashPaymentDetails: {
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4a6ee0',
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  acceptButton: {
    backgroundColor: '#4a6ee0',
  },
  negotiateButton: {
    backgroundColor: '#0092cc',
  },
  updateButton: {
    backgroundColor: '#f6a035',
  },
  completeButton: {
    backgroundColor: '#6a42bd',
  },
  confirmPaymentButton: {
    backgroundColor: '#2a9d8f',
  },
  modalContent: {
    padding: 16,
    maxHeight: 300,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    margin: 4,
  },
  paymentInfoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  paymentInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cashPaymentDetails: {
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4a6ee0',
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  footerLoader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  endOfListText: {
    textAlign: 'center',
    padding: 16,
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 