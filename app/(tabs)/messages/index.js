import React from 'react';
import { View, StyleSheet } from 'react-native';
import MessagingScreen from '../../screens/MessagingScreen';

export default function MessagesScreen() {
  return (
    <View style={styles.container}>
      <MessagingScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
}); 