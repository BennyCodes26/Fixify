import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

const NearbyTechnicians = ({ onTechniciansUpdate }) => {
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission is required to find nearby technicians.');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        if (isMounted) {
          setLocation({ latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude });
          await fetchNearbyTechnicians(currentLocation.coords);
        }
      } catch (error) {
        console.error('Error getting location:', error);
        if (isMounted) {
          setError('Failed to get your location');
        }
      }
    };

    getCurrentLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchNearbyTechnicians = async (userLocation) => {
    try {
      setLoading(true);
      console.log('Fetching nearby technicians...');
      const techniciansRef = collection(db, 'users');
      const q = query(
        techniciansRef,
        where('userType', '==', 'technician'),
        where('isAvailable', '==', true)
      );

      const querySnapshot = await getDocs(q);
      const techniciansData = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            data.location.latitude,
            data.location.longitude
          );
          
          techniciansData.push({
            id: doc.id,
            ...data,
            distance: distance.toFixed(2),
            rating: data.rating || 4.5,
            name: data.name || 'Unknown Technician',
            avatarEmoji: data.avatarEmoji || '👨‍🔧',
            phone: data.phone || '',
            isAvailable: data.isAvailable || true,
            location: data.location || { latitude: 0, longitude: 0 }
          });
        }
      });

      // Sort by distance
      techniciansData.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
      
      console.log('Found technicians:', techniciansData.length);
      
      // Update parent component with nearby technicians
      if (onTechniciansUpdate) {
        onTechniciansUpdate(techniciansData);
      }
      
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      setError('Failed to fetch nearby technicians');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (value) => {
    return (value * Math.PI) / 180;
  };

  const getFirstName = (fullName) => {
    return fullName ? fullName.split(' ')[0] : 'Technician';
  };

  const handleViewProfile = (technicianId) => {
    router.push({
      pathname: '/technicianProfileView',
      params: { technicianId }
    });
  };

  const handleContact = (technician) => {
    Alert.alert('Contact', `Call ${technician.name} at ${technician.contactNumber}`);
  };

  const renderTechnicianMarker = (technician) => {
    return (
      <Marker
        key={technician.id}
        coordinate={technician.location}
        onPress={() => setSelectedTechnician(technician)}
      >
        <View style={styles.markerContainer}>
          <Text style={styles.markerText}>{technician.avatarEmoji || '👨‍🔧'}</Text>
          <Text style={styles.nameText} numberOfLines={1}>{getFirstName(technician.name)}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ {technician.rating || '4.5'}</Text>
          </View>
          <Text style={styles.distanceText}>{technician.distance}km</Text>
        </View>
        <Callout tooltip={true}>
          <View style={styles.calloutContainer}>
            <View style={styles.calloutHeader}>
              <Text style={styles.calloutName}>{technician.name}</Text>
              <Text style={styles.calloutRating}>⭐ {technician.rating || '4.5'}</Text>
            </View>
            <View style={styles.calloutActions}>
              <TouchableOpacity 
                style={[styles.calloutButton, styles.profileButton]}
                onPress={() => handleViewProfile(technician.id)}
              >
                <Text style={styles.calloutButtonText}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.calloutButton, styles.contactButton]}
                onPress={() => handleContact(technician)}
              >
                <Text style={styles.calloutButtonText}>Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Callout>
      </Marker>
    );
  };

  const renderTechnicianCard = (technician) => {
    const firstName = technician.name ? technician.name.split(' ')[0] : 'Technician';
    return (
      <TouchableOpacity 
        key={technician.id}
        style={styles.technicianCard}
        onPress={() => handleViewProfile(technician.id)}
      >
        <View style={styles.technicianInfo}>
          <Text style={styles.avatarEmoji}>{technician.avatarEmoji || '🔧'}</Text>
          <View style={styles.technicianDetails}>
            <Text style={styles.technicianName}>{firstName}</Text>
            <Text style={styles.technicianRating}>⭐ {technician.rating || '0.0'}</Text>
          </View>
        </View>
        <Text style={styles.distanceText}>
          {calculateDistance(
            location?.latitude || 0,
            location?.longitude || 0,
            technician.location.latitude,
            technician.location.longitude
          ).toFixed(1)}km away
        </Text>
      </TouchableOpacity>
    );
  };

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
        <Text style={styles.loadingText}>Finding nearby technicians...</Text>
      </View>
    );
  }

  if (technicians.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No technicians available in your area</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {technicians.map(renderTechnicianMarker)}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  markerContainer: {
    backgroundColor: 'white',
    padding: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1e88e5',
    alignItems: 'center',
    minWidth: 60,
  },
  markerText: {
    fontSize: 16,
  },
  nameText: {
    fontSize: 10,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 55,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
  },
  distanceText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  calloutContainer: {
    width: 160,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  calloutRating: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  calloutActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  calloutButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
    minWidth: 70,
  },
  profileButton: {
    backgroundColor: '#1e88e5',
  },
  contactButton: {
    backgroundColor: '#4CAF50',
  },
  calloutButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  technicianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  technicianInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  technicianDetails: {
    marginLeft: 10,
  },
  technicianName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  technicianRating: {
    fontSize: 10,
    color: '#666',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
  },
});

export default NearbyTechnicians; 