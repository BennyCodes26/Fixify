import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  StatusBar,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db, storage } from '../config/firebase';
import { collection, query, where, orderBy, getDocs, onSnapshot, limit, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile, updatePassword } from 'firebase/auth';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';

const SPECIALTIES = [
  // Mobile Device Repair
  'Android Phone Repair',
  'iPhone Repair',
  'Tablet Repair',
  'Smart Watch Repair',
  
  // Computer & Laptop
  'Laptop Repair',
  'Desktop PC Repair',
  'Computer Hardware',
  'Computer Software',
  'Operating System Installation',
  'Data Recovery',
  
  // Network & IT
  'Network Setup',
  'WiFi Configuration',
  'Network Security',
  'IT Support',
  'Cloud Services',
  
  // Electrical & Electronics
  'Electrical Repair',
  'Electronic Repair',
  'Power Supply Repair',
  'Circuit Board Repair',
  'Smart Home Systems',
  
  // Gaming & Entertainment
  'Gaming Console Repair',
  'TV Repair',
  'Audio System Repair',
  'Home Theater Setup',
  
  // Security Systems
  'CCTV Installation',
  'Security Camera Setup',
  'Alarm System Installation',
  'Access Control Systems'
];

const DEFAULT_CERTIFICATIONS = [
  'CompTIA A+',
  'CompTIA Network+',
  'CompTIA Security+',
  'Cisco CCNA',
  'Microsoft MCP',
  'Apple Certified Technician',
  'Google IT Support Professional',
  'Electrical Safety Certification',
  'Network Security Certification',
  'Data Recovery Specialist'
];

// Avatar options
const AVATAR_OPTIONS = [
  { id: '1', emoji: '👨‍🔧', color: '#1e88e5' },      // Male mechanic
  { id: '2', emoji: '👩‍🔧', color: '#4CAF50' },      // Female mechanic
  { id: '3', emoji: '👨‍💻', color: '#FF9800' },      // Tech guy
  { id: '4', emoji: '👩‍💻', color: '#E91E63' },      // Tech girl
  { id: '5', emoji: '👨‍🔨', color: '#9C27B0' },      // Carpenter
  { id: '6', emoji: '👩‍🔨', color: '#607D8B' },      // Carpenter
  { id: '7', emoji: '👨‍⚡', color: '#FFC107' },      // Electrician
  { id: '8', emoji: '👩‍⚡', color: '#00BCD4' },      // Electrician
  { id: '9', emoji: '👨‍🔌', color: '#795548' },      // Plumber
  { id: '10', emoji: '👩‍🔌', color: '#3F51B5' },     // Plumber
  { id: '11', emoji: '👨‍🏭', color: '#009688' },     // Factory worker
  { id: '12', emoji: '👩‍🏭', color: '#673AB7' },     // Factory worker
];

// Add these new components before the TechnicianDashboard component
const SpecialtyButton = React.memo(({ specialty, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.specialtyButton,
      isSelected && styles.selectedSpecialty
    ]}
    onPress={onPress}
  >
    <Text style={[
      styles.specialtyText,
      isSelected && styles.selectedSpecialtyText
    ]}>
      {specialty}
    </Text>
  </TouchableOpacity>
));

const CertificationItem = React.memo(({ certification, onRemove }) => (
  <View style={styles.certificationItem}>
    <Text style={styles.certificationText}>{certification}</Text>
    <TouchableOpacity
      onPress={onRemove}
      style={styles.removeCertification}
    >
      <Ionicons name="close-circle" size={20} color="#ff4444" />
    </TouchableOpacity>
  </View>
));

const CertificationOption = React.memo(({ certification, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.certificationOption,
      isSelected && styles.selectedCertification
    ]}
    onPress={onPress}
  >
    <Text style={[
      styles.certificationOptionText,
      isSelected && styles.selectedCertificationText
    ]}>
      {certification}
    </Text>
    {isSelected && (
      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
    )}
  </TouchableOpacity>
));

const RequestItem = React.memo(({ item }) => (
  <TouchableOpacity style={styles.requestItem}>
    <View style={styles.requestHeader}>
      <Text style={styles.customerName}>{item.customer}</Text>
      <Text style={[
        styles.statusBadge, 
        item.status === 'Completed' ? styles.completedStatus : 
        item.status === 'In Progress' ? styles.inProgressStatus : 
        styles.pendingStatus
      ]}>
        {item.status}
      </Text>
    </View>
    <Text style={styles.issueText}>{item.issue}</Text>
    <Text style={styles.dateText}>Requested on: {item.date}</Text>
  </TouchableOpacity>
));

const TransactionItem = React.memo(({ item }) => (
  <TouchableOpacity style={styles.transactionItem}>
    <View style={styles.transactionHeader}>
      <View>
        <Text style={styles.transactionTitle}>{item.repairType} Repair</Text>
        <Text style={styles.transactionDescription}>{item.description}</Text>
      </View>
      <Text style={styles.amountText}>+${item.amount}</Text>
    </View>
    <View style={styles.transactionFooter}>
      <Text style={styles.dateText}>
        {item.createdAt?.toDate().toLocaleDateString() || 'Recent'}
      </Text>
      <View style={styles.paymentMethod}>
        <Ionicons 
          name={item.paymentMethod === 'card' ? 'card-outline' : 'cash-outline'} 
          size={16} 
          color="#666" 
        />
        <Text style={styles.paymentMethodText}>
          {item.paymentMethod === 'card' ? 'Card' : 'Cash'}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
));

const TechnicianDashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [technicianData, setTechnicianData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [editedData, setEditedData] = useState({
    name: '',
    email: '',
    contactNumber: '',
    specialties: [],
    certifications: [],
    newPassword: '',
    confirmPassword: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [newCertification, setNewCertification] = useState('');
  const [location, setLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [address, setAddress] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showCertificateInput, setShowCertificateInput] = useState(false);
  const [newCertificate, setNewCertificate] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [overallRating, setOverallRating] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  
  useEffect(() => {
    const fetchTechnicianData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setTechnicianData(data);
            setEditedData({
              name: data.name || '',
              email: data.email || '',
              contactNumber: data.contactNumber || '',
              specialties: data.specialties || [],
              certifications: data.certifications || [],
              newPassword: '',
              confirmPassword: ''
            });
            // Set the selected avatar based on stored data
            if (data.avatarColor) {
              setSelectedAvatar(AVATAR_OPTIONS.find(avatar => avatar.color === data.avatarColor));
            }
            // Set location data if it exists
            if (data.location) {
              setLocation(data.location);
              setAddress(data.address || '');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching technician data:', error);
      }
    };

    fetchTechnicianData();

    // Add back handler
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true; // Prevent default back behavior
    });

    // Cleanup
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchUserProfile(user.uid);
        fetchConversations(user.uid);
        fetchTransactions(user.uid);
        fetchReviews(user.uid);
      } else {
        setLoading(false);
        router.replace('/');
      }
    });

    return () => unsubAuth();
  }, []);

  const handleBack = () => {
    router.replace('/technicianDashboard');
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const user = auth.currentUser;
        if (!user) {
          Alert.alert('Error', 'You must be logged in to upload an image');
          return;
        }

        console.log('Starting image upload...');
        console.log('User ID:', user.uid);

        // Create a reference to the image in Firebase Storage
        const imageRef = ref(storage, `profile_images/${user.uid}`);
        console.log('Storage reference created:', imageRef);
        
        // Convert the image URI to a blob
        console.log('Fetching image from URI:', result.assets[0].uri);
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        console.log('Image converted to blob, size:', blob.size);

        // Upload the image to Firebase Storage
        console.log('Uploading to Firebase Storage...');
        await uploadBytes(imageRef, blob);
        console.log('Upload completed');

        // Get the download URL
        console.log('Getting download URL...');
        const downloadURL = await getDownloadURL(imageRef);
        console.log('Download URL received:', downloadURL);

        // Update the profile image URL in Firestore
        console.log('Updating Firestore document...');
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: downloadURL
        });
        console.log('Firestore updated');

        // Update the local state
        setProfileImage(downloadURL);
        setIsUploading(false);
        console.log('Local state updated');
      }
    } catch (error) {
      console.error('Detailed error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      setIsUploading(false);
      Alert.alert(
        'Error',
        'Failed to upload image. Please check your internet connection and try again.'
      );
    }
  };

  const handleAvatarSelect = async (avatar) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Update Firestore document
      await updateDoc(doc(db, 'users', user.uid), {
        avatarColor: avatar.color
      });

      // Update local state
      setSelectedAvatar(avatar);
      setTechnicianData(prev => ({
        ...prev,
        avatarColor: avatar.color
      }));
      setShowAvatarModal(false);
    } catch (error) {
      console.error('Error updating avatar:', error);
      Alert.alert('Error', 'Failed to update avatar');
    }
  };

  const getLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location to customers.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = currentLocation.coords;

      // Get address from coordinates
      const [addressResult] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const formattedAddress = addressResult 
        ? `${addressResult.street || ''} ${addressResult.city || ''} ${addressResult.region || ''} ${addressResult.country || ''}`
        : '';

      setLocation({ latitude, longitude });
      setAddress(formattedAddress);
      setSelectedLocation({ latitude, longitude });
      setIsLoadingLocation(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setIsLoadingLocation(false);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: editedData.name
      });

      // Update Firestore document
      await updateDoc(doc(db, 'users', user.uid), {
        name: editedData.name,
        email: editedData.email,
        contactNumber: editedData.contactNumber,
        specialties: editedData.specialties,
        certifications: editedData.certifications,
        avatarColor: selectedAvatar?.color,
        location: location,
        address: address
      });

      // Update password if provided
      if (editedData.newPassword) {
        if (editedData.newPassword !== editedData.confirmPassword) {
          Alert.alert('Error', 'Passwords do not match');
          return;
        }
        await updatePassword(user, editedData.newPassword);
      }

      setTechnicianData({
        ...technicianData,
        ...editedData,
        avatarColor: selectedAvatar?.color,
        location: location,
        address: address
      });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const toggleSpecialty = (specialty) => {
    setEditedData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  const addCertification = () => {
    setShowCertificationModal(true);
  };

  const handleAddCertification = () => {
    if (newCertification.trim()) {
      setEditedData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()]
      }));
      setNewCertification('');
      setShowCertificationModal(false);
    }
  };

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
    // Don't update the region to maintain zoom level
  };

  const handleConfirmLocation = async () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location on the map');
      return;
    }

    try {
      const { latitude, longitude } = selectedLocation;
      const [address] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const formattedAddress = address 
        ? `${address.street || ''} ${address.city || ''} ${address.region || ''} ${address.country || ''}`
        : 'Location selected on map';

      // Update local state
      setLocation(selectedLocation);
      setAddress(formattedAddress);
      
      // Save to Firebase
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          location: selectedLocation,
          address: formattedAddress,
          lastLocationUpdate: new Date().toISOString(),
          isAvailable: true, // Add availability status
          rating: rating, // Add rating
          specialties: editedData.specialties, // Add specialties
          name: editedData.name, // Add name for customer view
          contactNumber: editedData.contactNumber, // Add contact for customer view
        });
      }

      setShowMap(false);
      Alert.alert('Success', 'Location updated successfully');
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  };

  const fetchConversations = async (technicianId) => {
    setLoading(true);
    try {
      // First try - direct fetch with no snapshotListener
      const requestsRef = collection(db, 'repairRequests');
      
      // Use the simplest possible query to avoid BloomFilter errors
      try {
        const q = query(requestsRef, where('technicianId', '==', technicianId));
        const querySnapshot = await getDocs(q);
        
        // Process and sort the data manually
        const conversationsList = querySnapshot.docs
          .map(docSnapshot => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              ...data,
              name: data.customerName || 'Customer'
            };
          })
          // Only include items with messages
          .filter(doc => doc.lastMessageTime) 
          // Manual sort by lastMessageTime
          .sort((a, b) => {
            const timeA = a.lastMessageTime?.toDate?.() || new Date(0);
            const timeB = b.lastMessageTime?.toDate?.() || new Date(0);
            return timeB - timeA;
          });
          
        setConversations(conversationsList);
      } catch (queryError) {
        console.error('Error with initial query:', queryError);
        
        // Fallback - get all repair requests and filter manually (most reliable)
        const allRequests = await getDocs(collection(db, 'repairRequests'));
        
        const conversationsList = allRequests.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          // Filter only the current technician's requests
          .filter(doc => doc.technicianId === technicianId)
          // Only include items with messages
          .filter(doc => doc.lastMessageTime)
          // Manual sort by lastMessageTime
          .sort((a, b) => {
            const timeA = a.lastMessageTime?.toDate?.() || new Date(0);
            const timeB = b.lastMessageTime?.toDate?.() || new Date(0);
            return timeB - timeA;
          })
          // Map names
          .map(doc => ({
            ...doc,
            name: doc.customerName || 'Customer'
          }));
        
        setConversations(conversationsList);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // Final fallback - show empty conversations
      setConversations([]);
      Alert.alert('Error', 'Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (userId) => {
    try {
      const transactionsRef = collection(db, 'transactions');
      // Use a simpler query that doesn't require a composite index
      const q = query(
        transactionsRef,
        where('technicianId', '==', userId),
        // Don't use orderBy with where without creating an index first
        limit(10)
      );

      const querySnapshot = await getDocs(q);
      // Sort the results in memory instead
      const transactionsList = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          // Sort by createdAt in descending order
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB - dateA;
        });
      
      setTransactions(transactionsList);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchUserProfile = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setUserProfile(userData);
        setTechnicianData(userData);
        
        // Also initialize the edited data
        setEditedData({
          name: userData.name || '',
          email: userData.email || '',
          contactNumber: userData.contactNumber || '',
          specialties: userData.specialties || [],
          certifications: userData.certifications || [],
          newPassword: '',
          confirmPassword: ''
        });
        
        // Set the selected avatar based on stored data
        if (userData.avatarColor) {
          setSelectedAvatar(AVATAR_OPTIONS.find(avatar => avatar.color === userData.avatarColor));
        }
        
        // Set location data if it exists
        if (userData.location) {
          setLocation(userData.location);
          setAddress(userData.address || '');
        }
      } else {
        console.log('No user profile found!');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setLoading(false);
    }
  };

  const fetchReviews = async (technicianId) => {
    try {
      setReviewsLoading(true);
      
      const reviewsRef = collection(db, 'reviews');
      const q = query(
        reviewsRef,
        where('technicianId', '==', technicianId),
        limit(5)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Sort in memory to avoid needing Firestore index
      const reviewsData = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      
      setReviews(reviewsData);
      
      // Calculate overall rating
      if (reviewsData.length > 0) {
        const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
        setOverallRating(totalRating / reviewsData.length);
        setReviewsCount(reviewsData.length);
      }
      
      setReviewsLoading(false);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviewsLoading(false);
    }
  };

  // Profile section component
  const ProfileSection = () => {
    const handleSpecialtyPress = useCallback((specialty) => {
      setEditedData(prev => ({
        ...prev,
        specialties: prev.specialties.includes(specialty)
          ? prev.specialties.filter(s => s !== specialty)
          : [...prev.specialties, specialty]
      }));
    }, []);

    const handleCertificationPress = useCallback((cert) => {
      setEditedData(prev => ({
        ...prev,
        certifications: prev.certifications.includes(cert)
          ? prev.certifications.filter(c => c !== cert)
          : [...prev.certifications, cert]
      }));
    }, []);

    const handleRemoveCertification = useCallback((index) => {
      setEditedData(prev => ({
        ...prev,
        certifications: prev.certifications.filter((_, i) => i !== index)
      }));
    }, []);

    const handleLogout = async () => {
      try {
        await auth.signOut();
        router.replace('/login');
      } catch (error) {
        console.error('Error logging out:', error);
        Alert.alert('Error', 'Failed to logout. Please try again.');
      }
    };

    return (
      <ScrollView style={styles.profileContainer}>
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.profileBackButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color="#1e88e5" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => isEditing && setShowAvatarModal(true)} 
            style={styles.profileImageContainer}
          >
            {selectedAvatar ? (
              <View style={styles.avatarContainer}>
                <View style={[styles.avatarWrapper, { backgroundColor: selectedAvatar.color }]}>
                  <Text style={styles.avatarEmoji}>{selectedAvatar.emoji}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
            )}
            {isEditing && (
              <View style={styles.editImageOverlay}>
                <Ionicons name="camera" size={24} color="white" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Avatar Selection Modal */}
        <Modal
          visible={showAvatarModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAvatarModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Choose Your Avatar</Text>
              <View style={styles.avatarGrid}>
                {AVATAR_OPTIONS.map((avatar) => (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.avatarOption,
                      { backgroundColor: avatar.color },
                      selectedAvatar?.id === avatar.id && styles.selectedAvatar
                    ]}
                    onPress={() => handleAvatarSelect(avatar)}
                  >
                    <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAvatarModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.profileForm}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editedData.name}
              onChangeText={(text) => setEditedData(prev => ({ ...prev, name: text }))}
              editable={isEditing}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={editedData.email}
              onChangeText={(text) => setEditedData(prev => ({ ...prev, email: text }))}
              editable={isEditing}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Contact Number</Text>
            <TextInput
              style={styles.input}
              value={editedData.contactNumber}
              onChangeText={(text) => setEditedData(prev => ({ ...prev, contactNumber: text }))}
              editable={isEditing}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Specialties</Text>
            <View style={styles.specialtiesContainer}>
              {SPECIALTIES.map((specialty) => (
                <SpecialtyButton
                  key={specialty}
                  specialty={specialty}
                  isSelected={editedData.specialties.includes(specialty)}
                  onPress={() => isEditing && handleSpecialtyPress(specialty)}
                />
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Certifications</Text>
            <View style={styles.certificationsContainer}>
              {editedData.certifications.map((cert, index) => (
                <CertificationItem
                  key={index}
                  certification={cert}
                  onRemove={() => isEditing && handleRemoveCertification(index)}
                />
              ))}
              {isEditing && (
                <View style={styles.addCertificationContainer}>
                  <TouchableOpacity
                    style={styles.addCertificationButton}
                    onPress={addCertification}
                  >
                    <Ionicons name="add-circle" size={24} color="#1e88e5" />
                    <Text style={styles.addCertificationText}>Add Certification</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addCertificationButton}
                    onPress={() => setShowCertificationModal(true)}
                  >
                    <Ionicons name="list" size={24} color="#1e88e5" />
                    <Text style={styles.addCertificationText}>Choose from List</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            {location ? (
              <View>
                <Text style={styles.addressText}>{address}</Text>
                <TouchableOpacity 
                  style={styles.button}
                  onPress={() => setShowMap(true)}
                >
                  <Text style={styles.buttonText}>Update Location</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.button}
                onPress={() => setShowMap(true)}
              >
                <Text style={styles.buttonText}>Set Your Location</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.newPassword}
                  onChangeText={(text) => setEditedData(prev => ({ ...prev, newPassword: text }))}
                  secureTextEntry
                  placeholder="Leave blank to keep current password"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.confirmPassword}
                  onChangeText={(text) => setEditedData(prev => ({ ...prev, confirmPassword: text }))}
                  secureTextEntry
                  placeholder="Leave blank to keep current password"
                />
              </View>
            </>
          )}

          <View style={styles.profileActions}>
            {isEditing ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSaveProfile}
                >
                  <Text style={styles.actionButtonText}>Save Changes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setIsEditing(false);
                    setEditedData({
                      name: technicianData.name || '',
                      email: technicianData.email || '',
                      contactNumber: technicianData.contactNumber || '',
                      specialties: technicianData.specialties || [],
                      certifications: technicianData.certifications || [],
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.actionButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Certification Selection Modal */}
        <Modal
          visible={showCertificationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCertificationModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Certifications</Text>
              <ScrollView style={styles.certificationList}>
                {DEFAULT_CERTIFICATIONS.map((cert) => (
                  <CertificationOption
                    key={cert}
                    certification={cert}
                    isSelected={editedData.certifications.includes(cert)}
                    onPress={() => handleCertificationPress(cert)}
                  />
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCertificationModal(false)}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showMap}
          animationType="slide"
          onRequestClose={() => setShowMap(false)}
        >
          <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowMap(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.mapTitle}>Select Your Location</Text>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={handleConfirmLocation}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.mapSearchContainer}>
              <TextInput
                style={styles.mapSearchInput}
                placeholder="Search location..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity 
                style={styles.useCurrentLocationButton}
                onPress={getLocation}
                disabled={isLoadingLocation}
              >
                <Ionicons name="locate" size={24} color="#1e88e5" />
                <Text style={styles.useCurrentLocationText}>Use Current Location</Text>
              </TouchableOpacity>
            </View>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: location?.latitude || 14.5995,
                longitude: location?.longitude || 120.9842,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
              showsScale={true}
              showsBuildings={true}
              showsTraffic={true}
              showsIndoors={true}
              onPress={handleMapPress}
            >
              {selectedLocation && (
                <Marker
                  coordinate={selectedLocation}
                  title="Selected Location"
                  draggable
                  onDragEnd={(e) => {
                    setSelectedLocation(e.nativeEvent.coordinate);
                  }}
                />
              )}
              {location && !selectedLocation && (
                <Marker
                  coordinate={location}
                  title="Current Location"
                  pinColor="#1e88e5"
                />
              )}
            </MapView>
          </View>
        </Modal>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#dc3545" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHomeContent();
      case 'transactions':
        return (
          <View style={styles.requestsContainer}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="cash-outline" size={64} color="#ccc" />
                <Text style={styles.emptyStateText}>No transactions yet</Text>
              </View>
            ) : (
              <FlatList
                data={transactions}
                renderItem={({ item }) => (
                  <View style={styles.transactionItem}>
                    <View style={styles.transactionHeader}>
                      <View>
                        <Text style={styles.transactionTitle}>{item.repairType} Repair</Text>
                        <Text style={styles.transactionDescription}>{item.description}</Text>
                      </View>
                      <Text style={styles.amountText}>+${item.amount}</Text>
                    </View>
                    <View style={styles.transactionFooter}>
                      <Text style={styles.dateText}>
                        {item.createdAt?.toDate().toLocaleDateString() || 'Recent'}
                      </Text>
                      <View style={styles.paymentMethod}>
                        <Ionicons 
                          name={item.paymentMethod === 'card' ? 'card-outline' : 'cash-outline'} 
                          size={16} 
                          color="#666" 
                        />
                        <Text style={styles.paymentMethodText}>
                          {item.paymentMethod === 'card' ? 'Card' : 'Cash'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        );
      case 'messages':
        return renderMessagesContent();
      case 'profile':
        return <ProfileSection />;
      default:
        return null;
    }
  };

  const renderHomeContent = () => {
    // Calculate real values from data
    const totalEarnings = transactions.reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
    const completedRepairs = transactions.length;
    
    // Rating display logic - show N/A for no reviews
    const ratingDisplay = reviewsCount > 0 
      ? overallRating.toFixed(1) 
      : 'N/A';
    
    return (
      <View style={styles.homeContent}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done" size={24} color="#1e88e5" />
            <Text style={styles.statNumber}>{completedRepairs}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={24} color="#1e88e5" />
            <Text style={styles.statNumber}>{ratingDisplay}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash" size={24} color="#1e88e5" />
            <Text style={styles.statNumber}>${totalEarnings.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
        </View>
        
        <View style={[styles.section, styles.requestsSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Requests</Text>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/screens/TechnicianRequests')}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color="#1e88e5" />
            </TouchableOpacity>
          </View>
          
          {conversations.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="clipboard-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No requests yet</Text>
            </View>
          ) : (
            <>
              {conversations.slice(0, 3).map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.requestItem}
                  onPress={() => router.push({
                    pathname: '/screens/CustomerRequestForm',
                    params: { requestId: item.id }
                  })}
                >
                  <View style={styles.requestHeader}>
                    <Text style={styles.customerName}>{item.customerName || 'Customer'}</Text>
                    <Text style={[
                      styles.statusBadge, 
                      item.status === 'Completed' ? styles.completedStatus : 
                      item.status === 'In Progress' ? styles.inProgressStatus : 
                      styles.pendingStatus
                    ]}>
                      {item.status}
                    </Text>
                  </View>
                  <Text style={styles.issueText}>{item.deviceType} - {item.description}</Text>
                  <Text style={styles.dateText}>
                    Requested on: {item.createdAt?.toDate().toLocaleDateString() || 'Recent'}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
        
        <View style={[styles.section, styles.quickActionsSection]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/screens/TechnicianRequests')}
            >
              <Ionicons name="list" size={24} color="#1e88e5" />
              <Text style={styles.quickActionText}>View Requests</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => setActiveTab('messages')}
            >
              <Ionicons name="chatbubbles" size={24} color="#1e88e5" />
              <Text style={styles.quickActionText}>Messages</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={[styles.section, styles.reviewsSection]}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          {reviewsLoading ? (
            <ActivityIndicator size="small" color="#1e88e5" />
          ) : reviews.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="star-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No reviews yet</Text>
            </View>
          ) : (
            <>
              <View style={styles.ratingOverview}>
                <View style={styles.ratingNumberContainer}>
                  <Text style={styles.ratingNumber}>{overallRating.toFixed(1)}</Text>
                  <View style={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons 
                        key={star}
                        name={star <= Math.round(overallRating) ? "star" : "star-outline"} 
                        size={16} 
                        color="#FFD700" 
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewsCount}>from {reviewsCount} reviews</Text>
                </View>
              </View>
              
              {reviews.map(review => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewCustomerName}>{review.customerName}</Text>
                    <View style={styles.reviewRating}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Ionicons 
                          key={star}
                          name={star <= review.rating ? "star" : "star-outline"} 
                          size={14} 
                          color="#FFD700" 
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewDeviceType}>{review.deviceType} Repair</Text>
                  {review.review ? (
                    <Text style={styles.reviewText}>{review.review}</Text>
                  ) : (
                    <Text style={styles.noReviewText}>No comments provided</Text>
                  )}
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
              
              <TouchableOpacity 
                style={styles.viewAllReviewsButton}
                onPress={() => router.push('/screens/ReviewsScreen')}
              >
                <Text style={styles.viewAllReviewsText}>View All Reviews</Text>
                <Ionicons name="chevron-forward" size={16} color="#1e88e5" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderMessagesContent = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Messages</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#1e88e5" style={styles.loader} />
      ) : conversations.length === 0 ? (
        <Text style={styles.emptyText}>No conversations yet</Text>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.messageCard}
              onPress={() => router.push({
                pathname: '/screens/ChatScreen',
                params: { requestId: item.id }
              })}
            >
              <View style={styles.messageInfo}>
                <Text style={styles.customerName}>
                  {'Customer'}
                </Text>
                <Text style={styles.deviceType}>{item.deviceType}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage || 'No messages yet'}
                </Text>
              </View>
              <View style={styles.messageMeta}>
                <Text style={styles.messageTime}>
                  {item.lastMessageTime ? new Date(item.lastMessageTime.toDate()).toLocaleDateString() : 'Just now'}
                </Text>
                <View style={[
                  styles.statusBadge,
                  item.status === 'Pending' ? styles.pendingBadge :
                  item.status === 'Negotiating' ? styles.negotiatingBadge :
                  item.status === 'In Progress' ? styles.inProgressBadge :
                  styles.completedBadge
                ]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.messagesList}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeHeader}>
          <View style={styles.welcomeLeftSection}>
            <Image 
              source={require('../assets/onboarding1.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeText}>
                Welcome, {technicianData?.name?.split(' ')[0] || 'Technician'}
              </Text>
              <Text style={styles.subtitleText}>Another Day, Another Fix</Text>
            </View>
          </View>
        </View>
      </View>
      
      {/* Main Content */}
      {renderContent()}

      {/* Navigation Bar */}
      <View style={styles.navigationBar}>
        <TouchableOpacity
          style={[styles.navButton, activeTab === 'home' && styles.activeNavButton]}
          onPress={() => setActiveTab('home')}
        >
          <Ionicons
            name="home"
            size={24}
            color={activeTab === 'home' ? '#1e88e5' : '#666'}
          />
          <Text style={[styles.navButtonText, activeTab === 'home' && styles.activeNavButtonText]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, activeTab === 'transactions' && styles.activeNavButton]}
          onPress={() => setActiveTab('transactions')}
        >
          <Ionicons
            name="receipt"
            size={24}
            color={activeTab === 'transactions' ? '#1e88e5' : '#666'}
          />
          <Text style={[styles.navButtonText, activeTab === 'transactions' && styles.activeNavButtonText]}>
            Transactions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, activeTab === 'messages' && styles.activeNavButton]}
          onPress={() => setActiveTab('messages')}
        >
          <Ionicons
            name="chatbubbles"
            size={24}
            color={activeTab === 'messages' ? '#1e88e5' : '#666'}
          />
          <Text style={[styles.navButtonText, activeTab === 'messages' && styles.activeNavButtonText]}>
            Messages
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, activeTab === 'profile' && styles.activeNavButton]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons
            name="person"
            size={24}
            color={activeTab === 'profile' ? '#1e88e5' : '#666'}
          />
          <Text style={[styles.navButtonText, activeTab === 'profile' && styles.activeNavButtonText]}>
            Profile
          </Text>
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
  welcomeSection: {
    padding: 20,
    backgroundColor: '#1e88e5',
    borderBottomWidth: 1,
    borderBottomColor: '#1e88e5',
    marginTop: 40,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  welcomeLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeTextContainer: {
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e88e5',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  requestsContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  viewAllText: {
    color: '#1e88e5',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e88e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  requestButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  requestItem: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  transactionItem: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingStatus: {
    backgroundColor: '#fff9c4',
    color: '#ffa000',
  },
  inProgressStatus: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
  },
  completedStatus: {
    backgroundColor: '#e8f5e9',
    color: '#388e3c',
  },
  issueText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#888',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
  },
  navButton: {
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeNavButton: {
    backgroundColor: '#e3f2fd',
  },
  activeNavButtonText: {
    color: '#1e88e5',
    fontWeight: 'bold',
  },
  // Profile styles
  profileContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  profileBackButton: {
    marginRight: 20,
  },
  profileImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avatarContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  avatarWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  avatarEmoji: {
    fontSize: 40,
    textAlign: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    alignItems: 'center',
  },
  profileForm: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedSpecialty: {
    backgroundColor: '#1e88e5',
    borderColor: '#1e88e5',
  },
  specialtyText: {
    color: '#666',
  },
  selectedSpecialtyText: {
    color: 'white',
  },
  certificationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  certificationText: {
    color: '#333',
    marginRight: 4,
  },
  removeCertification: {
    marginLeft: 4,
  },
  addCertificationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addCertificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 16,
  },
  addCertificationText: {
    color: '#1e88e5',
    marginLeft: 4,
  },
  profileActions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#1e88e5',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 20,
  },
  avatarOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    margin: 5,
  },
  selectedAvatar: {
    borderColor: '#1e88e5',
    borderWidth: 3,
  },
  closeButton: {
    backgroundColor: '#1e88e5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  certificationList: {
    maxHeight: 400,
    width: '100%',
  },
  certificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedCertification: {
    backgroundColor: '#e3f2fd',
  },
  certificationOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedCertificationText: {
    color: '#1e88e5',
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  button: {
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  buttonText: {
    color: '#1e88e5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    zIndex: 2,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  mapSearchContainer: {
    position: 'absolute',
    top: 80, // Adjusted to be below the header
    left: 16,
    right: 16,
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mapSearchInput: {
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  useCurrentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 8,
  },
  useCurrentLocationText: {
    color: '#1e88e5',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  map: {
    flex: 1,
    zIndex: 0,
  },
  addressText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  logoutButtonText: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  messagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e88e5',
    marginTop: 20,
  },
  messagesButtonText: {
    color: '#1e88e5',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  homeContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  requestsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  quickActionsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 150,
    justifyContent: 'center',
  },
  quickActionText: {
    color: '#1e88e5',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 24,
  },
  messageCard: {
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
  messageInfo: {
    flex: 1,
  },
  deviceType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  negotiatingBadge: {
    backgroundColor: '#ffb74d',
  },
  inProgressBadge: {
    backgroundColor: '#4caf50',
  },
  statusText: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  messagesList: {
    padding: 16,
  },
  loader: {
    marginTop: 20,
  },
  pendingBadge: {
    backgroundColor: '#ffd54f',
  },
  completedBadge: {
    backgroundColor: '#9e9e9e',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  viewReviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  viewReviewsText: {
    color: '#1e88e5',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  statsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statCards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statIconContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
  },
  statInfo: {
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  ratingOverview: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ratingNumberContainer: {
    alignItems: 'center',
  },
  ratingNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingStars: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  reviewsCount: {
    fontSize: 14,
    color: '#757575',
  },
  reviewCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewCustomerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewDeviceType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  noReviewText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  viewAllReviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  viewAllReviewsText: {
    color: '#1e88e5',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
});

export default TechnicianDashboard; 