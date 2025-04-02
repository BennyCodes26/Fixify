import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  StatusBar,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';
import * as Location from 'expo-location';

const TechnicianRequestForm = () => {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If we're on the request form, go back to dashboard
      router.replace('/technicianDashboard');
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      // Get technician's location first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Location permission is required to view nearby requests');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);

      const technicianId = auth.currentUser.uid;

      // Query for requests within 10km radius
      const requestsRef = collection(db, 'serviceRequests');
      const q = query(
        requestsRef,
        where('status', '==', 'pending')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter requests within 10km radius and not denied by this technician
        const nearbyRequests = requestsData.filter(request => {
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            request.location.latitude,
            request.location.longitude
          );
          
          // Check if this request has been denied by this technician
          const deniedBy = request.deniedBy || [];
          const isDeniedByTechnician = deniedBy.includes(technicianId);
          
          return distance <= 10 && !isDeniedByTechnician; // 10km radius and not denied by this technician
        });

        // Sort by emergency status and distance
        nearbyRequests.sort((a, b) => {
          if (a.isEmergency && !b.isEmergency) return -1;
          if (!a.isEmergency && b.isEmergency) return 1;
          
          const distanceA = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            a.location.latitude,
            a.location.longitude
          );
          const distanceB = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            b.location.latitude,
            b.location.longitude
          );
          
          return distanceA - distanceB;
        });

        setRequests(nearbyRequests);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('Error', 'Failed to fetch requests');
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleCheckRequest = (request) => {
    Alert.alert(
      "Service Request Details",
      `Device: ${request.deviceType}\n\nDescription: ${request.description}`,
      [
        {
          text: "Deny",
          onPress: () => handleDenyRequest(request.id),
          style: "destructive"
        },
        {
          text: "Contact Customer",
          onPress: () => handleContactCustomer(request.contactNumber)
        },
        {
          text: "Back",
          style: "cancel"
        }
      ],
      { cancelable: true }
    );
  };

  const handleDenyRequest = async (requestId) => {
    try {
      const technicianId = auth.currentUser.uid;
      const requestRef = doc(db, 'serviceRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      const requestData = requestDoc.data();
      
      // Get current deniedBy array or initialize empty array
      const deniedBy = requestData.deniedBy || [];
      
      // Add current technician to deniedBy array
      deniedBy.push(technicianId);
      
      // Update the request with new deniedBy array
      await updateDoc(requestRef, {
        deniedBy: deniedBy
      });
      
      Alert.alert('Success', 'Request denied successfully');
    } catch (error) {
      console.error('Error denying request:', error);
      Alert.alert('Error', 'Failed to deny request');
    }
  };

  const handleContactCustomer = (contactNumber) => {
    Alert.alert(
      'Contact Customer',
      `Would you like to contact this customer?\nPhone: ${contactNumber}`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Call',
          onPress: () => {
            // Implement phone call functionality
            console.log('Calling customer:', contactNumber);
          }
        }
      ]
    );
  };

  const renderRequestItem = ({ item }) => {
    const distance = location ? calculateDistance(
      location.coords.latitude,
      location.coords.longitude,
      item.location.latitude,
      item.location.longitude
    ) : 0;

    // Get first name from full name, handle cases where name might be undefined
    const firstName = item.customerName ? item.customerName.split(' ')[0] : 'Customer';

    return (
      <View style={[
        styles.requestItem,
        item.isEmergency && styles.emergencyRequest
      ]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={styles.customerName}>{firstName}</Text>
            <Text style={styles.distance}>{distance.toFixed(1)} km away</Text>
          </View>
          <View style={styles.checkButtonContainer}>
            <TouchableOpacity
              style={styles.checkButton}
              onPress={() => handleCheckRequest(item)}
            >
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.deviceType}>{item.deviceType}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.replace('/technicianDashboard')}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Requests</Text>
      </View>

      {/* Main Content */}
      <FlatList
        data={requests}
        renderItem={renderRequestItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            {loading ? 'Loading requests...' : 'No pending requests nearby'}
          </Text>
        )}
      />
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
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 16,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  content: {
    padding: 12,
  },
  requestItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  requestInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  distance: {
    fontSize: 12,
    color: '#666',
  },
  deviceType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  checkButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  checkButton: {
    padding: 4,
  },
  emergencyRequest: {
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default TechnicianRequestForm; 