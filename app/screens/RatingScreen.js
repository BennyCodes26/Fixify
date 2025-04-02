import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function RatingScreen() {
  const { requestId, invoiceId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestData, setRequestData] = useState(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [technicianId, setTechnicianId] = useState(null);

  useEffect(() => {
    fetchRequestData();
  }, []);

  const fetchRequestData = async () => {
    try {
      setLoading(true);
      const requestRef = doc(db, 'repairRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        Alert.alert('Error', 'Request not found');
        router.back();
        return;
      }
      
      const data = requestDoc.data();
      setRequestData(data);
      setTechnicianId(data.technicianId);
    } catch (error) {
      console.error('Error fetching request data:', error);
      Alert.alert('Error', 'Failed to load request information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitRating = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Create the review document
      const reviewData = {
        requestId: requestId,
        customerId: auth.currentUser.uid,
        customerName: auth.currentUser.displayName || 'Customer',
        technicianId: technicianId,
        rating: rating,
        review: review.trim(),
        createdAt: serverTimestamp(),
        deviceType: requestData.deviceType,
        status: 'active', // For potential moderation
      };
      
      // Add review to Firestore
      const reviewRef = await addDoc(collection(db, 'reviews'), reviewData);
      
      // Update the request with review data
      await updateDoc(doc(db, 'repairRequests', requestId), {
        rating: rating,
        reviewId: reviewRef.id,
        hasReview: true
      });
      
      // Update the technician's average rating
      await updateTechnicianRating(technicianId, rating);
      
      // Send notification to technician
      await addDoc(collection(db, 'notifications'), {
        userId: technicianId,
        title: 'New Rating Received',
        message: `You received a ${rating}-star rating for your ${requestData.deviceType} repair!`,
        read: false,
        createdAt: serverTimestamp(),
        type: 'new_rating',
        requestId: requestId
      });
      
      Alert.alert(
        'Thank You!',
        'Your rating and feedback have been submitted successfully.',
        [
          {
            text: 'View Invoice',
            onPress: () => router.push({
              pathname: '/screens/InvoiceScreen',
              params: { invoiceId: invoiceId }
            })
          },
          {
            text: 'Back to Dashboard',
            onPress: () => router.push('/customerDashboard')
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit your rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTechnicianRating = async (techId, newRating) => {
    try {
      const techRef = doc(db, 'users', techId);
      const techDoc = await getDoc(techRef);
      
      if (!techDoc.exists()) {
        console.error('Technician document not found');
        return;
      }
      
      const techData = techDoc.data();
      const currentRating = techData.rating || 0;
      const numberOfRatings = techData.numberOfRatings || 0;
      
      // Calculate new average rating
      const totalRatingPoints = (currentRating * numberOfRatings) + newRating;
      const newNumberOfRatings = numberOfRatings + 1;
      const newAverageRating = totalRatingPoints / newNumberOfRatings;
      
      // Update technician document
      await updateDoc(techRef, {
        rating: newAverageRating,
        numberOfRatings: newNumberOfRatings,
        lastRatingDate: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating technician rating:', error);
      // Continue even if this fails - the review is still recorded
    }
  };

  const renderStar = (position) => {
    const filled = position <= rating;
    
    return (
      <TouchableOpacity
        key={position}
        style={styles.starContainer}
        onPress={() => setRating(position)}
      >
        <Ionicons 
          name={filled ? 'star' : 'star-outline'} 
          size={50} 
          color={filled ? '#FFD700' : '#D3D3D3'} 
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e88e5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Experience</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How was your repair experience?</Text>
          <Text style={styles.repairDetail}>
            {requestData.deviceType} repair by {requestData.technicianName || 'Technician'}
          </Text>
          
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(pos => renderStar(pos))}
          </View>
          
          <Text style={styles.ratingText}>
            {rating === 0 ? 'Tap to rate' :
             rating === 1 ? 'Poor' :
             rating === 2 ? 'Fair' :
             rating === 3 ? 'Good' :
             rating === 4 ? 'Very Good' :
             'Excellent'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Your Feedback</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="Tell us about your experience with the technician and repair service..."
            multiline
            numberOfLines={5}
            value={review}
            onChangeText={setReview}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (rating === 0 || submitting) && styles.disabledButton
          ]}
          onPress={submitRating}
          disabled={rating === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Review</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  repairDetail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starContainer: {
    padding: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e88e5',
    marginTop: 8,
  },
  reviewInput: {
    width: '100%',
    height: 120,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#1e88e5',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9e9e9e',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
}); 