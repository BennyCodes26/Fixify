import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { CreditCardInput } from 'react-native-credit-card-input';

export default function PaymentScreen() {
  const { requestId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [requestData, setRequestData] = useState(null);
  const [cardData, setCardData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card', 'cash', or 'gcash'
  const [cardValid, setCardValid] = useState(false);
  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashReference, setGcashReference] = useState('');

  useEffect(() => {
    fetchRequestData();
  }, []);

  const fetchRequestData = async () => {
    try {
      setLoading(true);
      const requestRef = doc(db, 'repairRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        Alert.alert('Error', 'Request not found');
        router.back();
        return;
      }
      
      const data = requestDoc.data();
      setRequestData(data);
    } catch (error) {
      console.error('Error fetching request data:', error);
      Alert.alert('Error', 'Failed to load request information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCardChange = (form) => {
    setCardData(form);
    setCardValid(form.valid);
  };

  const processPayment = async () => {
    if (paymentMethod === 'card' && !cardValid) {
      Alert.alert('Error', 'Please enter valid card information');
      return;
    }
    
    if (paymentMethod === 'gcash' && (!gcashNumber || !gcashReference)) {
      Alert.alert('Error', 'Please enter GCash number and reference number');
      return;
    }
    
    try {
      setProcessing(true);
      
      // Simulating payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a transaction document
      const transactionData = {
        requestId: requestId,
        customerId: auth.currentUser.uid,
        technicianId: requestData.technicianId,
        amount: requestData.agreedPrice,
        paymentMethod: paymentMethod,
        status: 'Completed',
        createdAt: serverTimestamp(),
        repairType: requestData.deviceType,
        description: requestData.description,
        // For a real implementation, you'd have payment gateway response data here
        paymentDetails: paymentMethod === 'card' ? {
          cardType: cardData?.values?.type,
          lastFour: cardData?.values?.number?.slice(-4),
          // Never store full card numbers in your database
        } : paymentMethod === 'gcash' ? {
          method: 'GCash',
          phoneNumber: gcashNumber,
          referenceNumber: gcashReference
        } : {
          method: 'Cash on Hand'
        },
      };
      
      // Add transaction to Firestore
      const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update request status
      await updateDoc(doc(db, 'repairRequests', requestId), {
        status: 'Paid',
        paymentCompleted: true,
        paymentDate: serverTimestamp(),
        transactionId: transactionRef.id
      });
      
      // Create an invoice
      const invoiceData = {
        transactionId: transactionRef.id,
        requestId: requestId,
        customerId: auth.currentUser.uid,
        customerName: requestData.customerName,
        technicianId: requestData.technicianId,
        technicianName: requestData.technicianName,
        amount: requestData.agreedPrice,
        paymentMethod: paymentMethod,
        deviceType: requestData.deviceType,
        description: requestData.description,
        completionNotes: requestData.completionNotes,
        createdAt: serverTimestamp(),
        paidAt: serverTimestamp(),
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      };
      
      const invoiceRef = await addDoc(collection(db, 'invoices'), invoiceData);
      
      // Add notification for technician
      await addDoc(collection(db, 'notifications'), {
        userId: requestData.technicianId,
        title: 'Payment Received',
        message: `Payment of $${requestData.agreedPrice} received for ${requestData.deviceType} repair.`,
        read: false,
        createdAt: serverTimestamp(),
        type: 'payment_received',
        requestId: requestId
      });
      
      Alert.alert(
        'Payment Successful',
        'Your payment has been processed successfully. Please rate your experience.',
        [
          {
            text: 'Rate Now',
            onPress: () => router.push({
              pathname: '/screens/RatingScreen',
              params: { requestId: requestId, invoiceId: invoiceRef.id }
            })
          }
        ]
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Payment processing failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e88e5" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e88e5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <View style={styles.orderItem}>
            <Text style={styles.orderItemTitle}>{requestData.deviceType} Repair</Text>
            <Text style={styles.orderItemDescription}>{requestData.description}</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Total:</Text>
              <Text style={styles.priceAmount}>${requestData.agreedPrice}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.paymentMethodOption,
                paymentMethod === 'card' && styles.selectedPaymentMethod
              ]}
              onPress={() => setPaymentMethod('card')}
            >
              <Ionicons 
                name="card" 
                size={24} 
                color={paymentMethod === 'card' ? '#1e88e5' : '#666'} 
              />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'card' && styles.selectedPaymentMethodText
              ]}>
                Credit Card
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentMethodOption,
                paymentMethod === 'cash' && styles.selectedPaymentMethod
              ]}
              onPress={() => setPaymentMethod('cash')}
            >
              <Ionicons 
                name="cash" 
                size={24} 
                color={paymentMethod === 'cash' ? '#1e88e5' : '#666'} 
              />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'cash' && styles.selectedPaymentMethodText
              ]}>
                Cash on Hand
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentMethodOption,
                paymentMethod === 'gcash' && styles.selectedPaymentMethod
              ]}
              onPress={() => setPaymentMethod('gcash')}
            >
              <Ionicons 
                name="phone-portrait" 
                size={24} 
                color={paymentMethod === 'gcash' ? '#1e88e5' : '#666'} 
              />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'gcash' && styles.selectedPaymentMethodText
              ]}>
                GCash
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {paymentMethod === 'card' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Card Details</Text>
            <CreditCardInput 
              onChange={handleCardChange} 
              requiresName={true}
              cardScale={1.0}
              inputStyle={styles.cardInput}
              labelStyle={styles.cardLabel}
            />
          </View>
        )}
        
        {paymentMethod === 'gcash' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GCash Details</Text>
            <Text style={styles.paymentInstructions}>
              Please send your payment to our GCash number: 09XX-XXX-XXXX
            </Text>
            <Text style={styles.paymentInstructions}>
              Enter your details below after completing the payment:
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your GCash Number</Text>
              <TextInput
                style={styles.input}
                value={gcashNumber}
                onChangeText={setGcashNumber}
                placeholder="09XX-XXX-XXXX"
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>GCash Reference Number</Text>
              <TextInput
                style={styles.input}
                value={gcashReference}
                onChangeText={setGcashReference}
                placeholder="Enter reference number from GCash"
              />
            </View>
          </View>
        )}
        
        {paymentMethod === 'cash' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cash on Hand</Text>
            <Text style={styles.paymentInstructions}>
              You've selected to pay with cash directly to the technician.
            </Text>
            <Text style={styles.paymentInstructions}>
              Please prepare the exact amount of ${requestData.agreedPrice} to hand to the technician.
            </Text>
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle" size={24} color="#ffa000" />
              <Text style={styles.noteText}>
                The technician will mark the payment as complete once they receive the cash.
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.payButton,
            ((paymentMethod === 'card' && !cardValid) || 
             (paymentMethod === 'gcash' && (!gcashNumber || !gcashReference))) && styles.disabledButton
          ]}
          onPress={processPayment}
          disabled={processing || 
                   (paymentMethod === 'card' && !cardValid) || 
                   (paymentMethod === 'gcash' && (!gcashNumber || !gcashReference))}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.payButtonText}>
                Pay ${requestData.agreedPrice}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  orderItem: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  orderItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  orderItemDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  priceLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 4,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedPaymentMethod: {
    borderColor: '#1e88e5',
    backgroundColor: '#e3f2fd',
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  selectedPaymentMethodText: {
    color: '#1e88e5',
    fontWeight: 'bold',
  },
  cardInput: {
    fontSize: 16,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cardLabel: {
    color: '#666',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentInstructions: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    lineHeight: 24,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff9c4',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e88e5',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  disabledButton: {
    backgroundColor: '#9e9e9e',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
  },
}); 