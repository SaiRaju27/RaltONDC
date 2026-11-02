import React, { useState } from 'react';
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
  Platform,
  Modal,
} from 'react-native';

interface OnboardingFlowProps {
  onboardStep: 1 | 2 | 3 | 4 | 5 | 6;
  setOnboardStep: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;
  onCompleteRegistration: (profile: any) => Promise<void>;
  onFinishAndGoDashboard: () => void;
  onBackToAuth: () => void;
  authPhone: string;
}

// =============================================================================
// REUSABLE FLOATING LABEL INPUT (With Border Highlight & No Tick/Check Icons)
// =============================================================================
interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  editable?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: any;
  maxLength?: number;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  hint?: string;
  isError?: boolean;
}

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
  secureTextEntry,
  autoCapitalize,
  maxLength,
  rightElement,
  onPress,
  hint,
  isError = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || (value && value.length > 0);

  return (
    <View style={{ marginBottom: 14 }}>
      <TouchableOpacity
        activeOpacity={editable ? 1 : 0.8}
        onPress={onPress}
        style={[
          {
            position: 'relative',
            borderWidth: isFocused ? 2 : 1.5,
            borderColor: isError
              ? '#ba1a1a'
              : isFocused
                ? '#042f1e'
                : '#c1c8c1',
            borderRadius: 12,
            backgroundColor: editable ? '#ffffff' : '#f8faff',
            paddingHorizontal: 14,
            paddingTop: 16,
            paddingBottom: 10,
            minHeight: 56,
            justifyContent: 'center',
          },
        ]}
      >
        {/* Floating Label (Moves to the top border on focus or when value exists) */}
        <View
          style={{
            position: 'absolute',
            left: 12,
            top: isFloating ? -9 : 17,
            backgroundColor: isFloating ? '#ffffff' : 'transparent',
            paddingHorizontal: isFloating ? 6 : 0,
            zIndex: 2,
          }}
          pointerEvents="none"
        >
          <Text
            style={{
              fontSize: isFloating ? 11 : 14,
              fontWeight: isFloating ? '700' : '500',
              color: isError
                ? '#ba1a1a'
                : isFocused
                  ? '#042f1e'
                  : isFloating
                    ? '#274e3b'
                    : '#717973',
            }}
          >
            {label}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: '600',
              color: editable ? '#141b2b' : '#414943',
              padding: 0,
              margin: 0,
            }}
            value={value}
            onChangeText={onChangeText}
            placeholder={isFocused ? placeholder : ''}
            placeholderTextColor="#9ca3af"
            keyboardType={keyboardType}
            editable={editable}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            maxLength={maxLength}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {rightElement}
        </View>
      </TouchableOpacity>
      {hint ? (
        <Text
          style={{
            fontSize: 11,
            color: isError ? '#ba1a1a' : '#717973',
            marginTop: 4,
            marginLeft: 4,
            fontWeight: isError ? '600' : '400',
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

// =============================================================================
// UNIFIED STANDARDIZED STEPPER (Consistent Across All Steps)
// =============================================================================
const ONBOARD_STEPS = [
  { id: 1, title: 'Personal', subtitle: 'Profile Details' },
  { id: 2, title: 'Vehicle', subtitle: 'Ride & Plate' },
  { id: 3, title: 'Docs', subtitle: 'DL & PAN' },
  { id: 4, title: 'Identity', subtitle: 'eKYC & Selfie' },
  { id: 5, title: 'Bank', subtitle: 'Payout Account' },
];

const UnifiedStepper: React.FC<{ currentStep: 1 | 2 | 3 | 4 | 5 | 6 }> = ({ currentStep }) => {
  const stepIdx = Math.min(currentStep, 5);
  const currentStepMeta = ONBOARD_STEPS[stepIdx - 1];
  const percentage = Math.round((stepIdx / 5) * 100);

  return (
    <View style={obStyles.card}>
      {/* Top Title & Progress percentage */}
      <View style={obStyles.betweenRow}>
        <View>
          <Text style={obStyles.stepIndicatorTitle}>
            Step {stepIdx} of 5: {currentStepMeta?.subtitle || 'Partner Setup'}
          </Text>
        </View>
        <View style={obStyles.badgeGreen}>
          <Text style={obStyles.badgeGreenText}>{percentage}% Completed</Text>
        </View>
      </View>

      {/* 5-segment unified progress bar */}
      <View style={obStyles.stepperBarRow}>
        {ONBOARD_STEPS.map((s) => {
          const isDone = s.id < stepIdx;
          const isActive = s.id === stepIdx;
          return (
            <View
              key={s.id}
              style={[
                obStyles.stepperBarSegment,
                {
                  backgroundColor: isDone
                    ? '#042f1e'
                    : isActive
                      ? '#1e4633'
                      : '#dce2f7',
                  height: isActive ? 6 : 4,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Unified bottom 5 step labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        {ONBOARD_STEPS.map((s) => {
          const isActive = s.id === stepIdx;
          const isDone = s.id < stepIdx;
          return (
            <Text
              key={s.id}
              style={[
                obStyles.stepperLabelText,
                {
                  color: isActive ? '#042f1e' : isDone ? '#1e4633' : '#717973',
                  fontWeight: isActive ? '800' : isDone ? '600' : '400',
                  fontSize: 10,
                },
              ]}
            >
              {s.id}. {s.title}
            </Text>
          );
        })}
      </View>
    </View>
  );
};

// =============================================================================
// MAIN ONBOARDING FLOW COMPONENT
// =============================================================================
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onboardStep,
  setOnboardStep,
  onCompleteRegistration,
  onFinishAndGoDashboard,
  onBackToAuth,
  authPhone,
}) => {
  // Step 1: Personal Profile State (Clean defaults, no hardcoded mock data)
  const [fullName, setFullName] = useState<string>('');
  const [emailAddr, setEmailAddr] = useState<string>('');
  const [dobInput, setDobInput] = useState<string>('');
  const [selectedHub, setSelectedHub] = useState<'indiranagar' | 'koramangala' | 'whitefield' | 'hiteccity'>('indiranagar');
  const [referralCode, setReferralCode] = useState<string>('');
  const [isReferralApplied, setIsReferralApplied] = useState<boolean>(false);
  const [isSavingStep1, setIsSavingStep1] = useState<boolean>(false);

  // Calendar Modal State
  const [showDobModal, setShowDobModal] = useState<boolean>(false);
  const [calYear, setCalYear] = useState<number>(2000);
  const [calMonth, setCalMonth] = useState<number>(0); // 0-indexed (0 = January)

  // Step 2: Vehicle Selection & RC State
  const [vehicleChoice, setVehicleChoice] = useState<'moto' | 'ev' | 'bicycle'>('moto');
  const [vehiclePlateInput, setVehiclePlateInput] = useState<string>('');
  const [vehicleModel, setVehicleModel] = useState<string>('hero-splendor');
  const [ownershipType, setOwnershipType] = useState<'own' | 'rented' | 'family'>('own');

  // Step 3: Document Upload State
  const [dlNumber, setDlNumber] = useState<string>('');
  const [panNumber, setPanNumber] = useState<string>('');
  const [isRcUploading, setIsRcUploading] = useState<boolean>(false);
  const [rcProgress, setRcProgress] = useState<number>(100);
  const [isRcVerified, setIsRcVerified] = useState<boolean>(true);

  // Step 4: eKYC & Selfie State
  const [aadhaarDigits, setAadhaarDigits] = useState<string>('');
  const [ekycOtp] = useState<string[]>(['6', '1', '9', '0', '4', '8']);
  const [isRetakingPhoto, setIsRetakingPhoto] = useState<boolean>(false);

  // Step 5: Bank Setup & Payout State
  const bankHolderName = fullName.trim() || 'Verified Fleet Partner';
  const [bankIfscInput, setBankIfscInput] = useState<string>('');
  const [bankAccInput, setBankAccInput] = useState<string>('');
  const [bankAccConfirmInput, setBankAccConfirmInput] = useState<string>('');
  const [upiIdInput, setUpiIdInput] = useState<string>('');
  const [termsAgreed, setTermsAgreed] = useState<boolean>(false);
  const [isSubmittingApp, setIsSubmittingApp] = useState<boolean>(false);

  // Step 6: Application Status State
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Age Calculator & 18+ Validation Helper
  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const parts = dobString.split('-');
    if (parts.length !== 3) return 0;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const birthDate = new Date(y, m, d);
    if (isNaN(birthDate.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const riderAge = dobInput ? calculateAge(dobInput) : 0;
  const isAgeValid = Boolean(dobInput) && riderAge >= 18;
  const canProceedStep1 = fullName.trim().length > 0 && isAgeValid;

  // Step Navigation Helper
  const handleBack = () => {
    if (onboardStep === 1) {
      onBackToAuth();
    } else if (onboardStep === 2) {
      setOnboardStep(1);
    } else if (onboardStep === 3) {
      setOnboardStep(2);
    } else if (onboardStep === 4) {
      setOnboardStep(vehicleChoice === 'bicycle' ? 2 : 3);
    } else if (onboardStep === 5) {
      setOnboardStep(4);
    } else if (onboardStep === 6) {
      setOnboardStep(5);
    }
  };

  const showHelpdesk = () => {
    Alert.alert(
      'RALT Rider Support Helpdesk',
      'Dedicated Partner Support Hotline:\n📞 1800-419-7258 (Toll Free)\n💬 WhatsApp: +91 80 4920 1100\n\nAvailable 24x7 for onboarding assistance.'
    );
  };

  // Step 1: Submit to Step 2 with 18+ Verification
  const handleProceedStep1 = () => {
    if (!fullName.trim()) {
      Alert.alert('Full Name Required', 'Please enter your full legal name as printed on your official ID.');
      return;
    }
    if (!dobInput) {
      Alert.alert('Date of Birth Required', 'Please select your Date of Birth to verify 18+ eligibility.');
      return;
    }
    if (!isAgeValid) {
      Alert.alert(
        'Age Verification Error',
        `You must be at least 18 years old to join as a RALT fleet delivery partner. (Current age: ${riderAge} years)`
      );
      return;
    }
    setIsSavingStep1(true);
    setTimeout(() => {
      setIsSavingStep1(false);
      setOnboardStep(2);
    }, 300);
  };

  // Step 2: Submit to Step 3 (or 4 for bicycle)
  const handleProceedStep2 = () => {
    if (vehicleChoice === 'bicycle') {
      setOnboardStep(4);
    } else {
      setOnboardStep(3);
    }
  };

  // Step 5: Final Submission
  const handleSubmitApplication = async () => {
    if (!termsAgreed) {
      Alert.alert('Terms Agreement Required', 'Please accept the Fleet Terms & Insurance Coverage to proceed.');
      return;
    }
    setIsSubmittingApp(true);
    const profile = {
      name: fullName,
      phone: authPhone || '+91 98765 43210',
      email: emailAddr,
      dob: dobInput,
      hub: selectedHub,
      vehicleType: vehicleChoice,
      vehiclePlate: vehicleChoice === 'bicycle' ? 'BICYCLE' : vehiclePlateInput,
      dlNumber: vehicleChoice === 'bicycle' ? 'DL-WAIVED' : dlNumber,
      aadhaarNumber: aadhaarDigits,
      bankAccount: bankAccInput,
      bankIfsc: bankIfscInput,
      upiId: upiIdInput,
    };
    await onCompleteRegistration(profile);
    setIsSubmittingApp(false);
    setOnboardStep(6);
  };

  // Titles for the header
  const getHeaderTitle = () => {
    switch (onboardStep) {
      case 1: return 'Tell us about yourself';
      case 2: return 'Vehicle Information';
      case 3: return 'Driver Documents';
      case 4: return 'Identity Verification';
      case 5: return 'Bank Account Setup';
      case 6: return 'Application Status';
    }
  };

  // Month names for Calendar Picker
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInCurrentCalMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfCalMonth = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun

  return (
    <SafeAreaView style={obStyles.container}>
      <StatusBar barStyle="dark-content" />

      {/* TOP HEADER (Sits comfortably down below status bar/notch) */}
      <View style={obStyles.headerBar}>
        <TouchableOpacity
          style={obStyles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={obStyles.backButtonArrow}>←</Text>
        </TouchableOpacity>

        <View style={obStyles.headerCenter}>
          <Text style={obStyles.headerTitle} numberOfLines={1}>
            {getHeaderTitle()}
          </Text>
          <View style={obStyles.miniDotsRow}>
            {[1, 2, 3, 4, 5, 6].map((st) => (
              <View
                key={st}
                style={[
                  obStyles.miniDot,
                  st <= onboardStep ? obStyles.miniDotActive : obStyles.miniDotInactive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={obStyles.headerRight}>
          <TouchableOpacity
            style={obStyles.supportBtn}
            onPress={showHelpdesk}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 18 }}>🎧</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={obStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================================== */}
        {/* STEP 1: PERSONAL PROFILE                                            */}
        {/* =================================================================== */}
        {onboardStep === 1 && (
          <View style={obStyles.stepWrap}>
            {/* Standardized Unified Stepper */}
            <UnifiedStepper currentStep={1} />

            {/* Visual Hero Card */}
            <View style={obStyles.visualHeroCard}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={obStyles.visualHeroTitle}>Tell us about yourself</Text>
                <Text style={obStyles.visualHeroSubtitle}>
                  Create your verified RALT fleet partner profile to unlock delivery gigs.
                </Text>
              </View>
              <View style={obStyles.visualHeroIconWrap}>
                <Text style={{ fontSize: 26 }}>🪪</Text>
              </View>
            </View>

            {/* Form Fields Card */}
            <View style={obStyles.card}>
              {/* Field 1: Full Legal Name */}
              <FloatingLabelInput
                label="Full Legal Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="As printed on Aadhaar or PAN card"
                autoCapitalize="words"
                hint="Must match your official government ID & bank account name"
              />

              {/* Field 2: Registered Mobile Number */}
              <FloatingLabelInput
                label="Registered Mobile Number"
                value={authPhone ? `+91 ${authPhone}` : '+91 98765 43210'}
                editable={false}
                hint="Auto-authenticated with primary SIM login"
              />

              {/* Field 3: Email Address */}
              <FloatingLabelInput
                label="Email Address for Invoices"
                value={emailAddr}
                onChangeText={setEmailAddr}
                placeholder="name@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                hint="Receives automated tax invoices & daily pay summaries"
              />

              {/* Field 4: Date of Birth with Interactive Calendar Picker */}
              <FloatingLabelInput
                label="Date of Birth (YYYY-MM-DD)"
                value={dobInput}
                editable={false}
                placeholder="Tap calendar to select DOB"
                onPress={() => {
                  if (dobInput) {
                    const parts = dobInput.split('-');
                    if (parts.length === 3) {
                      setCalYear(parseInt(parts[0], 10) || 2000);
                      setCalMonth(parseInt(parts[1], 10) - 1 || 0);
                    }
                  } else {
                    setCalYear(2000);
                    setCalMonth(0);
                  }
                  setShowDobModal(true);
                }}
                rightElement={
                  <TouchableOpacity
                    onPress={() => setShowDobModal(true)}
                    style={{ padding: 6 }}
                  >
                    <Text style={{ fontSize: 20 }}>📅</Text>
                  </TouchableOpacity>
                }
                isError={Boolean(dobInput && !isAgeValid)}
                hint={
                  !dobInput
                    ? 'Select your birth date from calendar (Must be 18+ to join)'
                    : isAgeValid
                      ? `Age: ${riderAge} years old (Eligible for onboarding)`
                      : `⚠️ Under 18: Partner fleet guidelines mandate age 18+ (Current: ${riderAge} yrs)`
                }
              />
            </View>

            {/* Privacy Note */}
            <View style={obStyles.privacyRow}>
              <Text style={{ fontSize: 16 }}>🛡️</Text>
              <Text style={obStyles.privacyText}>
                Your personal details are securely protected and strictly used for identity verification and direct partner deposits.
              </Text>
            </View>

            {/* Action CTA */}
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={[obStyles.primaryCtaBtn, !canProceedStep1 && { opacity: 0.5 }]}
                onPress={handleProceedStep1}
                disabled={isSavingStep1 || !canProceedStep1}
                activeOpacity={0.9}
              >
                {isSavingStep1 ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={obStyles.primaryCtaBtnText}>
                      {!fullName.trim()
                        ? 'Enter Full Legal Name'
                        : !dobInput
                          ? 'Select Date of Birth'
                          : !isAgeValid
                            ? 'Age 18+ Required to Proceed'
                            : 'Next: Vehicle Details'}
                    </Text>
                    {canProceedStep1 && <Text style={obStyles.primaryCtaArrow}>➔</Text>}
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* STEP 2: CHOOSE DELIVERY RIDE & VEHICLE RC                           */}
        {/* =================================================================== */}
        {onboardStep === 2 && (
          <View style={obStyles.stepWrap}>
            {/* Standardized Unified Stepper */}
            <UnifiedStepper currentStep={2} />

            {/* Context Header */}
            <View style={{ paddingVertical: 4 }}>
              <Text style={obStyles.sectionHeading}>Choose your delivery ride</Text>
              <Text style={obStyles.fieldHint}>
                Select how you plan to deliver orders across your city and customize daily benefits.
              </Text>
            </View>

            {/* Ride Card 1: Motorcycle */}
            <TouchableOpacity
              style={[
                obStyles.rideCard,
                vehicleChoice === 'moto' && obStyles.rideCardSelected,
              ]}
              onPress={() => setVehicleChoice('moto')}
              activeOpacity={0.8}
            >
              <View style={obStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={obStyles.rideIconCircle}>
                    <Text style={{ fontSize: 24 }}>🏍️</Text>
                  </View>
                  <View>
                    <Text style={obStyles.rideCardTitle}>Motorcycle / Fuel Bike</Text>
                    <Text style={obStyles.fieldHint}>Max daily range • All order categories</Text>
                  </View>
                </View>
                <View
                  style={[
                    obStyles.radioOuter,
                    vehicleChoice === 'moto' && obStyles.radioOuterActive,
                  ]}
                >
                  {vehicleChoice === 'moto' && <View style={obStyles.radioInner} />}
                </View>
              </View>
            </TouchableOpacity>

            {/* Ride Card 2: Electric EV Scooter */}
            <TouchableOpacity
              style={[
                obStyles.rideCard,
                vehicleChoice === 'ev' && obStyles.rideCardSelected,
              ]}
              onPress={() => setVehicleChoice('ev')}
              activeOpacity={0.8}
            >
              <View style={obStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[obStyles.rideIconCircle, { backgroundColor: '#c0edd2' }]}>
                    <Text style={{ fontSize: 24 }}>🛵</Text>
                  </View>
                  <View>
                    <Text style={obStyles.rideCardTitle}>Electric EV Scooter</Text>
                    <Text style={obStyles.fieldHint}>Zero emission • Lowest operating cost</Text>
                  </View>
                </View>
                <View
                  style={[
                    obStyles.radioOuter,
                    vehicleChoice === 'ev' && obStyles.radioOuterActive,
                  ]}
                >
                  {vehicleChoice === 'ev' && <View style={obStyles.radioInner} />}
                </View>
              </View>
            </TouchableOpacity>

            {/* Ride Card 3: Eco Bicycle */}
            <TouchableOpacity
              style={[
                obStyles.rideCard,
                vehicleChoice === 'bicycle' && obStyles.rideCardSelected,
              ]}
              onPress={() => setVehicleChoice('bicycle')}
              activeOpacity={0.8}
            >
              <View style={obStyles.betweenRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={obStyles.rideIconCircle}>
                    <Text style={{ fontSize: 24 }}>🚲</Text>
                  </View>
                  <View>
                    <Text style={obStyles.rideCardTitle}>Eco Bicycle</Text>
                    <Text style={obStyles.fieldHint}>Short distance hyperlocal • No DL required</Text>
                  </View>
                </View>
                <View
                  style={[
                    obStyles.radioOuter,
                    vehicleChoice === 'bicycle' && obStyles.radioOuterActive,
                  ]}
                >
                  {vehicleChoice === 'bicycle' && <View style={obStyles.radioInner} />}
                </View>
              </View>
            </TouchableOpacity>

            {/* Dynamic RC Form: for Motorcycle / EV */}
            {vehicleChoice !== 'bicycle' ? (
              <View style={obStyles.card}>
                <Text style={[obStyles.fieldLabel, { marginBottom: 10 }]}>Vehicle Plate Number (RC)</Text>
                <FloatingLabelInput
                  label="Plate Number (e.g. KA 01 AB 5678)"
                  value={vehiclePlateInput}
                  onChangeText={(val) => setVehiclePlateInput(val.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={13}
                  hint="Ensure RC is issued under valid commercial or two-wheeler transport guidelines"
                />
              </View>
            ) : (
              <View style={obStyles.card}>
                <Text style={[obStyles.fieldLabel, { color: '#042f1e' }]}>No License or RC Required</Text>
                <Text style={[obStyles.fieldHint, { marginTop: 4 }]}>
                  Bicycle deliveries are permitted for 0–3 km orders without requiring vehicle registration documents.
                </Text>
              </View>
            )}

            {/* Sticky Bottom Actions */}
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={obStyles.primaryCtaBtn}
                onPress={handleProceedStep2}
                activeOpacity={0.9}
              >
                <Text style={obStyles.primaryCtaBtnText}>
                  {vehicleChoice === 'bicycle' ? 'Next: eKYC & Identity' : 'Next: Driver Documents'}
                </Text>
                <Text style={obStyles.primaryCtaArrow}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* STEP 3: DRIVER DOCUMENTS (DL, PAN)                                  */}
        {/* =================================================================== */}
        {onboardStep === 3 && (
          <View style={obStyles.stepWrap}>
            {/* Standardized Unified Stepper */}
            <UnifiedStepper currentStep={3} />

            {/* Subheader */}
            <View style={{ paddingVertical: 4 }}>
              <Text style={obStyles.sectionHeading}>Driver Documents</Text>
              <Text style={obStyles.fieldHint}>Verified via Ministry of Road Transport & NSDL gateways</Text>
            </View>

            {/* Document Card 1: Driving License */}
            <View style={obStyles.card}>
              <Text style={[obStyles.fieldLabel, { marginBottom: 10 }]}>Driving License (DL)</Text>

              {/* DL Image Previews */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={obStyles.dlImageWrap}>
                  <Image
                    source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQ4n_bKv83Vjb95GE9SZw7o8kgzvso2nv-KkYQvf4_xsfw5-efltRABkW_gimDiULoVh7pvE6eQ5b4BTSrvShHBuIF1BPJm9WpVIwWQjhDgX-E2IrlHpGxVL4CIsmezT94uk478aMNZFjEgdM2fleuQ0uvfECX6D-cL0YN9xZyzhHVnWPuL1iEgqPqpHqmLVo_DL4ls9xfU8AgXNEeGvxvk66nnCHiG2TbfjXoTSEJ' }}
                    style={obStyles.docThumbImage}
                    resizeMode="cover"
                  />
                  <View style={obStyles.docThumbBadge}>
                    <Text style={obStyles.docThumbBadgeText}>Front View</Text>
                  </View>
                </View>
                <View style={obStyles.dlImageWrap}>
                  <Image
                    source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBmJdSrI8jsi5cz2ooho1vPqZXqSnVrd2nhLpDq24Jy-BQVyYCXBaOiYebGLYCw7Q9ah4EFmJ31-uXULrBamDtXAqqLrXs-NiqAIeOFrv-55p_z3YyS14xVlB9setDSajt6nSpr44HXZFSFkBpwnUPOMYCf8HH7t4KLs4AqSuHS6T9uVy3mllymSLG5eYIhj5updBa08R-1vcUSD-KXw7EVoA0-8UDhLIpX8GGvFD_a' }}
                    style={obStyles.docThumbImage}
                    resizeMode="cover"
                  />
                  <View style={obStyles.docThumbBadge}>
                    <Text style={obStyles.docThumbBadgeText}>Back View</Text>
                  </View>
                </View>
              </View>

              <FloatingLabelInput
                label="Driving License Number"
                value={dlNumber}
                onChangeText={(v) => setDlNumber(v.toUpperCase())}
                autoCapitalize="characters"
                hint="Auto-matched with Sarathi Vahan DB • Valid till 2038"
              />
            </View>

            {/* Document Card 2: PAN Card */}
            <View style={obStyles.card}>
              <Text style={[obStyles.fieldLabel, { marginBottom: 10 }]}>PAN Card Identity</Text>
              <FloatingLabelInput
                label="Permanent Account Number (PAN)"
                value={panNumber}
                onChangeText={(v) => setPanNumber(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={10}
                hint="Auto-authenticated via NSDL Protean Gateway • 100% Name Match"
              />
            </View>

            {/* Sticky Bottom Actions */}
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={obStyles.primaryCtaBtn}
                onPress={() => setOnboardStep(4)}
                activeOpacity={0.9}
              >
                <Text style={obStyles.primaryCtaBtnText}>Next: eKYC & Selfie</Text>
                <Text style={obStyles.primaryCtaArrow}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* STEP 4: eKYC & LIVE PROFILE SELFIE                                  */}
        {/* =================================================================== */}
        {onboardStep === 4 && (
          <View style={obStyles.stepWrap}>
            {/* Standardized Unified Stepper */}
            <UnifiedStepper currentStep={4} />

            {/* Context Header */}
            <View style={{ paddingVertical: 4 }}>
              <Text style={obStyles.sectionHeading}>Identity & Face Verification</Text>
              <Text style={obStyles.fieldHint}>Verified via Digio UIDAI gateway and live selfie comparison</Text>
            </View>

            {/* Section 1: Aadhaar eKYC */}
            <View style={obStyles.card}>
              <Text style={[obStyles.fieldLabel, { marginBottom: 10 }]}>Aadhaar Paperless eKYC</Text>
              <FloatingLabelInput
                label="12-Digit Aadhaar (Masked Vault)"
                value={aadhaarDigits}
                editable={false}
                hint="UIDAI Authenticated Token #DG-8921-992-K"
              />

              {/* OTP Confirmation Panel */}
              <View style={obStyles.otpPanel}>
                <View style={obStyles.betweenRow}>
                  <Text style={obStyles.fieldHint}>6-digit OTP sent to linked mobile (...4321)</Text>
                  <Text style={{ fontSize: 11, color: '#042f1e', fontWeight: 'bold' }}>Auto-Read Complete</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {ekycOtp.map((dig, idx) => (
                    <View key={idx} style={obStyles.ekycOtpBox}>
                      <Text style={obStyles.ekycOtpText}>{dig}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Section 2: Live Profile Selfie */}
            <View style={obStyles.card}>
              <Text style={[obStyles.fieldLabel, { marginBottom: 8 }]}>Live Profile Selfie</Text>
              <View style={obStyles.selfieViewfinderFrame}>
                <Image
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBfTx9LmnJCpwHIT_Re3GNM09fLKXmJLor6yCzHaVYvIPUuadkxtYFEcNuvs3lH3NddVd4IvQjUnrDVBwztMI12u9aAn_1SAv9PbYMQoHLUyRmBfRz4x-dfwUt8YL8dKrS0CTrI_cvRGGIsDROIsTf9auUNu1e0RTSX3IbpYhveNLD0yjoG1gytETK9L0JOMiXUC5mXZgEtr_vnr7RI0xtQr6S5oU2Eoh4NGcWahSj' }}
                  style={obStyles.selfieImage}
                  resizeMode="cover"
                />
                <View style={obStyles.ovalGuide}>
                  <View style={obStyles.faceLockedPill}>
                    <Text style={obStyles.faceLockedText}>Face Locked • 99.8% Match</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[obStyles.retakeBtn, { marginTop: 12 }]}
                onPress={() => {
                  setIsRetakingPhoto(true);
                  setTimeout(() => {
                    setIsRetakingPhoto(false);
                    Alert.alert('Selfie Updated', 'Biometric liveness confirmed with 99.8% score.');
                  }, 800);
                }}
              >
                <Text style={obStyles.retakeBtnText}>
                  {isRetakingPhoto ? 'Capturing...' : '🔄 Retake Live Selfie'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Button */}
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={obStyles.primaryCtaBtn}
                onPress={() => setOnboardStep(5)}
                activeOpacity={0.9}
              >
                <Text style={obStyles.primaryCtaBtnText}>Next: Bank Account Setup</Text>
                <Text style={obStyles.primaryCtaArrow}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* STEP 5: BANK ACCOUNT SETUP & PENNY DROP                             */}
        {/* =================================================================== */}
        {onboardStep === 5 && (
          <View style={obStyles.stepWrap}>
            {/* Standardized Unified Stepper */}
            <UnifiedStepper currentStep={5} />

            {/* Header */}
            <View style={{ paddingVertical: 4 }}>
              <Text style={obStyles.sectionHeading}>Link Bank Account for Daily Payouts</Text>
              <Text style={obStyles.fieldHint}>Earnings, incentives, and tips are auto-deposited here every evening</Text>
            </View>

            {/* Account Fields Card */}
            <View style={obStyles.card}>
              <FloatingLabelInput
                label="Account Holder Name"
                value={bankHolderName}
                editable={false}
                hint="Permanently matched from verified KYC"
              />

              <FloatingLabelInput
                label="Bank IFSC Code"
                value={bankIfscInput}
                onChangeText={(v) => setBankIfscInput(v.toUpperCase())}
                autoCapitalize="characters"
                hint="Resolved: State Bank of India (Hitec City Branch)"
              />

              <FloatingLabelInput
                label="Bank Account Number"
                value={bankAccInput}
                onChangeText={setBankAccInput}
                hint="Account verified via Penny Drop"
              />

              <FloatingLabelInput
                label="Confirm Account Number"
                value={bankAccConfirmInput}
                onChangeText={setBankAccConfirmInput}
                hint="Numbers match"
              />

              <FloatingLabelInput
                label="Daily UPI ID (Optional)"
                value={upiIdInput}
                onChangeText={setUpiIdInput}
                autoCapitalize="none"
                hint="Used for instant intra-day tip payouts"
              />
            </View>

            {/* Terms Agreement */}
            <TouchableOpacity
              style={obStyles.card}
              onPress={() => setTermsAgreed(!termsAgreed)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={[obStyles.checkboxBox, termsAgreed && obStyles.checkboxBoxActive]}>
                  {termsAgreed && <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[obStyles.fieldLabel, { fontSize: 13 }]}>
                    I agree to RALT Logistics Fleet Terms, Safety Code & Insurance Coverage
                  </Text>
                  <Text style={obStyles.fieldHint}>
                    Includes complimentary ₹5,00,000 on-duty transit protection.
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Submit Button */}
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={[obStyles.primaryCtaBtn, !termsAgreed && { opacity: 0.5 }]}
                onPress={handleSubmitApplication}
                disabled={isSubmittingApp || !termsAgreed}
                activeOpacity={0.9}
              >
                {isSubmittingApp ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={obStyles.primaryCtaBtnText}>Complete Registration & Submit Application</Text>
                    <Text style={{ fontSize: 18 }}>🚀</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* STEP 6: APPLICATION SUBMITTED & DIGITAL PARTNER ID                  */}
        {/* =================================================================== */}
        {onboardStep === 6 && (
          <View style={obStyles.stepWrap}>
            {/* Celebratory Hero Card */}
            <View style={obStyles.celebrateHeroCard}>
              <View style={obStyles.celebrateBadgeCircle}>
                <Text style={{ fontSize: 32 }}>🎉</Text>
              </View>
              <Text style={obStyles.celebrateHeroTitle}>Application Submitted Successfully!</Text>
              <Text style={obStyles.celebrateHeroSubtitle}>
                Welcome aboard! Your documents are verified and your digital dispatch profile is now active.
              </Text>
            </View>

            {/* Digital Partner Card */}
            <View style={obStyles.digitalIdCard}>
              <View style={obStyles.betweenRow}>
                <View>
                  <Text style={{ fontSize: 11, color: '#89b39b', fontWeight: 'bold' }}>OFFICIAL RALT DISPATCH ID</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginTop: 2 }}>RALT-HYD-884920</Text>
                </View>
                <TouchableOpacity
                  style={obStyles.copyBtn}
                  onPress={() => {
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                >
                  <Text style={obStyles.copyBtnText}>{copiedId ? 'COPIED!' : 'Copy ID'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Actions */}
            <View style={{ marginTop: 16, gap: 10 }}>
              <TouchableOpacity
                style={obStyles.primaryCtaBtn}
                onPress={onFinishAndGoDashboard}
                activeOpacity={0.9}
              >
                <Text style={obStyles.primaryCtaBtnText}>Go to Fleet Radar Dashboard</Text>
                <Text style={obStyles.primaryCtaArrow}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* =================================================================== */}
      {/* DATE OF BIRTH INTERACTIVE CALENDAR MODAL                            */}
      {/* =================================================================== */}
      <Modal
        visible={showDobModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDobModal(false)}
      >
        <View style={obStyles.modalOverlay}>
          <View style={obStyles.calendarModalContainer}>
            {/* Modal Header */}
            <View style={obStyles.calendarModalHeader}>
              <Text style={obStyles.calendarModalTitle}>Select Date of Birth</Text>
              <TouchableOpacity
                onPress={() => setShowDobModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 18, color: '#414943', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Year & Month Stepper Controls */}
            <View style={obStyles.calControlsRow}>
              {/* Month selector */}
              <View style={obStyles.calSelectorGroup}>
                <TouchableOpacity
                  style={obStyles.calNavArrowBtn}
                  onPress={() => {
                    if (calMonth === 0) {
                      setCalMonth(11);
                      setCalYear((y) => y - 1);
                    } else {
                      setCalMonth((m) => m - 1);
                    }
                  }}
                >
                  <Text style={obStyles.calNavArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={obStyles.calNavLabel}>{MONTHS[calMonth]}</Text>
                <TouchableOpacity
                  style={obStyles.calNavArrowBtn}
                  onPress={() => {
                    if (calMonth === 11) {
                      setCalMonth(0);
                      setCalYear((y) => y + 1);
                    } else {
                      setCalMonth((m) => m + 1);
                    }
                  }}
                >
                  <Text style={obStyles.calNavArrowText}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Year selector */}
              <View style={obStyles.calSelectorGroup}>
                <TouchableOpacity
                  style={obStyles.calNavArrowBtn}
                  onPress={() => setCalYear((y) => Math.max(1950, y - 1))}
                >
                  <Text style={obStyles.calNavArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={obStyles.calNavLabel}>{calYear}</Text>
                <TouchableOpacity
                  style={obStyles.calNavArrowBtn}
                  onPress={() => setCalYear((y) => Math.min(2015, y + 1))}
                >
                  <Text style={obStyles.calNavArrowText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Year Jump Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
            >
              {[1990, 1993, 1995, 1998, 2000, 2002, 2004, 2006, 2007, 2008].map((yr) => (
                <TouchableOpacity
                  key={yr}
                  style={[
                    obStyles.yearChip,
                    calYear === yr && obStyles.yearChipActive,
                  ]}
                  onPress={() => setCalYear(yr)}
                >
                  <Text
                    style={[
                      obStyles.yearChipText,
                      calYear === yr && obStyles.yearChipTextActive,
                    ]}
                  >
                    {yr}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Weekday Header */}
            <View style={obStyles.weekDaysRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Text key={d} style={obStyles.weekDayLabel}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={obStyles.daysGrid}>
              {/* Empty leading cells */}
              {Array.from({ length: firstDayOfCalMonth }).map((_, i) => (
                <View key={`empty-${i}`} style={obStyles.dayCellEmpty} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInCurrentCalMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isSelected = dobInput === dateStr;
                const cellAge = calculateAge(dateStr);
                const isCell18Plus = cellAge >= 18;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    style={[
                      obStyles.dayCell,
                      isSelected && obStyles.dayCellSelected,
                    ]}
                    onPress={() => {
                      setDobInput(dateStr);
                      setShowDobModal(false);
                    }}
                  >
                    <Text
                      style={[
                        obStyles.dayCellText,
                        isSelected && obStyles.dayCellTextSelected,
                        !isCell18Plus && !isSelected && { color: '#ba1a1a' },
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 18+ Notice at bottom of modal */}
            <View style={obStyles.modalDobFooter}>
              <Text style={{ fontSize: 11, color: '#414943', textAlign: 'center' }}>
                Selected: <Text style={{ fontWeight: 'bold', color: '#042f1e' }}>{dobInput}</Text> • Age: <Text style={{ fontWeight: 'bold', color: isAgeValid ? '#042f1e' : '#ba1a1a' }}>{riderAge} yrs</Text> ({isAgeValid ? 'Eligible' : 'Under 18 Not Eligible'})
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLESHEET
// =============================================================================
const obStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9ff',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f3ff',
  },
  backButtonArrow: {
    fontSize: 20,
    color: '#141b2b',
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141b2b',
  },
  miniDotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  miniDot: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  miniDotActive: {
    backgroundColor: '#042f1e',
  },
  miniDotInactive: {
    backgroundColor: '#dce2f7',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 60,
  },
  stepWrap: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  betweenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepIndicatorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#042f1e',
  },
  badgeGreen: {
    backgroundColor: '#c0edd2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#002113',
  },
  stepperBarRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  stepperBarSegment: {
    flex: 1,
    borderRadius: 3,
  },
  stepperLabelText: {
    fontSize: 11,
    color: '#717973',
  },
  visualHeroCard: {
    backgroundColor: '#1e4633',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visualHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  visualHeroSubtitle: {
    fontSize: 12,
    color: '#89b39b',
    marginTop: 4,
  },
  visualHeroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(4, 47, 30, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
  },
  fieldHint: {
    fontSize: 12,
    color: '#717973',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#042f1e',
    marginBottom: 4,
  },
  hubChip: {
    backgroundColor: '#f1f3ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e1e8fd',
  },
  hubChipActive: {
    backgroundColor: '#042f1e',
    borderColor: '#042f1e',
  },
  hubChipText: {
    fontSize: 12,
    color: '#414943',
    fontWeight: '600',
  },
  hubChipTextActive: {
    color: '#ffffff',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  privacyText: {
    fontSize: 11,
    color: '#717973',
    flex: 1,
    lineHeight: 16,
  },
  primaryCtaBtn: {
    backgroundColor: '#042f1e',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#042f1e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryCtaBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryCtaArrow: {
    color: '#ffffff',
    fontSize: 16,
  },
  rideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e1e8fd',
  },
  rideCardSelected: {
    borderColor: '#042f1e',
    backgroundColor: '#f9fcfa',
  },
  rideIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141b2b',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#c1c8c1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#042f1e',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#042f1e',
  },
  dlImageWrap: {
    flex: 1,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f3ff',
  },
  docThumbImage: {
    width: '100%',
    height: '100%',
  },
  docThumbBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docThumbBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  otpPanel: {
    backgroundColor: '#f9f9ff',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  ekycOtpBox: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c1c8c1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ekycOtpText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#042f1e',
  },
  selfieViewfinderFrame: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#141b2b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieImage: {
    width: '100%',
    height: '100%',
  },
  ovalGuide: {
    position: 'absolute',
    width: 140,
    height: 170,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#c0edd2',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  faceLockedPill: {
    backgroundColor: '#042f1e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  faceLockedText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  retakeBtn: {
    borderWidth: 1.5,
    borderColor: '#042f1e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#042f1e',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#c1c8c1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: '#042f1e',
    borderColor: '#042f1e',
  },
  celebrateHeroCard: {
    backgroundColor: '#042f1e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    textAlign: 'center',
  },
  celebrateBadgeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  celebrateHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  celebrateHeroSubtitle: {
    fontSize: 13,
    color: '#89b39b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  digitalIdCard: {
    backgroundColor: '#1e4633',
    borderRadius: 14,
    padding: 16,
  },
  copyBtn: {
    backgroundColor: '#c0edd2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#002113',
  },

  // CALENDAR MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3ff',
    paddingBottom: 8,
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#141b2b',
  },
  calControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  calSelectorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f3ff',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  calNavArrowBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  calNavArrowText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#042f1e',
  },
  calNavLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141b2b',
    minWidth: 60,
    textAlign: 'center',
  },
  yearChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f1f3ff',
  },
  yearChipActive: {
    backgroundColor: '#042f1e',
  },
  yearChipText: {
    fontSize: 11,
    color: '#414943',
    fontWeight: '600',
  },
  yearChipTextActive: {
    color: '#ffffff',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 4,
  },
  weekDayLabel: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#717973',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 38,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  dayCellSelected: {
    backgroundColor: '#042f1e',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#141b2b',
  },
  dayCellTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalDobFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f3ff',
  },
});
