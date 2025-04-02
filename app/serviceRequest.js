import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { startChatFromServiceRequest, navigateToChat } from './utils/chatUtils';

export default function ServiceRequest() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams();
  const [requestData, setRequestData] = React.useState(null);

  const handleContactCustomer = async () => {
    try {
      const chatId = await startChatFromServiceRequest(requestData.customerId);
      navigateToChat(router, chatId);
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  const handleAcceptRequest = async () => {
    try {
      const requestRef = doc(db, 'serviceRequests', requestId);
      await updateDoc(requestRef, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: auth.currentUser.uid
      });

      Alert.alert('Success', 'Service request accepted successfully');
      router.back();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ... existing code ... */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.button, styles.acceptButton]}
          onPress={handleAcceptRequest}
        >
          <Ionicons name="checkmark-circle" size={24} color="white" />
          <Text style={styles.buttonText}>Accept Request</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.contactButton]}
          onPress={handleContactCustomer}
        >
          <Ionicons name="chatbubble" size={24} color="white" />
          <Text style={styles.buttonText}>Contact Customer</Text>
        </TouchableOpacity>
      </View>
      {/* ... existing code ... */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  contactButton: {
    backgroundColor: '#1e88e5',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
}); 