import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  LayoutChangeEvent,
  Image,
  PanResponder,
  Animated,
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
  projectMercatorToScreen,
  mercatorPixelsToLatLng,
  latLngToMercatorPixels,
  getVisibleTiles,
  calculateAutoZoom,
  LatLng,
  MapTile,
} from './src/utils/geoUtils';

export type MapTheme = 'street' | 'night' | 'satellite';

export interface HotspotInfo {
  id: string;
  name: string;
  sub: string;
  lat: number;
  lng: number;
  badge: string;
  color: string;
}

export const LB_NAGAR_HOTSPOTS: HotspotInfo[] = [
  {
    id: 'hs-1',
    name: 'Paradise Biryani Hub',
    sub: '🔥 14 Live Orders • Sagar Ring Rd',
    lat: 17.3488,
    lng: 78.5518,
    badge: '14 ORDERS',
    color: '#ef4444',
  },
  {
    id: 'hs-2',
    name: 'LB Nagar Metro Hub',
    sub: '⚡ +15% Surge Zone Active',
    lat: 17.3457,
    lng: 78.5522,
    badge: '+15% SURGE',
    color: '#f59e0b',
  },
  {
    id: 'hs-3',
    name: 'Kothapet Market Cluster',
    sub: '📦 High Order Inflow',
    lat: 17.3625,
    lng: 78.5412,
    badge: 'HIGH VOLUME',
    color: '#10b981',
  },
];

export const NEARBY_PARTNERS: Array<{ id: string; label: string; lat: number; lng: number }> = [
  { id: 'p-1', label: '🛵 Rider #42', lat: 17.3495, lng: 78.5540 },
  { id: 'p-2', label: '🛵 Rider #87', lat: 17.3430, lng: 78.5490 },
];

export interface LiveTrackingMapProps {
  mode?: 'radar' | 'order';
  riderLocation?: LatLng;
  destinationLocation?: LatLng | null;
  originLabel?: string;
  destinationLabel?: string;
  destinationAddress?: string;
  destinationType?: 'store' | 'customer';
  riderHeading?: number;
  riderSpeedKmh?: number;
  isOnline?: boolean;
  orderId?: string;
  defaultTheme?: MapTheme;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  onOpenNavigation?: (destLat: number, destLng: number, address?: string) => void;
  onRiderArrived?: (type: 'store' | 'customer') => void;
}

const TILE_TEMPLATES: Record<MapTheme, string> = {
  // CartoDB Voyager @2x: Crisp vector-like Retina slippy map tiles with roads, flyovers, LB Nagar Metro, colonies
  street: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
  // CartoDB Dark Matter @2x: High-contrast night tactical mode
  night: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
  // Esri World Imagery: Real-world high-resolution satellite imagery
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  mode,
  // Default to Hyderabad LB Nagar Metro Ring Road Junction
  riderLocation = { lat: 17.3457, lng: 78.5522 },
  destinationLocation,
  originLabel,
  destinationLabel = 'Delivery Destination',
  destinationAddress,
  destinationType = 'customer',
  riderHeading,
  riderSpeedKmh = 0,
  isOnline = true,
  orderId,
  defaultTheme = 'street',
  isExpanded = false,
  onToggleExpand,
  onInteractionChange,
  onOpenNavigation,
  onRiderArrived,
}) => {
  // Radar mode is active when mode is explicitly 'radar' or when no destination is provided
  const isRadarMode = mode === 'radar' || !destinationLocation;

  const defaultCenterLat =
    isRadarMode || !destinationLocation
      ? riderLocation.lat
      : (riderLocation.lat + destinationLocation.lat) / 2;
  const defaultCenterLng =
    isRadarMode || !destinationLocation
      ? riderLocation.lng
      : (riderLocation.lng + destinationLocation.lng) / 2;

  const [canvasDim, setCanvasDim] = useState<{ width: number; height: number }>({
    width: 360,
    height: 260,
  });

  const [theme, setTheme] = useState<MapTheme>(defaultTheme);
  const [zoomLevel, setZoomLevel] = useState<number>(isRadarMode ? 15 : 14);
  const [manualZoom, setManualZoom] = useState<boolean>(false);
  const [centerCoord, setCenterCoord] = useState<LatLng>({
    lat: defaultCenterLat,
    lng: defaultCenterLng,
  });
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);

  const [pulsePhase, setPulsePhase] = useState<number>(0);
  const [radarAngle, setRadarAngle] = useState<number>(0);
  const [liveSpeed, setLiveSpeed] = useState<number>(riderSpeedKmh || (isRadarMode ? 0 : 28));

  const pinchScaleAnim = useRef(new Animated.Value(1)).current;
  const panStartCenterPxRef = useRef<{ px: number; py: number }>({ px: 0, py: 0 });
  const touchDistStartRef = useRef<number | null>(null);
  const touchZoomStartRef = useRef<number>(zoomLevel);
  const arrivalReportedRef = useRef<boolean>(false);
  const containerRef = useRef<any>(null);

  // Sync default center when not manually exploring
  useEffect(() => {
    if (!manualZoom) {
      setCenterCoord({ lat: defaultCenterLat, lng: defaultCenterLng });
    }
  }, [defaultCenterLat, defaultCenterLng, manualZoom]);

  // Pulse & radar sweep animation loop
  useEffect(() => {
    const timer = setInterval(() => {
      setPulsePhase((prev) => (prev + 1) % 100);
      setRadarAngle((prev) => (prev + 4) % 360);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Update speed variation
  useEffect(() => {
    if (riderSpeedKmh > 0) {
      setLiveSpeed(riderSpeedKmh);
    }
  }, [riderSpeedKmh]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 50 && height > 50) {
      const w = Math.round(width);
      const h = Math.round(height);
      setCanvasDim({ width: w, height: h });
      if (!manualZoom) {
        if (isRadarMode || !destinationLocation) {
          setZoomLevel(15);
        } else {
          const computedZ = calculateAutoZoom(
            [riderLocation, destinationLocation],
            w,
            h,
            45
          );
          setZoomLevel(computedZ);
        }
      }
    }
  };

  // Distance & ETA calculation (only relevant in order mode)
  const distanceMeters = destinationLocation
    ? calculateDistanceMeters(
        riderLocation.lat,
        riderLocation.lng,
        destinationLocation.lat,
        destinationLocation.lng
      )
    : 0;

  const calculatedBearing =
    typeof riderHeading === 'number' && !isNaN(riderHeading)
      ? riderHeading
      : destinationLocation
      ? calculateBearing(
          riderLocation.lat,
          riderLocation.lng,
          destinationLocation.lat,
          destinationLocation.lng
        )
      : 45; // Default aesthetic orientation

  const etaMinutes = calculateEtaMinutes(distanceMeters, liveSpeed);
  const isNear = !isRadarMode && distanceMeters > 0 && distanceMeters <= 100;

  // Trigger arrival hook once when within 50m in order mode
  useEffect(() => {
    if (!isRadarMode && destinationLocation && distanceMeters <= 50 && !arrivalReportedRef.current) {
      arrivalReportedRef.current = true;
      if (typeof onRiderArrived === 'function') {
        onRiderArrived(destinationType);
      }
    }
  }, [distanceMeters, destinationType, onRiderArrived, isRadarMode, destinationLocation]);

  // Infinite, Seamless Slippy Map Tiles calculated directly for active centerCoord
  const currentTileTemplate = TILE_TEMPLATES[theme] || TILE_TEMPLATES.street;
  const visibleTiles: MapTile[] = getVisibleTiles(
    centerCoord.lat,
    centerCoord.lng,
    zoomLevel,
    canvasDim.width,
    canvasDim.height,
    currentTileTemplate
  );

  // Project rider to exact screen coordinates relative to centerCoord
  const riderPoint = projectMercatorToScreen(
    riderLocation.lat,
    riderLocation.lng,
    centerCoord.lat,
    centerCoord.lng,
    zoomLevel,
    canvasDim.width,
    canvasDim.height
  );

  let destPoint: { x: number; y: number } | null = null;
  let routePathD = '';

  if (!isRadarMode && destinationLocation) {
    destPoint = projectMercatorToScreen(
      destinationLocation.lat,
      destinationLocation.lng,
      centerCoord.lat,
      centerCoord.lng,
      zoomLevel,
      canvasDim.width,
      canvasDim.height
    );

    // Realistic road curve waypoint following city street grid
    const midX = (riderPoint.x + destPoint.x) / 2 + (riderPoint.y - destPoint.y) * 0.12;
    const midY = (riderPoint.y + destPoint.y) / 2 + (destPoint.x - riderPoint.x) * 0.12;
    routePathD = `M ${riderPoint.x} ${riderPoint.y} Q ${midX} ${midY} ${destPoint.x} ${destPoint.y}`;
  }

  // Smooth Gesture Responder: Continuous Panning + Multi-Touch Pinch
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_e, gestureState) =>
        Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1,
      onMoveShouldSetPanResponderCapture: (_e, gestureState) =>
        Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1,
      onPanResponderGrant: (e) => {
        onInteractionChange?.(true);
        setManualZoom(true);
        const touches = e.nativeEvent.touches || [];
        panStartCenterPxRef.current = latLngToMercatorPixels(centerCoord.lat, centerCoord.lng, zoomLevel);
        if (touches.length >= 2) {
          touchDistStartRef.current = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          touchZoomStartRef.current = zoomLevel;
        } else {
          touchDistStartRef.current = null;
        }
      },
      onPanResponderMove: (e, gestureState) => {
        const touches = e.nativeEvent.touches || [];
        if (touches.length >= 2 && touchDistStartRef.current && touchDistStartRef.current > 10) {
          // Multi-touch Pinch Gesture
          const currentDist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          const ratio = currentDist / touchDistStartRef.current;
          pinchScaleAnim.setValue(Math.min(1.5, Math.max(0.6, ratio)));

          if (ratio > 1.4) {
            touchDistStartRef.current = currentDist;
            touchZoomStartRef.current = Math.min(18, zoomLevel + 1);
            setZoomLevel((prev) => Math.min(18, prev + 1));
            pinchScaleAnim.setValue(1);
          } else if (ratio < 0.7) {
            touchDistStartRef.current = currentDist;
            touchZoomStartRef.current = Math.max(11, zoomLevel - 1);
            setZoomLevel((prev) => Math.max(11, prev - 1));
            pinchScaleAnim.setValue(1);
          }
        } else {
          // 1-touch or Mouse Drag Panning (Continuous Mercator Translation)
          const newPx = panStartCenterPxRef.current.px - gestureState.dx;
          const newPy = panStartCenterPxRef.current.py - gestureState.dy;
          const newLatLng = mercatorPixelsToLatLng(newPx, newPy, zoomLevel);
          setCenterCoord(newLatLng);
        }
      },
      onPanResponderRelease: () => {
        onInteractionChange?.(false);
        touchDistStartRef.current = null;
        Animated.spring(pinchScaleAnim, {
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      },
      onPanResponderTerminate: () => {
        onInteractionChange?.(false);
        touchDistStartRef.current = null;
        pinchScaleAnim.setValue(1);
      },
    })
  ).current;

  // Web Event Listeners: Active Non-Passive Wheel & Double Click Zoom
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.getElementById('tracking-map-viewport');
      if (!el) return;

      let lastWheelTime = 0;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setManualZoom(true);

        const now = Date.now();
        if (e.ctrlKey) {
          // Trackpad pinch gesture on macOS
          if (now - lastWheelTime > 60) {
            lastWheelTime = now;
            const dir = e.deltaY < 0 ? 1 : -1;
            setZoomLevel((prev) => Math.min(18, Math.max(11, prev + dir)));
          }
        } else {
          // Mouse scroll wheel
          if (now - lastWheelTime > 110 && Math.abs(e.deltaY) > 8) {
            lastWheelTime = now;
            const dir = e.deltaY < 0 ? 1 : -1;
            setZoomLevel((prev) => Math.min(18, Math.max(11, prev + dir)));
          }
        }
      };

      const onDblClick = (e: MouseEvent) => {
        e.preventDefault();
        setManualZoom(true);
        const rect = el.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const centerPx = latLngToMercatorPixels(centerCoord.lat, centerCoord.lng, zoomLevel);
        const clickedPx = {
          px: centerPx.px + (clickX - canvasDim.width / 2),
          py: centerPx.py + (clickY - canvasDim.height / 2),
        };
        const nextZoom = Math.min(18, zoomLevel + 1);
        const clickedLatLng = mercatorPixelsToLatLng(clickedPx.px, clickedPx.py, zoomLevel);
        setCenterCoord(clickedLatLng);
        setZoomLevel(nextZoom);
      };

      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('dblclick', onDblClick);
      return () => {
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('dblclick', onDblClick);
      };
    }
  }, [centerCoord, zoomLevel, canvasDim]);

  // External Navigation launcher
  const handleLaunchExternalNav = () => {
    if (!destinationLocation) return;
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

  // Zoom In / Out / Recenter
  const handleZoomIn = () => {
    setManualZoom(true);
    setZoomLevel((prev) => Math.min(18, prev + 1));
  };

  const handleZoomOut = () => {
    setManualZoom(true);
    setZoomLevel((prev) => Math.max(11, prev - 1));
  };

  const handleRecenter = () => {
    setManualZoom(false);
    setSelectedHotspot(null);
    if (isRadarMode || !destinationLocation) {
      setCenterCoord({ lat: riderLocation.lat, lng: riderLocation.lng });
      setZoomLevel(15);
    } else {
      setCenterCoord({
        lat: (riderLocation.lat + destinationLocation.lat) / 2,
        lng: (riderLocation.lng + destinationLocation.lng) / 2,
      });
      const computedZ = calculateAutoZoom(
        [riderLocation, destinationLocation],
        canvasDim.width,
        canvasDim.height,
        45
      );
      setZoomLevel(computedZ);
    }
  };

  const cycleTheme = () => {
    setTheme((prev) => {
      if (prev === 'street') return 'night';
      if (prev === 'night') return 'satellite';
      return 'street';
    });
  };

  // Radar ripple sizing
  const pulseRadius1 = 18 + (pulsePhase % 50) * 1.5;
  const pulseOpacity1 = Math.max(0, 1 - (pulsePhase % 50) / 45);
  const pulseRadius2 = 18 + ((pulsePhase + 25) % 50) * 1.5;
  const pulseOpacity2 = Math.max(0, 1 - ((pulsePhase + 25) % 50) / 45);

  const isNight = theme === 'night';
  const isSatellite = theme === 'satellite';

  return (
    <View
      ref={containerRef}
      nativeID="tracking-map-viewport"
      style={[
        styles.container,
        {
          backgroundColor: isNight ? '#0b1318' : isSatellite ? '#0f172a' : '#f4f6f8',
        },
        Platform.OS === 'web'
          ? ({
              cursor: 'grab',
              touchAction: 'none',
            } as any)
          : undefined,
      ]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      {/* =====================================================================
          1. REAL CITY STREET MAP TILES (CartoDB Voyager / Dark / Satellite)
          ===================================================================== */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ scale: pinchScaleAnim }],
          },
        ]}
        pointerEvents="none"
      >
        {visibleTiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={[
              {
                position: 'absolute',
                left: tile.left,
                top: tile.top,
                width: tile.width,
                height: tile.height,
                opacity: isNight ? 0.95 : 1.0,
              },
              Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : undefined,
            ]}
            resizeMode="cover"
          />
        ))}
      </Animated.View>

      {/* Subtle vignette border gradient overlay */}
      <View style={styles.vignetteOverlay} pointerEvents="none" />

      {/* =====================================================================
          2. SVG VECTOR OVERLAY: HOTSPOTS, ROUTE, PINS, VEHICLE RADAR
          ===================================================================== */}
      <Svg
        width={canvasDim.width}
        height={canvasDim.height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {/* Street Route Neon Gradient (Swiggy / Zomato / ONDC Emerald) */}
          <LinearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#059669" stopOpacity="1" />
            <Stop offset="60%" stopColor="#10b981" stopOpacity="1" />
            <Stop offset="100%" stopColor="#00e676" stopOpacity="0.95" />
          </LinearGradient>

          {/* Vehicle Radar Radial Glow */}
          <RadialGradient id="radarGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#00e676" stopOpacity="0.75" />
            <Stop offset="50%" stopColor="#00e676" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#00e676" stopOpacity="0" />
          </RadialGradient>

          {/* Radar Sweep Sector Gradient */}
          <RadialGradient id="sweepSectorGrad" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#00e676" stopOpacity="0.5" />
            <Stop offset="70%" stopColor="#10b981" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#00e676" stopOpacity="0" />
          </RadialGradient>

          {/* Destination Target Glow */}
          <RadialGradient id="destGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
            <Stop offset="70%" stopColor="#ef4444" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </RadialGradient>

          {/* Hotspot Amber Glow */}
          <RadialGradient id="amberGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
            <Stop offset="70%" stopColor="#f59e0b" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* =====================================================================
            A. RADAR MODE: CLUSTER DEMAND HOTSPOTS (Paradise, Metro, Kothapet)
            ===================================================================== */}
        {isRadarMode &&
          LB_NAGAR_HOTSPOTS.map((hs) => {
            const pt = projectMercatorToScreen(
              hs.lat,
              hs.lng,
              centerCoord.lat,
              centerCoord.lng,
              zoomLevel,
              canvasDim.width,
              canvasDim.height
            );
            return (
              <G key={hs.id} x={pt.x} y={pt.y}>
                <Circle r="26" fill="url(#amberGlow)" />
                <Circle r="14" fill={hs.color} opacity="0.2" />
                <Circle r="6" fill={hs.color} stroke="#ffffff" strokeWidth="1.8" />
                <G y="-18">
                  <Rect
                    x="-42"
                    y="-9"
                    width="84"
                    height="18"
                    rx="9"
                    fill="rgba(15, 23, 42, 0.94)"
                    stroke={hs.color}
                    strokeWidth="1"
                  />
                  <SvgText
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    {hs.badge}
                  </SvgText>
                </G>
              </G>
            );
          })}

        {/* =====================================================================
            B. RADAR MODE: NEARBY DELIVERY PARTNER BLIPS (Fleet Radar)
            ===================================================================== */}
        {isRadarMode &&
          NEARBY_PARTNERS.map((partner) => {
            const pt = projectMercatorToScreen(
              partner.lat,
              partner.lng,
              centerCoord.lat,
              centerCoord.lng,
              zoomLevel,
              canvasDim.width,
              canvasDim.height
            );
            return (
              <G key={partner.id} x={pt.x} y={pt.y}>
                <Circle r="12" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
                <Circle r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                <G y="14">
                  <Rect x="-28" y="-6" width="56" height="12" rx="6" fill="rgba(6, 78, 59, 0.88)" />
                  <SvgText x="0" y="2.5" textAnchor="middle" fill="#a7f3d0" fontSize="7" fontWeight="bold">
                    {partner.label}
                  </SvgText>
                </G>
              </G>
            );
          })}

        {/* =====================================================================
            C. ORDER MODE: ROUTE & DESTINATION PIN (ONLY WHEN ORDER ACTIVE)
            ===================================================================== */}
        {!isRadarMode && destPoint && (
          <>
            {/* Glowing Road Highlight Shadow */}
            <Path
              d={routePathD}
              fill="none"
              stroke="#059669"
              strokeWidth="9"
              strokeOpacity="0.35"
              strokeLinecap="round"
            />
            {/* Core Crisp Road Polyline */}
            <Path
              d={routePathD}
              fill="none"
              stroke="url(#routeGrad)"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Directional Dash Stream (Flowing forward) */}
            <Path
              d={routePathD}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray="6,8"
              strokeOpacity="0.8"
              strokeLinecap="round"
            />

            {/* Destination Pin (Store or Customer) */}
            <G x={destPoint.x} y={destPoint.y}>
              <Circle r="24" fill="url(#destGlow)" />
              <Circle r="16" fill="none" stroke="#ef4444" strokeWidth="1.8" opacity="0.6" strokeDasharray="3,3" />

              {/* Solid Pin Body */}
              <Circle
                r="13"
                fill={destinationType === 'store' ? '#0284c7' : '#ef4444'}
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <Circle r="4" fill="#ffffff" />

              {/* Floating Pill Label Tag */}
              <G y="-24">
                <Rect
                  x="-52"
                  y="-11"
                  width="104"
                  height="22"
                  rx="11"
                  fill="rgba(15, 23, 42, 0.92)"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                <SvgText
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  {destinationType === 'store' ? '🏬 STORE' : '📍 CUSTOMER'}
                </SvgText>
              </G>
            </G>
          </>
        )}

        {/* =====================================================================
            D. RADAR MODE: CONCENTRIC SCANNER RINGS & 360° SWEEP CONE
            ===================================================================== */}
        {isRadarMode && (
          <G x={riderPoint.x} y={riderPoint.y}>
            <Circle r="110" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="4,6" opacity="0.3" />
            <Circle r="75" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3,5" opacity="0.25" />

            <G transform={`rotate(${radarAngle}, 0, 0)`}>
              <Path
                d="M 0 0 L 78 -78 A 110 110 0 0 1 110 0 Z"
                fill="url(#sweepSectorGrad)"
              />
              <Line x1="0" y1="0" x2="110" y2="0" stroke="#00e676" strokeWidth="1.5" opacity="0.75" />
            </G>
          </G>
        )}

        {/* =====================================================================
            E. ORIGIN PIN (STORE OR LIVE RIDER VEHICLE)
            ===================================================================== */}
        {originLabel === 'store' ? (
          <G x={riderPoint.x} y={riderPoint.y}>
            <Circle r="24" fill="url(#destGlow)" />
            <Circle r="16" fill="none" stroke="#0284c7" strokeWidth="1.8" opacity="0.6" strokeDasharray="3,3" />
            <Circle r="13" fill="#0284c7" stroke="#ffffff" strokeWidth="2.5" />
            <Circle r="4" fill="#ffffff" />
            <G y="-24">
              <Rect
                x="-52"
                y="-11"
                width="104"
                height="22"
                rx="11"
                fill="rgba(15, 23, 42, 0.92)"
                stroke="#ffffff"
                strokeWidth="1"
              />
              <SvgText
                x="0"
                y="4"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="9.5"
                fontWeight="bold"
              >
                🏬 STORE
              </SvgText>
            </G>
          </G>
        ) : (
          <G x={riderPoint.x} y={riderPoint.y}>
            {/* Concentric expanding sonar ripple rings */}
            <Circle
              r={pulseRadius1}
              fill="none"
              stroke="#00e676"
              strokeWidth="2"
              opacity={pulseOpacity1}
            />
            <Circle
              r={pulseRadius2}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              opacity={pulseOpacity2}
            />
            <Circle r="24" fill="url(#radarGlow)" />

            {/* Vehicle Body aligned with dynamic bearing */}
            <G transform={`rotate(${calculatedBearing}, 0, 0)`}>
              <Path d="M -7 -10 L 0 -26 L 7 -10 Z" fill="#00e676" opacity="0.45" />
              <Circle r="13" fill="#042f1e" stroke="#00e676" strokeWidth="2.5" />
              <Rect x="-3" y="-10" width="6" height="20" rx="3" fill="#00e676" />
              <Circle cx="0" cy="0" r="4.5" fill="#ffffff" />
              <Circle cx="0" cy="-6" r="2.5" fill="#10b981" />
              <Circle cx="0" cy="6" r="2.5" fill="#10b981" />
            </G>

            {/* Rider Label Badge */}
            <G y="24">
              <Rect
                x="-36"
                y="-9"
                width="72"
                height="18"
                rx="9"
                fill="#042f1e"
                stroke="#00e676"
                strokeWidth="1"
              />
              <SvgText
                x="0"
                y="3.5"
                textAnchor="middle"
                fill="#00e676"
                fontSize="9"
                fontWeight="900"
              >
                YOU • LB NAGAR
              </SvgText>
            </G>
          </G>
        )}
      </Svg>

      {/* =====================================================================
          3. TOP CONTROLS & STATUS BADGES
          ===================================================================== */}
      <View style={styles.topBadgeRow} pointerEvents="box-none">
        <View style={styles.gpsActivePill}>
          <View style={[styles.gpsDot, isOnline ? styles.gpsDotOnline : styles.gpsDotOffline]} />
          <Text style={styles.gpsText}>
            {isRadarMode
              ? isOnline
                ? 'RADAR ACTIVE • LB NAGAR'
                : 'RADAR OFFLINE'
              : isOnline
              ? 'GPS ACTIVE • EN ROUTE'
              : 'GPS OFFLINE'}
          </Text>
        </View>

        {isNear && (
          <View style={styles.arrivingPill}>
            <Text style={styles.arrivingText}>⚡ ARRIVING SOON</Text>
          </View>
        )}

        {selectedHotspot && (
          <TouchableOpacity
            style={styles.hotspotBannerPill}
            onPress={() => setSelectedHotspot(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.hotspotBannerText}>{selectedHotspot.sub}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Top-Right: Fullscreen Toggle, Navigation & Theme Selector */}
      <View style={styles.topRightControls} pointerEvents="box-none">
        {typeof onToggleExpand === 'function' && (
          <TouchableOpacity
            style={styles.expandToggleBtn}
            onPress={onToggleExpand}
            activeOpacity={0.8}
          >
            <Text style={styles.expandToggleText}>{isExpanded ? '↙ Collapse' : '⛶ Expand'}</Text>
          </TouchableOpacity>
        )}

        {!isRadarMode && destinationLocation && (
          <TouchableOpacity
            style={styles.navFloatingBtn}
            onPress={handleLaunchExternalNav}
            activeOpacity={0.85}
          >
            <Text style={styles.navFloatingBtnText}>
              {Platform.OS === 'ios' ? 'Apple Maps ➔' : 'Google Maps ➔'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.themeToggleBtn}
          onPress={cycleTheme}
          activeOpacity={0.8}
        >
          <Text style={styles.themeToggleText}>
            {theme === 'street' ? '☀️ Street' : theme === 'night' ? '🌙 Night' : '🛰️ Sat'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Vertical Map Control Column (Zoom In, Out, Recenter) */}
      <View style={styles.mapControlCol} pointerEvents="box-none">
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn} activeOpacity={0.8}>
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut} activeOpacity={0.8}>
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleRecenter} activeOpacity={0.8}>
          <Text style={styles.recenterBtnText}>🎯</Text>
        </TouchableOpacity>
      </View>

      {/* =====================================================================
          4. FLOATING TELEMETRY HUD (Context-aware: Radar mode vs Order mode)
          ===================================================================== */}
      <View style={styles.hudContainer} pointerEvents="box-none">
        {isRadarMode ? (
          <>
            {/* Metric 1: Radar Mode Status */}
            <View style={styles.hudMetricBox}>
              <Text style={styles.hudLabel}>FLEET RADAR</Text>
              <Text style={[styles.hudValue, { color: '#00e676' }]}>ONLINE</Text>
            </View>

            <View style={styles.hudDivider} />

            {/* Metric 2: Active Dispatch Cluster */}
            <View style={styles.hudMetricBox}>
              <Text style={styles.hudLabel}>CLUSTER</Text>
              <Text style={styles.hudValue}>LB NAGAR</Text>
            </View>

            <View style={styles.hudDivider} />

            {/* Metric 3: Cluster Demand Surge */}
            <View style={styles.hudMetricBox}>
              <Text style={styles.hudLabel}>DEMAND</Text>
              <Text style={[styles.hudValue, { color: '#fbbf24' }]}>+15% SURGE</Text>
            </View>
          </>
        ) : (
          <>
            {/* Metric 1: Distance to Store/Customer */}
            <View style={styles.hudMetricBox}>
              <Text style={styles.hudLabel}>DISTANCE</Text>
              <Text style={styles.hudValue}>{formatDistance(distanceMeters)}</Text>
            </View>

            <View style={styles.hudDivider} />

            {/* Metric 2: Live Rider Speed */}
            <View style={styles.hudMetricBox}>
              <Text style={styles.hudLabel}>SPEED</Text>
              <Text style={styles.hudValue}>
                {Math.round(liveSpeed)} <Text style={styles.hudUnit}>km/h</Text>
              </Text>
            </View>

            <View style={styles.hudDivider} />

            {/* Metric 3: Real Delivery ETA */}
            <View style={styles.hudMetricBox}>
              <Text style={styles.hudLabel}>EST. TIME</Text>
              <Text style={[styles.hudValue, { color: '#00e676' }]}>
                {formatEta(etaMinutes)}
              </Text>
            </View>
          </>
        )}
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
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    userSelect: 'none' as any,
  },
  vignetteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 16,
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
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  arrivingText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hotspotBannerPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  hotspotBannerText: {
    color: '#fbbf24',
    fontSize: 9.5,
    fontWeight: '700',
  },
  topRightControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  expandToggleBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  expandToggleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  navFloatingBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: '#00e676',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  navFloatingBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  themeToggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  themeToggleText: {
    color: '#0f172a',
    fontSize: 10.5,
    fontWeight: '700',
  },
  mapControlCol: {
    position: 'absolute',
    right: 10,
    top: 48,
    zIndex: 10,
    gap: 6,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  zoomBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    lineHeight: 20,
  },
  recenterBtnText: {
    fontSize: 14,
  },
  hudContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 7,
    paddingHorizontal: 4,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  hudMetricBox: {
    alignItems: 'center',
    flex: 1,
  },
  hudLabel: {
    color: '#a7f3d0',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});
