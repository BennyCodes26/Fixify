import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

export default function TechnicianRequestForm() {
  const [deviceType, setDeviceType] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location to customers.');
        setIsLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      if (!currentLocation || !currentLocation.coords) {
        throw new Error('Failed to get location coordinates');
      }

      const { latitude, longitude } = currentLocation.coords;
      
      // Get address from coordinates
      const [addressResult] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const formattedAddress = addressResult 
        ? `${addressResult.street || ''} ${addressResult.city || ''} ${addressResult.region || ''} ${addressResult.country || ''}`
        : '';

      setLocation({
        latitude,
        longitude,
        address: formattedAddress
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = async (isEmergency = false) => {
    if (!deviceType.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Please wait for location to be determined');
      return;
    }

    setIsLoading(true);
    try {
      // Here you would typically send the data to your backend
      // For now, we'll just show a success message
      Alert.alert(
        'Success',
        `Your ${isEmergency ? 'emergency ' : ''}request has been submitted successfully`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/technicianDashboard')
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setIsLoading(false);
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
        <Text style={styles.title}>New Service Request</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Application Or Device Type</Text>
          <TextInput
            style={styles.input}
            value={deviceType}
            onChangeText={setDeviceType}
            placeholder="e.g., iPhone 13, Samsung TV, etc."
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your issue in detail..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.locationContainer}>
          <Text style={styles.label}>Location</Text>
          {isLoadingLocation ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1e88e5" />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          ) : location ? (
            <Text style={styles.locationText}>{location.address}</Text>
          ) : (
            <Text style={styles.errorText}>Location not available</Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.regularButton]}
            onPress={() => handleSubmit(false)}
            disabled={isLoading || isLoadingLocation}
          >
            <Text style={styles.buttonText}>Send Request</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.emergencyButton]}
            onPress={() => handleSubmit(true)}
            disabled={isLoading || isLoadingLocation}
          >
            <Ionicons name="warning" size={20} color="#fff" style={styles.emergencyIcon} />
            <Text style={styles.buttonText}>Emergency Request</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  locationContainer: {
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
  },
  locationText: {
    color: '#333',
    fontSize: 14,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
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
    height: 150,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  regularButton: {
    backgroundColor: '#1e88e5',
  },
  emergencyButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyIcon: {
    marginRight: 8,
  },
}); 