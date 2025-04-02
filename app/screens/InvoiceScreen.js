import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export default function InvoiceScreen() {
  const { invoiceId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [generating, setGenerating] = useState(false);
  const invoiceRef = useRef(null);

  useEffect(() => {
    fetchInvoiceData();
  }, []);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'invoices', invoiceId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        Alert.alert('Error', 'Invoice not found');
        router.back();
        return;
      }
      
      setInvoice({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        paidAt: docSnap.data().paidAt?.toDate() || new Date(),
      });
    } catch (error) {
      console.error('Error fetching invoice:', error);
      Alert.alert('Error', 'Failed to load invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const generateShareHTML = () => {
    if (!invoice) return '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #e0e0e0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            padding: 30px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1e88e5;
            margin-bottom: 10px;
          }
          .meta {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .meta-col {
            flex: 1;
          }
          .label {
            font-weight: bold;
            margin-bottom: 5px;
            color: #666;
          }
          .value {
            margin-bottom: 15px;
          }
          .item {
            display: flex;
            border-bottom: 1px solid #e0e0e0;
            padding: 15px 0;
          }
          .item-description {
            flex: 2;
          }
          .item-amount {
            flex: 1;
            text-align: right;
          }
          .total {
            text-align: right;
            margin-top: 20px;
            font-size: 18px;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
          .success {
            background-color: #e8f5e9;
            color: #2e7d32;
            padding: 10px;
            text-align: center;
            margin-bottom: 20px;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <h1>FIXIFY</h1>
            <p>Invoice #${invoice.invoiceNumber}</p>
          </div>
          
          <div class="success">
            <strong>PAID</strong> - ${formatDate(invoice.paidAt)}
          </div>
          
          <div class="meta">
            <div class="meta-col">
              <div class="label">From:</div>
              <div class="value">${invoice.technicianName}</div>
              
              <div class="label">To:</div>
              <div class="value">${invoice.customerName}</div>
              
              <div class="label">Device:</div>
              <div class="value">${invoice.deviceType}</div>
            </div>
            
            <div class="meta-col">
              <div class="label">Invoice Date:</div>
              <div class="value">${formatDate(invoice.createdAt)}</div>
              
              <div class="label">Payment Method:</div>
              <div class="value">${invoice.paymentMethod === 'card' ? 'Credit Card' : 
                               invoice.paymentMethod === 'gcash' ? 'GCash' : 'Cash on Hand'}</div>
            </div>
          </div>
          
          <div>
            <div class="item">
              <div class="item-description">
                <strong>${invoice.deviceType} Repair</strong>
                <br />
                ${invoice.description}
              </div>
              <div class="item-amount">$${invoice.amount}</div>
            </div>
            
            <div class="total">
              Total: $${invoice.amount}
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>For any questions, please contact Fixify Support.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const shareInvoice = async () => {
    try {
      setGenerating(true);
      
      const html = generateShareHTML();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      
    } catch (error) {
      console.error('Error sharing invoice:', error);
      Alert.alert('Error', 'Failed to share invoice. Please try again.');
    } finally {
      setGenerating(false);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e88e5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice</Text>
        <TouchableOpacity style={styles.shareButton} onPress={shareInvoice}>
          {generating ? (
            <ActivityIndicator size="small" color="#1e88e5" />
          ) : (
            <Ionicons name="share-outline" size={24} color="#1e88e5" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} ref={invoiceRef}>
        <View style={styles.invoiceContainer}>
          <View style={styles.invoiceHeader}>
            <Text style={styles.logo}>FIXIFY</Text>
            <Text style={styles.invoiceNumber}>Invoice #{invoice.invoiceNumber}</Text>
          </View>
          
          <View style={styles.paidStatus}>
            <Ionicons name="checkmark-circle" size={16} color="#2e7d32" />
            <Text style={styles.paidText}>PAID - {formatDate(invoice.paidAt)}</Text>
          </View>
          
          <View style={styles.infoContainer}>
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>From:</Text>
              <Text style={styles.infoValue}>{invoice.technicianName}</Text>
              
              <Text style={styles.infoLabel}>To:</Text>
              <Text style={styles.infoValue}>{invoice.customerName}</Text>
              
              <Text style={styles.infoLabel}>Device:</Text>
              <Text style={styles.infoValue}>{invoice.deviceType}</Text>
            </View>
            
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>Invoice Date:</Text>
              <Text style={styles.infoValue}>{formatDate(invoice.createdAt)}</Text>
              
              <Text style={styles.infoLabel}>Payment Method:</Text>
              <Text style={styles.infoValue}>
                {invoice.paymentMethod === 'card' ? 'Credit Card' : 
                 invoice.paymentMethod === 'gcash' ? 'GCash' : 'Cash on Hand'}
              </Text>
            </View>
          </View>
          
          <View style={styles.lineItem}>
            <View style={styles.lineItemDescription}>
              <Text style={styles.lineItemTitle}>{invoice.deviceType} Repair</Text>
              <Text style={styles.lineItemDetail}>{invoice.description}</Text>
            </View>
            <Text style={styles.lineItemAmount}>${invoice.amount}</Text>
          </View>
          
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>${invoice.amount}</Text>
          </View>
          
          {invoice.completionNotes && (
            <View style={styles.completionNotes}>
              <Text style={styles.notesLabel}>Repair Notes:</Text>
              <Text style={styles.notesText}>{invoice.completionNotes}</Text>
            </View>
          )}
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your business!</Text>
            <Text style={styles.footerText}>For any questions, please contact Fixify Support.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
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
    paddingRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  invoiceContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  invoiceHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e88e5',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 16,
    color: '#666',
  },
  paidStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 4,
    marginBottom: 20,
  },
  paidText: {
    color: '#2e7d32',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  infoContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  lineItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  lineItemDescription: {
    flex: 2,
  },
  lineItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  lineItemDetail: {
    fontSize: 14,
    color: '#666',
  },
  lineItemAmount: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  completionNotes: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
}); 