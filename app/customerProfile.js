import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword } from 'firebase/auth';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

// Customer avatar options
const CUSTOMER_AVATARS = [
  { emoji: '👤', color: '#1e88e5' }, // Blue
  { emoji: '👥', color: '#43a047' }, // Green
  { emoji: '👨', color: '#fdd835' }, // Yellow
  { emoji: '👩', color: '#e53935' }, // Red
  { emoji: '🧑', color: '#8e24aa' }, // Purple
  { emoji: '👧', color: '#fb8c00' }, // Orange
  { emoji: '👦', color: '#00acc1' }, // Cyan
  { emoji: '👨‍💼', color: '#3949ab' }, // Indigo
  { emoji: '👩‍💼', color: '#d81b60' }, // Pink
  { emoji: '👨‍💻', color: '#5c6bc0' }, // Deep Purple
  { emoji: '👩‍💻', color: '#00897b' }, // Teal
  { emoji: '👨‍🎓', color: '#f4511e' }, // Deep Orange
];

const CustomerProfile = () => {
  const router = useRouter();
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  useEffect(() => {
    fetchCustomerData();
    getLocation();

    // Add back handler
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true; // Prevent default back behavior
    });

    // Cleanup
    return () => backHandler.remove();
  }, []);

  const getLocation = async () => {
    try {
      setIsGettingLocation(true);
      console.log('Requesting location permissions...');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Location permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to update your location.');
        setIsGettingLocation(false);
        return;
      }

      console.log('Getting current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      });
      console.log('Current position:', location);
      setLocation(location);

      console.log('Getting address from coordinates...');
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log('Address:', address);

      if (address) {
        const formattedAddress = `${address.street || ''} ${address.city || ''} ${address.region || ''} ${address.country || ''}`.trim();
        console.log('Formatted address:', formattedAddress);
        setEditedData(prev => ({
          ...prev,
          address: formattedAddress,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }
        }));
      } else {
        Alert.alert('Error', 'Could not get address from your location');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Error',
        'Failed to get location. Please make sure location services are enabled and try again.'
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const fetchCustomerData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCustomerData(userDoc.data());
          setEditedData(userDoc.data());
        }
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.replace('/customerDashboard');
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleAvatarSelect = (avatar) => {
    setEditedData(prev => ({
      ...prev,
      avatarEmoji: avatar.emoji,
      avatarColor: avatar.color
    }));
    setShowAvatarModal(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        // Create an update object with only defined fields
        const updateData = {};
        
        // Only add fields that have values
        if (editedData.name) updateData.name = editedData.name;
        if (editedData.contactNumber) updateData.contactNumber = editedData.contactNumber;
        if (editedData.address) updateData.address = editedData.address;
        
        // Only add avatar fields if they exist
        if (editedData.avatarEmoji) updateData.avatarEmoji = editedData.avatarEmoji;
        if (editedData.avatarColor) updateData.avatarColor = editedData.avatarColor;
        
        // Add location if available
        if (location) {
          updateData.location = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
        }
        
        // Update Firestore data
        await updateDoc(doc(db, 'users', user.uid), updateData);

        // Update email if changed
        if (editedData.email && editedData.email !== user.email) {
          await updateEmail(user, editedData.email);
        }

        // Update password if provided
        if (newPassword && newPassword === confirmPassword) {
          await updatePassword(user, newPassword);
        }

        setCustomerData(editedData);
        setEditing(false);
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedData(customerData);
    setEditing(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!editing ? (
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Ionicons name="pencil" size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="checkmark" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Avatar Section */}
        <View style={styles.profileImageSection}>
          <TouchableOpacity 
            onPress={() => editing && setShowAvatarModal(true)}
            disabled={!editing}
          >
            <View style={[
              styles.avatarContainer,
              { backgroundColor: editedData?.avatarColor || '#1e88e5' }
            ]}>
              <Text style={styles.avatarEmoji}>
                {editedData?.avatarEmoji || '👤'}
              </Text>
            </View>
            {editing && (
              <View style={styles.editAvatarButton}>
                <Ionicons name="pencil" size={20} color="white" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={editedData?.name}
                onChangeText={(text) => setEditedData(prev => ({ ...prev, name: text }))}
                placeholder="Enter your name"
              />
            ) : (
              <Text style={styles.infoValue}>{customerData?.name || 'Not set'}</Text>
            )}
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={editedData?.email}
                onChangeText={(text) => setEditedData(prev => ({ ...prev, email: text }))}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.infoValue}>{customerData?.email || 'Not set'}</Text>
            )}
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={editedData?.contactNumber}
                onChangeText={(text) => setEditedData(prev => ({ ...prev, contactNumber: text }))}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.infoValue}>{customerData?.contactNumber || 'Not set'}</Text>
            )}
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Address</Text>
            {editing ? (
              <View style={styles.addressContainer}>
                <TextInput
                  style={[styles.input, styles.addressInput]}
                  value={editedData?.address}
                  onChangeText={(text) => setEditedData(prev => ({ ...prev, address: text }))}
                  placeholder="Enter your address"
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.locationButton,
                    isGettingLocation && styles.locationButtonDisabled
                  ]}
                  onPress={getLocation}
                  disabled={isGettingLocation}
                >
                  {isGettingLocation ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="location" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.infoValue}>{customerData?.address || 'Not set'}</Text>
            )}
          </View>
        </View>

        {/* Password Section */}
        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                secureTextEntry
              />
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Avatar Selection Modal */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Avatar</Text>
              <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.avatarGrid}>
              {CUSTOMER_AVATARS.map((avatar, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.avatarOption,
                    { backgroundColor: avatar.color }
                  ]}
                  onPress={() => handleAvatarSelect(avatar)}
                >
                  <Text style={styles.avatarOptionEmoji}>{avatar.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

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
    backgroundColor: '#1e88e5',
    paddingTop: 40,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  editButton: {
    marginLeft: 'auto',
  },
  editActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  saveButton: {
    marginRight: 16,
  },
  cancelButton: {
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  profileImageSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarEmoji: {
    fontSize: 50,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1e88e5',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    fontSize: 16,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressInput: {
    flex: 1,
  },
  locationButton: {
    backgroundColor: '#1e88e5',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButtonDisabled: {
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingBottom: 20,
  },
  avatarOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarOptionEmoji: {
    fontSize: 30,
  },
});

export default CustomerProfile; 