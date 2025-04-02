import * as Location from 'expo-location';

const updateLocation = async () => {
  try {
    // Check if location services are enabled
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      Alert.alert(
        'Location Services Disabled',
        'Please enable location services in your device settings to update your location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    // Request location permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Location permission is required to update your location. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    // Get current location with high accuracy
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 5000,
      distanceInterval: 10,
    });

    // Update location in Firestore
    const locationData = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      address: 'Location updated', // We'll update this after getting the address
      updatedAt: serverTimestamp(),
    };

    // First update the basic location data
    await updateDoc(doc(db, 'users', user.uid), {
      location: locationData,
    });

    // Then try to get the address
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const fullAddress = `${address.street || ''}, ${address.city || ''}, ${address.region || ''}, ${address.country || ''}`.trim();
        await updateDoc(doc(db, 'users', user.uid), {
          'location.address': fullAddress,
        });
      }
    } catch (addressError) {
      console.error('Error getting address:', addressError);
      // Don't show an error to the user since we already updated the coordinates
    }

    Alert.alert('Success', 'Location updated successfully');
  } catch (error) {
    console.error('Error saving location:', error);
    if (error.message.includes('Not authorized')) {
      Alert.alert(
        'Permission Required',
        'Location permission is required. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    } else {
      Alert.alert('Error', 'Failed to update location. Please try again.');
    }
  }
}; 