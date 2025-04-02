import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../../config/firebase';
import { getDoc, doc } from 'firebase/firestore';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          router.replace('/customerProfile');
        } else if (userData?.userType === 'technician') {
          router.replace('/technicianProfile');
        }
      } catch (error) {
        console.error('Error checking user type:', error);
        router.replace('/(auth)/login');
      } finally {
        setLoading(false);
      }
    };

    checkUserType();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1e88e5" />
      </View>
    );
  }

  return null;
} 