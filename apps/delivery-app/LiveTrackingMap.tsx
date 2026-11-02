import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  G,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import {
  calculateDistanceMeters,
  calculateBearing,
  calculateEtaMinutes,
  formatDistance,
  formatEta,
  projectCoordinates,
  LatLng,
} from './src/utils/geoUtils';

export interface LiveTrackingMapProps {
  riderLocation?: LatLng;
  destinationLocation?: LatLng;
  destinationLabel?: string;
  destinationAddress?: string;
  destinationType?: 'store' | 'customer';
  riderHeading?: number;
  riderSpeedKmh?: number;
  isOnline?: boolean;
  orderId?: string;
  onOpenNavigation?: (destLat: number, destLng: number, address?: string) => void;
  onRiderArrived?: (type: 'store' | 'customer') => void;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  riderLocation = { lat: 17.4375, lng: 78.3687 }, // Hitec City default
  destinationLocation = { lat: 17.4485, lng: 78.3908 }, // Cyber Towers default
  destinationLabel = 'Delivery Destination',
  destinationAddress,
  destinationType = 'customer',
  riderHeading = 45,
  riderSpeedKmh = 0,
  isOnline = true,
  orderId,
  onOpenNavigation,
  onRiderArrived,
}) => {
  const [canvasDim, setCanvasDim] = useState<{ width: number; height: number }>({
    width: 360,
    height: 240,
  });
  const [pulsePhase, setPulsePhase] = useState<number>(0);
  const [liveSpeed, setLiveSpeed] = useState<number>(riderSpeedKmh || 28);
  const arrivalReportedRef = useRef<boolean>(false);

  // Pulse animation loop for the GPS radar ring
  useEffect(() => {
    const timer = setInterval(() => {
      setPulsePhase((prev) => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Update speed variation for realism when on the move
  useEffect(() => {
    if (riderSpeedKmh > 0) {
      setLiveSpeed(riderSpeedKmh);
    }
  }, [riderSpeedKmh]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 50 && height > 50) {
      setCanvasDim({ width: Math.round(width), height: Math.round(height) });
    }
  };

  const distanceMeters = calculateDistanceMeters(
    riderLocation.lat,
    riderLocation.lng,
    destinationLocation.lat,
    destinationLocation.lng
  );

  const calculatedBearing =
    riderHeading ||
    calculateBearing(
      riderLocation.lat,
      riderLocation.lng,
      destinationLocation.lat,
      destinationLocation.lng
    );

  const etaMinutes = calculateEtaMinutes(distanceMeters, liveSpeed);
  const isNear = distanceMeters <= 80;

  // Trigger arrival hook once when within 50m
  useEffect(() => {
    if (distanceMeters <= 50 && !arrivalReportedRef.current) {
      arrivalReportedRef.current = true;
      if (typeof onRiderArrived === 'function') {
        onRiderArrived(destinationType);
      }
    }
  }, [distanceMeters, destinationType, onRiderArrived]);

  // Project geographic coordinates into SVG canvas pixels
  const projectedPoints = projectCoordinates(
    [riderLocation, destinationLocation],
    canvasDim.width,
    canvasDim.height,
    46
  );

  const riderPoint = projectedPoints[0] || { x: 70, y: 170 };
  const destPoint = projectedPoints[1] || { x: 290, y: 70 };

  // Generate intermediate curve waypoint for organic road-following visual
  const midX = (riderPoint.x + destPoint.x) / 2 + (riderPoint.y - destPoint.y) * 0.15;
  const midY = (riderPoint.y + destPoint.y) / 2 + (destPoint.x - riderPoint.x) * 0.15;
  const routePathD = `M ${riderPoint.x} ${riderPoint.y} Q ${midX} ${midY} ${destPoint.x} ${destPoint.y}`;

  // Launch external native navigation app
  const handleLaunchExternalNav = () => {
    if (typeof onOpenNavigation === 'function') {
      onOpenNavigation(destinationLocation.lat, destinationLocation.lng, destinationAddress);
      return;
    }
    const q = destinationAddress
      ? encodeURIComponent(destinationAddress)
      : `${destinationLocation.lat},${destinationLocation.lng}`;
    const url =
      Platform.OS === 'ios'
        ? `https://maps.apple.com/?daddr=${q}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}`;

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url).catch(() => {});
      }
    } catch {}
  };

  // Pulse wave size
  const pulseRadius = 16 + (pulsePhase % 50) * 0.35;
  const pulseOpacity = Math.max(0, 1 - (pulsePhase % 50) / 45);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg width={canvasDim.width} height={canvasDim.height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Tactical Background Gradient */}
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#031c12" />
            <Stop offset="0.5" stopColor="#042619" />
            <Stop offset="1" stopColor="#02140d" />
          </LinearGradient>

          {/* Neon Route Glow Gradient */}
          <LinearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00e676" stopOpacity="1" />
            <Stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
          </LinearGradient>

          {/* Radar Radial Glow */}
          <RadialGradient id="radarGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#00e676" stopOpacity="0.6" />
            <Stop offset="60%" stopColor="#00e676" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#00e676" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* 1. Base Canvas */}
        <Rect width={canvasDim.width} height={canvasDim.height} fill="url(#bgGrad)" />

        {/* 2. Tactical City Road Grid Lines */}
        <G opacity="0.18">
          <Line x1="0" y1={canvasDim.height * 0.3} x2={canvasDim.width} y2={canvasDim.height * 0.3} stroke="#00e676" strokeWidth="1" strokeDasharray="4,6" />
          <Line x1="0" y1={canvasDim.height * 0.65} x2={canvasDim.width} y2={canvasDim.height * 0.65} stroke="#00e676" strokeWidth="1" strokeDasharray="4,6" />
          <Line x1={canvasDim.width * 0.35} y1="0" x2={canvasDim.width * 0.35} y2={canvasDim.height} stroke="#00e676" strokeWidth="1" strokeDasharray="4,6" />
          <Line x1={canvasDim.width * 0.7} y1="0" x2={canvasDim.width * 0.7} y2={canvasDim.height} stroke="#00e676" strokeWidth="1" strokeDasharray="4,6" />
        </G>

        {/* 3. Glowing Route Shadow & Main Neon Path */}
        <Path
          d={routePathD}
          fill="none"
          stroke="#00e676"
          strokeWidth="8"
          strokeOpacity="0.2"
          strokeLinecap="round"
        />
        <Path
          d={routePathD}
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth="3.5"
          strokeDasharray="6,4"
          strokeLinecap="round"
        />

        {/* 4. Destination Pin (Store or Customer) */}
        <G x={destPoint.x} y={destPoint.y}>
          {/* Outer Pulsing Target Halo */}
          <Circle r="18" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.4" strokeDasharray="2,2" />
          <Circle r="13" fill="#0284c7" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2" />
          <Circle r="5" fill="#38bdf8" />
          {/* Label Tag */}
          <SvgText
            x="0"
            y="-20"
            textAnchor="middle"
            fill="#e0f2fe"
            fontSize="10"
            fontWeight="bold"
          >
            {destinationType === 'store' ? '🏬 STORE' : '📍 CUSTOMER'}
          </SvgText>
        </G>

        {/* 5. Live Rider Vehicle Marker & Radar Wave */}
        <G x={riderPoint.x} y={riderPoint.y}>
          {/* Radiating Radar Wave */}
          <Circle r={pulseRadius} fill="none" stroke="#00e676" strokeWidth="1.8" opacity={pulseOpacity} />
          <Circle r="24" fill="url(#radarGlow)" />

          {/* Vehicle Bearing Pointer & Icon */}
          <G transform={`rotate(${calculatedBearing}, 0, 0)`}>
            {/* Front Headlight Beam */}
            <Path d="M -6 -10 L 0 -22 L 6 -10 Z" fill="#00e676" opacity="0.35" />

            {/* Motorcycle Silhouette Body */}
            <Circle r="12" fill="#042f1e" stroke="#00e676" strokeWidth="2" />
            <Rect x="-2" y="-9" width="4" height="18" rx="2" fill="#00e676" />
            <Circle cx="0" cy="0" r="4.5" fill="#ffffff" />
            <Circle cx="0" cy="-6" r="2.5" fill="#00e676" />
            <Circle cx="0" cy="6" r="2.5" fill="#00e676" />
          </G>

          {/* Rider Label */}
          <SvgText
            x="0"
            y="23"
            textAnchor="middle"
            fill="#a7f3d0"
            fontSize="9"
            fontWeight="bold"
          >
            YOU
          </SvgText>
        </G>
      </Svg>

      {/* Floating Status Badge (Top-Left) */}
      <View style={styles.topBadgeRow}>
        <View style={styles.gpsActivePill}>
          <View style={[styles.gpsDot, isOnline ? styles.gpsDotOnline : styles.gpsDotOffline]} />
          <Text style={styles.gpsText}>{isOnline ? 'GPS ACTIVE • HIGH PRECISION' : 'OFFLINE'}</Text>
        </View>

        {isNear && (
          <View style={styles.arrivingPill}>
            <Text style={styles.arrivingText}>⚡ ARRIVING SOON</Text>
          </View>
        )}
      </View>

      {/* Floating Action: External Navigation Button (Top-Right) */}
      <TouchableOpacity
        style={styles.navFloatingBtn}
        onPress={handleLaunchExternalNav}
        activeOpacity={0.85}
      >
        <Text style={styles.navFloatingBtnText}>
          {Platform.OS === 'ios' ? 'Apple Maps ➔' : 'Google Maps ➔'}
        </Text>
      </TouchableOpacity>

      {/* Bottom Telemetry HUD */}
      <View style={styles.hudContainer}>
        {/* Metric 1: Distance */}
        <View style={styles.hudMetricBox}>
          <Text style={styles.hudLabel}>DISTANCE</Text>
          <Text style={styles.hudValue}>{formatDistance(distanceMeters)}</Text>
        </View>

        <View style={styles.hudDivider} />

        {/* Metric 2: Live Speed */}
        <View style={styles.hudMetricBox}>
          <Text style={styles.hudLabel}>SPEED</Text>
          <Text style={styles.hudValue}>
            {Math.round(liveSpeed)} <Text style={styles.hudUnit}>km/h</Text>
          </Text>
        </View>

        <View style={styles.hudDivider} />

        {/* Metric 3: Live ETA */}
        <View style={styles.hudMetricBox}>
          <Text style={styles.hudLabel}>EST. TIME</Text>
          <Text style={[styles.hudValue, { color: '#00e676' }]}>{formatEta(etaMinutes)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#02140d',
  },
  topBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  gpsActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(3, 28, 18, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  gpsDotOnline: {
    backgroundColor: '#00e676',
  },
  gpsDotOffline: {
    backgroundColor: '#ef4444',
  },
  gpsText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  arrivingPill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  arrivingText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navFloatingBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#042f1e',
    borderWidth: 1,
    borderColor: '#00e676',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  navFloatingBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  hudContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(2, 20, 13, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 7,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  hudMetricBox: {
    alignItems: 'center',
    flex: 1,
  },
  hudLabel: {
    color: '#6ee7b7',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  hudValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  hudUnit: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  hudDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});
