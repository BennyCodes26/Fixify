import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

interface Technician {
  id: string;
  name: string;
  specialty: string;
  rating?: number;
  profileImage?: string;
  isAvailable: boolean;
}

export default function HomeScreen() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkUserType();
  }, []);

  const checkUserType = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      // Get user type from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData?.userType === 'customer') {
        router.replace('/customerDashboard');
      } else if (userData?.userType === 'technician') {
        router.replace('/technicianDashboard');
      } else {
        // If user type is not set, fetch nearby technicians
        fetchNearbyTechnicians();
      }
    } catch (error) {
      console.error('Error checking user type:', error);
      router.replace('/(auth)/login');
    }
  };

  const fetchNearbyTechnicians = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const techniciansRef = collection(db, 'technicians');
      const q = query(techniciansRef, where('isAvailable', '==', true));
      const querySnapshot = await getDocs(q);
      
      const techniciansList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Technician[];

      setTechnicians(techniciansList);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      setError('Failed to fetch technicians');
    } finally {
      setLoading(false);
    }
  };

  const renderTechnician = ({ item }: { item: Technician }) => (
    <TouchableOpacity
      style={styles.technicianCard}
      onPress={() => router.push(`/technicianProfileView?id=${item.id}`)}
    >
      <Image
        source={{ uri: item.profileImage || 'https://via.placeholder.com/100' }}
        style={styles.technicianImage}
      />
      <View style={styles.technicianInfo}>
        <Text style={styles.technicianName}>{item.name}</Text>
        <Text style={styles.technicianSpecialty}>{item.specialty}</Text>
        <Text style={styles.technicianRating}>Rating: {item.rating || 'N/A'}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Technicians</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchNearbyTechnicians}
        >
          <Ionicons name="refresh" size={24} color="#1e88e5" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={technicians}
        renderItem={renderTechnician}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  technicianCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  technicianImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  technicianInfo: {
    flex: 1,
  },
  technicianName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  technicianSpecialty: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  technicianRating: {
    fontSize: 14,
    color: '#888',
  },
});
