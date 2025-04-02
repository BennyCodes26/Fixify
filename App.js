// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import OnboardingScreen1 from './screens/Onboarding/OnboardingScreen1';
import OnboardingScreen2 from './screens/Onboarding/OnboardingScreen2';
import OnboardingScreen3 from './screens/Onboarding/OnboardingScreen3';
import OnboardingScreen4 from './screens/Onboarding/OnboardingScreen4';
import LoginScreen from './screens/Auth/LoginScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Onboarding1"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Onboarding1" component={OnboardingScreen1} />
        <Stack.Screen name="Onboarding2" component={OnboardingScreen2} />
        <Stack.Screen name="Onboarding3" component={OnboardingScreen3} />
        <Stack.Screen name="Onboarding4" component={OnboardingScreen4} />
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
