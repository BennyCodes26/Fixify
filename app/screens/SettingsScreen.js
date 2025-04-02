import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);

  const renderSettingItem = ({ icon, title, value, onPress, type = 'arrow' }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingItemLeft}>
        <Ionicons name={icon} size={24} color="#666" />
        <Text style={styles.settingItemTitle}>{title}</Text>
      </View>
      {type === 'arrow' ? (
        <Ionicons name="chevron-forward" size={24} color="#666" />
      ) : type === 'switch' ? (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={value ? '#1E88E5' : '#f4f3f4'}
        />
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {renderSettingItem({
          icon: 'person-outline',
          title: 'Edit Profile',
          onPress: () => {},
        })}
        {renderSettingItem({
          icon: 'key-outline',
          title: 'Change Password',
          onPress: () => {},
        })}
        {renderSettingItem({
          icon: 'notifications-outline',
          title: 'Notifications',
          value: notifications,
          onPress: () => setNotifications(!notifications),
          type: 'switch',
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        {renderSettingItem({
          icon: 'moon-outline',
          title: 'Dark Mode',
          value: darkMode,
          onPress: () => setDarkMode(!darkMode),
          type: 'switch',
        })}
        {renderSettingItem({
          icon: 'language-outline',
          title: 'Language',
          onPress: () => {},
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        {renderSettingItem({
          icon: 'help-circle-outline',
          title: 'Help Center',
          onPress: () => {},
        })}
        {renderSettingItem({
          icon: 'document-text-outline',
          title: 'Terms of Service',
          onPress: () => {},
        })}
        {renderSettingItem({
          icon: 'shield-checkmark-outline',
          title: 'Privacy Policy',
          onPress: () => {},
        })}
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemTitle: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  logoutButton: {
    margin: 24,
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 