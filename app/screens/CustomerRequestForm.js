import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { auth, db } from '../../config/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
} from 'firebase/firestore';

export default function CustomerRequestForm() {
  const params = useLocalSearchParams();
  const { requestId } = params;
  const [deviceType, setDeviceType] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [negotiationPrice, setNegotiationPrice] = useState('');
  const [currentRequest, setCurrentRequest] = useState(null);
  const [viewMode, setViewMode] = useState(false);

  useEffect(() => {
    if (requestId) {
      // If requestId exists, we're viewing an existing request
      setViewMode(true);
      fetchRequestDetails(requestId);
    } else {
      // Otherwise, we're creating a new request
      getLocation();
    }
  }, [requestId]);

  const fetchRequestDetails = async (id) => {
    try {
      setLoading(true);
      const requestDoc = await getDoc(doc(db, 'repairRequests', id));
      
      if (requestDoc.exists()) {
        const data = requestDoc.data();
        setCurrentRequest({ id, ...data });
        
        // Also set form fields with existing data
        setDeviceType(data.deviceType || '');
        setDescription(data.description || '');
        setLocation(data.location || null);
        setAddress(data.address || '');
        
        // Set negotiation state if applicable
        if (data.status === 'Negotiating') {
          setNegotiating(true);
          setNegotiationPrice(data.agreedPrice ? data.agreedPrice.toString() : '');
        }
      } else {
        Alert.alert('Error', 'Request not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
      Alert.alert('Error', 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const getLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to submit a request.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setAddress(
        `${address.street || ''} ${address.city || ''} ${address.region || ''} ${address.country || ''}`
      );
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!deviceType || !description) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location is required');
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to submit a request');
        return;
      }

      const requestData = {
        deviceType,
        description,
        location,
        address,
        customerId: user.uid,
        customerName: user.displayName || 'Anonymous',
        status: 'Pending',
        createdAt: new Date(),
        emergency: false,
      };

      const docRef = await addDoc(collection(db, 'repairRequests'), requestData);
      setCurrentRequest({ id: docRef.id, ...requestData });
      
      Alert.alert('Success', 'Request submitted successfully. Waiting for technician response.');
      router.back();
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencySubmit = async () => {
    if (!deviceType || !description) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location is required');
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to submit a request');
        return;
      }

      const requestData = {
        deviceType,
        description,
        location,
        address,
        customerId: user.uid,
        customerName: user.displayName || 'Anonymous',
        status: 'Pending',
        createdAt: new Date(),
        emergency: true,
      };

      const docRef = await addDoc(collection(db, 'repairRequests'), requestData);
      setCurrentRequest({ id: docRef.id, ...requestData });
      
      Alert.alert('Success', 'Emergency request submitted successfully. Waiting for technician response.');
      router.back();
    } catch (error) {
      console.error('Error submitting emergency request:', error);
      Alert.alert('Error', 'Failed to submit emergency request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendServiceRequest = async () => {
    if (!negotiationPrice) {
      Alert.alert('Error', 'Please enter the agreed price');
      return;
    }

    try {
      setLoading(true);
      const requestRef = doc(db, 'repairRequests', currentRequest.id);
      await updateDoc(requestRef, {
        status: 'ServiceRequest',
        agreedPrice: parseFloat(negotiationPrice),
        serviceRequestedAt: new Date(),
      });

      Alert.alert('Success', 'Service request sent to technician for approval');
      router.back();
    } catch (error) {
      console.error('Error sending service request:', error);
      Alert.alert('Error', 'Failed to send service request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e88e5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {viewMode ? 'Repair Request Details' : 'Submit Repair Request'}
        </Text>
      </View>

      {viewMode && currentRequest ? (
        // View mode UI
        <View style={styles.form}>
          <View style={styles.requestInfoCard}>
            <Text style={styles.requestInfoTitle}>{currentRequest.deviceType}</Text>
            <Text style={styles.requestInfoDescription}>{currentRequest.description}</Text>
            
            <View style={styles.statusContainer}>
              <Ionicons 
                name={
                  currentRequest.status === 'Pending' ? 'time-outline' :
                  currentRequest.status === 'Negotiating' ? 'chatbubbles-outline' :
                  currentRequest.status === 'Accepted' ? 'checkmark-circle-outline' :
                  currentRequest.status === 'In Progress' ? 'construct-outline' :
                  currentRequest.status === 'Completed' ? 'trophy-outline' :
                  currentRequest.status === 'Paid' ? 'card-outline' :
                  'help-circle-outline'
                } 
                size={24} 
                color="#1e88e5" 
              />
              <Text style={styles.statusText}>{currentRequest.status}</Text>
            </View>
            
            {currentRequest.technicianName && (
              <View style={styles.technicianContainer}>
                <Text style={styles.technicianLabel}>Technician:</Text>
                <Text style={styles.technicianName}>{currentRequest.technicianName}</Text>
              </View>
            )}
          </View>
          
          {currentRequest.status === 'In Progress' && (
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Repair Progress</Text>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${currentRequest.progressPercentage || 0}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {currentRequest.progressPercentage || 0}% Complete
              </Text>
              
              {currentRequest.lastUpdatedAt && (
                <Text style={styles.lastUpdateText}>
                  Updated: {currentRequest.lastUpdatedAt.toDate().toLocaleString()}
                </Text>
              )}
              
              {currentRequest.progressUpdates && currentRequest.progressUpdates.length > 0 && (
                <View style={styles.progressUpdatesContainer}>
                  <Text style={styles.progressUpdatesTitle}>Progress Updates:</Text>
                  {currentRequest.progressUpdates
                    .sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate())
                    .map((update, index) => (
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
                    ))
                  }
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.messageButton}
                onPress={() => router.push({
                  pathname: '/screens/ChatScreen',
                  params: { requestId: currentRequest.id }
                })}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                <Text style={styles.messageButtonText}>Message Technician</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentRequest.status === 'Completed' && (
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Repair Details</Text>
              
              <View style={styles.completionDetails}>
                <View style={styles.completionRow}>
                  <Text style={styles.completionLabel}>Completed On:</Text>
                  <Text style={styles.completionValue}>
                    {currentRequest.completedAt?.toDate().toLocaleString() || 'Not available'}
                  </Text>
                </View>
                
                {currentRequest.repairDuration && (
                  <View style={styles.completionRow}>
                    <Text style={styles.completionLabel}>Repair Duration:</Text>
                    <Text style={styles.completionValue}>{currentRequest.repairDuration} hours</Text>
                  </View>
                )}

                {currentRequest.agreedPrice && (
                  <View style={styles.completionRow}>
                    <Text style={styles.completionLabel}>Agreed Price:</Text>
                    <Text style={styles.completionValue}>${currentRequest.agreedPrice}</Text>
                  </View>
                )}

                {currentRequest.completionNotes && (
                  <View style={styles.completionNotesContainer}>
                    <Text style={styles.completionLabel}>Technician Notes:</Text>
                    <Text style={styles.completionNotes}>{currentRequest.completionNotes}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          
          {currentRequest.status === 'Completed' && !currentRequest.paymentCompleted && (
            <View style={styles.paymentSection}>
              <Text style={styles.paymentTitle}>Payment Required</Text>
              <Text style={styles.paymentDescription}>
                Your repair has been completed! Please complete the payment to finish the process.
              </Text>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Total Amount:</Text>
                <Text style={styles.priceValue}>${currentRequest.agreedPrice || '0'}</Text>
              </View>
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={() => router.push({
                  pathname: '/screens/PaymentScreen',
                  params: { requestId: currentRequest.id }
                })}
              >
                <Ionicons name="card-outline" size={24} color="#FFFFFF" />
                <Text style={styles.payNowButtonText}>Pay Now</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {currentRequest.status === 'Completed' && currentRequest.paymentCompleted && (
            <View style={styles.paymentCompletedSection}>
              <View style={styles.paymentCompletedHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.paymentCompletedTitle}>Payment Completed</Text>
              </View>
              <Text style={styles.paymentCompletedDate}>
                Paid on: {currentRequest.paymentDate?.toDate().toLocaleDateString() || 'N/A'}
              </Text>
              <TouchableOpacity
                style={styles.viewInvoiceButton}
                onPress={() => router.push({
                  pathname: '/screens/InvoiceScreen',
                  params: { invoiceId: currentRequest.transactionId }
                })}
              >
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                <Text style={styles.viewInvoiceText}>View Invoice</Text>
              </TouchableOpacity>
              
              {!currentRequest.hasReview && (
                <View style={styles.rateRepairSection}>
                  <Text style={styles.rateRepairPrompt}>
                    How was your repair experience? Please take a moment to rate the technician's service.
                  </Text>
                  <TouchableOpacity
                    style={styles.rateRepairButton}
                    onPress={() => router.push({
                      pathname: '/screens/RatingScreen',
                      params: { requestId: currentRequest.id }
                    })}
                  >
                    <Ionicons name="star-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.rateRepairText}>Rate This Repair</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {currentRequest.hasReview && (
                <View style={styles.reviewCompletedSection}>
                  <View style={styles.reviewHeader}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.reviewCompletedText}>Review Submitted</Text>
                  </View>
                  <View style={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons 
                        key={star}
                        name={star <= currentRequest.rating ? "star" : "star-outline"} 
                        size={20} 
                        color="#FFD700" 
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        // Create mode UI (wrap all the creation UI in this else block)
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Device Type</Text>
            <TextInput
              style={styles.input}
              value={deviceType}
              onChangeText={setDeviceType}
              placeholder="e.g., Laptop, Phone, Tablet"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue in detail"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.locationContainer}>
            <Text style={styles.label}>Location</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#1e88e5" />
            ) : (
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={20} color="#666" />
                <Text style={styles.locationText}>
                  {address || 'Location not set'}
                </Text>
              </View>
            )}
          </View>

          {negotiating && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Agreed Price</Text>
              <TextInput
                style={styles.input}
                value={negotiationPrice}
                onChangeText={setNegotiationPrice}
                placeholder="Enter the agreed price"
                keyboardType="numeric"
              />
            </View>
          )}

          {!negotiating ? (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.regularButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Submit Regular Request</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.emergencyButton]}
                onPress={handleEmergencySubmit}
                disabled={loading}
              >
                <Ionicons name="warning" size={20} color="#fff" />
                <Text style={styles.buttonText}>Submit Emergency Request</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.serviceButton]}
                onPress={handleSendServiceRequest}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Send Service Request</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.approveButton]}
                onPress={async () => {
                  try {
                    setLoading(true);
                    const requestRef = doc(db, 'repairRequests', currentRequest.id);
                    await updateDoc(requestRef, {
                      status: 'Accepted',
                      approvedByCustomer: true,
                      approvedAt: new Date(),
                      agreedPrice: parseFloat(negotiationPrice) || currentRequest.agreedPrice || 0,
                    });
                    
                    // Send notification to technician
                    await addDoc(collection(db, 'notifications'), {
                      userId: currentRequest.technicianId,
                      title: 'Negotiation Approved',
                      message: `The customer has approved your negotiation for the ${currentRequest.deviceType} repair.`,
                      read: false,
                      createdAt: new Date(),
                      type: 'negotiation_approved',
                      requestId: currentRequest.id
                    });
                    
                    Alert.alert('Success', 'Negotiation approved. The technician can now start the repair.');
                    router.back();
                  } catch (error) {
                    console.error('Error approving negotiation:', error);
                    Alert.alert('Error', 'Failed to approve negotiation. Please try again.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Approve & Start Repair</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
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
  form: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationContainer: {
    marginBottom: 24,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  regularButton: {
    backgroundColor: '#1e88e5',
  },
  emergencyButton: {
    backgroundColor: '#ff3b30',
  },
  serviceButton: {
    backgroundColor: '#4caf50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  statusSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  completionDetails: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  completionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  completionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    flex: 1,
  },
  completionValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  completionNotesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  completionNotes: {
    fontSize: 16,
    color: '#333',
    marginTop: 8,
    fontStyle: 'italic',
  },
  progressBarContainer: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1e88e5',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  progressUpdatesContainer: {
    marginTop: 16,
  },
  progressUpdatesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  progressUpdate: {
    marginBottom: 8,
  },
  progressUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressUpdateTimestamp: {
    fontSize: 16,
    color: '#666',
  },
  progressPercentageBadge: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 4,
    marginLeft: 8,
  },
  progressPercentageText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  progressUpdateText: {
    fontSize: 16,
    color: '#666',
  },
  actionButtonsContainer: {
    gap: 12,
  },
  approveButton: {
    backgroundColor: '#4caf50',
  },
  payButton: {
    backgroundColor: '#4caf50',
  },
  paymentSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  paymentDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  priceValue: {
    fontSize: 16,
    color: '#666',
  },
  payNowButton: {
    backgroundColor: '#1e88e5',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payNowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  paymentCompletedSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentCompletedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentCompletedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  paymentCompletedDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  viewInvoiceButton: {
    backgroundColor: '#1e88e5',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewInvoiceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  rateRepairSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rateRepairPrompt: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  rateRepairButton: {
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rateRepairText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  reviewCompletedSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewCompletedText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
    marginLeft: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  requestInfoCard: {
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
  requestInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  requestInfoDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e88e5',
    marginLeft: 8,
  },
  technicianContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  technicianLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  technicianName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  lastUpdateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e88e5',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  messageButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 8,
  },
}); 