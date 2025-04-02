// screens/Onboarding/OnboardingScreen3.js
import React from 'react';
import { StyleSheet, View, Image, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const OnboardingScreen3 = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Center Content */}
      <View style={styles.contentContainer}>
        <Image
          source={require('../../assets/onboarding3.png')} // Add your onboarding image here
          style={styles.image}
          resizeMode="contain"
        />
        <Text style={styles.title}>Expert Technicians</Text>
        <Text style={styles.description}>
          Our verified technicians have the skills and tools to solve your problems efficiently.
        </Text>
      </View>
      
      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <View style={styles.buttonRow}>
          {/* Back button - white background with black text */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.navigate('Onboarding2')}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          
          {/* Next button - blue background with white text */}
          <TouchableOpacity 
            style={styles.nextButton}
            onPress={() => navigation.navigate('Onboarding4')}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
        
        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          <View style={styles.paginationDot} />
          <View style={styles.paginationDot} />
          <View style={[styles.paginationDot, styles.activeDot]} />
          <View style={styles.paginationDot} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    flex: 1,
    marginRight: 10,
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
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

export default OnboardingScreen3;
