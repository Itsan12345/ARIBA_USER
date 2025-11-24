
import { db } from '@/api/config/firebase.config';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const emergencyTypes = [
  'Medical',
  'Fire',
  'Crime',
  'Other',
];

const SOS = () => {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef(null);

  const [location, setLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [lastSentLocation, setLastSentLocation] = useState(null);
  const [lastSosUnverified, setLastSosUnverified] = useState(false);
  const [cancelCount, setCancelCount] = useState(0);
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningShowCount, setWarningShowCount] = useState(0);
  const [suspendedUntil, setSuspendedUntil] = useState(null); // ms epoch
  const [suspendedModalVisible, setSuspendedModalVisible] = useState(false);

  // Intro/instructions modal state (show on first load)
  const [introVisible, setIntroVisible] = useState(false);
  const [showIntroIcon, setShowIntroIcon] = useState(false);
  const introAnim = useRef(new Animated.Value(0)).current; // 0 = modal shown, 1 = icon shown

  const { user, userDoc } = useAuth();
  const router = useRouter();
  const hasContact = Boolean(userDoc?.phoneNumber || userDoc?.phone);

  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [otherReason, setOtherReason] = useState('');
  const [showReassureModal, setShowReassureModal] = useState(false);
  const [reassureTitle, setReassureTitle] = useState('');
  const [reassureBody, setReassureBody] = useState('');

  // Precompute dynamic classNames to avoid template literals in JSX
  const outerDisabled = (!hasContact || (suspendedUntil && Date.now() < suspendedUntil));
  const outerRingClass = outerDisabled ? 'w-[220px] h-[220px] rounded-full bg-slate-100 items-center justify-center opacity-50' : 'w-[220px] h-[220px] rounded-full bg-slate-100 items-center justify-center';

  // Animated radiating rings
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only start radiating ring animations when the SOS button is active
    // (not suspended and has contact). When suspended, do not start or
    // render the rings — cleanup will stop any running animations.
    const loops = [];
    const startLoop = (anim, delay) => {
      const start = () => {
        const seq = Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]);
        const l = Animated.loop(seq);
        l.start();
        loops.push({ anim: l });
      };
      const t = setTimeout(start, delay);
      return t;
    };

    let t1 = null;
    let t2 = null;
    if (!outerDisabled) {
      t1 = startLoop(ringA, 0);
      t2 = startLoop(ringB, 700);
    }

    return () => {
      [t1, t2].forEach(t => t && clearTimeout(t));
      // stop animations if running
      try { ringA.stopAnimation(); } catch (e) {}
      try { ringB.stopAnimation(); } catch (e) {}
    };
   }, [ringA, ringB, outerDisabled]);


  // Hotlines modal state and data
  const [hotlinesVisible, setHotlinesVisible] = useState(false);
  const hotlines = [
    { id: 'police', name: 'Police', number: '911' },
    { id: 'fire', name: 'Fire Department', number: '911' },
    { id: 'ambulance', name: 'Ambulance', number: '911' },
    { id: 'barangay', name: 'Barangay Hotline', number: '+63-123-456-789' },
    { id: 'national', name: 'National Emergency', number: '+63-2-911-0000' },
  ];


  useEffect(() => {
    if (confirmVisible) {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            // countdown finished — hide countdown and show the Confirm SOS modal
            setConfirmVisible(false);
            setShowConfirmModal(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [confirmVisible]);

  // load persisted cancel count for this user
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const key = user?.uid ? `sos_cancel_count_${user.uid}` : null;
        if (!key) return;
        const val = await AsyncStorage.getItem(key);
        if (mounted && val) setCancelCount(parseInt(val, 10) || 0);
      } catch (e) {
        // ignore
      }
    };
    load();
    return () => { mounted = false; };
  }, [user, userDoc]);

  // load persisted suspension state
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const key = user?.uid ? `sos_suspended_until_${user.uid}` : `sos_suspended_until_local`;
        const val = await AsyncStorage.getItem(key);
        if (mounted && val) {
          const ms = parseInt(val, 10);
          if (!Number.isNaN(ms)) setSuspendedUntil(ms);
        } else if (mounted) {
          // fallback to server-side human-readable suspended-until string
          if (userDoc?.sosSuspendedUntil) {
            const parsed = Date.parse(userDoc.sosSuspendedUntil);
            if (!Number.isNaN(parsed)) setSuspendedUntil(parsed);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  // Load whether we've shown the intro before (per-user) and set initial states
  useEffect(() => {
    let mounted = true;
    const loadIntro = async () => {
      try {
        const key = user?.uid ? `sos_intro_shown_${user.uid}` : `sos_intro_shown_local`;
        const val = await AsyncStorage.getItem(key);
        if (!mounted) return;
        if (!val) {
          // first time — show modal
          setIntroVisible(true);
          setShowIntroIcon(false);
          introAnim.setValue(0);
        } else {
          // show only subtle icon
          setIntroVisible(false);
          setShowIntroIcon(true);
          introAnim.setValue(1);
        }
      } catch (e) {
        // ignore
      }
    };
    loadIntro();
    return () => { mounted = false; };
  }, [user]);

  const clearSuspension = async () => {
    try {
      setSuspendedUntil(null);
      const keyUntil = user?.uid ? `sos_suspended_until_${user.uid}` : `sos_suspended_until_local`;
      await AsyncStorage.removeItem(keyUntil);
      // Also try to clear suspension metadata in Firestore (best-effort).
      if (user?.uid) {
        try {
          // Clear both human-readable and legacy fields (best-effort)
          await updateDoc(doc(db, 'users', user.uid), {
            sosSuspended: false,
            sosSuspendedAt: null,
            sosSuspendedUntil: null,
          });
        } catch (e) {
          console.warn('Could not clear suspension in Firestore (client may lack permission)', e);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const CANCEL_THRESHOLD = 5; // cancels before 1-week suspension

  const suspendUserForWeek = async (reason) => {
    try {
      // Suspend for 3 days (in milliseconds)
      const until = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3 days in ms
      setSuspendedUntil(until);
      setSuspendedModalVisible(true);

      // persist locally
      const keyUntil = user?.uid ? `sos_suspended_until_${user.uid}` : `sos_suspended_until_local`;
      await AsyncStorage.setItem(keyUntil, String(until));

      // clear cancel count
      setCancelCount(0);
      const keyCount = user?.uid ? `sos_cancel_count_${user.uid}` : `sos_cancel_count_local`;
      await AsyncStorage.removeItem(keyCount);

      // Try to persist suspension metadata to Firestore user document so admins
      // or backend tooling can see when the suspension started and when it ends.
      // This is best-effort: if security rules prevent the update the app will
      // continue to enforce suspension locally and log a warning.
      if (user?.uid) {
        try {
          // Persist a human-readable suspended-until string in Firestore so
          // admins and tooling can show the end date/time without converting
          // milliseconds. Keep a legacy numeric field nullified for safety.
          await updateDoc(doc(db, 'users', user.uid), {
            sosSuspended: true,
            sosSuspendedAt: serverTimestamp(),
            // Human-readable string, e.g. "Mon, Oct 29 2025, 2:34:00 PM"
            sosSuspendedUntil: new Date(until).toLocaleString(),
          });
        } catch (e) {
          // do not block the UX if Firestore update fails (likely due to rules)
          console.warn('Could not persist suspension to Firestore (client may lack permission)', e);
        }
      }
      // NOTE: we intentionally do NOT modify auth state or perform privileged
      // updates to the user's auth token here. Persisting suspension is done
      // locally (AsyncStorage) so the user remains signed in. If you want a
      // server-side record, implement an admin-only endpoint or cloud
      // function that sets the user's document — do not call it from the
      // client with elevated privileges.
    } catch (e) {
      console.warn('suspendUserForWeek failed', e);
    }
  };

    const closeIntroAndShowIcon = async () => {
      try {
        // animate modal -> icon
        Animated.timing(introAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(async () => {
          setIntroVisible(false);
          setShowIntroIcon(true);
          // persist that we've shown the intro
          const key = user?.uid ? `sos_intro_shown_${user.uid}` : `sos_intro_shown_local`;
          try { await AsyncStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
        });
      } catch (e) {
        setIntroVisible(false);
        setShowIntroIcon(true);
      }
    };

    const openIntroFromIcon = () => {
      // show modal again and animate back
      setIntroVisible(true);
      setShowIntroIcon(false);
      introAnim.setValue(0);
    };

  const incrementCancelCount = async (reason) => {
    try {
      const key = user?.uid ? `sos_cancel_count_${user.uid}` : `sos_cancel_count_local`;
      const next = (cancelCount || 0) + 1;
      setCancelCount(next);
      await AsyncStorage.setItem(key, String(next));

      // If next is 3 or 4 (approaching suspension), show a clear warning that further cancels will suspend for 3 days
      if (next >= 3 && next < CANCEL_THRESHOLD) {
        setWarningShowCount(next);
        setWarningModalVisible(true);
      }

      // If next reaches threshold, suspend user
      if (next >= CANCEL_THRESHOLD) {
        await suspendUserForWeek(reason);
      }
    } catch (e) {
      console.warn('incrementCancelCount failed', e);
    }
  };

  const triggerLocationAndType = async (retry = false) => {
    setConfirmVisible(false);
    setLoadingLocation(true);
    try {
      // Ensure device location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLoadingLocation(false);
        Alert.alert(
          'Location services disabled',
          'Please enable location services on your device to send an accurate SOS.',
          [
            { text: 'Retry', onPress: () => triggerLocationAndType(true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingLocation(false);
        Alert.alert(
          'Location permission',
          'Permission to access location was denied. Please enable it in settings to send accurate SOS data.',
          [
            { text: 'Retry', onPress: () => triggerLocationAndType(true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // Try to get the current position (balanced accuracy for speed), fallback to last known
      let loc = null;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, maximumAge: 10000 });
      } catch (e) {
        console.warn('Primary location fetch failed:', e);
      }

      if (!loc) {
        try {
          loc = await Location.getLastKnownPositionAsync();
        } catch (e) {
          console.warn('Last known position fetch failed:', e);
        }
      }

      if (!loc) {
        setLoadingLocation(false);
        Alert.alert(
          'Location unavailable',
          'Unable to determine current location. Please retry with location turned on to send SOS.',
          [
            { text: 'Retry', onPress: () => triggerLocationAndType(true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      setLocation(loc.coords);
      setLoadingLocation(false);
      setTypeModalVisible(true);
    } catch (e) {
      setLoadingLocation(false);
      console.error('Location error:', e);
      Alert.alert('Location error', 'Could not fetch location. Try again.', [
        { text: 'Retry', onPress: () => triggerLocationAndType(true) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

      const handlePress = () => {
    // Require contact number
    // Check suspension
    try {
      if (suspendedUntil && Date.now() < suspendedUntil) {
        // Show suspended modal instead of an alert for a polished UX
        setSuspendedModalVisible(true);
        return;
      }
      // if suspension expired, clear it
      if (suspendedUntil && Date.now() >= suspendedUntil) {
        clearSuspension();
      }
    } catch (e) {
      // ignore
    }

    if (!hasContact) {
      Alert.alert(
        'Contact number required',
        'Please add a contact number to your profile before sending an SOS. This helps responders identify you.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Update profile', onPress: () => router.push('/(tabs)/(profile)/profile') },
        ],
      );
      return;
    }

    // Start the 3s countdown first; after it finishes we'll show the confirm modal
    setConfirmVisible(true);
  };

  const handleCancelConfirm = () => {
    clearInterval(countdownRef.current);
    setConfirmVisible(false);
    setCountdown(3);
    incrementCancelCount('Cancelled during 3s countdown');
  };

  const handleSelectType = (type) => {
    setSelectedType(type);
    setTypeModalVisible(false);
    // send to firestore with duplicate detection
    sendSosToFirestore(type);
  };

  // Persist the 'Other' text as the user types so it's not lost if modal closes
  useEffect(() => {
    const key = user?.uid ? `sos_other_draft_${user.uid}` : null;
    let mounted = true;
    if (!key) return;

    // load existing draft when modal opens
    const loadDraft = async () => {
      try {
        const val = await AsyncStorage.getItem(key);
        if (mounted && val) setOtherReason(val);
      } catch (e) {
        // ignore
      }
    };

    if (typeModalVisible && selectedType === 'Other') loadDraft();

    return () => { mounted = false; };
  }, [typeModalVisible, selectedType, user]);

  useEffect(() => {
    const key = user?.uid ? `sos_other_draft_${user.uid}` : null;
    if (!key) return;
    const save = async () => {
      try {
        if (otherReason && otherReason.length > 0) {
          await AsyncStorage.setItem(key, otherReason);
        } else {
          await AsyncStorage.removeItem(key);
        }
      } catch (e) {
        // ignore
      }
    };
    save();
  }, [otherReason, user]);

  const sendSosToFirestore = async (type) => {
    if (!location) {
      Alert.alert('Location required', 'GPS coordinates are required to send an SOS. Please enable location and try again.');
      return;
    }

    try {
      // duplicate detection: reports within 5 minutes within ~50 meter radius
      const timeWindowMs = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();

  const snapshot = await getDocs(collection(db, 'sos'));
      let possibleDuplicate = false;

      const metersBetween = (lat1, lon1, lat2, lon2) => {
        const R = 6371000; // meters
        const toRad = (v) => (v * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data || !data.timestamp || !data.location) return;
        const ts = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp || 0);
        if (now - ts > timeWindowMs) return; // older than window
        // support both { latitude, longitude } and [lat, long]
        let docLat = null, docLon = null;
        if (Array.isArray(data.location)) {
          docLat = data.location[0];
          docLon = data.location[1];
        } else if (data.location.latitude !== undefined) {
          docLat = data.location.latitude;
          docLon = data.location.longitude;
        }
        if (docLat == null || docLon == null) return;
        const dist = metersBetween(location.latitude, location.longitude, docLat, docLon);
        if (dist <= 50 && data.type === type) {
          possibleDuplicate = true;
        }
      });

      await addDoc(collection(db, 'sos'), {
        uid: user?.uid || null,
        firstName: userDoc?.firstName || null,
        lastName: userDoc?.lastName || null,
        contactNumber: userDoc?.phoneNumber || userDoc?.phone || null,
        type: type,
        typeDetail: type === 'Other' ? (otherReason || null) : null,
        location: [location.latitude, location.longitude],
        timestamp: serverTimestamp(),
        status: possibleDuplicate ? 'possible duplicate' : 'pending',
        read: false,
      });

      // Show professional reassuring modal instead of an alert
      if (possibleDuplicate) {
        setReassureTitle('SOS Received — Under Review');
        setReassureBody(
          'We received your emergency request and responders have been notified. Your report appears similar to a recent submission and will be reviewed by responders to avoid duplicate dispatches. If this is still an active emergency, please remain where you are and await assistance — help is on the way.'
        );
      } else {
        setReassureTitle('SOS Confirmed');
        setReassureBody(
          'Your emergency request has been received and Barangay responders have been notified. Please stay safe, follow any instructions from emergency personnel, and remain at the location you reported. Responders are en route and will assist you shortly.'
        );
      }
  setLastSosUnverified(false);
  setShowReassureModal(true);
      // Successful verified/pending SOS — reset any accumulated cancel count so the user isn't penalized
      try {
        setCancelCount(0);
        setWarningShowCount(0);
        const keyCount = user?.uid ? `sos_cancel_count_${user.uid}` : `sos_cancel_count_local`;
        await AsyncStorage.removeItem(keyCount);
      } catch (err) {
        // non-critical
        console.warn('Could not reset cancel count after successful SOS', err);
      }
      // preserve last sent location for the reassurance modal map/fallback
      try {
        if (location && location.latitude != null && location.longitude != null) {
          setLastSentLocation([location.latitude, location.longitude]);
        }
      } catch (err) {
        console.warn('Could not set lastSentLocation', err);
      }
      // reset selection/state
      setSelectedType(null);
      // clear any saved 'Other' draft and local state
      try {
        if (user?.uid) await AsyncStorage.removeItem(`sos_other_draft_${user.uid}`);
      } catch (e) {
        // ignore
      }
      setOtherReason('');
      setLocation(null);
    } catch (e) {
      console.error('Error sending SOS:', e);
      Alert.alert('Send error', 'Could not send SOS. Please try again.');
    }
  };

  // Send an unverified SOS when user cancels or fails to confirm within 60s
  const sendUnverifiedSos = async () => {
    // best-effort location
    let locCoords = null;
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (servicesEnabled) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          try {
            const l = await Location.getLastKnownPositionAsync();
            if (l && l.coords) locCoords = [l.coords.latitude, l.coords.longitude];
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore location errors for unverified submission
      console.warn('Unverified SOS location fetch failed', e);
    }

    try {
      await addDoc(collection(db, 'sos'), {
        uid: user?.uid || null,
        firstName: userDoc?.firstName || null,
        lastName: userDoc?.lastName || null,
        contactNumber: userDoc?.phoneNumber || userDoc?.phone || null,
        type: null,
        typeDetail: null,
        location: locCoords,
        timestamp: serverTimestamp(),
        status: 'unverified',
        verified: false,
        read: false,
      });

      setLastSosUnverified(true);
      setReassureTitle('SOS Not Confirmed');
      setReassureBody(
        'You did not confirm the emergency within the time limit. An unverified alert was recorded for review. If you still require urgent assistance, please try again and follow the prompts.'
      );
      setShowReassureModal(true);
      if (locCoords && locCoords.length === 2) setLastSentLocation(locCoords);
    } catch (e) {
      console.error('Error sending unverified SOS:', e);
      Alert.alert('Send error', 'Could not record unverified SOS. Please try again.');
    }
  };

  // cleanup verify timer when component unmounts
  useEffect(() => {
    return () => {
      try { clearInterval(verifyRef.current); } catch (e) {}
      try { clearInterval(countdownRef.current); } catch (e) {}
    };
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-emerald-50">
      <View className="relative items-center justify-center">
        {/* Radiating rings (Animated) — render only when active (not suspended) */}
        {!outerDisabled && (
          <>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 160,
                height: 160,
                borderRadius: 110,
                borderWidth: 2,
                borderColor: '#ef4444',
                opacity: ringA.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: ringA.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 160,
                height: 160,
                borderRadius: 110,
                borderWidth: 2,
                borderColor: '#ef4444',
                opacity: ringB.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: ringB.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              }}
            />
          </>
        )}

        <TouchableOpacity
        accessible
        accessibilityLabel="Send SOS"
        accessibilityHint="Sends an alert to emergency contacts"
        activeOpacity={0.8}
        onPress={handlePress}
        className={outerRingClass}
        >
          <View className="w-[160px] h-[160px] rounded-full bg-red-500 items-center justify-center shadow-lg">
            <Text className="text-white text-[38px] font-[Roboto]">SOS</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Show in-app suspension banner when suspended */}
      {suspendedUntil && Date.now() < suspendedUntil && (
        <View className="mt-4 px-5">
          <Text className="text-red-700 text-center font-extrabold">
            Your account’s SOS access is temporarily suspended until {new Date(suspendedUntil).toLocaleString()}.
          </Text>
        </View>
      )}

      {/* Intro / Instructions modal (shown on first load) */}
      <Modal transparent visible={introVisible} animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center">
          <Animated.View
            style={{
              width: 320,
              padding: 18,
              backgroundColor: '#ffffff',
              borderRadius: 12,
              alignItems: 'center',
              transform: [{ scale: introAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }) }],
              opacity: introAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            }}
          >
            <Image source={require('@/assets/images/question-icon.png')} className="w-[72px] h-[72px] mb-2" resizeMode="contain" />
            <Text className="text-[18px] font-[Poppins] mb-2 text-center">How to use SOS</Text>
            <Text className="text-[14px] text-gray-700 text-center mb-3">Tap the red <Text className="font-extrabold">SOS</Text> button to alert responders. You will be asked to confirm before the alert is sent.</Text>
            <View className="w-full mt-1">
              <Text className="text-[13px] text-gray-600 mb-2">• Press once to start a 3s countdown.</Text>
              <Text className="text-[13px] text-gray-600 mb-2">• Confirm your emergency to send the alert to Barangay San Nicholas.</Text>
              <Text className="text-[13px] text-gray-600">• Repeated cancellations may temporarily suspend SOS access.</Text>
            </View>

            <TouchableOpacity
              onPress={closeIntroAndShowIcon}
              className="mt-4 w-full bg-green-600 py-3 rounded-lg items-center"
            >
              <Text className="text-white font-extrabold">Got it</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Subtle intro icon (appears after intro is dismissed) */}
      {(showIntroIcon || introVisible) && (
        <Animated.View
          pointerEvents={showIntroIcon ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            left: 16,
            bottom: 20,
            width: 34,
            height: 34,
            borderRadius: 22,
            backgroundColor: '#F0FDF4',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 6,
            opacity: introAnim,
            transform: [{ scale: introAnim }],
          }}
        >
          <TouchableOpacity onPress={openIntroFromIcon} className="w-full h-full items-center justify-center" accessibilityLabel="SOS instructions">
            <Image source={require('@/assets/images/information-icon.png')} style={{ width: 34, height: 34    }} resizeMode="contain" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Confirmation modal with 3s countdown */}
      <Modal transparent visible={confirmVisible} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-[300px] p-5 bg-white rounded-lg items-center">
            <Text className="text-[18px] font-extrabold mb-2">Are you sure?</Text>
            <Text className="text-[14px] text-gray-800 text-center">Sending emergency alert in {countdown} second{countdown !== 1 ? 's' : ''}.</Text>
            <View className="flex-row mt-4">
              <TouchableOpacity className="py-2.5 px-4 rounded-lg bg-gray-200" onPress={handleCancelConfirm}>
                <Text className="text-gray-900 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reassurance modal shown after sending SOS (dismiss with top-right X) */}
      <Modal transparent visible={showReassureModal} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-[340px] py-5 px-4 bg-white rounded-lg items-center shadow-xl">
            {/* Top-right close X */}
            <TouchableOpacity
              className="absolute top-2 right-2 p-2 z-10"
              onPress={() => setShowReassureModal(false)}
              accessibilityLabel="Close reassurance dialog"
            >
              <Text className="text-[18px] text-gray-700 font-extrabold">✕</Text>
            </TouchableOpacity>

            <Text className="text-[20px] font-extrabold mb-2 text-center">{reassureTitle}</Text>
            <View className="h-[2px] bg-gray-200 w-11/12 my-3" />
            <Image source={require('@/assets/images/green-confirm.png')} className="w-[96px] h-[96px] my-2" resizeMode="contain" />
            <Text className="text-[14px] text-gray-700 text-center leading-5 mt-1">{reassureBody}</Text>
            {/* Location fallback: only show Open in Maps button */}
            <View className="mt-4 w-full">
              {lastSosUnverified ? (
                <View>
                  <Text className="text-gray-500 text-center">Location not shown for unverified alerts.</Text>
                </View>
              ) : (lastSentLocation && lastSentLocation.length === 2 ? (
                <View className="items-center">
                  <TouchableOpacity
                    onPress={() => {
                      const lat = lastSentLocation[0];
                      const lng = lastSentLocation[1];
                      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                      Linking.openURL(url);
                    }}
                    className="w-4/5 bg-green-600 py-2.5 px-4 rounded-lg"
                  >
                    <Text className="text-white font-extrabold text-[16px] text-center">Click to view location</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text className="text-gray-500">Location not available.</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Confirm SOS modal (design from provided image) */}
      <Modal transparent visible={showConfirmModal} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-[340px] py-5 px-4 bg-white rounded-lg items-center shadow-xl">
            <Text className="text-[20px] font-extrabold text-center">CONFIRM SOS</Text>
            <View className="h-[2px] bg-gray-200 w-11/12 my-3" />

            <Image
              source={require('@/assets/images/confirm-sos.png')}
              className="w-[110px] h-[110px] my-2"
              resizeMode="contain"
            />

            <Text className="text-[15px] text-gray-700 text-center mt-1 mb-3 leading-5">
              This will alert Barangay Responders immediately. Use only for real emergencies.
            </Text>

            <View className="w-full flex-row justify-between mt-2">
              <TouchableOpacity
                className="flex-1 mr-2 bg-rose-500 py-3 rounded-lg items-center"
                onPress={() => {
                  setShowConfirmModal(false);
                  incrementCancelCount('Cancelled on confirm modal');
                }}
              >
                <Text className="text-white font-extrabold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 ml-2 bg-green-600 py-3 rounded-lg items-center"
                onPress={() => {
                  setShowConfirmModal(false);
                  // User confirmed — directly proceed to location and type selection
                  triggerLocationAndType();
                }}
              >
                <Text className="text-white font-extrabold">Confirm SOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Warning modal shown after repeated cancellations */}
      <Modal transparent visible={warningModalVisible} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-[340px] py-5 px-4 bg-white rounded-lg items-center shadow-xl">
            <Image source={require('@/assets/images/confirm-sos.png')} className="w-[80px] h-[80px] mb-1" resizeMode="contain" />
            <Text className="text-[18px] font-extrabold text-gray-900 mb-4 text-center">Warning: Potential Misuse Detected</Text>

            <Text className="text-[14px] text-gray-700 text-center leading-5 mb-3">
              We detected <Text className="text-red-700 font-extrabold">{warningShowCount}</Text> out of <Text className="text-red-700 font-extrabold">{CANCEL_THRESHOLD}</Text> repeated cancellations of the SOS flow. Please only use SOS for real emergencies.
            </Text>

            <Text className="text-[13px] text-gray-700 text-center mb-3">If you cancel {CANCEL_THRESHOLD} times, SOS access will be suspended for 3 days.</Text>

            <View className="w-full justify-center mt-2">
              <TouchableOpacity
                className="w-full bg-green-600 py-3 rounded-lg items-center"
                onPress={() => {
                  setWarningModalVisible(false);
                }}
                accessibilityLabel="Acknowledge misuse warning"
              >
                <Text className="text-white font-extrabold text-[15px]">I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Suspended modal shown when user is suspended */}
      <Modal transparent visible={suspendedModalVisible} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-[340px] py-6 px-5 bg-white rounded-xl items-center shadow-2xl">
            <Image source={require('@/assets/images/confirm-sos.png')} className="w-[80px] h-[80px] mb-1" resizeMode="contain" />
            <Text className="text-[20px] font-extrabold text-gray-900 mt-2 mb-2 text-center">SOS Temporarily Suspended</Text>
            <Text className="text-[14px] text-gray-700 text-center leading-5 mb-2">
              Your SOS access has been temporarily suspended due to repeated cancellations. You will regain access automatically after the suspension period.
            </Text>
            {suspendedUntil ? (
              <Text className="text-[13px] text-gray-600 text-center mb-4">Suspended until {new Date(suspendedUntil).toLocaleString()}.</Text>
            ) : userDoc?.sosSuspendedUntil ? (
              <Text className="text-[13px] text-gray-600 text-center mb-4">Suspended until {userDoc.sosSuspendedUntil}.</Text>
            ) : (
              <Text className="text-[13px] text-gray-600 text-center mb-4">You will regain access automatically after the suspension period.</Text>
            )}

            <TouchableOpacity
              className="w-3/5 bg-green-600 py-3 rounded-lg items-center"
              onPress={() => setSuspendedModalVisible(false)}
              accessibilityLabel="Dismiss suspension dialog"
            >
              <Text className="text-white font-extrabold text-[16px]">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading location */}
      <Modal transparent visible={loadingLocation} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-[300px] p-5 bg-white rounded-lg items-center">
            <ActivityIndicator size="large" color="#ef4444" />
            <Text className="text-[14px] text-gray-800 text-center mt-3">Fetching location...</Text>
          </View>
        </View>
      </Modal>

      {/* Emergency type selector modal (select then confirm) */}
      <Modal transparent visible={typeModalVisible} animationType="slide">
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-[320px] p-5 bg-white rounded-lg">
            <Text className="text-[18px] font-extrabold mb-2">Select Emergency Type</Text>
            {emergencyTypes.map((t) => {
              const itemSelected = selectedType === t;
              const itemClass = itemSelected ? 'py-3 px-2 rounded-lg my-1.5 bg-green-50 border border-green-600' : 'py-3 px-2 rounded-lg my-1.5 bg-slate-50';
              const itemTextClass = itemSelected ? 'text-green-700 font-extrabold' : 'text-[16px] text-slate-900';
              return (
                <TouchableOpacity key={t} className={itemClass} onPress={() => setSelectedType(t)}>
                  <Text className={itemTextClass}>{t}</Text>
                </TouchableOpacity>
              );
            })}

            {selectedType === 'Other' && (
              <View className="mt-2.5">
                <Text className="text-[14px] text-slate-900 font-extrabold mb-1.5">Please describe the emergency</Text>
                <Text className="text-[12px] text-gray-500 mb-1.5">Provide a brief, clear description so responders know what to expect.</Text>
                <TextInput
                  value={otherReason}
                  onChangeText={(text) => setOtherReason(text)}
                  placeholder="e.g. gas smell in building, child missing near market, strong chemical odor"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 py-2.5 px-3 rounded-lg bg-white text-slate-900 w-[280px] min-h-[96px] text-[14px] shadow-sm"
                  returnKeyType="done"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={300}
                  accessibilityLabel="Other emergency description"
                />
                <View className="mt-1.5 w-[280px] items-end">
                  <Text className="text-[12px] text-gray-500">{otherReason ? otherReason.length : 0}/300</Text>
                </View>
              </View>
            )}

            <View className="flex-row justify-between mt-3">
              {(() => {
                const canConfirm = Boolean(selectedType) && (selectedType !== 'Other' || (otherReason && otherReason.trim().length > 0));
                return (
                  <TouchableOpacity
                    className={(canConfirm ? 'bg-red-500' : 'bg-red-300') + ' py-2.5 px-4 rounded-lg mr-2'}
                    disabled={!canConfirm}
                    onPress={() => canConfirm && handleSelectType(selectedType)}
                  >
                    <Text className="text-white font-extrabold">Confirm</Text>
                  </TouchableOpacity>
                );
              })()}

              <TouchableOpacity className="py-2.5 px-4 rounded-lg bg-gray-200" onPress={() => { setTypeModalVisible(false); setSelectedType(null); }}>
                <Text className="text-gray-900 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// mapStyles removed — only Open in Maps button is used now

export default SOS;