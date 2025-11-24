import { db } from "@/api/config/firebase.config";
import { signUp } from "@/api/controller/auth.controller";
import Input from "@/components/ui/input/Input";
import { Role } from "@/enums/roles";
import { useFonts } from "expo-font";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { sendEmailVerification } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { CheckSquare, FileText, Square, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// import { auth } from "../api/config/firebase";
import "../global.css";

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: Role.USER,
    phone: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsData, setTermsData] = useState([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Pacifico: require("../assets/fonts/Pacifico-Regular.ttf"),
    Roboto: require("../assets/fonts/Roboto-Bold.ttf"),
  });

  const [showErrors, setShowErrors] = useState(false);

  // Handle scroll to detect if user has reached the bottom
  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  // Fetch Terms & Conditions from Firebase
  useEffect(() => {
    const fetchTerms = async () => {
      setLoadingTerms(true);
      try {
        const termsCollection = collection(db, "termsAndConditions");
        const termsSnapshot = await getDocs(termsCollection);
        
        if (!termsSnapshot.empty) {
          const allTerms = termsSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              title: data.tc_title || "Section",
              content: data.tc_content || "",
            };
          });
          setTermsData(allTerms);
        } else {
          setTermsData([{
            title: "Terms & Conditions",
            content: "Terms and Conditions are currently being updated. Please check back later."
          }]);
        }
      } catch (error) {
        console.error("Error fetching terms:", error);
        setTermsData([{
          title: "Terms & Conditions",
          content: "Unable to load Terms and Conditions at this time."
        }]);
      } finally {
        setLoadingTerms(false);
        setHasScrolledToBottom(false); // Reset scroll state when modal opens
      }
    };

    if (showTermsModal) {
      fetchTerms();
    }
  }, [showTermsModal]);

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (field, value) => {
    setCredentials((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Normalize Philippine phone numbers into E.164 (+63XXXXXXXXXX)
  const normalizePhilippinePhone = (input) => {
    if (!input) return null;
    // Remove spaces, dashes, parentheses
    const digits = input.replace(/[^0-9+]/g, "");

    // Strip leading + for checks
    const raw = digits.startsWith("+") ? digits.slice(1) : digits;

    // If already starts with country code 63 + 10 digits
    if (/^63\d{10}$/.test(raw)) return `+${raw}`;

    // If starts with 0 and mobile 09XXXXXXXXX or 9XXXXXXXXX
    if (/^0?9\d{9}$/.test(raw)) {
      const withoutLeading0 = raw.replace(/^0/, "");
      return `+63${withoutLeading0}`;
    }

    // If already +63XXXXXXXXXX
    if (/^\+63\d{10}$/.test(digits)) return digits;

    return null;
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    
    if (
      !credentials.firstName ||
      !credentials.lastName ||
      !credentials.email ||
      !credentials.phone ||
      credentials.password !== credentials.confirmPassword
    ) {
      Alert.alert("Please fix the errors before submitting.");
      return;
    }

    if (!termsAccepted) {
      Alert.alert("Terms Required", "Please accept the Terms & Conditions to continue.");
      return;
    }

    if (!isValidEmail(credentials.email)) {
      Alert.alert("Invalid email format");
      return;
    }

    // Normalize and validate Philippine phone number
    const normalizedPhone = normalizePhilippinePhone(credentials.phone);
    if (!normalizedPhone) {
      Alert.alert("Invalid phone", "Please enter a valid Philippine phone number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).");
      return;
    }

    setLoading(true);
    // try to get location permission and current coords (latitude, longitude)
    let locationArray = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        if (loc?.coords) {
          locationArray = [loc.coords.latitude, loc.coords.longitude];
        }
      } else {
        // Permission not granted - inform the user. Continue without location.
        Alert.alert(
          "Location permission required",
          "Location permission was not granted. You can enable it in device settings to attach your location to your account."
        );
      }
    } catch (locErr) {
      console.warn("Location error:", locErr);
      // Continue without location if fetching fails
    }

    try {
      // send credentials plus location (location may be null if not available)
  const payload = { ...credentials, location: locationArray, phone: normalizedPhone };
      const userCredential = await signUp(payload);

      if (userCredential?.data?.user) {
        try {
          await sendEmailVerification(userCredential?.data?.user);
          console.log(
            "✓ Verification email sent successfully to:",
            userCredential.user.email
          );
        } catch (emailError) {
          console.error("✗ Email verification failed:", emailError);
          console.log(
            "User created but email not sent. Error:",
            emailError.code,
            emailError.message
          );
        }

        setLoading(false);
        setCredentials({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: Role.USER,
          phone: "",
        });
        setShowErrors(false);

        Alert.alert(
          "Account Created",
          "Your account has been created. A verification email should arrive shortly at " +
            credentials.email +
            ". If you don't receive it, check your spam folder or request a new one after logging in.",
          [
            {
              text: "Back to Login",
              onPress: () => {
                router.replace("/index");
              },
            },
          ]
        );
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Signup error:", error);
      setLoading(false);
      Alert.alert("Error", error.message || "Failed to create account");
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 -mt-3">
          {/* Logo */}
          <View className="items-center">
            <Image
              source={require("../assets/images/signup_logo.png")}
              style={{ width: 120, height: 120, resizeMode: "contain" }}
            />
          </View>

          {/* Greeting */}
          <Text className="text-[18px] text-green-600 font-bold text-center mb-7">
            Welcome Let’s Get you Started!
          </Text>

          {/* Input fields */}
          <View className="space-y-4">
            <Input
              placeholder="First Name"
              value={credentials.firstName}
              onChangeText={(t) => handleChange("firstName", t)}
              leftIconName="user"
              showErrors={showErrors}
              editable={!loading}
              style={{ borderColor: "green", borderWidth: 1, borderRadius: 8 }}
            />

            <Input
              placeholder="Last Name"
              value={credentials.lastName}
              onChangeText={(t) => handleChange("lastName", t)}
              leftIconName="user"
              showErrors={showErrors}
              editable={!loading}
              style={{ borderColor: "green", borderWidth: 1, borderRadius: 8 }}
            />

            <Input
              placeholder="Phone Number"
              value={credentials.phone}
              onChangeText={(t) => handleChange("phone", t)}
              leftIconName="phone"
              showErrors={showErrors}
              editable={!loading}
              keyboardType="phone-pad"
              style={{ borderColor: "green", borderWidth: 1, borderRadius: 8 }}
            />

            <Input
              placeholder="Email"
              value={credentials.email}
              onChangeText={(t) => handleChange("email", t)}
              leftIconName="mail"
              showErrors={showErrors}
              editable={!loading}
              style={{ borderColor: "green", borderWidth: 1, borderRadius: 8 }}
            />

            <Input
              placeholder="Password"
              secureTextEntry={!showPassword}
              value={credentials.password}
              onChangeText={(t) => handleChange("password", t)}
              leftIconName="key"
              icon={showPassword ? "eye-off" : "eye"}
              onIconPress={() => setShowPassword(!showPassword)}
              type="password"
              showErrors={showErrors}
              editable={!loading}
              style={{ borderColor: "green", borderWidth: 1, borderRadius: 8 }}
            />

            <Input
              placeholder="Confirm Password"
              secureTextEntry={!showConfirmPassword}
              value={credentials.confirmPassword}
              onChangeText={(t) => handleChange("confirmPassword", t)}
              leftIconName="check"
              icon={showConfirmPassword ? "eye-off" : "eye"}
              onIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
              type="confirmPassword"
              compareWith={credentials.password}
              showErrors={showErrors}
              editable={!loading}
              style={{ borderColor: "green", borderWidth: 1, borderRadius: 8 }}
            />
          </View>

          {/* Terms & Conditions Checkbox */}
          <TouchableOpacity
            onPress={() => setTermsAccepted(!termsAccepted)}
            className="flex-row items-center mb-4"
            activeOpacity={0.7}
            disabled={loading}
          >
            <View className="mr-3">
              {termsAccepted ? (
                <CheckSquare size={24} color="#16A34A" />
              ) : (
                <Square size={24} color="#6B7280" />
              )}
            </View>
            <Text className="flex-1 text-sm text-gray-700">
              I agree to the{" "}
              <Text
                className="text-green-600 font-bold underline"
                onPress={(e) => {
                  e.stopPropagation();
                  setShowTermsModal(true);
                }}
              >
                Terms & Conditions
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Confirm button */}
          <TouchableOpacity
            onPress={handleSubmit}
            className="w-full py-3 rounded-lg mb-6 mt-3"
            style={{
              backgroundColor: "#FF7A00",
              borderRadius: 8,
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
              elevation: 3,
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
            activeOpacity={loading ? 1 : 0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" size="large" />
            ) : (
              <Text className="text-white font-bold text-center">Confirm</Text>
            )}
          </TouchableOpacity>

          {/* Already have an account */}
          <View className="flex-row justify-center items-center mb-9">
            <Text className="text-gray-600 text-sm">Already have an Account?</Text>
            <TouchableOpacity onPress={() => router.replace("/index")}>
              <Text className="text-[#16a34a] font-bold text-sm ml-1">Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Terms & Conditions Modal */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 16,
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 24,
            width: '100%',
            maxWidth: 500,
            maxHeight: '85%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 10,
          }}>
            {/* Header */}
            <View style={{
              backgroundColor: '#16A34A',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingVertical: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 3,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <FileText size={26} color="white" strokeWidth={2.5} />
                <Text style={{
                  color: 'white',
                  fontSize: 20,
                  fontWeight: 'bold',
                  marginLeft: 12,
                  flex: 1,
                }} numberOfLines={2}>
                  Terms & Conditions
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTermsModal(false)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  padding: 8,
                  marginLeft: 8,
                }}
              >
                <X size={22} color="white" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
              style={{ 
                maxHeight: 480,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 24,
                paddingTop: 20,
                paddingBottom: 12,
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {loadingTerms ? (
                <View style={{
                  paddingVertical: 96,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ActivityIndicator size="large" color="#16A34A" />
                  <Text style={{
                    color: '#6B7280',
                    marginTop: 20,
                    fontSize: 16,
                    fontWeight: '500',
                  }}>Loading terms...</Text>
                </View>
              ) : (
                <View>
                  {termsData.map((term, index) => (
                    <View key={index} style={{
                      marginBottom: 24,
                    }}>
                      {/* Title with numbering */}
                      <Text style={{
                        color: '#111827',
                        fontSize: 17,
                        fontWeight: 'bold',
                        marginBottom: 12,
                        lineHeight: 24,
                      }}>
                        {index + 1}. {term.title}
                      </Text>
                      
                      {/* Content */}
                      <Text style={{
                        color: '#374151',
                        fontSize: 15,
                        lineHeight: 24,
                        textAlign: 'justify',
                      }}>
                        {term.content}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={{
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
              paddingHorizontal: 24,
              paddingVertical: 24,
              backgroundColor: '#FFFFFF',
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }}>
              <TouchableOpacity
                onPress={() => {
                  setTermsAccepted(true);
                  setShowTermsModal(false);
                  setHasScrolledToBottom(false);
                }}
                disabled={!hasScrolledToBottom}
                style={{
                  backgroundColor: hasScrolledToBottom ? '#16A34A' : '#9CA3AF',
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  borderRadius: 12,
                  shadowColor: hasScrolledToBottom ? '#16A34A' : '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: hasScrolledToBottom ? 0.3 : 0.1,
                  shadowRadius: 6,
                  elevation: hasScrolledToBottom ? 6 : 2,
                }}
                activeOpacity={hasScrolledToBottom ? 0.8 : 1}
              >
                <Text style={{
                  color: 'white',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontSize: 14,
                  letterSpacing: 0.5,
                }}>
                  {hasScrolledToBottom ? 'I Agree' : 'Scroll to Read All Terms'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
