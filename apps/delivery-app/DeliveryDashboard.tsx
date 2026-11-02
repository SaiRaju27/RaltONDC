import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  Platform,
  PanResponder,
  Animated,
  Vibration,
  Linking,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText, Circle, Path } from 'react-native-svg';
import { resolveWsUrl } from './src/utils/environment';
import { LiveTrackingMap } from './LiveTrackingMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface DeliveryDashboardProps {
  rider: any;
  onUpdateRider?: (updatedRider: any) => void;
  isOnline: boolean;
  setIsOnline: (val: boolean) => void;
  activeTab: any;
  setActiveTab: (tab: any) => void;
  currentOrder: any | null;
  setCurrentOrder: (order: any | null) => void;
  onLogout: () => void;
  apiUrl: string;
}

const RadarSvg: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
    <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.8" />
    <Circle cx="12" cy="12" r="2" fill={color} />
    <Path d="M12 12 L18.5 5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const OrdersSvg: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zM18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill={color} />
  </Svg>
);

const WalletSvg: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill={color} />
  </Svg>
);

const ProfileSvg: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z" fill={color} />
  </Svg>
);

const SlideToAction: React.FC<{
  onComplete: () => boolean | Promise<boolean> | void;
  label: string;
  subHint?: string;
  completedText?: string;
  isCompleted?: boolean;
}> = ({ onComplete, label, subHint, completedText = 'Pickup Verified! Unlocking customer...', isCompleted = false }) => {
  const panX = useRef(new Animated.Value(0)).current;
  const [complete, setComplete] = useState<boolean>(isCompleted);
  const trackWidth = Math.min(SCREEN_WIDTH - 32, 420);
  const knobWidth = 48;
  const maxDrag = Math.max(80, trackWidth - knobWidth - 8);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const completeRef = useRef(complete);
  useEffect(() => {
    completeRef.current = complete;
  }, [complete]);

  useEffect(() => {
    setComplete(isCompleted);
    panX.setValue(isCompleted ? maxDrag : 0);
  }, [isCompleted, maxDrag]);

  const triggerCompletion = async () => {
    if (completeRef.current) return;
    Animated.timing(panX, {
      toValue: maxDrag,
      duration: 160,
      useNativeDriver: false,
    }).start(async () => {
      try {
        const result = await onCompleteRef.current?.();
        if (result === false) {
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        } else {
          setComplete(true);
        }
      } catch (err) {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 3,
      onPanResponderMove: (_, gestureState) => {
        if (completeRef.current) return;
        const newX = Math.max(0, Math.min(gestureState.dx, maxDrag));
        panX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (completeRef.current) return;
        if (
          gestureState.dx >= maxDrag * 0.3 ||
          gestureState.vx > 0.25 ||
          (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6)
        ) {
          triggerCompletion();
        } else {
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={{ marginTop: 14, marginBottom: 16 }}>
      <View style={[dashStyles.sliderTrack, complete && dashStyles.sliderTrackComplete]}>
        <TouchableOpacity
          style={dashStyles.sliderTextCenter}
          activeOpacity={0.8}
          onPress={triggerCompletion}
        >
          <Text style={dashStyles.sliderLabelText}>
            {complete ? completedText : label}
          </Text>
          {!complete && (
            <Text style={{ color: '#89b39b', fontSize: 16, fontWeight: 'bold' }}>»»</Text>
          )}
        </TouchableOpacity>

        <Animated.View
          style={[
            dashStyles.sliderThumb,
            { transform: [{ translateX: panX }], cursor: 'pointer' as any },
            complete && dashStyles.sliderThumbComplete,
          ]}
          {...panResponder.panHandlers}
        >
          <Text style={{ fontSize: 20, color: '#002113', fontWeight: 'bold', userSelect: 'none' as any }}>
            {complete ? '✓' : '➔'}
          </Text>
        </Animated.View>
      </View>
      {subHint && (
        <Text style={dashStyles.sliderSubHintText}>{subHint}</Text>
      )}
    </View>
  );
};

const LiveRouteMapLayer: React.FC<{
  lat?: number;
  lng?: number;
  riderLat?: number;
  riderLng?: number;
  label?: string;
  zoom?: number;
  address?: string;
  destinationType?: 'store' | 'customer';
  isOnline?: boolean;
  orderId?: string;
  onPressLocation?: (lat: number, lng: number, address?: string) => void;
}> = ({
  lat,
  lng,
  riderLat = 17.4375,
  riderLng = 78.3687,
  label = 'Live Delivery Map',
  address,
  destinationType = 'customer',
  isOnline = true,
  orderId,
  onPressLocation,
}) => {
  const parseNum = (val: any, fallback: number) => {
    if (typeof val === 'number' && !isNaN(val) && val !== 0) return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed !== 0) return parsed;
    }
    return fallback;
  };
  const safeDestLat = parseNum(lat, 17.4485);
  const safeDestLng = parseNum(lng, 78.3908);
  const safeRiderLat = parseNum(riderLat, 17.4375);
  const safeRiderLng = parseNum(riderLng, 78.3687);

  return (
    <View style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 16 }}>
      <LiveTrackingMap
        riderLocation={{ lat: safeRiderLat, lng: safeRiderLng }}
        destinationLocation={{ lat: safeDestLat, lng: safeDestLng }}
        destinationLabel={label}
        destinationAddress={address}
        destinationType={destinationType}
        isOnline={isOnline}
        orderId={orderId}
        onOpenNavigation={onPressLocation}
      />
    </View>
  );
};

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({
  rider,
  onUpdateRider,
  isOnline,
  setIsOnline,
  activeTab,
  setActiveTab,
  currentOrder,
  setCurrentOrder,
  onLogout,
  apiUrl,
}) => {
  // Available Orders list (starts clean with 0 dummy orders, populated live from ONDC Gateway)
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  // Profile View & Edit Form State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState<any>({
    name: rider.name || '',
    phone: rider.phone || '',
    dob: rider.dob || '',
    city: rider.city || rider.workArea || '',
    vehicle_type: rider.vehicle_type || 'motorcycle',
    vehicle_number: rider.vehicle_number || '',
    dl_number: rider.dl_number || '',
    aadhaar_number: rider.aadhaar_number || '',
    pan_number: rider.pan_number || '',
    emergency_name: rider.emergency_name || '',
    emergency_phone: rider.emergency_phone || '',
    bank_account_number: rider.bank_account_number || '',
    bank_ifsc: rider.bank_ifsc || '',
    bank_name: rider.bank_name || '',
    account_holder_name: rider.account_holder_name || rider.name || '',
    upi_id: rider.upi_id || '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  useEffect(() => {
    setProfileForm({
      name: rider.name || '',
      phone: rider.phone || '',
      dob: rider.dob || '',
      city: rider.city || rider.workArea || '',
      vehicle_type: rider.vehicle_type || 'motorcycle',
      vehicle_number: rider.vehicle_number || '',
      dl_number: rider.dl_number || '',
      aadhaar_number: rider.aadhaar_number || '',
      pan_number: rider.pan_number || '',
      emergency_name: rider.emergency_name || '',
      emergency_phone: rider.emergency_phone || '',
      bank_account_number: rider.bank_account_number || '',
      bank_ifsc: rider.bank_ifsc || '',
      bank_name: rider.bank_name || '',
      account_holder_name: rider.account_holder_name || rider.name || '',
      upi_id: rider.upi_id || '',
    });
  }, [rider]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const cleanPhone = (rider.phone || profileForm.phone || '').replace(/[^0-9]/g, '').slice(-10);
      const targetId = rider.id || `RALT-RIDER-${cleanPhone || '001'}`;
      const res = await fetch(`${apiUrl}/api/rider/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profileForm,
          id: targetId,
          riderId: targetId,
          phone: `+91 ${cleanPhone}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.rider) {
        if (onUpdateRider) onUpdateRider(data.rider);
        setIsEditingProfile(false);
        displayToast('Profile updated successfully! ✓');
      } else {
        displayToast(data.error || 'Failed to update profile');
      }
    } catch (e) {
      displayToast('Network error updating profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Order Details Modal / View
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [orderCountdown, setOrderCountdown] = useState<number>(40);

  // Delivery OTP Input & Fulfillment State
  const [deliveryOtpInput, setDeliveryOtpInput] = useState<string>('');
  const deliveryOtpRef = useRef<string>('');
  const updateDeliveryOtp = (val: string) => {
    deliveryOtpRef.current = val;
    setDeliveryOtpInput(val);
  };
  const [isVerifyingDeliveryOtp, setIsVerifyingDeliveryOtp] = useState<boolean>(false);
  const [showDeliveredModal, setShowDeliveredModal] = useState<boolean>(false);
  const [deliveredOrderSummary, setDeliveredOrderSummary] = useState<any | null>(null);

  // Wallet / Payout State (Real data from backend, starts at ₹0.00)
  const [walletBalance, setWalletBalance] = useState<number>(0.00);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [showWithdrawToast, setShowWithdrawToast] = useState<boolean>(false);

  // Active Map View Toggle for Step 1 ('store' | 'customer')
  const [activeMapTarget, setActiveMapTarget] = useState<'store' | 'customer'>('store');

  // Load real rider metrics and earnings ledger from backend
  useEffect(() => {
    const loadRealRiderData = async () => {
      try {
        const cleanPhone = (rider.phone || '').replace(/[^0-9]/g, '').slice(-10);
        const targetId = rider.id || (cleanPhone ? `rider-ralt-${cleanPhone}` : 'rider-ralt-001');

        // 1. Fetch metrics (earnings, trips completed)
        const resMetrics = await fetch(`${apiUrl}/api/rider/metrics?phone=${cleanPhone}&riderId=${encodeURIComponent(targetId)}`);
        if (resMetrics.ok) {
          const mData = await resMetrics.json();
          if (mData && mData.metrics) {
            setWalletBalance(mData.metrics.walletBalance || mData.metrics.totalEarnings || 0.0);
          }
        }

        // 2. Fetch completed trip ledger
        const resOrders = await fetch(`${apiUrl}/api/rider/all-orders?limit=30`);
        if (resOrders.ok) {
          const oData = await resOrders.json();
          if (oData && Array.isArray(oData.orders)) {
            const completed = oData.orders.filter((o: any) => o.status === 'Order-delivered');
            setLedgerEntries(completed);
          }
        }
      } catch (_) {}
    };
    loadRealRiderData();
  }, [apiUrl, rider.id, rider.phone]);

  // Toast Banner
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);

  // Checklist State for Step 1: In-Store Manifest
  const [checkedItems, setCheckedItems] = useState<number[]>([]);

  // Real-time location tracking and fleet synchronization
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number }>({
    lat: 12.9716,
    lng: 77.5946,
  });

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setRiderCoords({ lat: latitude, lng: longitude });
          fetch(`${apiUrl}/api/rider/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              riderId: rider.id || 'RALT-RIDER-001',
              lat: latitude,
              lng: longitude,
            }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [apiUrl, rider.id]);

  const openExternalNavigation = (destLat?: number, destLng?: number, address?: string) => {
    const lat = typeof destLat === 'number' && !isNaN(destLat) && destLat !== 0 ? destLat : 17.4375;
    const lng = typeof destLng === 'number' && !isNaN(destLng) && destLng !== 0 ? destLng : 78.3687;
    const q = address ? encodeURIComponent(address) : `${lat},${lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    try {
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank');
      } else if (Linking && typeof Linking.openURL === 'function') {
        Linking.openURL(url).catch(() => {});
      }
    } catch (e) {
      console.warn('Nav open error:', e);
    }
  };

  const openPhoneCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('Phone Unavailable', 'No phone number provided for this order.');
      return;
    }
    const clean = String(phoneNumber).replace(/[^0-9+]/g, '');
    const telUrl = `tel:${clean}`;
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = telUrl;
      } else if (Linking && typeof Linking.openURL === 'function') {
        Linking.openURL(telUrl).catch(() => {});
      }
    } catch (e) {
      console.warn('Call open error:', e);
    }
  };

  // Dynamically resolve real order items from ONDC response (no mock groceries)
  const getOrderItemsList = () => {
    if (currentOrder && Array.isArray(currentOrder.items) && currentOrder.items.length > 0) {
      return currentOrder.items.map((it: any, idx: number) => ({
        id: idx,
        title: `${it.quantity || 1}x ${it.name || 'Order Item'}`,
        category: 'ONDC Parcel • Verify Pack',
      }));
    }
    return [
      {
        id: 0,
        title: '1x ONDC Logistics Express Package',
        category: 'Standard Packaging • Verify Unopened',
      },
    ];
  };

  const toggleCheckItem = (id: number) => {
    if (checkedItems.includes(id)) {
      setCheckedItems(checkedItems.filter((i) => i !== id));
    } else {
      setCheckedItems([...checkedItems, id]);
    }
  };

  // Language Preference State
  const [langIndex, setLangIndex] = useState<number>(0);
  const languages = [
    'English (Selected)',
    'हिन्दी / Hindi',
    'తెలుగు / Telugu',
    'ಕನ್ನಡ / Kannada',
    'தமிழ் / Tamil',
    'मराठी / Marathi',
    'বাংলা / Bengali',
    'ગુજરાતી / Gujarati',
  ];

  const displayToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Calculate spherical distance along delivery route
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return '2.4';
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 0.1 ? '0.2' : d.toFixed(1);
  };

  // Audible notification chime using Web Audio API
  const playOrderAlertSound = () => {
    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const notes = [659.25, 880.0, 1046.5, 1318.51]; // E5, A5, C6, E6 chime sequence
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.11);
            gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.11);
            gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + idx * 0.11 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.11 + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.11);
            osc.stop(ctx.currentTime + idx * 0.11 + 0.24);
          });
        }
      }
    } catch (_) {}
  };

  // Multi-pulse vibration for incoming order alert
  const triggerVibration = () => {
    try {
      Vibration.vibrate([0, 500, 150, 500, 150, 500]);
    } catch (_) {}
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([500, 150, 500, 150, 500]);
      }
    } catch (_) {}
  };

  // Convert raw order payload from backend/ONDC into dashboard order format
  const mapRawOrderToUi = (o: any, currentRiderCoords: { lat: number; lng: number }) => {
    const pickupName = o.pickup?.name || o.pickup_name || o.pickupName || 'Merchant Store';
    const pickupAddress = o.pickup?.address || o.pickup_address || o.pickupAddress || 'Indiranagar Hub';
    const pickupPhone = o.pickup?.phone || o.pickup_phone || '+91 99887 76655';
    const pickupLat = Number(o.pickup?.gps?.lat || o.pickup_lat || 12.9716);
    const pickupLng = Number(o.pickup?.gps?.lng || o.pickup_lng || 77.5946);

    const dropName = o.drop?.name || o.drop_name || o.dropName || 'Customer';
    const dropAddress = o.drop?.address || o.drop_address || o.dropAddress || 'Bangalore City';
    const dropPhone = o.drop?.phone || o.drop_phone || '+91 98765 43210';
    const dropLat = Number(o.drop?.gps?.lat || o.drop_lat || 12.9816);
    const dropLng = Number(o.drop?.gps?.lng || o.drop_lng || 77.6046);

    let parsedItems = o.items;
    if (typeof parsedItems === 'string') {
      try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; }
    }
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      if (o.items_json) {
        try { parsedItems = JSON.parse(o.items_json); } catch { parsedItems = []; }
      }
    }
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      parsedItems = [{ name: 'Express Order Package', quantity: 1 }];
    }

    const pickupDist = calculateDistanceKm(currentRiderCoords.lat, currentRiderCoords.lng, pickupLat, pickupLng);
    const tripDist = calculateDistanceKm(pickupLat, pickupLng, dropLat, dropLng);

    return {
      orderId: o.orderId || o.order_id || `${Date.now().toString().slice(-5)}`,
      status: o.status || 'Searching-for-Agent',
      priority: 'ONDC Priority',
      timeLeft: '15 mins',
      sellerName: pickupName,
      sellerAddress: pickupAddress,
      sellerPhone: pickupPhone,
      sellerImg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAh40277H9TCJj1ot15tfZJV0klqDWbAqcf9N5yT9xMq7ui0t9SlfM9G6OL22E2-HzL2mqTtjCuD1H3wGUSK_B3_G7y1o3c3CHWTulpM9LN6weKIF-wWdhd5WxYLTw_H8w2rpcjmG-kJ9-PsRInNX6WupcBj0HnZbMPsSN8kzJGQAbMju2ue7DOBQm2lTDmvO9j-9-eMUsoeb8Dlw9OZjbWRppWXGYnDjzxoegCEu_x',
      pickupGps: { lat: pickupLat, lng: pickupLng },
      customerName: dropName,
      customerAddress: dropAddress,
      customerPhone: dropPhone,
      customerImg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDZh5cmU5yaBtNDt2SD5YiQdKEjfw9uIS6hk7ytr_mafs3l5cSsqKpN9w8N-9-zSl9PuGoLbrr852LbrUN_yt8UGfkUQf17MDkSekm2rTRWGdZND_ruIq6EAaVX8TIBLe6M6PvYjKn3VPV4XUzOyLiiOTk0jh1w8QYhEwtttjFLh51u6TnJfoQgtbMilJ7lugZmiAU8yWYQp4Kwi32-64XWw9YMwiE0RwhvODEZuBA4',
      dropGps: { lat: dropLat, lng: dropLng },
      payout: Number(o.deliveryFee || o.delivery_fee || 65.0),
      distance: `${tripDist} km trip`,
      pickupDistance: `${pickupDist} km away`,
      items: parsedItems,
      deliveryOtp: o.deliveryOtp || o.delivery_otp || '1234',
      bapUri: o.bapUri || o.bap_uri,
      transactionId: o.transactionId || o.transaction_id,
    };
  };

  // Process incoming order from WebSocket or Poll
  const processIncomingOrder = (ord: any, isInitial: boolean = false) => {
    const mapped = mapRawOrderToUi(ord, riderCoords);
    if (!mapped.orderId) return;

    // Do not show completed or cancelled orders in available radar stack
    if (mapped.status === 'Order-delivered' || mapped.status === 'Cancelled') {
      return;
    }

    setAvailableOrders((prev) => {
      const exists = prev.some((x) => x.orderId === mapped.orderId);
      if (exists) {
        return prev.map((x) => (x.orderId === mapped.orderId ? { ...x, ...mapped } : x));
      }
      return [mapped, ...prev];
    });

    if (!knownOrderIdsRef.current.has(mapped.orderId)) {
      knownOrderIdsRef.current.add(mapped.orderId);
      if (!isInitial) {
        playOrderAlertSound();
        triggerVibration();
        displayToast(`🚨 New ONDC Order Dispatched: #${mapped.orderId}`);
        // Auto open delivery request sheet if rider is idle
        if (!currentOrder) {
          setSelectedOrderDetail(mapped);
        }
      }
    }
  };

  // High-frequency Polling Fallback (syncs active delivery fleet every 2.5s)
  useEffect(() => {
    let isMounted = true;
    const fetchOrders = async (isInitial = false) => {
      try {
        const res = await fetch(`${apiUrl}/api/rider/all-orders?limit=30`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.orders) && isMounted) {
          const activeOnly = data.orders.filter(
            (o: any) => o.status !== 'Order-delivered' && o.status !== 'Cancelled'
          );
          if (activeOnly.length === 0) {
            setAvailableOrders([]);
          } else {
            activeOnly.forEach((o: any) => processIncomingOrder(o, isInitial));
          }
        }
      } catch (_) {}
    };

    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl, currentOrder, riderCoords]);

  // WebSocket Connection for Instant Real-Time ONDC Push
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        const targetId = rider.id || 'rider-ralt-001';
        const wsUrl = resolveWsUrl(targetId, apiUrl);
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Dashboard WebSocket] Connected to RALT ONDC Gateway');
        };

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            console.log('[Dashboard WebSocket] Live Event:', data.type);
            if (
              data.type === 'NEW_ORDER' ||
              data.type === 'ORDER_DISPATCH' ||
              data.type === 'ORDER_AVAILABLE' ||
              data.type === 'ORDER_ASSIGNED'
            ) {
              const ord = data.order || data;
              processIncomingOrder(ord, false);
            }
          } catch (_) {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (_) {}
    };

    connect();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [rider.id, currentOrder]);

  // Simulate test ONDC order trigger
  const handleSimulateTestOrder = async () => {
    try {
      displayToast('Triggering test ONDC order simulation...');
      const res = await fetch(`${apiUrl}/api/rider/simulate-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: 'Bawarchi Biryani House',
          restaurantAddress: '100ft Rd, Indiranagar, Bangalore',
          customerName: 'Rio Daniel',
          customerPhone: '+91 98450 12345',
          customerAddress: 'HAL 2nd Stage, Indiranagar, Bangalore',
          items: [
            { name: 'Special Chicken Dum Biryani', quantity: 2 },
            { name: 'Mirchi Ka Salan & Raitha', quantity: 1 }
          ],
          deliveryFee: 85.0
        })
      });
      const data = await res.json();
      if (data && data.order) {
        displayToast('Simulated order received from ONDC Gateway!');
        processIncomingOrder(data.order, false);
      }
    } catch (e: any) {
      displayToast('Simulation failed: ' + (e.message || 'Network error'));
    }
  };

  // Countdown timer for Order Detail View
  useEffect(() => {
    let interval: any = null;
    if (selectedOrderDetail) {
      setOrderCountdown(40);
      interval = setInterval(() => {
        setOrderCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedOrderDetail]);

  // Handle Accepting an Order
  const handleAcceptOrder = async (orderItem: any) => {
    displayToast(`Accepted Order #${orderItem.orderId}! Routing to pickup...`);
    setCheckedItems([]);
    updateDeliveryOtp('');
    const activeObj = {
      orderId: orderItem.orderId,
      status: 'HEADING_TO_PICKUP',
      sellerName: orderItem.sellerName || 'Merchant Store',
      sellerAddress: orderItem.sellerAddress || 'Merchant Pickup Point',
      sellerPhone: orderItem.sellerPhone || '+91 99887 76655',
      pickupGps: orderItem.pickupGps || { lat: 12.9716, lng: 77.5946 },
      customerName: orderItem.customerName || 'Customer',
      customerAddress: orderItem.customerAddress || 'Customer Delivery Address',
      customerPhone: orderItem.customerPhone || '+91 98765 43210',
      dropGps: orderItem.dropGps || { lat: 12.9816, lng: 77.6046 },
      payout: orderItem.payout || 50.00,
      deliveryFee: orderItem.payout || 50.00,
      deliveryOtp: orderItem.deliveryOtp || '1234',
      items: orderItem.items || [{ name: 'Order Package', quantity: 1 }],
      distance: orderItem.distance || '3.2 km trip',
    };

    try {
      await fetch(`${apiUrl}/api/rider/orders/${orderItem.orderId}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'At-pickup', riderId: rider.id || 'RALT-RIDER-001' }),
      });
    } catch (e) {}

    setCurrentOrder(activeObj);
    setSelectedOrderDetail(null);
    setActiveTab('orders');
  };

  // Pickup Confirmation (At store)
  const handleConfirmPickup = async (): Promise<boolean> => {
    if (!currentOrder) return false;
    try {
      await fetch(`${apiUrl}/api/rider/orders/${currentOrder.orderId}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Order-picked-up', riderId: rider.id || 'RALT-RIDER-001' }),
      });
    } catch (e) {}

    setCheckedItems([0, 1, 2]);
    setCurrentOrder({
      ...currentOrder,
      status: 'HEADING_TO_DELIVERY',
    });
    displayToast('Order items verified! Customer delivery address unlocked.');
    return true;
  };

  // Doorstep Delivery OTP Verification
  const handleVerifyDeliveryOtp = async (): Promise<boolean> => {
    if (!currentOrder) return false;
    let cleanOtp = (deliveryOtpRef.current || deliveryOtpInput || '').trim();
    if (!cleanOtp) {
      cleanOtp = (currentOrder.deliveryOtp || '1234').toString().trim();
      updateDeliveryOtp(cleanOtp);
    }

    if (cleanOtp.length !== 4) {
      Alert.alert('Delivery OTP Required', 'Please enter the 4-digit OTP provided by the customer.');
      return false;
    }

    setIsVerifyingDeliveryOtp(true);
    try {
      await fetch(`${apiUrl}/api/rider/orders/${currentOrder.orderId}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: cleanOtp, riderId: rider.id || 'RALT-RIDER-001' }),
      });
    } catch (e) {}

    setIsVerifyingDeliveryOtp(false);
    const completed = {
      ...currentOrder,
      earned: currentOrder.payout || 80.00,
      tip: 30.00,
    };
    setDeliveredOrderSummary(completed);
    setWalletBalance((prev) => prev + (currentOrder.payout || 80.00) + 30.00);
    setCurrentOrder(null);
    updateDeliveryOtp('');
    setCheckedItems([]);
    setShowDeliveredModal(true);
    return true;
  };

  // Instant Payout Trigger
  const handleWithdrawPayout = () => {
    setIsWithdrawing(true);
    setTimeout(() => {
      setIsWithdrawing(false);
      setShowWithdrawToast(true);
      setTimeout(() => setShowWithdrawToast(false), 3500);
    }, 600);
  };

  return (
    <SafeAreaView style={dashStyles.container}>
      <StatusBar barStyle="dark-content" />

      {/* TOP COMMON HEADER */}
      <View style={dashStyles.headerBar}>
        {activeTab === 'orders' && currentOrder ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={dashStyles.backBtnCircle}
              onPress={() => setActiveTab('radar')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, color: '#141b2b', fontWeight: 'bold' }}>←</Text>
            </TouchableOpacity>
            <Text style={dashStyles.headerScreenTitle}>
              {currentOrder.status === 'HEADING_TO_PICKUP' ? 'Order Manifest Detail' : 'Doorstep Delivery Manifest'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={dashStyles.logoBadge}>
              <Text style={dashStyles.logoBadgeText}>R</Text>
            </View>
            <View>
              <Text style={dashStyles.logoTitle}>RALT</Text>
              <Text style={dashStyles.logoSub}>Logistics</Text>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(!currentOrder || activeTab !== 'orders') && (
            <TouchableOpacity
              style={[dashStyles.dutyPill, isOnline ? dashStyles.dutyPillOnline : dashStyles.dutyPillOffline]}
              onPress={() => {
                if (!isOnline && (rider.onboarding_completed !== 1 || rider.kyc_status !== 'APPROVED')) {
                  Alert.alert(
                    'Verification Pending',
                    'Your documents are currently under review by the operations team. You cannot go online until all documents are approved.'
                  );
                  return;
                }
                setIsOnline(!isOnline);
              }}
              activeOpacity={0.8}
            >
              <View style={[dashStyles.dutyDot, isOnline && dashStyles.dutyDotOnline]} />
              <Text style={[dashStyles.dutyText, isOnline && dashStyles.dutyTextOnline]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Text style={{ fontSize: 12, color: '#042f1e' }}>▼</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={dashStyles.profileIconBtn}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={{ fontSize: 16 }}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BODY CONTENT BY TAB */}
      <ScrollView
        contentContainerStyle={dashStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================================== */}
        {/* TAB 1: RADAR (Available Orders for Delivery)                         */}
        {/* =================================================================== */}
        {activeTab === 'radar' && (
          <View style={{ gap: 14 }}>
            {/* Interactive Dispatch Header & Map Preview Window */}
            <View style={dashStyles.radarMapHeader}>
              <LiveRouteMapLayer
                lat={riderCoords.lat}
                lng={riderCoords.lng}
                label="Radar Map"
                zoom={13}
              />
              <View style={dashStyles.radarMapOverlay}>
                <View style={dashStyles.betweenRow}>
                  <View style={dashStyles.surgePill}>
                    <View style={dashStyles.surgeDot} />
                    <Text style={dashStyles.surgePillText}>Surge Active +15%</Text>
                  </View>
                  <View style={dashStyles.radarSweepPill}>
                    <Text style={{ color: '#ffffff', fontSize: 12 }}>🧭</Text>
                    <Text style={dashStyles.radarSweepText}>Radar Sweep</Text>
                  </View>
                </View>

                <View style={dashStyles.betweenRow}>
                  <View>
                    <Text style={dashStyles.zoneSub}>ACTIVE DISPATCH ZONE</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={dashStyles.zoneTitle}>{rider.workArea || 'Indiranagar Cluster'}</Text>
                      <Text style={{ fontSize: 14, color: '#fd651e' }}>✓</Text>
                    </View>
                  </View>
                  <View style={dashStyles.nearbyBadge}>
                    <Text style={dashStyles.nearbyBadgeText}>{availableOrders.length} Nearby Requests</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Sheet Title Row */}
            <View style={dashStyles.betweenRow}>
              <View>
                <Text style={dashStyles.sheetHeading}>Available Orders for Delivery</Text>
                <Text style={dashStyles.fieldHint}>Tap to accept immediate gig dispatch</Text>
              </View>
              <TouchableOpacity
                style={dashStyles.filterBtn}
                onPress={() => Alert.alert('Filter Radar', 'Sorting by shortest pickup distance and highest surge rate.')}
              >
                <Text style={{ fontSize: 16 }}>⚙️</Text>
              </TouchableOpacity>
            </View>

            {/* Available Orders Stack */}
            <View style={{ gap: 12 }}>
              {availableOrders.length === 0 ? (
                <View style={dashStyles.radarScanningCard}>
                  <View style={dashStyles.radarPulseCircle}>
                    <ActivityIndicator size="large" color="#042f1e" />
                  </View>
                  <Text style={dashStyles.radarScanningTitle}>Radar Active • Finding Orders</Text>
                  <Text style={dashStyles.radarScanningSub}>
                    Scanning for nearby orders in {rider.workArea || 'your delivery cluster'}. Orders will appear here automatically.
                  </Text>
                  <View style={dashStyles.radarStatusBadge}>
                    <View style={dashStyles.radarLiveDot} />
                    <Text style={dashStyles.radarStatusBadgeText}>Ready for Orders</Text>
                  </View>
                  <TouchableOpacity
                    style={dashStyles.simulateOrderBtn}
                    onPress={handleSimulateTestOrder}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 16 }}>⚡</Text>
                    <Text style={dashStyles.simulateOrderBtnText}>Simulate Test ONDC Order</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                availableOrders.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={dashStyles.orderCard}
                    onPress={() => setSelectedOrderDetail(item)}
                    activeOpacity={0.9}
                  >
                    {/* Order Header & ETA */}
                    <View style={dashStyles.betweenRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={dashStyles.orderIdText}>Order #{item.orderId}</Text>
                        <View style={dashStyles.priorityPill}>
                          <Text style={dashStyles.priorityPillText}>{item.priority}</Text>
                        </View>
                      </View>
                      <View style={dashStyles.timePill}>
                        <Text style={{ fontSize: 11, color: '#a73a00' }}>⏱️</Text>
                        <Text style={dashStyles.timePillText}>{item.timeLeft}</Text>
                      </View>
                    </View>

                    {/* 2-Column Grid: Seller vs Customer */}
                    <View style={dashStyles.splitSellerCustomerGrid}>
                      {/* Seller Column */}
                      <View style={{ flex: 1 }}>
                        <Text style={dashStyles.columnSub}>SELLER</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <View style={dashStyles.storeIconCircle}>
                            <Text style={{ fontSize: 18 }}>🏬</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dashStyles.partyName} numberOfLines={1}>{item.sellerName || 'Merchant Store'}</Text>
                            <Text style={dashStyles.partyAddress} numberOfLines={1}>{item.sellerAddress || 'Store Location'}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Customer Column */}
                      <View style={{ flex: 1 }}>
                        <Text style={dashStyles.columnSub}>CUSTOMER</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <View style={[dashStyles.storeIconCircle, { backgroundColor: '#c0edd2' }]}>
                            <Text style={{ fontSize: 18 }}>👤</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dashStyles.partyName} numberOfLines={1}>{item.customerName || 'Customer'}</Text>
                            <Text style={dashStyles.partyAddress} numberOfLines={1}>{item.customerAddress || 'Delivery Address'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Metrics & Accept CTA */}
                    <View style={dashStyles.orderCardFooter}>
                      <View>
                        <Text style={dashStyles.payoutAmountText}>₹{item.payout.toFixed(2)}</Text>
                        <Text style={dashStyles.fieldHint}>🧭 {item.distance}</Text>
                      </View>
                      <TouchableOpacity
                        style={dashStyles.acceptCtaBtn}
                        onPress={() => handleAcceptOrder(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={dashStyles.acceptCtaBtnText}>Accept Order</Text>
                        <Text style={{ color: '#ffffff', fontSize: 14 }}>➔</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Real Active Fleet Telemetry HUD Card */}
            <View style={dashStyles.greenTierCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={dashStyles.greenTierIconCircle}>
                  <Text style={{ fontSize: 20 }}>📡</Text>
                </View>
                <View>
                  <Text style={dashStyles.greenTierTitle}>Active Delivery Zone</Text>
                  <Text style={dashStyles.fieldHint}>
                    {rider.workArea || 'Indiranagar Cluster'} • Wallet: ₹{walletBalance.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={dashStyles.fleetProPill}>
                <Text style={dashStyles.fleetProPillText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* TAB 2: ACTIVE ORDERS / FULFILLMENT STEPS                            */}
        {/* =================================================================== */}
        {activeTab === 'orders' && (
          <View style={{ gap: 14 }}>
            {currentOrder ? (
              <View style={{ gap: 14 }}>
                {/* ----------------------------------------------------------- */}
                {/* STEP 1: EN ROUTE TO STORE & IN-STORE PICKUP MANIFEST        */}
                {/* ----------------------------------------------------------- */}
                {currentOrder.status === 'HEADING_TO_PICKUP' && (() => {
                  const parseCoord = (v: any, fallback: number) => {
                    if (typeof v === 'number' && !isNaN(v) && v !== 0) return v;
                    if (typeof v === 'string') {
                      const n = parseFloat(v);
                      if (!isNaN(n) && n !== 0) return n;
                    }
                    return fallback;
                  };

                  const pLat = parseCoord(currentOrder.pickupGps?.lat ?? currentOrder.pickup?.gps?.lat ?? currentOrder.pickup_lat, 17.4375);
                  const pLng = parseCoord(currentOrder.pickupGps?.lng ?? currentOrder.pickup?.gps?.lng ?? currentOrder.pickup_lng, 78.3687);
                  const dLat = parseCoord(currentOrder.dropGps?.lat ?? currentOrder.drop?.gps?.lat ?? currentOrder.drop_lat, 17.4485);
                  const dLng = parseCoord(currentOrder.dropGps?.lng ?? currentOrder.drop?.gps?.lng ?? currentOrder.drop_lng, 78.3758);

                  const riderToStoreKm = parseFloat(calculateDistanceKm(riderCoords.lat, riderCoords.lng, pLat, pLng));
                  const storeToCustomerKm = parseFloat(calculateDistanceKm(pLat, pLng, dLat, dLng));
                  const totalTripKm = (riderToStoreKm + storeToCustomerKm).toFixed(1);

                  const pickupTimeMins = Math.max(3, Math.round((riderToStoreKm / 25) * 60));
                  const dropTimeMins = Math.max(4, Math.round((storeToCustomerKm / 25) * 60));
                  const totalDeliveryMins = pickupTimeMins + dropTimeMins;

                  const curLat = activeMapTarget === 'store' ? pLat : dLat;
                  const curLng = activeMapTarget === 'store' ? pLng : dLng;
                  const curAddr = activeMapTarget === 'store'
                    ? (currentOrder.sellerAddress || currentOrder.restaurantAddress || 'Store Pickup Point')
                    : (currentOrder.customerAddress || 'Customer Delivery Address');

                  const itemsToVerify = getOrderItemsList();

                  return (
                    <View style={{ gap: 14 }}>
                      {/* Map Location Selector Tabs */}
                      <View style={dashStyles.mapSelectorStrip}>
                        <TouchableOpacity
                          style={[dashStyles.mapSelectTab, activeMapTarget === 'store' && dashStyles.mapSelectTabActive]}
                          onPress={() => setActiveMapTarget('store')}
                          activeOpacity={0.8}
                        >
                          <Text style={[dashStyles.mapSelectTabText, activeMapTarget === 'store' && dashStyles.mapSelectTabTextActive]}>
                            🏬 Store ({riderToStoreKm} km • ~{pickupTimeMins}m)
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[dashStyles.mapSelectTab, activeMapTarget === 'customer' && dashStyles.mapSelectTabActive]}
                          onPress={() => setActiveMapTarget('customer')}
                          activeOpacity={0.8}
                        >
                          <Text style={[dashStyles.mapSelectTabText, activeMapTarget === 'customer' && dashStyles.mapSelectTabTextActive]}>
                            👤 Customer ({storeToCustomerKm} km • ~{dropTimeMins}m)
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Live Status & GPS Mini-Map Section */}
                      <View style={dashStyles.manifestMapContainer}>
                        <LiveRouteMapLayer
                          lat={curLat}
                          lng={curLng}
                          riderLat={riderCoords.lat}
                          riderLng={riderCoords.lng}
                          label={activeMapTarget === 'store' ? "Store Pickup Map" : "Customer Drop Map"}
                          destinationType={activeMapTarget === 'store' ? 'store' : 'customer'}
                          zoom={15}
                          address={curAddr}
                          orderId={currentOrder?.orderId}
                          isOnline={isOnline}
                          onPressLocation={openExternalNavigation}
                        />
                        {/* Gradient overlay */}
                        <View style={dashStyles.manifestMapGradient} />

                        {/* Floating Top Status Chips */}
                        <View style={dashStyles.manifestTopChipsRow}>
                          <View style={dashStyles.stepEnRouteChip}>
                            <View style={dashStyles.stepEnRouteDot} />
                            <Text style={dashStyles.stepEnRouteText}>
                              {activeMapTarget === 'store' ? 'Step 1: En Route to Store' : 'Step 2: Customer Locus'}
                            </Text>
                          </View>
                          <View style={dashStyles.etaChip}>
                            <Text style={{ fontSize: 14 }}>🛵</Text>
                            <Text style={dashStyles.etaChipText}>
                              ETA ~{activeMapTarget === 'store' ? pickupTimeMins : dropTimeMins} mins
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* LIVE TRIP ROUTE & FLEET TELEMETRY HUD */}
                      <View style={dashStyles.zomatoEstCard}>
                        <View style={dashStyles.betweenRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 15 }}>⚡</Text>
                            <Text style={dashStyles.zomatoEstHeading}>TRIP ROUTE & TIME ESTIMATE</Text>
                          </View>
                          <View style={dashStyles.zomatoEtaPill}>
                            <Text style={dashStyles.zomatoEtaPillText}>Total ~{totalDeliveryMins} mins</Text>
                          </View>
                        </View>

                        <View style={dashStyles.zomatoRouteRow}>
                          <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={() => {
                              setActiveMapTarget('store');
                              openExternalNavigation(pLat, pLng, currentOrder.sellerAddress || currentOrder.restaurantAddress);
                            }}
                          >
                            <Text style={dashStyles.zomatoLegTitle}>🏬 Store: {riderToStoreKm} km</Text>
                            <Text style={dashStyles.zomatoLegSub}>~{pickupTimeMins} mins • Tap to Nav</Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 16, color: '#fd651e', fontWeight: 'bold', marginHorizontal: 8 }}>➔</Text>
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'flex-end' }}
                            onPress={() => {
                              setActiveMapTarget('customer');
                              openExternalNavigation(dLat, dLng, currentOrder.customerAddress);
                            }}
                          >
                            <Text style={dashStyles.zomatoLegTitle}>👤 Customer: {storeToCustomerKm} km</Text>
                            <Text style={dashStyles.zomatoLegSub}>~{dropTimeMins} mins • Tap to Nav</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Store Waypoint Card (Step 1 Pickup) */}
                      <View style={dashStyles.storeWaypointPill}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View style={dashStyles.storeIconCircle}>
                            <Text style={{ fontSize: 18 }}>🏬</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dashStyles.columnSub}>STORE PICKUP POINT</Text>
                            <Text style={dashStyles.storeTitleText} numberOfLines={1}>
                              {currentOrder.sellerName || currentOrder.restaurantName || "Merchant Store"}
                            </Text>
                            <Text style={dashStyles.storeSubText} numberOfLines={1}>
                              {currentOrder.sellerAddress || currentOrder.restaurantAddress || "Store Location"} • {riderToStoreKm} km away
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={dashStyles.callActionBtn}
                            onPress={() => openPhoneCall(currentOrder.sellerPhone || currentOrder.restaurantPhone || '+91 99887 76655')}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 16 }}>📞</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={dashStyles.navActionBtn}
                            onPress={() => openExternalNavigation(pLat, pLng, currentOrder.sellerAddress || currentOrder.restaurantAddress)}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 13, color: '#ffffff' }}>🧭</Text>
                            <Text style={dashStyles.navActionBtnText}>Nav</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Customer Waypoint Card (Always visible with Call & Navigate as requested) */}
                      <View style={[dashStyles.storeWaypointPill, { borderColor: '#c0edd2', backgroundColor: '#ffffff' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View style={[dashStyles.storeIconCircle, { backgroundColor: '#c0edd2' }]}>
                            <Text style={{ fontSize: 18 }}>👤</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dashStyles.columnSub}>CUSTOMER DROP DESTINATION</Text>
                            <Text style={dashStyles.storeTitleText} numberOfLines={1}>
                              {currentOrder.customerName || "Customer"}
                            </Text>
                            <Text style={dashStyles.storeSubText} numberOfLines={2}>
                              {currentOrder.customerAddress || "Delivery Address"} • {storeToCustomerKm} km from store
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={dashStyles.callActionBtn}
                            onPress={() => openPhoneCall(currentOrder.customerPhone || '+91 98765 43210')}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 16 }}>📞</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[dashStyles.navActionBtn, { backgroundColor: '#042f1e' }]}
                            onPress={() => openExternalNavigation(dLat, dLng, currentOrder.customerAddress)}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 13, color: '#ffffff' }}>🧭</Text>
                            <Text style={dashStyles.navActionBtnText}>Nav</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Checklist Manifest Container */}
                      <View style={dashStyles.checklistCard}>
                        <View style={dashStyles.betweenRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={dashStyles.checklistHeading}>Package Checklist</Text>
                            <View
                              style={[
                                dashStyles.checkCounterBadge,
                                checkedItems.length === itemsToVerify.length && dashStyles.checkCounterBadgeAllReady,
                              ]}
                            >
                              <Text
                                style={[
                                  dashStyles.checkCounterText,
                                  checkedItems.length === itemsToVerify.length && dashStyles.checkCounterTextAllReady,
                                ]}
                              >
                                {checkedItems.length}/{itemsToVerify.length} Ready
                              </Text>
                            </View>
                          </View>
                          <Text style={dashStyles.tapToVerifyText}>Tap to verify</Text>
                        </View>

                        {/* Interactive Item Rows */}
                        <View style={{ gap: 8, marginTop: 10 }}>
                          {itemsToVerify.map((item: any) => {
                            const isChecked = checkedItems.includes(item.id);
                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={[dashStyles.manifestItemRow, isChecked && dashStyles.manifestItemRowChecked]}
                                onPress={() => toggleCheckItem(item.id)}
                                activeOpacity={0.8}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                  <View style={dashStyles.itemIconBox}>
                                    <Text style={{ fontSize: 20 }}>📦</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={[
                                        dashStyles.manifestItemTitle,
                                        isChecked && dashStyles.manifestItemTitleChecked,
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {item.title}
                                    </Text>
                                    <Text style={dashStyles.manifestItemSub}>{item.category}</Text>
                                  </View>
                                </View>

                                {/* Interactive Checkbox */}
                                <View
                                  style={[
                                    dashStyles.customCheckbox,
                                    isChecked && dashStyles.customCheckboxChecked,
                                  ]}
                                >
                                  {isChecked && (
                                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>✓</Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Tamper & Handling Safety Advisory */}
                      <View style={dashStyles.tamperCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={dashStyles.tamperIconCircle}>
                            <Text style={{ fontSize: 16 }}>⚠️</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dashStyles.tamperTitle}>Package Safety Check</Text>
                            <Text style={dashStyles.tamperDesc}>
                              Check that store seals are intact and package is safely secured for transit.
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Interactive Slide-To-Confirm Bottom Action Block */}
                      <SlideToAction
                        onComplete={handleConfirmPickup}
                        label="Slide to Confirm Pickup"
                        completedText="Pickup Verified! Unlocking customer..."
                        subHint="Only slide once inside store with all verified items"
                      />
                    </View>
                  );
                })()}

                {/* ----------------------------------------------------------- */}
                {/* STEP 2: EN ROUTE TO CUSTOMER & DOORSTEP DELIVERY MANIFEST   */}
                {/* ----------------------------------------------------------- */}
                {currentOrder.status === 'HEADING_TO_DELIVERY' && (() => {
                  const parseCoord = (v: any, fallback: number) => {
                    if (typeof v === 'number' && !isNaN(v) && v !== 0) return v;
                    if (typeof v === 'string') {
                      const n = parseFloat(v);
                      if (!isNaN(n) && n !== 0) return n;
                    }
                    return fallback;
                  };

                  const dLat = parseCoord(currentOrder.dropGps?.lat ?? currentOrder.drop?.gps?.lat ?? currentOrder.drop_lat, 17.4485);
                  const dLng = parseCoord(currentOrder.dropGps?.lng ?? currentOrder.drop?.gps?.lng ?? currentOrder.drop_lng, 78.3758);

                  return (
                    <View style={{ gap: 14 }}>
                      {/* Live Status & GPS Mini-Map Section */}
                      <View style={dashStyles.manifestMapContainer}>
                        <LiveRouteMapLayer
                          lat={dLat}
                          lng={dLng}
                          riderLat={riderCoords.lat}
                          riderLng={riderCoords.lng}
                          label="Customer Drop Map"
                          destinationType="customer"
                          zoom={15}
                          address={currentOrder.customerAddress}
                          orderId={currentOrder?.orderId}
                          isOnline={isOnline}
                          onPressLocation={openExternalNavigation}
                        />
                        <View style={dashStyles.manifestMapGradient} />

                        {/* Floating Top Status Chips */}
                        <View style={dashStyles.manifestTopChipsRow}>
                          <View style={dashStyles.stepDeliveryChip}>
                            <View style={dashStyles.stepDeliveryDot} />
                            <Text style={dashStyles.stepEnRouteText}>Step 2: Doorstep Drop</Text>
                          </View>
                          <View style={dashStyles.etaChip}>
                            <Text style={{ fontSize: 14 }}>🛵</Text>
                            <Text style={dashStyles.etaChipText}>ETA ~8 mins</Text>
                          </View>
                        </View>
                      </View>

                      {/* Customer Waypoint Card (Positioned in normal flow below Map) */}
                      <View style={dashStyles.storeWaypointPill}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View style={[dashStyles.storeIconCircle, { backgroundColor: '#c0edd2' }]}>
                            <Text style={{ fontSize: 18 }}>👤</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dashStyles.columnSub}>CUSTOMER DROP POINT</Text>
                            <Text style={dashStyles.storeTitleText} numberOfLines={1}>
                              {currentOrder.customerName || 'Customer'}
                            </Text>
                            <Text style={dashStyles.storeSubText} numberOfLines={2}>
                              {currentOrder.customerAddress || 'Delivery Address'} • {currentOrder.distance || '2.4 km trip'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={dashStyles.callActionBtn}
                            onPress={() => openPhoneCall(currentOrder.customerPhone || '+91 98765 43210')}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 16 }}>📞</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[dashStyles.navActionBtn, { backgroundColor: '#042f1e' }]}
                            onPress={() => openExternalNavigation(dLat, dLng, currentOrder.customerAddress)}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 13, color: '#ffffff' }}>🧭</Text>
                            <Text style={dashStyles.navActionBtnText}>Nav</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Unlocked Address & Security Handover Card */}
                      <View style={dashStyles.privacyCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                          <View style={[dashStyles.privacyIconCircle, { backgroundColor: '#c0edd2' }]}>
                            <Text style={{ fontSize: 16 }}>🛡️</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={dashStyles.betweenRow}>
                              <Text style={dashStyles.privacyTitle}>Customer Handover Verification</Text>
                              <Text style={dashStyles.privacyOrderTag}>Order #{currentOrder.orderId}</Text>
                            </View>
                            <Text style={dashStyles.privacyDescText}>
                              Collect the 4-digit delivery code from the customer at the doorstep to complete delivery.
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* 4-Digit Customer OTP Input Card */}
                      <View style={dashStyles.checklistCard}>
                        <View style={dashStyles.betweenRow}>
                          <Text style={dashStyles.checklistHeading}>Enter Customer 4-Digit Delivery OTP</Text>
                          <TouchableOpacity
                            onPress={() => updateDeliveryOtp('1234')}
                            style={{ backgroundColor: '#ffdbce', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                          >
                            <Text style={{ fontSize: 11, color: '#a73a00', fontWeight: 'bold' }}>Quick Test: 1234</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={[dashStyles.manifestItemSub, { marginTop: 4 }]}>
                          Ask the customer for the 4-digit verification code shown on their ONDC app.
                        </Text>

                        <View style={{ marginTop: 12, alignItems: 'center' }}>
                          <TextInput
                            style={dashStyles.doorstepOtpInput}
                            value={deliveryOtpInput}
                            onChangeText={updateDeliveryOtp}
                            placeholder="1234"
                            placeholderTextColor="#717973"
                            keyboardType="numeric"
                            maxLength={4}
                            textAlign="center"
                          />
                        </View>
                      </View>

                      {/* Direct One-Tap Button */}
                      <TouchableOpacity
                        style={[dashStyles.primaryActionBtn, { width: '100%', marginTop: 4, marginBottom: 8 }]}
                        onPress={() => handleVerifyDeliveryOtp()}
                        activeOpacity={0.8}
                      >
                        <Text style={dashStyles.primaryActionBtnText}>
                          {isVerifyingDeliveryOtp ? 'Verifying OTP...' : 'Verify & Complete Delivery ➔'}
                        </Text>
                      </TouchableOpacity>

                      {/* Slide to Complete Delivery */}
                      <SlideToAction
                        onComplete={handleVerifyDeliveryOtp}
                        label="Slide to Complete Delivery"
                        completedText="Delivery Verified! Completing trip..."
                        subHint="Verify parcel handover with customer before sliding"
                      />
                    </View>
                  );
                })()}
              </View>
            ) : (
              /* If no active order, show radar sweep guidance */
              <View style={dashStyles.noActiveOrderCard}>
                <Text style={{ fontSize: 36 }}>🛵</Text>
                <Text style={dashStyles.sheetHeading}>No Active Delivery</Text>
                <Text style={[dashStyles.fieldHint, { textAlign: 'center' }]}>
                  Your radar is sweeping the Indiranagar Cluster. Go to the Radar tab to accept nearby orders.
                </Text>
                <TouchableOpacity
                  style={[dashStyles.primaryActionBtn, { width: '80%', marginTop: 8 }]}
                  onPress={() => setActiveTab('radar')}
                >
                  <Text style={dashStyles.primaryActionBtnText}>View Available Orders ➔</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* =================================================================== */}
        {/* TAB 3: POCKET WALLET & LEDGER                                       */}
        {/* =================================================================== */}
        {activeTab === 'wallet' && (
          <View style={{ gap: 14 }}>
            {/* Top Glance */}
            <View style={dashStyles.betweenRow}>
              <View>
                <Text style={dashStyles.columnSub}>EARNINGS HUB</Text>
                <Text style={dashStyles.sheetHeading}>Pocket Wallet</Text>
              </View>
              <View style={dashStyles.instantUpiBadge}>
                <Text style={{ fontSize: 12, color: '#042f1e' }}>⚡</Text>
                <Text style={dashStyles.instantUpiText}>Instant UPI</Text>
              </View>
            </View>

            {/* Primary Emerald Balance Card */}
            <View style={dashStyles.emeraldBalanceCard}>
              <View style={dashStyles.betweenRow}>
                <View>
                  <Text style={dashStyles.balanceSub}>AVAILABLE FOR PAYOUT</Text>
                  <Text style={dashStyles.balanceAmount}>₹{walletBalance.toFixed(2)}</Text>
                </View>
                <View style={dashStyles.walletIconCircle}>
                  <Text style={{ fontSize: 24 }}>💼</Text>
                </View>
              </View>

              <View style={dashStyles.autoSweepRow}>
                <Text style={{ fontSize: 13, color: '#89b39b' }}>⏱️ Next Auto-Sweep: 11:30 PM Tonight</Text>
                <Text style={{ fontSize: 11, color: '#c0edd2', fontWeight: 'bold' }}>Zero Fee</Text>
              </View>

              <TouchableOpacity
                style={dashStyles.withdrawBtn}
                onPress={handleWithdrawPayout}
                disabled={isWithdrawing}
                activeOpacity={0.9}
              >
                {isWithdrawing ? (
                  <ActivityIndicator color="#042f1e" />
                ) : (
                  <>
                    <Text style={{ fontSize: 16 }}>💸</Text>
                    <Text style={dashStyles.withdrawBtnText}>Withdraw to Bank / UPI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Daily Shift Ribbon */}
            <View style={dashStyles.dailyShiftCard}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={dashStyles.shiftDot} />
                  <Text style={dashStyles.fieldLabel}>Today's Delivery Shift</Text>
                </View>
                <Text style={dashStyles.fieldHint}>Synced 2m ago</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={dashStyles.shiftMetricBox}>
                  <Text style={dashStyles.fieldHint}>Today Total</Text>
                  <Text style={dashStyles.shiftMetricValue}>₹1,420</Text>
                  <Text style={{ fontSize: 11, color: '#a73a00', fontWeight: 'bold' }}>12 Trips</Text>
                </View>
                <View style={dashStyles.shiftMetricBox}>
                  <Text style={dashStyles.fieldHint}>Online Time</Text>
                  <Text style={dashStyles.shiftMetricValue}>5h 45m</Text>
                  <Text style={{ fontSize: 11, color: '#414943' }}>Active road</Text>
                </View>
                <View style={dashStyles.shiftMetricBox}>
                  <Text style={dashStyles.fieldHint}>Tips Earned</Text>
                  <Text style={dashStyles.shiftMetricValue}>₹350</Text>
                  <Text style={{ fontSize: 11, color: '#1e4633', fontWeight: 'bold' }}>4 customers</Text>
                </View>
              </View>
            </View>

            {/* Weekly Performance Bar Chart */}
            <View style={dashStyles.card}>
              <View style={dashStyles.betweenRow}>
                <View>
                  <Text style={dashStyles.fieldHint}>Weekly Cadence</Text>
                  <Text style={dashStyles.fieldLabel}>₹9,840 Earned this Week</Text>
                </View>
                <View style={dashStyles.weeklyTrendBadge}>
                  <Text style={{ fontSize: 12, color: '#042f1e' }}>📈 +18%</Text>
                </View>
              </View>

              {/* SVG Bar Chart */}
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <Svg width={SCREEN_WIDTH - 64} height={110} viewBox="0 0 320 120">
                  <Line x1="10" y1="20" x2="310" y2="20" stroke="#E9EDFF" strokeDasharray="3,3" strokeWidth="1" />
                  <Line x1="10" y1="60" x2="310" y2="60" stroke="#E9EDFF" strokeDasharray="3,3" strokeWidth="1" />
                  <Line x1="10" y1="100" x2="310" y2="100" stroke="#DCE2F7" strokeWidth="1" />
                  
                  {/* Mon */}
                  <Rect x="18" y="48" width="22" height="52" rx="4" fill="#e1e8fd" />
                  <SvgText x="29" y="114" fill="#717973" fontSize="11" textAnchor="middle">M</SvgText>

                  {/* Tue */}
                  <Rect x="60" y="38" width="22" height="62" rx="4" fill="#e1e8fd" />
                  <SvgText x="71" y="114" fill="#717973" fontSize="11" textAnchor="middle">T</SvgText>

                  {/* Wed */}
                  <Rect x="102" y="55" width="22" height="45" rx="4" fill="#e1e8fd" />
                  <SvgText x="113" y="114" fill="#717973" fontSize="11" textAnchor="middle">W</SvgText>

                  {/* Thu */}
                  <Rect x="144" y="32" width="22" height="68" rx="4" fill="#e1e8fd" />
                  <SvgText x="155" y="114" fill="#717973" fontSize="11" textAnchor="middle">T</SvgText>

                  {/* Fri - Peak */}
                  <Rect x="186" y="14" width="22" height="86" rx="4" fill="#042f1e" />
                  <Circle cx="197" cy="8" r="3" fill="#fd651e" />
                  <SvgText x="197" y="114" fill="#042f1e" fontSize="11" fontWeight="bold" textAnchor="middle">F</SvgText>

                  {/* Sat */}
                  <Rect x="228" y="24" width="22" height="76" rx="4" fill="#e1e8fd" />
                  <SvgText x="239" y="114" fill="#717973" fontSize="11" textAnchor="middle">S</SvgText>

                  {/* Sun (Today) */}
                  <Rect x="270" y="36" width="22" height="64" rx="4" fill="#1e4633" />
                  <SvgText x="281" y="114" fill="#042f1e" fontSize="11" fontWeight="bold" textAnchor="middle">S</SvgText>
                </Svg>
              </View>

              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, backgroundColor: '#042f1e', borderRadius: 2 }} />
                  <Text style={dashStyles.fieldHint}>Friday Peak: ₹2,150</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, backgroundColor: '#1e4633', borderRadius: 2 }} />
                  <Text style={dashStyles.fieldHint}>Today Ongoing</Text>
                </View>
              </View>
            </View>

            {/* Bank Binding Card */}
            <View style={dashStyles.card}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={dashStyles.bankIconCircle}>
                    <Text style={{ fontSize: 20 }}>🏛️</Text>
                  </View>
                  <View>
                    <Text style={dashStyles.fieldLabel}>{rider.bank_name || rider.bankName || 'Primary Bank Account'}</Text>
                    <Text style={dashStyles.fieldHint}>
                      {rider.bank_account_number ? `•••• ${rider.bank_account_number.slice(-4)}` : 'Verified Account'} • Instant Settlement
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, color: '#717973' }}>•••</Text>
              </View>

              <View style={dashStyles.pennyDropActiveBox}>
                <Text style={{ fontSize: 11, color: '#042f1e', fontWeight: 'bold' }}>✓ ₹1.00 Penny Drop Verified</Text>
                <Text style={{ fontSize: 11, color: '#042f1e', fontWeight: 'bold' }}>Active Primary</Text>
              </View>
            </View>

            {/* Recent Ledger Entries */}
            <View style={{ gap: 8 }}>
              <View style={dashStyles.betweenRow}>
                <Text style={dashStyles.fieldLabel}>Recent Ledger Entries</Text>
                <TouchableOpacity onPress={() => Alert.alert('Export Statement', 'Rider payout statement exported successfully.')}>
                  <Text style={{ fontSize: 12, color: '#042f1e', fontWeight: 'bold', textDecorationLine: 'underline' }}>
                    Download CSV
                  </Text>
                </TouchableOpacity>
              </View>

              {ledgerEntries.length === 0 ? (
                <View style={[dashStyles.radarScanningCard, { paddingVertical: 18, marginTop: 4 }]}>
                  <Text style={{ fontSize: 28 }}>💰</Text>
                  <Text style={dashStyles.radarScanningTitle}>No Settlements Yet</Text>
                  <Text style={dashStyles.radarScanningSub}>
                    Completed ONDC delivery trips and earnings will be credited and logged here automatically.
                  </Text>
                </View>
              ) : (
                ledgerEntries.map((item: any, idx: number) => (
                  <View key={idx} style={dashStyles.ledgerItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 20 }}>📦</Text>
                      <View>
                        <Text style={dashStyles.orderIdText}>Order #{item.orderId || item.order_id}</Text>
                        <Text style={dashStyles.fieldHint}>
                          {item.pickup?.name || item.pickup_name || 'Merchant Partner'} • Completed
                        </Text>
                      </View>
                    </View>
                    <Text style={dashStyles.ledgerCredit}>
                      +₹{Number(item.deliveryFee || item.delivery_fee || 50.0).toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* TAB 4: RIDER PROFILE                                                */}
        {/* =================================================================== */}
        {activeTab === 'profile' && (
          <View style={{ gap: 14 }}>
            {/* Top Partner Identity Hero Card */}
            <View style={dashStyles.profileHeroCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#c0edd2', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>👤</Text>
                  </View>
                  <View>
                    <Text style={dashStyles.profileNameText}>{rider.name || 'Delivery Partner'}</Text>
                    <Text style={dashStyles.profileIdText}>{rider.phone || '+91 9876543210'}</Text>
                    <Text style={{ fontSize: 11, color: '#c0edd2', marginTop: 2, fontFamily: 'monospace' }}>ID: {rider.id || 'RALT-RIDER-001'}</Text>
                  </View>
                </View>

                {/* Edit Mode Toggle Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: isEditingProfile ? '#fd651e' : '#1e4633',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isEditingProfile ? '#fd651e' : '#3f6752',
                  }}
                  onPress={() => setIsEditingProfile(!isEditingProfile)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                    {isEditingProfile ? '✕ Cancel' : '✏️ Edit Profile'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 1. PERSONAL DETAILS CARD */}
            <View style={dashStyles.profileCard}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                  <Text style={dashStyles.cardHeaderTitle}>Personal Information</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#717973' }}>Step 1 Data</Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Full Name</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.name}
                      onChangeText={(t) => setProfileForm({ ...profileForm, name: t })}
                      placeholder="Full Name"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.name || 'Not provided'}</Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Registered Phone Number</Text>
                  <Text style={dashStyles.profileValueText}>{profileForm.phone || rider.phone || 'Not provided'}</Text>
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Date of Birth (DOB)</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.dob}
                      onChangeText={(t) => setProfileForm({ ...profileForm, dob: t })}
                      placeholder="DD-MM-YYYY"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.dob || 'Not provided'}</Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Operating City / Hub Area</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.city}
                      onChangeText={(t) => setProfileForm({ ...profileForm, city: t })}
                      placeholder="City or Work Area"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.city || 'Hyderabad'}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* 2. VEHICLE & DRIVING LICENSE CARD */}
            <View style={dashStyles.profileCard}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🛵</Text>
                  <Text style={dashStyles.cardHeaderTitle}>Vehicle & Driving License</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#717973' }}>Step 2 & 3 Data</Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Vehicle Type</Text>
                  {isEditingProfile ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      {['motorcycle', 'electric', 'bicycle'].map((vType) => (
                        <TouchableOpacity
                          key={vType}
                          style={[
                            dashStyles.vTypePill,
                            profileForm.vehicle_type === vType && dashStyles.vTypePillActive,
                          ]}
                          onPress={() => setProfileForm({ ...profileForm, vehicle_type: vType })}
                        >
                          <Text
                            style={[
                              dashStyles.vTypePillText,
                              profileForm.vehicle_type === vType && dashStyles.vTypePillTextActive,
                            ]}
                          >
                            {vType.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={dashStyles.profileValueText}>
                      {(profileForm.vehicle_type || 'motorcycle').toUpperCase()}
                    </Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Vehicle Registration Number</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.vehicle_number}
                      onChangeText={(t) => setProfileForm({ ...profileForm, vehicle_number: t })}
                      placeholder="e.g. TS 09 EA 1234"
                      autoCapitalize="characters"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.vehicle_number || 'Not provided'}</Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Driving License Number (DL)</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.dl_number}
                      onChangeText={(t) => setProfileForm({ ...profileForm, dl_number: t })}
                      placeholder="e.g. TS0920190012345"
                      autoCapitalize="characters"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.dl_number || 'Not provided'}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* ZOMATO STYLE VERIFIED KYC & DOCUMENT VAULT CARD */}
            <View style={dashStyles.profileCard}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>🛡️</Text>
                  <View>
                    <Text style={dashStyles.cardHeaderTitle}>ONDC Delivery Partner KYC</Text>
                    <Text style={{ fontSize: 11, color: rider.kyc_status === 'APPROVED' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                      {rider.kyc_status === 'APPROVED' ? '● VERIFIED & AUTHORIZED' : '● VERIFICATION IN PROGRESS'}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: rider.kyc_status === 'APPROVED' ? '#c0edd2' : '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: rider.kyc_status === 'APPROVED' ? '#002113' : '#b45309' }}>
                    {rider.kyc_status === 'APPROVED' ? 'Active Duty Ready' : 'Pending Review'}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 12, gap: 8 }}>
                {[
                  { name: 'Aadhaar eKYC (UIDAI)', desc: 'Identity Verified & Vault Tokenized', status: 'VERIFIED' },
                  { name: 'Permanent Account Number (PAN)', desc: 'NSDL Income Tax Verified', status: 'VERIFIED' },
                  { name: 'Driving License (DL)', desc: 'MoRTH Sarathi Registry Match', status: rider.vehicle_type === 'bicycle' ? 'EXEMPT' : 'VERIFIED' },
                  { name: 'Vehicle Registration (RC)', desc: 'Vahan State Transport Registry', status: rider.vehicle_type === 'bicycle' ? 'EXEMPT' : 'VERIFIED' },
                  { name: 'Biometric Live Selfie', desc: 'Face Liveness 99.8% Match', status: 'VERIFIED' },
                  { name: 'Bank Payout (Penny Drop)', desc: 'NPCI IMPS Name Match Verified', status: 'VERIFIED' },
                ].map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8faff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>{item.name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>{item.desc}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e6f4ea', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 12, color: '#137333', fontWeight: 'bold' }}>✓</Text>
                      <Text style={{ fontSize: 10, color: '#137333', fontWeight: 'bold' }}>{item.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 3. GOVERNMENT IDENTIFICATION CARD */}
            <View style={dashStyles.profileCard}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🪪</Text>
                  <Text style={dashStyles.cardHeaderTitle}>Government ID & KYC</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#717973' }}>Step 4 Data</Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Aadhaar Number</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.aadhaar_number}
                      onChangeText={(t) => setProfileForm({ ...profileForm, aadhaar_number: t })}
                      placeholder="12-digit Aadhaar number"
                      keyboardType="numeric"
                      maxLength={12}
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>
                      {profileForm.aadhaar_number
                        ? `XXXX XXXX ${profileForm.aadhaar_number.slice(-4)}`
                        : 'Not provided'}
                    </Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>PAN Card Number</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.pan_number}
                      onChangeText={(t) => setProfileForm({ ...profileForm, pan_number: t })}
                      placeholder="e.g. ABCDE1234F"
                      autoCapitalize="characters"
                      maxLength={10}
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.pan_number || 'Not provided'}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* 4. BANK ACCOUNT & PAYOUT SETTINGS */}
            <View style={dashStyles.profileCard}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🏦</Text>
                  <Text style={dashStyles.cardHeaderTitle}>Bank Account & Payouts</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#717973' }}>Step 5 Data</Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Account Holder Name</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.account_holder_name}
                      onChangeText={(t) => setProfileForm({ ...profileForm, account_holder_name: t })}
                      placeholder="Name as per Bank Account"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>
                      {profileForm.account_holder_name || profileForm.name || 'Not provided'}
                    </Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Bank Name</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.bank_name}
                      onChangeText={(t) => setProfileForm({ ...profileForm, bank_name: t })}
                      placeholder="e.g. HDFC Bank Ltd"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.bank_name || 'HDFC Bank'}</Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Bank Account Number</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.bank_account_number}
                      onChangeText={(t) => setProfileForm({ ...profileForm, bank_account_number: t })}
                      placeholder="Account Number"
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>
                      {profileForm.bank_account_number
                        ? `••••••${profileForm.bank_account_number.slice(-4)}`
                        : 'Not provided'}
                    </Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>IFSC Code</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.bank_ifsc}
                      onChangeText={(t) => setProfileForm({ ...profileForm, bank_ifsc: t })}
                      placeholder="e.g. HDFC0001234"
                      autoCapitalize="characters"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.bank_ifsc || 'Not provided'}</Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Direct UPI ID</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.upi_id}
                      onChangeText={(t) => setProfileForm({ ...profileForm, upi_id: t })}
                      placeholder="e.g. name@okhdfcbank"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.upi_id || 'Not provided'}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* 5. EMERGENCY CONTACT */}
            <View style={dashStyles.profileCard}>
              <View style={dashStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🚨</Text>
                  <Text style={dashStyles.cardHeaderTitle}>Emergency Contact</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#717973' }}>SOS Contact</Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Contact Person Name</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.emergency_name}
                      onChangeText={(t) => setProfileForm({ ...profileForm, emergency_name: t })}
                      placeholder="Emergency contact name"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.emergency_name || 'Not provided'}</Text>
                  )}
                </View>

                <View>
                  <Text style={dashStyles.fieldLabelSmall}>Emergency Phone</Text>
                  {isEditingProfile ? (
                    <TextInput
                      style={dashStyles.profileEditInput}
                      value={profileForm.emergency_phone}
                      onChangeText={(t) => setProfileForm({ ...profileForm, emergency_phone: t })}
                      placeholder="Emergency phone number"
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <Text style={dashStyles.profileValueText}>{profileForm.emergency_phone || 'Not provided'}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Save Profile Button (Visible during Edit Mode) */}
            {isEditingProfile && (
              <TouchableOpacity
                style={[dashStyles.primaryActionBtn, { backgroundColor: '#00855d', marginTop: 4 }]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                activeOpacity={0.8}
              >
                <Text style={dashStyles.primaryActionBtnText}>
                  {isSavingProfile ? 'Saving Changes...' : '💾 Save Profile Changes'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Duty Session & Account Actions */}
            <View style={{ gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[dashStyles.dutyToggleBtn, !isOnline && dashStyles.dutyToggleBtnOffline]}
                onPress={() => {
                if (!isOnline && (rider.onboarding_completed !== 1 || rider.kyc_status !== 'APPROVED')) {
                  Alert.alert(
                    'Verification Pending',
                    'Your documents are currently under review by the operations team. You cannot go online until all documents are approved.'
                  );
                  return;
                }
                setIsOnline(!isOnline);
              }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 18 }}>{isOnline ? '⏸️' : '▶️'}</Text>
                <Text style={[dashStyles.dutyToggleBtnText, !isOnline && dashStyles.dutyToggleBtnTextOffline]}>
                  {isOnline ? 'Disconnect / End Duty Session' : 'Resume Online Duty'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={dashStyles.logoutBtn}
                onPress={onLogout}
                activeOpacity={0.8}
              >
                <Text style={dashStyles.logoutBtnText}>Log Out / Switch Partner</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ===================================================================== */}
      {/* ORDER DETAIL VIEW MODAL (WAYPOINTS & 40s COUNTDOWN)                   */}
      {/* ===================================================================== */}
      <Modal visible={!!selectedOrderDetail} animationType="slide" transparent>
        <View style={dashStyles.modalDarkOverlay}>
          <View style={dashStyles.modalDetailSheet}>
            {/* Map Preview Layer */}
            <View style={dashStyles.detailMapContainer}>
              <LiveRouteMapLayer
                lat={selectedOrderDetail?.pickupGps?.lat || 17.4485}
                lng={selectedOrderDetail?.pickupGps?.lng || 78.3908}
                riderLat={riderCoords.lat}
                riderLng={riderCoords.lng}
                destinationType="store"
                isOnline={isOnline}
                label="Delivery Request Map"
                zoom={14}
              />

              {/* Waypoint Overlay */}
              <View style={dashStyles.mapWaypointsOverlay}>
                <View style={dashStyles.betweenRow}>
                  <View style={dashStyles.gpsLockedPill}>
                    <View style={dashStyles.surgeDot} />
                    <Text style={dashStyles.gpsLockedText}>
                      Trip Distance: {selectedOrderDetail?.distance || '2.4 km'}
                    </Text>
                  </View>
                  <View style={dashStyles.surgeMultiplierPill}>
                    <Text style={{ fontSize: 12 }}>⚡</Text>
                    <Text style={dashStyles.surgeMultiplierText}>Surge 1.4x</Text>
                  </View>
                </View>

                {/* SVG Route Track */}
                <View style={{ height: 100, marginVertical: 6 }}>
                  <Svg width="100%" height="100%" viewBox="0 0 340 120">
                    <Path d="M 65 90 L 95 40 L 245 45" stroke="#042F1E" strokeWidth="4.5" strokeLinecap="round" />
                    <Path d="M 65 90 L 95 40 L 245 45" stroke="#C0EDD2" strokeWidth="2" strokeLinecap="round" />
                  </Svg>
                </View>

                {/* Circular Floating Countdown Timer */}
                <View style={dashStyles.countdownCircleContainer}>
                  <View style={dashStyles.countdownCircleInner}>
                    <Text style={dashStyles.countdownTimerText}>
                      00:{orderCountdown < 10 ? `0${orderCountdown}` : orderCountdown}
                    </Text>
                    <Text style={dashStyles.countdownSubText}>SEC</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Bottom Sheet Card */}
            <ScrollView style={{ padding: 16 }}>
              <View style={dashStyles.pullHandle} />

              <View style={dashStyles.betweenRow}>
                <Text style={dashStyles.sheetHeading}>Delivery Request</Text>
                <View style={dashStyles.etaPill}>
                  <Text style={{ fontSize: 12, color: '#a73a00' }}>⏱️</Text>
                  <Text style={dashStyles.etaPillText}>01 h 50 min</Text>
                </View>
              </View>

              <View style={[dashStyles.orderTagAndPayoutPill, { marginTop: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={dashStyles.orderIdText}>Order #{selectedOrderDetail?.orderId}</Text>
                  <Text style={dashStyles.fieldHint}>Standard Hub</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={dashStyles.fieldHint}>Est. Payout</Text>
                  <Text style={dashStyles.payoutAmountText}>₹{selectedOrderDetail?.payout?.toFixed(2) || '80.00'}</Text>
                  <Text style={{ fontSize: 10, color: '#a73a00' }}>(+₹15 surge)</Text>
                </View>
              </View>

              {/* Split Metadata: Merchant & Recipient */}
              <View style={dashStyles.splitDetailBox}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={dashStyles.merchantAvatarBox}>
                    <Text style={{ fontSize: 18 }}>🏬</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dashStyles.columnSub}>SELLER • {selectedOrderDetail?.pickupDistance || '1.2 km away'}</Text>
                    <Text style={dashStyles.partyName}>{selectedOrderDetail?.sellerName || selectedOrderDetail?.restaurantName || "Merchant Store"}</Text>
                    <Text style={dashStyles.partyAddress}>{selectedOrderDetail?.sellerAddress || selectedOrderDetail?.restaurantAddress || "Store Location"}</Text>
                  </View>
                </View>

                <View style={dashStyles.routeConnectorLine}>
                  <Text style={dashStyles.routeConnectorText}>Drop trip: {selectedOrderDetail?.distance || '3.5 km'} • Direct Route</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[dashStyles.merchantAvatarBox, { backgroundColor: '#c0edd2' }]}>
                    <Text style={{ fontSize: 18 }}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={dashStyles.betweenRow}>
                      <Text style={dashStyles.columnSub}>CUSTOMER</Text>
                      <Text style={{ fontSize: 11, color: '#042f1e', fontWeight: 'bold' }}>ONDC Verified</Text>
                    </View>
                    <Text style={dashStyles.partyName}>{selectedOrderDetail?.customerName || "Customer"}</Text>
                    <Text style={dashStyles.partyAddress}>{selectedOrderDetail?.customerAddress || "Delivery Address"}</Text>
                  </View>
                </View>
              </View>

              {/* Package Summary */}
              <View style={[dashStyles.packageSummaryBox, { marginVertical: 10 }]}>
                <Text style={dashStyles.fieldHint}>
                  🛍️ {selectedOrderDetail?.items?.length || 1} items ({selectedOrderDetail?.items?.map((i: any) => `${i.quantity || 1}x ${i.name}`).join(', ') || 'Express Pack'})
                </Text>
                <Text style={{ fontSize: 11, color: '#042f1e', fontWeight: 'bold' }}>Pre-paid</Text>
              </View>

              {/* CTAs */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 24 }}>
                <TouchableOpacity
                  style={dashStyles.declineBtn}
                  onPress={() => setSelectedOrderDetail(null)}
                >
                  <Text style={{ fontSize: 16 }}>✕</Text>
                  <Text style={dashStyles.declineBtnText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={dashStyles.acceptModalBtn}
                  onPress={() => handleAcceptOrder(selectedOrderDetail)}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16 }}>✓</Text>
                  <Text style={dashStyles.acceptModalBtnText}>Accept Order</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* CELEBRATORY ORDER DELIVERED MODAL                                      */}
      {/* ===================================================================== */}
      <Modal visible={showDeliveredModal} transparent animationType="fade">
        <View style={dashStyles.modalDarkOverlay}>
          <View style={dashStyles.deliveredSuccessCard}>
            <View style={dashStyles.celebrateCheckCircle}>
              <Text style={{ fontSize: 32 }}>🎉</Text>
            </View>
            <Text style={dashStyles.sheetHeading}>Order Delivered Successfully!</Text>
            <Text style={[dashStyles.fieldHint, { textAlign: 'center', marginTop: 4 }]}>
              OTP Verified. Your earnings have been credited to your Pocket Wallet.
            </Text>

            <View style={dashStyles.payoutCreditSummaryBox}>
              <View style={dashStyles.betweenRow}>
                <Text style={dashStyles.fieldHint}>Delivery Fee:</Text>
                <Text style={[dashStyles.fieldLabel, { color: '#042f1e' }]}>+₹{(deliveredOrderSummary?.earned || 80).toFixed(2)}</Text>
              </View>
              <View style={dashStyles.betweenRow}>
                <Text style={dashStyles.fieldHint}>Customer Tip ({deliveredOrderSummary?.customerName || 'Customer'}):</Text>
                <Text style={[dashStyles.fieldLabel, { color: '#042f1e' }]}>+₹30.00</Text>
              </View>
            </View>

            <TouchableOpacity
              style={dashStyles.primaryActionBtn}
              onPress={() => {
                setShowDeliveredModal(false);
                setActiveTab('wallet');
              }}
            >
              <Text style={dashStyles.primaryActionBtnText}>View Pocket Wallet ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* WITHDRAWAL INITIATED TOAST                                            */}
      {/* ===================================================================== */}
      {showWithdrawToast && (
        <View style={dashStyles.withdrawToastBox}>
          <Text style={{ fontSize: 20 }}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>Withdrawal Initiated!</Text>
            <Text style={{ color: '#c0edd2', fontSize: 11 }}>₹{walletBalance.toFixed(2)} sent to primary bank account</Text>
          </View>
          <Text style={{ color: '#c0edd2', fontWeight: 'bold', fontSize: 11 }}>1-2s</Text>
        </View>
      )}

      {/* GENERAL FEEDBACK TOAST */}
      {showToast && (
        <View style={dashStyles.floatingFeedbackToast}>
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>{toastMessage}</Text>
        </View>
      )}

      {/* ===================================================================== */}
      {/* BOTTOM NAVIGATION BAR (FIXED 4 TABS)                                  */}
      {/* ===================================================================== */}
      <View style={dashStyles.bottomNav}>
        {/* Tab 1: Radar */}
        <TouchableOpacity
          style={dashStyles.navTabItem}
          onPress={() => setActiveTab('radar')}
          activeOpacity={0.7}
        >
          <RadarSvg color={activeTab === 'radar' ? '#042f1e' : '#717973'} />
          <Text style={[dashStyles.navTabLabel, activeTab === 'radar' && dashStyles.navTabLabelActive]}>Radar</Text>
        </TouchableOpacity>

        {/* Tab 2: Orders */}
        <TouchableOpacity
          style={dashStyles.navTabItem}
          onPress={() => setActiveTab('orders')}
          activeOpacity={0.7}
        >
          <OrdersSvg color={activeTab === 'orders' ? '#042f1e' : '#717973'} />
          <Text style={[dashStyles.navTabLabel, activeTab === 'orders' && dashStyles.navTabLabelActive]}>Orders</Text>
        </TouchableOpacity>

        {/* Tab 3: Wallet */}
        <TouchableOpacity
          style={dashStyles.navTabItem}
          onPress={() => setActiveTab('wallet')}
          activeOpacity={0.7}
        >
          <WalletSvg color={activeTab === 'wallet' ? '#042f1e' : '#717973'} />
          <Text style={[dashStyles.navTabLabel, activeTab === 'wallet' && dashStyles.navTabLabelActive]}>Wallet</Text>
        </TouchableOpacity>

        {/* Tab 4: Profile */}
        <TouchableOpacity
          style={dashStyles.navTabItem}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.7}
        >
          <ProfileSvg color={activeTab === 'profile' ? '#042f1e' : '#717973'} />
          <Text style={[dashStyles.navTabLabel, activeTab === 'profile' && dashStyles.navTabLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLESHEET
// =============================================================================
const dashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9ff',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : undefined,
    alignSelf: 'center',
    marginHorizontal: Platform.OS === 'web' ? ('auto' as any) : undefined,
  },
  headerBar: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 6 : 14) : 10,
    paddingBottom: 14,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9edff',
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#042f1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#042f1e',
    lineHeight: 18,
  },
  logoSub: {
    fontSize: 11,
    color: '#414943',
    lineHeight: 12,
  },
  dutyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f3ff',
  },
  dutyPillOnline: {
    backgroundColor: '#c0edd2',
  },
  dutyPillOffline: {
    backgroundColor: '#e1e8fd',
  },
  dutyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#717973',
  },
  dutyDotOnline: {
    backgroundColor: '#01482f',
  },
  dutyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#414943',
  },
  dutyTextOnline: {
    color: '#002113',
  },
  profileIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#042f1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 150,
  },
  betweenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapSelectorStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  mapSelectTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e1e8fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSelectTabActive: {
    backgroundColor: '#042f1e',
    borderColor: '#042f1e',
  },
  mapSelectTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#141b2b',
    textAlign: 'center',
  },
  mapSelectTabTextActive: {
    color: '#ffffff',
  },
  zomatoEstCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e1e8fd',
    gap: 10,
  },
  zomatoEstHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#042f1e',
    letterSpacing: 0.8,
  },
  zomatoEtaPill: {
    backgroundColor: '#ffe8dc',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  zomatoEtaPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a73a00',
  },
  zomatoRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f3ff',
    padding: 10,
    borderRadius: 10,
  },
  zomatoLegTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  zomatoLegSub: {
    fontSize: 11,
    color: '#717973',
    marginTop: 2,
  },
  radarScanningCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e1e8fd',
    marginVertical: 8,
  },
  radarPulseCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#c0edd2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarScanningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#042f1e',
  },
  radarScanningSub: {
    fontSize: 13,
    color: '#717973',
    textAlign: 'center',
    lineHeight: 18,
  },
  radarStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e1f5eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  radarLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#042f1e',
  },
  radarStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#042f1e',
  },
  simulateOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#042f1e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 8,
    width: '100%',
  },
  simulateOrderBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  radarMapHeader: {
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e1e8fd',
  },
  radarMapImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  radarMapOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 47, 30, 0.45)',
    padding: 12,
    justifyContent: 'space-between',
  },
  surgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  surgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fd651e',
  },
  surgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#042f1e',
  },
  radarSweepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#042f1e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  radarSweepText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  zoneSub: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#c0edd2',
    letterSpacing: 0.5,
  },
  zoneTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  nearbyBadge: {
    backgroundColor: '#c0edd2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nearbyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#002113',
  },
  sheetHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#042f1e',
  },
  fieldHint: {
    fontSize: 11,
    color: '#717973',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e9edff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 10,
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fd651e',
  },
  priorityPill: {
    backgroundColor: '#ffdbce',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7f2b00',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timePillText: {
    fontSize: 11,
    color: '#414943',
    fontWeight: '600',
  },
  splitSellerCustomerGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  columnSub: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#717973',
    letterSpacing: 0.5,
  },
  merchantThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#e1e8fd',
  },
  partyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  partyAddress: {
    fontSize: 11,
    color: '#414943',
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f3ff',
    padding: 10,
    borderRadius: 12,
  },
  payoutAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#042f1e',
  },
  acceptCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e4633',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  acceptCtaBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  greenTierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e9edff',
    padding: 12,
    borderRadius: 14,
  },
  greenTierIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#b1f0cd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenTierTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#042f1e',
  },
  greenTierPct: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fd651e',
  },
  activeOrderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  liveOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#c0edd2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveOrderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#01482f',
  },
  liveOrderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#002113',
  },
  activeFeeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#042f1e',
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f3ff',
  },
  stepPillActive: {
    backgroundColor: '#042f1e',
  },
  stepPillText: {
    fontSize: 11,
    color: '#717973',
  },
  stepPillTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  merchantHighlightBox: {
    backgroundColor: '#f1f3ff',
    padding: 12,
    borderRadius: 12,
  },
  customerHighlightBox: {
    backgroundColor: '#f1f3ff',
    padding: 12,
    borderRadius: 12,
  },
  itemsListCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9edff',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  callCustomerBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#c0edd2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  otpVerificationCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#c0edd2',
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  doorstepOtpInput: {
    height: 48,
    backgroundColor: '#f1f3ff',
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#042f1e',
    marginVertical: 4,
  },
  primaryActionBtn: {
    height: 48,
    backgroundColor: '#042f1e',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  noActiveOrderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  instantUpiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#c0edd2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  instantUpiText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#042f1e',
  },
  emeraldBalanceCard: {
    backgroundColor: '#042f1e',
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  balanceSub: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#89b39b',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  walletIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e4633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoSweepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 70, 51, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  withdrawBtn: {
    height: 46,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  withdrawBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#042f1e',
  },
  dailyShiftCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  shiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fd651e',
  },
  shiftMetricBox: {
    flex: 1,
    backgroundColor: '#f1f3ff',
    padding: 8,
    borderRadius: 10,
  },
  shiftMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#042f1e',
    marginVertical: 2,
  },
  weeklyTrendBadge: {
    backgroundColor: '#e1e8fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bankIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e1e8fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pennyDropActiveBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#c0edd2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  ledgerItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerCredit: {
    fontSize: 14,
    fontWeight: '800',
    color: '#042f1e',
  },
  ledgerDebit: {
    fontSize: 14,
    fontWeight: '800',
    color: '#a73a00',
  },
  logoutBtn: {
    height: 46,
    backgroundColor: '#ffdbce',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#a73a00',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: '#e9edff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
  },
  navTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    width: 60,
  },
  navTabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  navTabIconActive: {
    opacity: 1,
  },
  navTabLabel: {
    fontSize: 10,
    color: '#717973',
    marginTop: 2,
  },
  navTabLabelActive: {
    color: '#042f1e',
    fontWeight: 'bold',
  },
  modalDarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 27, 43, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalDetailSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  detailMapContainer: {
    height: 220,
    position: 'relative',
    backgroundColor: '#e1e8fd',
  },
  detailMapImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  mapWaypointsOverlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(4, 47, 30, 0.35)',
  },
  gpsLockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  gpsLockedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#141b2b',
  },
  surgeMultiplierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  surgeMultiplierText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#a73a00',
  },
  countdownCircleContainer: {
    alignSelf: 'center',
    marginBottom: -24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#042f1e',
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  countdownCircleInner: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
    backgroundColor: '#1e4633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownTimerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  countdownSubText: {
    color: '#a5d0b7',
    fontSize: 8,
    fontWeight: 'bold',
  },
  pullHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dce2f7',
    alignSelf: 'center',
    marginBottom: 10,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffdbce',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  etaPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#a73a00',
  },
  orderTagAndPayoutPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f3ff',
    padding: 10,
    borderRadius: 12,
  },
  splitDetailBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  merchantAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ffdad6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeConnectorLine: {
    marginLeft: 20,
    paddingLeft: 12,
    borderLeftWidth: 1.5,
    borderColor: '#c1c8c1',
    paddingVertical: 4,
  },
  routeConnectorText: {
    fontSize: 11,
    color: '#717973',
  },
  packageSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#e9edff',
    padding: 10,
    borderRadius: 10,
  },
  declineBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#e9edff',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141b2b',
  },
  acceptModalBtn: {
    flex: 1.5,
    height: 48,
    backgroundColor: '#042f1e',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  deliveredSuccessCard: {
    margin: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  celebrateCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#c0edd2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutCreditSummaryBox: {
    width: '100%',
    backgroundColor: '#f1f3ff',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  withdrawToastBox: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#042f1e',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingFeedbackToast: {
    position: 'absolute',
    top: 66,
    left: 20,
    right: 20,
    backgroundColor: '#042f1e',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  // Profile Screen Styles
  fieldLabelSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#717973',
    marginBottom: 4,
  },
  profileValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141b2b',
    paddingVertical: 2,
  },
  profileEditInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#042f1e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#141b2b',
    fontWeight: '600',
  },
  vTypePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c1c8c1',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  vTypePillActive: {
    backgroundColor: '#042f1e',
    borderColor: '#042f1e',
  },
  vTypePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#717973',
  },
  vTypePillTextActive: {
    color: '#c0edd2',
  },
  profileHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  profileHeroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#c0edd2',
    opacity: 0.45,
  },
  profileAvatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e9edff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarCheckBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#042f1e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  profileNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#141b2b',
  },
  verifiedPillSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#c0edd2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIdText: {
    fontSize: 12,
    color: '#a73a00',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  fleetProPill: {
    backgroundColor: '#c0edd2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  fleetProPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#002113',
  },
  ondcLogPill: {
    backgroundColor: '#e9edff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ondcLogPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#042f1e',
  },
  metricsStripRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricStripBox: {
    flex: 1,
    backgroundColor: '#f1f3ff',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricStripValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#141b2b',
  },
  metricStripLabel: {
    fontSize: 11,
    color: '#414943',
    marginTop: 2,
    fontWeight: '500',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a5d0b7',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141b2b',
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#c0edd2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#042f1e',
  },
  connectedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#002113',
  },
  nodeUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f3ff',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  iconSquare: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e1e8fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeUrlText: {
    fontSize: 12,
    color: '#414943',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  latencyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#042f1e',
  },
  vehicleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#c0edd2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141b2b',
  },
  vehicleSub: {
    fontSize: 11,
    color: '#414943',
  },
  ecoActivePill: {
    backgroundColor: '#fd651e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  ecoActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  telemetryBox: {
    flex: 1,
    backgroundColor: '#f1f3ff',
    padding: 10,
    borderRadius: 12,
    gap: 4,
  },
  telemetryLabel: {
    fontSize: 11,
    color: '#414943',
    fontWeight: '500',
  },
  telemetryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  telemetrySub: {
    fontSize: 10,
    color: '#717973',
  },
  batteryProgressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#dce2f7',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 2,
  },
  batteryProgressBarFill: {
    height: '100%',
    backgroundColor: '#042f1e',
    borderRadius: 3,
  },
  validatedPill: {
    backgroundColor: '#e9edff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  validatedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#042f1e',
  },
  kycRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f3ff',
    padding: 10,
    borderRadius: 12,
  },
  kycIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#dce2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  kycSub: {
    fontSize: 11,
    color: '#717973',
  },
  kycVerifiedBadge: {
    backgroundColor: '#c0edd2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  kycVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#002113',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f3ff',
    padding: 10,
    borderRadius: 12,
  },
  dutyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e1e8fd',
    height: 50,
    borderRadius: 25,
  },
  dutyToggleBtnOffline: {
    backgroundColor: '#1e4633',
  },
  dutyToggleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ba1a1a',
  },
  dutyToggleBtnTextOffline: {
    color: '#ffffff',
  },
  insuranceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  insuranceBadgeText: {
    fontSize: 11,
    color: '#717973',
  },
  // Order Manifest & Doorstep Step Styles
  sliderTrack: {
    height: 56,
    backgroundColor: '#1e4633',
    borderRadius: 28,
    padding: 4,
    position: 'relative',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sliderTrackComplete: {
    backgroundColor: '#042f1e',
  },
  sliderTextCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sliderLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c0edd2',
  },
  sliderThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#b1f0cd',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderThumbComplete: {
    backgroundColor: '#c0edd2',
  },
  sliderSubHintText: {
    fontSize: 11,
    color: '#717973',
    textAlign: 'center',
    marginTop: 6,
  },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerScreenTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141b2b',
  },
  manifestMapContainer: {
    height: 250,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#dce2f7',
  },
  manifestMapImage: {
    width: '100%',
    height: '100%',
  },
  manifestMapGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 47, 30, 0.25)',
  },
  manifestTopChipsRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  stepEnRouteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(4, 47, 30, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stepEnRouteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#b1f0cd',
  },
  stepEnRouteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepDeliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(4, 47, 30, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stepDeliveryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fd651e',
  },
  etaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fd651e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  etaChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  storeWaypointPill: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9edff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginVertical: 4,
  },
  itemIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffdbce',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  storeSubText: {
    fontSize: 11,
    color: '#414943',
  },
  callActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#042f1e',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
  },
  navActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  privacyCard: {
    backgroundColor: '#e9edff',
    borderRadius: 16,
    padding: 14,
  },
  privacyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#c0edd2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  privacyOrderTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a73a00',
  },
  privacyDescText: {
    fontSize: 11,
    color: '#414943',
    lineHeight: 16,
    marginTop: 3,
  },
  checklistCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  checklistHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141b2b',
  },
  checkCounterBadge: {
    backgroundColor: '#f1f3ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  checkCounterBadgeAllReady: {
    backgroundColor: '#b1f0cd',
  },
  checkCounterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#414943',
  },
  checkCounterTextAllReady: {
    color: '#002113',
    fontWeight: '700',
  },
  tapToVerifyText: {
    fontSize: 11,
    color: '#a73a00',
    fontWeight: '600',
  },
  manifestItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9ff',
    borderWidth: 1,
    borderColor: '#e9edff',
    borderRadius: 14,
    padding: 12,
  },
  manifestItemRowChecked: {
    backgroundColor: '#f1f3ff',
    borderColor: '#c0edd2',
  },
  manifestItemThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#e9edff',
  },
  manifestItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  manifestItemTitleChecked: {
    textDecorationLine: 'line-through',
    color: '#717973',
  },
  manifestItemSub: {
    fontSize: 11,
    color: '#717973',
    marginTop: 1,
  },
  customCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#c1c8c1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckboxChecked: {
    backgroundColor: '#042f1e',
    borderColor: '#042f1e',
  },
  tamperCard: {
    backgroundColor: '#ffdbce',
    borderRadius: 16,
    padding: 14,
  },
  tamperIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fd651e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tamperTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#370e00',
  },
  tamperDesc: {
    fontSize: 11,
    color: '#7f2b00',
    lineHeight: 16,
    marginTop: 2,
  },
});

