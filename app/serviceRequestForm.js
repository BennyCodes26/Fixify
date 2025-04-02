import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import * as Location from 'expo-location';

const ServiceRequestForm = () => {
  const router = useRouter();
  const [deviceType, setDeviceType] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const submitRequest = async (isEmergency = false) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please log in to submit a request');
        return;
      }

      // Get customer's profile data from users collection
      const customerDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!customerDoc.exists()) {
        console.error('Customer document not found for user:', user.uid);
        Alert.alert('Error', 'Customer profile not found. Please try again.');
        return;
      }

      const customerData = customerDoc.data();
      console.log('Customer data:', customerData); // Debug log

      // Check if required fields are present
      if (!customerData || !customerData.name) {
        console.error('Missing customer data:', customerData);
        Alert.alert('Error', 'Profile data is incomplete. Please update your profile.');
        return;
      }

      // Get user's location
      const location = await Location.getCurrentPositionAsync({});
      
      // Create request object
      const requestData = {
        customerId: user.uid,
        customerName: customerData.name,
        customerPhone: customerData.phone || '',
        deviceType,
        description,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        },
        isEmergency,
        status: 'pending',
        createdAt: serverTimestamp(),
        contactNumber: customerData.phone || '',
        deniedBy: []
      };

      // Add to Firestore
      await addDoc(collection(db, 'serviceRequests'), requestData);

      Alert.alert(
        'Success',
        `Your ${isEmergency ? 'emergency ' : ''}request has been submitted successfully!`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/customerDashboard')
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    }
  };

  const handleSubmit = () => {
    submitRequest(false);
  };

  const handleEmergencyRequest = () => {
    Alert.alert(
      'Emergency Request',
      'This is an emergency request. It will cost more than a regular request and will notify technicians of the urgent nature of your request. Do you want to proceed?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'OK',
          onPress: () => submitRequest(true)
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Request</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Electronics/Appliance Type</Text>
          <TextInput
            style={styles.input}
            value={deviceType}
            onChangeText={setDeviceType}
            placeholder="Enter device type"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue"
            placeholderTextColor="#666"
            multiline
            numberOfLines={6}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.disabledButton]} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Send a Request'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.emergencyButton, isSubmitting && styles.disabledButton]}
            onPress={handleEmergencyRequest}
            disabled={isSubmitting}
          >
            <Text style={styles.emergencyButtonText}>Emergency Request</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.replace('/customerDashboard')}
        >
          <Ionicons name="home-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.replace('/customerTransactionHistory')}
        >
          <Ionicons name="card-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.replace('/customerMessaging')}
        >
          <Ionicons name="chatbubble-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.replace('/customerProfile')}
        >
          <Ionicons name="person-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e88e5',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 20,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  content: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  descriptionInput: {
    height: 150,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#1e88e5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emergencyButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f44336',
  },
  emergencyButtonText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#1e88e5',
    height: 65,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  navButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default ServiceRequestForm; 