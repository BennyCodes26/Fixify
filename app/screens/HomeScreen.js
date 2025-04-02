import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function HomeScreen() {
  const router = useRouter();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const techniciansQuery = query(
        collection(db, 'users'),
        where('role', '==', 'technician')
      );

      const snapshot = await getDocs(techniciansQuery);
      const techniciansList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setTechnicians(techniciansList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      setError('Failed to load technicians');
      setLoading(false);
    }
  };

  const renderTechnicianCard = ({ item }) => {
    const firstName = item.firstName || item.name?.split(' ')[0] || 'Technician';
    return (
      <TouchableOpacity
        style={styles.technicianCard}
        onPress={() => router.push({
          pathname: '/technicianProfileView',
          params: { technicianId: item.id }
        })}
      >
        <View style={styles.technicianInfo}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{item.avatarEmoji || '👨‍🔧'}</Text>
          </View>
          <View style={styles.technicianDetails}>
            <Text style={styles.technicianName}>{firstName}</Text>
            <Text style={styles.technicianRating}>⭐ {item.rating || '4.5'}</Text>
            <Text style={styles.specialty}>{item.specialty || 'General Technician'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
        <Text style={styles.loadingText}>Loading technicians...</Text>
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
      <FlatList
        data={technicians}
        renderItem={renderTechnicianCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No technicians available</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
  },
  technicianCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  technicianInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  technicianDetails: {
    flex: 1,
  },
  technicianName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  technicianRating: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 14,
    color: '#1e88e5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e53935',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 