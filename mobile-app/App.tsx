import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
  Platform,
  Modal
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

// Dynamically determine computer's IP address so physical phones on Expo Go connect seamlessly
const getBackendHost = () => {
  if (Platform.OS === 'web') {
    return 'localhost:5000';
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `${ip}:5000`;
  }
  return '192.168.0.10:5000';
};

const BACKEND_HOST = getBackendHost();
const API_URL = `http://${BACKEND_HOST}`;
const WS_URL = `ws://${BACKEND_HOST}/ws?riderId=rider-ralt-001`;

interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  vehicle_number: string;
  is_online: number;
}

interface OrderItem {
  name: string;
  quantity: number;
}

interface ONDCOrder {
  orderId: string;
  transactionId: string;
  status: 'Searching-for-Agent' | 'Agent-assigned' | 'At-pickup' | 'Order-picked-up' | 'In-transit' | 'Order-delivered' | 'Cancelled';
  deliveryFee: number;
  deliveryOtp: string;
  pickup: {
    name: string;
    phone: string;
    address: string;
    gps: { lat: number; lng: number };
  };
  drop: {
    name: string;
    phone: string;
    address: string;
    gps: { lat: number; lng: number };
  };
  items: OrderItem[];
  createdAt: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'deliveries' | 'active_task' | 'earnings' | 'profile'>('deliveries');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [rider, setRider] = useState<RiderProfile | null>(null);
  
  // Real orders
  const [activeOrders, setActiveOrders] = useState<ONDCOrder[]>([]);
  const [currentOrder, setCurrentOrder] = useState<ONDCOrder | null>(null);
  
  // Incoming order alert modal
  const [incomingOrder, setIncomingOrder] = useState<ONDCOrder | null>(null);
  
  // Delivery Verification OTP input
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // Real Earnings state
  const [earnings, setEarnings] = useState<{ total: number; count: number; history: any[] }>({
    total: 0,
    count: 0,
    history: []
  });

  const wsRef = useRef<WebSocket | null>(null);

  // 1. Fetch real rider profile & real orders
  const refreshData = async () => {
    try {
      // Profile
      const pRes = await fetch(`${API_URL}/api/rider/profile?riderId=rider-ralt-001`);
      if (pRes.ok) {
        const pData = await pRes.json();
        setRider(pData.rider);
        setIsOnline(pData.rider.is_online === 1);
      }

      // Active Orders
      const oRes = await fetch(`${API_URL}/api/rider/orders?riderId=rider-ralt-001`);
      if (oRes.ok) {
        const oData = await oRes.json();
        const orders: ONDCOrder[] = oData.orders || [];
        setActiveOrders(orders);
        if (orders.length > 0 && !currentOrder) {
          setCurrentOrder(orders[0]);
        }
      }

      // Earnings
      const eRes = await fetch(`${API_URL}/api/rider/earnings?riderId=rider-ralt-001`);
      if (eRes.ok) {
        const eData = await eRes.json();
        setEarnings(eData);
      }
    } catch (err) {
      console.warn('API error:', err);
    }
  };

  // 2. Connect Real-time WebSocket
  const setupWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log('[Rider App] Connected to WebSocket Dispatch');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Rider App] Received WebSocket event:', data.type);

          if (data.type === 'CONNECTED') {
            if (data.rider) {
              setRider(data.rider);
              setIsOnline(data.rider.is_online === 1);
            }
            if (data.activeOrders && data.activeOrders.length > 0) {
              setActiveOrders(data.activeOrders);
              setCurrentOrder(data.activeOrders[0]);
            }
          } else if (data.type === 'ORDER_DISPATCH' || data.type === 'ORDER_AVAILABLE') {
            // Real-time incoming order popup!
            setIncomingOrder(data.order);
          } else if (data.type === 'ORDER_UPDATED') {
            setCurrentOrder(data.order);
            refreshData();
          } else if (data.type === 'EARNING_CREDITED') {
            refreshData();
          }
        } catch (e) {}
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Attempt reconnect after 4 seconds
        setTimeout(setupWebSocket, 4000);
      };
    } catch (e) {
      setWsConnected(false);
    }
  };

  useEffect(() => {
    refreshData();
    setupWebSocket();

    const interval = setInterval(refreshData, 5000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 3. Toggle Online/Offline
  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value);
    try {
      await fetch(`${API_URL}/api/rider/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId: 'rider-ralt-001', isOnline: value })
      });
      refreshData();
    } catch (e) {}
  };

  // 4. Accept Incoming Real Order
  const acceptIncomingOrder = () => {
    if (!incomingOrder) return;
    setCurrentOrder(incomingOrder);
    setActiveOrders(prev => [incomingOrder, ...prev]);
    setIncomingOrder(null);
    setActiveTab('active_task');
  };

  // 5. Update Order Status in Backend
  const handleUpdateStatus = async (newStatus: string) => {
    if (!currentOrder) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rider/orders/${currentOrder.orderId}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentOrder(data.order);
        refreshData();
      }
    } catch (err: any) {
      Alert.alert('Network Error', 'Could not update status on server.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Verify Customer OTP and Complete Delivery
  const handleVerifyOtp = async () => {
    if (!currentOrder) return;
    if (!otpInput || otpInput.trim().length !== 4) {
      setOtpError('Please enter the exact 4-digit code given by customer.');
      return;
    }

    setOtpError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rider/orders/${currentOrder.orderId}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpInput.trim() })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        Alert.alert('🎉 Delivery Completed!', `Successfully delivered! ₹${currentOrder.deliveryFee} added to your wallet.`);
        setOtpInput('');
        setCurrentOrder(null);
        refreshData();
        setActiveTab('earnings');
      } else {
        setOtpError(data.error || 'Incorrect OTP. Ask customer for the 4-digit code.');
      }
    } catch (err: any) {
      setOtpError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.brandTitle}>
              <Text style={{ color: '#38bdf8' }}>RALT</Text> Rider
            </Text>
            <View style={[styles.socketDot, { backgroundColor: wsConnected ? '#10b981' : '#f43f5e' }]} />
            <Text style={{ fontSize: 11, color: wsConnected ? '#10b981' : '#f43f5e', fontWeight: '600' }}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </Text>
          </View>
          <Text style={styles.brandSub}>ONDC Logistics Partner (P2P / LOG10)</Text>
        </View>

        <View style={styles.onlineToggleBox}>
          <Text style={[styles.onlineLabel, { color: isOnline ? '#34d399' : '#94a3b8' }]}>
            {isOnline ? 'DUTY ON' : 'OFF DUTY'}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#334155', true: '#0284c7' }}
            thumbColor={isOnline ? '#38bdf8' : '#64748b'}
          />
        </View>
      </View>

      {/* Real Incoming Order Alert Modal */}
      {incomingOrder && (
        <Modal transparent animationType="slide" visible={Boolean(incomingOrder)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 24 }}>🚨</Text>
                <View>
                  <Text style={styles.modalTitle}>NEW ONDC ORDER ASSIGNED</Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8' }}>{incomingOrder.orderId}</Text>
                </View>
                <View style={styles.payoutBadge}>
                  <Text style={styles.payoutBadgeText}>+₹{incomingOrder.deliveryFee}</Text>
                </View>
              </View>

              <View style={styles.modalRouteBox}>
                <View style={styles.routeRow}>
                  <Text style={{ fontSize: 16 }}>🏪</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.routeHeader}>PICKUP RESTAURANT</Text>
                    <Text style={styles.routeMain}>{incomingOrder.pickup.name}</Text>
                    <Text style={styles.routeSub}>{incomingOrder.pickup.address}</Text>
                  </View>
                </View>

                <View style={styles.routeDivider} />

                <View style={styles.routeRow}>
                  <Text style={{ fontSize: 16 }}>📍</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.routeHeader}>DELIVERY DROP</Text>
                    <Text style={styles.routeMain}>{incomingOrder.drop.name}</Text>
                    <Text style={styles.routeSub}>{incomingOrder.drop.address}</Text>
                  </View>
                </View>
              </View>

              <View style={{ marginVertical: 12, padding: 10, backgroundColor: '#0f172a', borderRadius: 8 }}>
                <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>ITEMS TO COLLECT:</Text>
                {incomingOrder.items.map((it, idx) => (
                  <Text key={idx} style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>
                    • {it.name} (Qty: {it.quantity})
                  </Text>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#334155' }]}
                  onPress={() => setIncomingOrder(null)}
                >
                  <Text style={{ color: '#cbd5e1', fontWeight: '700' }}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#0284c7', flex: 2 }]}
                  onPress={acceptIncomingOrder}
                >
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>ACCEPT ORDER</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* TAB 1: DELIVERIES LIST */}
        {activeTab === 'deliveries' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Deliveries</Text>
              <Text style={{ fontSize: 13, color: '#94a3b8' }}>
                {activeOrders.length} order{activeOrders.length === 1 ? '' : 's'} in queue
              </Text>
            </View>

            {activeOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 44, marginBottom: 12 }}>🛵</Text>
                <Text style={styles.emptyTitle}>
                  {isOnline ? 'Waiting for ONDC Orders...' : 'You are currently Offline'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {isOnline
                    ? 'Orders from ONDC Buyer Apps (Paytm, Magicpin, ONDC Workbench) will automatically ring your phone here.'
                    : 'Turn on DUTY ON switch at the top to receive incoming orders.'}
                </Text>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { marginTop: 16 }]}
                  onPress={refreshData}
                >
                  <Text style={styles.primaryActionBtnText}>🔄 Refresh Orders</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeOrders.map((ord) => (
                <TouchableOpacity
                  key={ord.orderId}
                  style={styles.orderListItem}
                  onPress={() => {
                    setCurrentOrder(ord);
                    setActiveTab('active_task');
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#38bdf8', fontWeight: '800', fontSize: 15 }}>{ord.orderId}</Text>
                    <View style={styles.payoutBadge}>
                      <Text style={styles.payoutBadgeText}>₹{ord.deliveryFee} PAYOUT</Text>
                    </View>
                  </View>

                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                    From: {ord.pickup.name}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>
                    To: {ord.drop.address}
                  </Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8 }}>
                    <Text style={{ color: '#34d399', fontWeight: '700', fontSize: 12 }}>
                      STATUS: {ord.status.toUpperCase()}
                    </Text>
                    <Text style={{ color: '#38bdf8', fontWeight: '700', fontSize: 13 }}>View Task →</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* TAB 2: ACTIVE TASK STEPPER & OTP VERIFICATION */}
        {activeTab === 'active_task' && (
          <View>
            {!currentOrder ? (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
                <Text style={styles.emptyTitle}>No Active Delivery Task</Text>
                <Text style={styles.emptyDesc}>Select an order from the Deliveries tab to start fulfillment.</Text>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { marginTop: 16 }]}
                  onPress={() => setActiveTab('deliveries')}
                >
                  <Text style={styles.primaryActionBtnText}>Go to Deliveries</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* Order Top Bar */}
                <View style={styles.taskCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>ORDER ID</Text>
                      <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>{currentOrder.orderId}</Text>
                    </View>
                    <View style={styles.payoutBadge}>
                      <Text style={styles.payoutBadgeText}>₹{currentOrder.deliveryFee} EARNING</Text>
                    </View>
                  </View>

                  {/* Progressive Stepper */}
                  <View style={styles.stepperContainer}>
                    <View style={[styles.stepDot, currentOrder.status !== 'Searching-for-Agent' && styles.stepActive]}>
                      <Text style={styles.stepNum}>1</Text>
                    </View>
                    <View style={[styles.stepLine, (currentOrder.status === 'At-pickup' || currentOrder.status === 'Order-picked-up' || currentOrder.status === 'In-transit' || currentOrder.status === 'Order-delivered') && styles.lineActive]} />
                    
                    <View style={[styles.stepDot, (currentOrder.status === 'At-pickup' || currentOrder.status === 'Order-picked-up' || currentOrder.status === 'In-transit' || currentOrder.status === 'Order-delivered') && styles.stepActive]}>
                      <Text style={styles.stepNum}>2</Text>
                    </View>
                    <View style={[styles.stepLine, (currentOrder.status === 'Order-picked-up' || currentOrder.status === 'In-transit' || currentOrder.status === 'Order-delivered') && styles.lineActive]} />
                    
                    <View style={[styles.stepDot, (currentOrder.status === 'In-transit' || currentOrder.status === 'Order-delivered') && styles.stepActive]}>
                      <Text style={styles.stepNum}>3</Text>
                    </View>
                    <View style={[styles.stepLine, currentOrder.status === 'Order-delivered' && styles.lineActive]} />

                    <View style={[styles.stepDot, currentOrder.status === 'Order-delivered' && styles.stepActive]}>
                      <Text style={styles.stepNum}>4</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={styles.stepText}>Assigned</Text>
                    <Text style={styles.stepText}>At Store</Text>
                    <Text style={styles.stepText}>Picked Up</Text>
                    <Text style={styles.stepText}>Delivered</Text>
                  </View>

                  {/* Stage-based action UI */}
                  {currentOrder.status === 'Agent-assigned' && (
                    <View style={styles.actionSection}>
                      <Text style={styles.sectionActionTitle}>📍 Navigate to Restaurant</Text>
                      <View style={styles.infoBox}>
                        <Text style={{ color: '#38bdf8', fontWeight: '700', fontSize: 15 }}>{currentOrder.pickup.name}</Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 13, marginTop: 2 }}>{currentOrder.pickup.address}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Phone: {currentOrder.pickup.phone}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => handleUpdateStatus('At-pickup')}
                        disabled={loading}
                      >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryActionBtnText}>✓ I Have Reached Restaurant</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {currentOrder.status === 'At-pickup' && (
                    <View style={styles.actionSection}>
                      <Text style={styles.sectionActionTitle}>📦 Collect Items from Kitchen</Text>
                      <View style={styles.infoBox}>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>VERIFY ORDER CONTENTS:</Text>
                        {currentOrder.items.map((it, idx) => (
                          <Text key={idx} style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                            ☑ {it.quantity}x {it.name}
                          </Text>
                        ))}
                      </View>

                      <TouchableOpacity
                        style={[styles.primaryActionBtn, { backgroundColor: '#ea580c' }]}
                        onPress={() => handleUpdateStatus('Order-picked-up')}
                        disabled={loading}
                      >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryActionBtnText}>✓ Confirm Items Picked Up</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {currentOrder.status === 'Order-picked-up' && (
                    <View style={styles.actionSection}>
                      <Text style={styles.sectionActionTitle}>🛵 Start Delivery to Customer</Text>
                      <View style={styles.infoBox}>
                        <Text style={{ color: '#38bdf8', fontWeight: '700', fontSize: 15 }}>Customer: {currentOrder.drop.name}</Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 13, marginTop: 2 }}>{currentOrder.drop.address}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Phone: {currentOrder.drop.phone}</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.primaryActionBtn, { backgroundColor: '#8b5cf6' }]}
                        onPress={() => handleUpdateStatus('In-transit')}
                        disabled={loading}
                      >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryActionBtnText}>🛵 Start Journey to Customer</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {currentOrder.status === 'In-transit' && (
                    <View style={styles.actionSection}>
                      <Text style={styles.sectionActionTitle}>🔐 Customer Delivery Verification</Text>
                      <View style={styles.infoBox}>
                        <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                          Arrived at <Text style={{ color: 'white', fontWeight: '700' }}>{currentOrder.drop.address}</Text>.
                        </Text>
                        <Text style={{ color: '#38bdf8', fontSize: 13, marginTop: 4 }}>
                          Ask customer for their 4-digit ONDC Delivery OTP:
                        </Text>
                      </View>

                      <View style={{ marginVertical: 14 }}>
                        <TextInput
                          style={styles.otpInput}
                          placeholder="ENTER 4-DIGIT OTP"
                          placeholderTextColor="#64748b"
                          keyboardType="numeric"
                          maxLength={4}
                          value={otpInput}
                          onChangeText={(t) => {
                            setOtpInput(t);
                            setOtpError('');
                          }}
                        />
                        {otpError ? (
                          <Text style={{ color: '#f43f5e', fontSize: 13, marginTop: 6, fontWeight: '600', textAlign: 'center' }}>
                            {otpError}
                          </Text>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        style={[styles.primaryActionBtn, { backgroundColor: '#10b981' }]}
                        onPress={handleVerifyOtp}
                        disabled={loading}
                      >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryActionBtnText}>VERIFY OTP & COMPLETE DELIVERY</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {currentOrder.status === 'Order-delivered' && (
                    <View style={{ alignItems: 'center', padding: 20 }}>
                      <Text style={{ fontSize: 48, marginBottom: 8 }}>🎉</Text>
                      <Text style={{ color: '#34d399', fontSize: 18, fontWeight: '800' }}>ORDER DELIVERED!</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>₹{currentOrder.deliveryFee} credited to your ledger.</Text>
                      <TouchableOpacity
                        style={[styles.primaryActionBtn, { marginTop: 16 }]}
                        onPress={() => setActiveTab('earnings')}
                      >
                        <Text style={styles.primaryActionBtnText}>View Earnings Wallet →</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* TAB 3: REAL EARNINGS LEDGER */}
        {activeTab === 'earnings' && (
          <View>
            <View style={styles.earningsSummaryCard}>
              <Text style={{ color: '#94a3b8', fontSize: 13, textTransform: 'uppercase' }}>Today's Total Payout</Text>
              <Text style={{ color: '#34d399', fontSize: 36, fontWeight: '800', marginVertical: 6 }}>
                ₹{earnings.total.toFixed(2)}
              </Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                Completed Deliveries: <Text style={{ color: 'white', fontWeight: '700' }}>{earnings.count}</Text>
              </Text>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>Trip Earnings History</Text>
              {earnings.history.length === 0 ? (
                <View style={[styles.emptyCard, { padding: 30 }]}>
                  <Text style={{ color: '#94a3b8' }}>No completed trips recorded yet.</Text>
                </View>
              ) : (
                earnings.history.map((h, i) => (
                  <View key={h.id || i} style={styles.historyRow}>
                    <View>
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>{h.order_id}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>{h.description || 'Delivery payout'}</Text>
                      <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{new Date(h.created_at).toLocaleString()}</Text>
                    </View>
                    <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 16 }}>+₹{h.amount}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* TAB 4: RIDER PROFILE */}
        {activeTab === 'profile' && (
          <View>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={{ fontSize: 32 }}>👨‍✈️</Text>
              </View>
              <Text style={styles.profileName}>{rider?.name || 'Raju Kumar'}</Text>
              <Text style={styles.profileVehicle}>Vehicle: {rider?.vehicle_number || 'TS-09-EA-1234'}</Text>
              <Text style={styles.profilePhone}>{rider?.phone || '+91 98765 43210'}</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={{ color: '#94a3b8' }}>ONDC Subscriber</Text>
                <Text style={{ color: 'white', fontWeight: '600' }}>ralt.in (BPP)</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: '#94a3b8' }}>Domain Role</Text>
                <Text style={{ color: 'white', fontWeight: '600' }}>ONDC:LOG10 (Hyperlocal)</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: '#94a3b8' }}>Database Engine</Text>
                <Text style={{ color: '#38bdf8', fontWeight: '600' }}>SQLite (Zero Dummy Data)</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: '#94a3b8' }}>Dispatch Sync</Text>
                <Text style={{ color: '#34d399', fontWeight: '600' }}>WebSocket Real-Time</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('deliveries')}
        >
          <Text style={{ fontSize: 20 }}>🛵</Text>
          <Text style={[styles.navText, activeTab === 'deliveries' && styles.navActiveText]}>
            Deliveries
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('active_task')}
        >
          <Text style={{ fontSize: 20 }}>📋</Text>
          <Text style={[styles.navText, activeTab === 'active_task' && styles.navActiveText]}>
            Active Task
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('earnings')}
        >
          <Text style={{ fontSize: 20 }}>💰</Text>
          <Text style={[styles.navText, activeTab === 'earnings' && styles.navActiveText]}>
            Earnings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={{ fontSize: 20 }}>👤</Text>
          <Text style={[styles.navText, activeTab === 'profile' && styles.navActiveText]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    width: '100%',
    alignSelf: 'center',
    height: '100%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a'
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc'
  },
  brandSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  socketDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  onlineToggleBox: {
    alignItems: 'flex-end'
  },
  onlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4
  },
  content: {
    padding: 16,
    paddingBottom: 90
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc'
  },
  emptyCard: {
    backgroundColor: '#151e2e',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233147',
    marginTop: 10
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18
  },
  orderListItem: {
    backgroundColor: '#151e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#233147'
  },
  payoutBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  payoutBadgeText: {
    color: '#34d399',
    fontWeight: '800',
    fontSize: 12
  },
  taskCard: {
    backgroundColor: '#151e2e',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#233147'
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepActive: {
    backgroundColor: '#0284c7'
  },
  stepNum: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700'
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#334155'
  },
  lineActive: {
    backgroundColor: '#0284c7'
  },
  stepText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600'
  },
  actionSection: {
    marginTop: 10
  },
  sectionActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8
  },
  infoBox: {
    backgroundColor: '#0b1120',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14
  },
  primaryActionBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryActionBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 14
  },
  otpInput: {
    backgroundColor: '#0b1120',
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderRadius: 10,
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 12,
    letterSpacing: 6
  },
  earningsSummaryCard: {
    backgroundColor: '#151e2e',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233147'
  },
  historyRow: {
    backgroundColor: '#151e2e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233147'
  },
  profileCard: {
    backgroundColor: '#151e2e',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233147',
    marginBottom: 16
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0369a1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: 'white'
  },
  profileVehicle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4
  },
  profilePhone: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  detailCard: {
    backgroundColor: '#151e2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#233147'
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
    justifyContent: 'space-around'
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4
  },
  navText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
    fontWeight: '600'
  },
  navActiveText: {
    color: '#38bdf8',
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    backgroundColor: '#151e2e',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 2,
    borderColor: '#0284c7'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38bdf8'
  },
  modalRouteBox: {
    backgroundColor: '#0b1120',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#233147'
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  routeHeader: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 0.5
  },
  routeMain: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 1
  },
  routeSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 10,
    marginLeft: 24
  },
  modalBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  }
});
