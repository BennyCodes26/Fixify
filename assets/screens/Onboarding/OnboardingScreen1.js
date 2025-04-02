// screens/Onboarding/OnboardingScreen1.js
import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const OnboardingScreen1 = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Center Image */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../../assets/onboarding1.png')} // Add your onboarding image here
          style={styles.image}
          resizeMode="contain"
        />
      </View>
      
      {/* Skip button positioned top right */}
      <TouchableOpacity 
        style={styles.skipButton}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      
      {/* Next button at bottom */}
      <TouchableOpacity 
        style={styles.nextButton}
        onPress={() => navigation.navigate('Onboarding2')}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
      
      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        <View style={[styles.paginationDot, styles.activeDot]} />
        <View style={styles.paginationDot} />
        <View style={styles.paginationDot} />
        <View style={styles.paginationDot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2196F3', // Default blue background
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 250,
    height: 250,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
  },
  skipText: {
    color: 'white',
    fontSize: 16,
  },
  nextButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 40,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: 'white',
  },
});

export default OnboardingScreen1;
