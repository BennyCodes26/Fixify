// screens/Onboarding/OnboardingScreen2.js
import React from 'react';
import { StyleSheet, View, Image, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const OnboardingScreen2 = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Center Content */}
      <View style={styles.contentContainer}>
        <Image
          source={require('../../assets/onboarding2.png')} // Add your onboarding image here
          style={styles.image}
          resizeMode="contain"
        />
        <Text style={styles.title}>Quick Repairs</Text>
        <Text style={styles.description}>
          Connect with skilled technicians in your area for fast and reliable repairs.
        </Text>
      </View>
      
      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        {/* Next button - white text on blue background */}
        <TouchableOpacity 
          style={styles.nextButton}
          onPress={() => navigation.navigate('Onboarding3')}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
        
        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          <View style={styles.paginationDot} />
          <View style={[styles.paginationDot, styles.activeDot]} />
          <View style={styles.paginationDot} />
          <View style={styles.paginationDot} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white', // White background as specified
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  nextButton: {
    backgroundColor: '#2196F3', // Blue button
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DDDDDD',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#2196F3',
  },
});

export default OnboardingScreen2;
