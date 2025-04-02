import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after resources are loaded
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
            title: 'Welcome'
          }} 
        />
        <Stack.Screen 
          name="(auth)" 
          options={{ 
            headerShown: false,
            title: 'Authentication'
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            title: 'Main App'
          }} 
        />
        <Stack.Screen 
          name="serviceRequest" 
          options={{ 
            headerShown: false,
            title: 'Service Request'
          }} 
        />
        <Stack.Screen 
          name="technicianProfileView" 
          options={{ 
            headerShown: false,
            title: 'Technician Profile'
          }} 
        />
        <Stack.Screen 
          name="nearbyTechnicians" 
          options={{ 
            headerShown: false,
            title: 'Nearby Technicians'
          }} 
        />
        <Stack.Screen 
          name="serviceRequestForm" 
          options={{ 
            headerShown: false,
            title: 'Service Request Form'
          }} 
        />
        <Stack.Screen 
          name="technicianRequestForm" 
          options={{ 
            headerShown: false,
            title: 'Technician Request Form'
          }} 
        />
        <Stack.Screen 
          name="screens/PaymentScreen" 
          options={{ 
            headerShown: false,
            title: 'Payment'
          }} 
        />
        <Stack.Screen 
          name="screens/RatingScreen" 
          options={{ 
            headerShown: false,
            title: 'Rate Technician'
          }} 
        />
        <Stack.Screen 
          name="screens/InvoiceScreen" 
          options={{ 
            headerShown: false,
            title: 'Invoice'
          }} 
        />
        <Stack.Screen 
          name="screens/ReviewsScreen" 
          options={{ 
            headerShown: false,
            title: 'Reviews'
          }} 
        />
      </Stack>
    </GestureHandlerRootView>
  );
} 