import * as Location from 'expo-location';
import { Tabs, useRouter, useSegments } from "expo-router";
import { AlertTriangle, Bell, FileText, Home, Send, User } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Image, StyleSheet, TouchableOpacity, View } from "react-native";
import SendNewReport from "../../components/modals/SendNewReport";

export default function TabLayout() {
  const [isModalVisible, setModalVisible] = useState(false);
  const segments = useSegments();
  const currentTab = segments[segments.length - 1];
  const router = useRouter();
  
  // Animation values
  // Each FAB gets its own scale and shimmer refs so clicking one doesn't animate the other
  const fabAnimationSend = useRef(new Animated.Value(1)).current;
  const fabAnimationChatbot = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const shimmerSend = useRef(new Animated.Value(-1)).current;
  const shimmerChatbot = useRef(new Animated.Value(-1)).current;
  const rotateSend = useRef(new Animated.Value(0)).current;
  const rotateChatbot = useRef(new Animated.Value(0)).current;

  // Loading screen animations
  const [isLoading, setIsLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState(new Set());
  const loadingFadeAnim = useRef(new Animated.Value(0)).current;
  const loadingScaleAnim = useRef(new Animated.Value(0.5)).current;
  const loadingRotateAnim = useRef(new Animated.Value(0)).current;

  // Start continuous pulse animation
  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.08,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  }, []);

  // Periodic shimmer effect for each FAB separately (so they can shimmer independently)
  useEffect(() => {
    const startShimmer = (shimmerRef, initialDelay = 1000) => {
      const shimmer = () => {
        Animated.timing(shimmerRef, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          shimmerRef.setValue(-1);
          setTimeout(shimmer, 3000); // Repeat after 3s
        });
      };
      setTimeout(shimmer, initialDelay);
    };
    startShimmer(shimmerSend, 1000);
    startShimmer(shimmerChatbot, 1800);
  }, []);

  // Loading screen animation on tab change - only for tabs that haven't been loaded yet
  useEffect(() => {
    // Skip loading animation for tabs that have already been loaded
    if (loadedTabs.has(currentTab)) {
      return;
    }

    setIsLoading(true);
    loadingFadeAnim.setValue(0);
    loadingScaleAnim.setValue(0.5);
    loadingRotateAnim.setValue(0);

    Animated.parallel([
      Animated.timing(loadingFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(loadingScaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(loadingRotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start(),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(loadingFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(loadingScaleAnim, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsLoading(false);
        loadingRotateAnim.stopAnimation();
        // Mark this tab as loaded
        setLoadedTabs(prev => new Set([...prev, currentTab]));
      });
    }, 1500); // Loading duration

    return () => clearTimeout(timer);
  }, [segments, loadedTabs, currentTab]);

  // Animate only the provided FAB refs: rotateRef, scaleRef, shimmerRef
  const animateFab = (rotateRef = null, scaleRef = null, shimmerRef = null, onRotateComplete = null) => {
    // Scale animation for the provided scaleRef only
    if (scaleRef) {
      Animated.sequence([
        Animated.timing(scaleRef, {
          toValue: 1.1,
          duration: 100,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(scaleRef, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.elastic(1)),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Rotation animation for the provided rotateRef only
    if (rotateRef) {
      Animated.timing(rotateRef, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        rotateRef.setValue(0);
        if (onRotateComplete) onRotateComplete();
      });
    }

    // Trigger immediate shimmer for the provided shimmerRef only
    if (shimmerRef) {
      shimmerRef.setValue(-1);
      Animated.timing(shimmerRef, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        shimmerRef.setValue(-1);
      });
    }
  };

  const handleFabPress = async () => {
  // stop any chatbot rotation/scale/shimmer and reset before animating send FAB
  try {
    rotateChatbot.stopAnimation(); rotateChatbot.setValue(0);
    fabAnimationChatbot.stopAnimation(); fabAnimationChatbot.setValue(1);
    shimmerChatbot.stopAnimation(); shimmerChatbot.setValue(-1);
  } catch (e) {}
  animateFab(rotateSend, fabAnimationSend, shimmerSend);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Permission to access location was denied. Please enable it in your device settings to submit a report.');
      return;
    }
    setModalVisible(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: 'green',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60, borderTopLeftRadius: 15, borderTopRightRadius: 15 },
        }}
      >
        <Tabs.Screen
          name="(index)"
          options={{
            title: "Dashboard",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="(reports)"
          options={{
            title: "Reports",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="(sos)"
          options={{
            title: "SOS",
            headerShown: false,
            tabBarActiveTintColor: '#3a9c54ff',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarIcon: ({ color, size }) => <AlertTriangle color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="(notifications)"
          options={{
            title: "Notifications",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="(profile)"
          options={{
            title: "Profile",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
      {isLoading && (
        <Animated.View style={[styles.loadingOverlay, { opacity: loadingFadeAnim }]}>
          <Animated.Image
            source={require("../../assets/images/signup_logo.png")}
            style={[
              styles.loadingLogo,
              {
                transform: [
                  { scale: loadingScaleAnim },
                  {
                    rotate: loadingRotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />
        </Animated.View>
      )}
  {currentTab !== '[id]' && currentTab !== '(sos)' && (
        <>
          <Animated.View 
            style={[
              styles.fab, 
              { 
                transform: [
                  { scale: Animated.multiply(fabAnimationSend, pulseAnimation) },
                  { 
                    rotate: rotateSend.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '15deg']
                    })
                  }
                ]
              }
            ]}
          >
            <TouchableOpacity
              style={styles.fabButton}
              onPress={handleFabPress}
            >
              <Animated.View 
                style={[
                  styles.shimmerOverlay,
                  {
                    transform: [{
                      translateX: shimmerSend.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-100, 100]
                      })
                    }]
                  }
                ]}
              />
              <Send color="white" size={24} />
            </TouchableOpacity>
          </Animated.View>

          {/* Chatbot FAB - similar styling, positioned above Send FAB */}
          <Animated.View 
            style={[
              styles.chatbotFab,
              { 
                transform: [
                  { scale: Animated.multiply(fabAnimationChatbot, pulseAnimation) },
                  { 
                    rotate: rotateChatbot.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '15deg']
                    })
                  }
                ]
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.fabButton, styles.chatbotButton]}
              onPress={() => {
                // stop any send FAB rotation/scale/shimmer and reset before animating chatbot FAB
                try {
                  rotateSend.stopAnimation(); rotateSend.setValue(0);
                  fabAnimationSend.stopAnimation(); fabAnimationSend.setValue(1);
                  shimmerSend.stopAnimation(); shimmerSend.setValue(-1);
                } catch (e) {}
                // animate chatbot FAB (only this FAB) then navigate
                animateFab(rotateChatbot, fabAnimationChatbot, shimmerChatbot, () => {
                  try { router.push('/AIChatbot/aichatbot'); } catch (e) { console.error('Navigation error:', e); }
                });
              }}
            >
              <Animated.View 
                style={[
                  styles.shimmerOverlay,
                  {
                    transform: [{
                      translateX: shimmerChatbot.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-100, 100]
                      })
                    }]
                  }
                ]}
              />
              <Image source={require("../../assets/images/ariba-logo.png")} style={{ width: 38, height: 38, resizeMode: 'cover' }} />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
      <SendNewReport visible={isModalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
  },
  fabButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fd7e14',
    borderRadius: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    width: 20,
    transform: [{ skewX: '-20deg' }],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingLogo: {
    width: 100,
    height: 100,
  },
  chatbotFab: {
    position: 'absolute',
    right: 20,
    bottom: 156, // slightly above the send FAB
  },
  chatbotButton: {
    backgroundColor: '#16a34a', // green
  },
});
