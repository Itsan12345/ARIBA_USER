import { forgotPassword } from "@/api/controller/auth.controller";
import { GoogleSignUpButton } from "@/components/ui/button/googleAuthButtons";
import Input from "@/components/ui/input/Input";
import { HttpStatus } from "@/enums/status";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  const handleSendEmail = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const req = await forgotPassword(email);
      if (req.status === HttpStatus.OK) {
        setEmailSent(true);
        Alert.alert(
          "Success", 
          "Password reset email sent! Please check your inbox and follow the instructions to reset your password.",
          [
            {
              text: "OK",
              onPress: () => router.push("/")
            }
          ]
        );
      } else {
        Alert.alert("Error", req.message || "Failed to send password reset email");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
      console.error("Forgot password error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 px-6 bg-white justify-center">
      {/* Logo */}
      <View className="items-center">
        <Image
          source={require("../assets/images/signup_logo.png")}
          style={{ width: 130, height: 130, resizeMode: "contain" }}
        />
      </View>

      {/* Instruction text */}
      <Text className="text-center text-black mb-5">
        {emailSent 
          ? "Check your email for password reset instructions" 
          : "Enter your email to receive password reset instructions"
        }
      </Text>

      {/* Input */}
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        leftIconName="mail"
        className="mb-6 border border-green-500 rounded-md bg-white"
      />

      {/* Send Email button */}
      <TouchableOpacity
        onPress={handleSendEmail}
        disabled={loading || emailSent}
        className="w-full py-4 rounded-lg mb-8 mt-3"
        style={{ 
          backgroundColor: loading || emailSent ? "#A0A0A0" : "#34C759",
          opacity: loading || emailSent ? 0.7 : 1
        }}
      >
        <Text className="text-white font-bold text-center">
          {loading ? "Sending..." : emailSent ? "Email Sent" : "Send Email"}
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View className="flex-row items-center mb-8">
        <View className="flex-1 h-px bg-black" />
        <Text className="text-xs text-black mx-2">Sign up Instead</Text>
        <View className="flex-1 h-px bg-black" />
      </View>

      {/* Sign up button */}
      <TouchableOpacity
        onPress={() => router.push("/signup")}
        className="w-full py-4 rounded-lg mb-8"
        style={{ backgroundColor: "#FF7A00" }}
      >
        <Text className="text-white font-bold text-center">Sign up</Text>
      </TouchableOpacity>

      {/* Social login buttons */}
      <View className="flex-row justify-center space-x-6">
        {/* Google */}
        <View
          className="w-12 h-12 mr-8 rounded-lg bg-white justify-center items-center"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <GoogleSignUpButton />
        </View>

        {/* Facebook */}
        <View
          className="w-12 h-12 rounded-lg bg-white justify-center items-center"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Image
            source={require("../assets/images/facebook.png")}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
