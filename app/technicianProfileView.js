import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function TechnicianProfileView() {
  const router = useRouter();
  const { technicianId } = useLocalSearchParams();
  const [technician, setTechnician] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('TechnicianProfileView mounted');
    console.log('Received technicianId:', technicianId);
    console.log('technicianId type:', typeof technicianId);
    
    if (technicianId && typeof technicianId === 'string' && technicianId.trim() !== '') {
      console.log('Valid technician ID received, fetching data...');
      fetchTechnicianData();
    } else {
      console.error('Invalid technician ID received:', technicianId);
      Alert.alert('Error', 'Invalid technician ID');
      router.back();
    }
  }, [technicianId]);

  const fetchTechnicianData = async () => {
    try {
      setLoading(true);
      console.log('Starting to fetch technician data...');
      console.log('Technician ID:', technicianId);
      
      if (!technicianId) {
        console.error('No technician ID provided');
        Alert.alert('Error', 'Invalid technician ID');
        router.back();
        return;
      }

      console.log('Attempting to fetch document from Firestore...');
      const technicianDoc = await getDoc(doc(db, 'users', technicianId));
      
      if (!technicianDoc.exists()) {
        console.error('Technician document not found for ID:', technicianId);
        Alert.alert('Error', 'Technician profile not found');
        router.back();
        return;
      }

      const data = technicianDoc.data();
      console.log('Successfully retrieved technician data:', data);

      if (!data) {
        console.error('Technician data is null or undefined');
        Alert.alert('Error', 'Invalid technician data');
        router.back();
        return;
      }

      if (data.userType !== 'technician') {
        console.error('User is not a technician. User type:', data.userType);
        Alert.alert('Error', 'Invalid technician profile');
        router.back();
        return;
      }

      const technicianData = {
        ...data,
        rating: data.rating || 4.5,
        numberOfRatings: data.numberOfRatings || 0,
        name: data.name || 'Unknown Technician',
        avatarEmoji: data.avatarEmoji || '👨‍🔧',
        phone: data.contactNumber || data.phone || '',
        specialties: data.specialties || [],
        certifications: data.certifications || [],
        address: data.address || 'Address not available',
        location: data.location || { latitude: 0, longitude: 0 }
      };

      console.log('Setting technician data:', technicianData);
      setTechnician(technicianData);
    } catch (error) {
      console.error('Error fetching technician data:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        technicianId: technicianId
      });
      Alert.alert('Error', 'Failed to load technician profile. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (technician?.phone) {
      Alert.alert(
        'Contact Technician',
        `Would you like to contact ${technician.name}?\nPhone: ${technician.phone}`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Call',
            onPress: () => {
              // Implement phone call functionality
              console.log('Calling technician:', technician.phone);
            }
          }
        ]
      );
    } else {
      Alert.alert('Error', 'Contact information not available');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
      </View>
    );
  }

  if (!technician) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Technician Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {technician.avatarEmoji || '👨‍🔧'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{technician.name}</Text>
            <Text style={styles.specialty}>{technician.specialties?.[0] || 'General Technician'}</Text>
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
            <Ionicons name="call" size={24} color="#1e88e5" />
            <Text style={styles.contactText}>{technician.phone || 'Contact not available'}</Text>
          </TouchableOpacity>
          <View style={styles.addressContainer}>
            <Ionicons name="location" size={24} color="#1e88e5" />
            <Text style={styles.addressText}>{technician.address}</Text>
          </View>
        </View>

        {/* Specialties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.skillsContainer}>
            {technician.specialties?.map((specialty, index) => (
              <View key={index} style={styles.skillTag}>
                <Text style={styles.skillText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Certifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Certifications</Text>
          <View style={styles.certificationsContainer}>
            {technician.certifications?.map((certification, index) => (
              <View key={index} style={styles.certificationItem}>
                <Ionicons name="ribbon" size={20} color="#1e88e5" />
                <Text style={styles.certificationText}>{certification}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rating</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={24} color="#FFD700" />
            <Text style={styles.ratingText}>
              {technician.rating ? `${technician.rating.toFixed(1)} (${technician.numberOfRatings} ratings)` : 'No ratings yet'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e88e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  contactText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillText: {
    color: '#1e88e5',
    fontSize: 14,
  },
  experienceText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
    color: '#333',
    marginLeft: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  addressText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  certificationsContainer: {
    marginTop: 8,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  certificationText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
}); 