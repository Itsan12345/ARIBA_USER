import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AIbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showInitialTyping, setShowInitialTyping] = useState(true);
  const scrollViewRef = useRef(null);

  // inside AIChatbot
const { user } = useAuth(); // Add this at the top of the component

  // Show initial typing animation and then the welcome message
  useEffect(() => {
    // Start with typing indicator
    setTimeout(() => {
      setMessages([{ sender: "bot", text: "..." }]);
      
      // After 2 seconds, replace with actual welcome message
      setTimeout(() => {
        setMessages([{ sender: "bot", text: "Hi! I'm NicolAI 🤖. How can I help you today?" }]);
        setShowInitialTyping(false);
      }, 2000);
    }, 500); // Small delay before showing typing
  }, []);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const typingMessage = { sender: "bot", text: "..." };
    setMessages((prev) => [...prev, typingMessage]);

    try {
      const N8N_WEBHOOK_URL = "https://itsangabriel.app.n8n.cloud/webhook/f6b5929e-e415-448d-b3b9-df5df4142fa7";

      const response = await fetch(
        N8N_WEBHOOK_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: "demo-session", message: input }),
        }
      );
      const data = await response.json();

      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          sender: "bot",
          text: data.output || "Sorry, I didn't understand that.",
        };
        return newMsgs;
      });
    } catch (err) {
      console.error("Chatbot error:", err);
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          sender: "bot",
          text: "⚠️ Error connecting to AI.",
        };
        return newMsgs;
      });
    }

    setLoading(false);
  };

  // Colors based on theme
  const themeColors = {
    background: isDarkMode ? "#1c1c1c" : "#D9E9DD",
    headerBg: isDarkMode ? "#121212" : "#fff",
    headerText: isDarkMode ? "#A0FFA0" : "#347a42",
    userMsg: isDarkMode ? "#286738" : "#b7e0b3",
    botMsg: isDarkMode ? "#333" : "#FFFFFF",
    inputBg: isDarkMode ? "#222" : "#fff",
    inputText: isDarkMode ? "#fff" : "#000",
    sendIcon: isDarkMode ? "#80FF80" : "#347a42",
    typingDot: isDarkMode ? "#aaa" : "#555",
    placeholder: isDarkMode ? "#888" : "#666",
  };

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.headerBg }]}>
        <Ionicons name="sparkles-outline" size={24} color={themeColors.sendIcon} />
        <Text style={[styles.headerTitle, { color: themeColors.headerText }]}>NicolAI</Text>

        {/* Light/Dark icon toggle */}
        <TouchableOpacity style={{ marginLeft: "auto" }} onPress={toggleTheme}>
          <Ionicons
            name={isDarkMode ? "sunny-outline" : "moon-outline"}
            size={24}
            color={themeColors.headerText}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.chatArea}
        onContentSizeChange={() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        }}
      >
       {messages.map((msg, idx) => (
  <View
    key={idx}
    style={[
      styles.messageRow,
      msg.sender === "user"
        ? { justifyContent: "flex-end" }
        : { justifyContent: "flex-start" },
    ]}
  >
    {/* Message bubble first for user, then profile pic */}
    {msg.sender === "user" && (
      <View
        style={[
          styles.message,
          { backgroundColor: themeColors.userMsg },
        ]}
      >
        <Text style={{ color: themeColors.inputText }}>{msg.text}</Text>
      </View>
    )}

    {msg.sender === "bot" && (
      <>
        {/* Bot profile pic */}
        <Image
          source={require("@/assets/images/ariba-logo.png")}
          style={styles.profilePic}
        />
        {/* Bot message bubble */}
        <View
          style={[
            styles.message,
            { backgroundColor: themeColors.botMsg },
          ]}
        >
          {msg.text === "..." ? (
            <TypingIndicator typingDotColor={themeColors.typingDot} />
          ) : (
            <Text style={{ color: themeColors.inputText }}>{msg.text}</Text>
          )}
        </View>
      </>
    )}

    {/* User profile pic at the right */}
    {msg.sender === "user" && (
      <Image
        source={{ uri: user?.photoURL || "https://www.shutterstock.com/image-vector/blank-avatar-photo-place-holder-600nw-1095249842.jpg" }}
        style={styles.profilePic}
      />
    )}
  </View>
))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[styles.inputArea, { backgroundColor: themeColors.inputBg }]}>
          <TextInput
            style={[styles.input, { color: themeColors.inputText }]}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
            placeholderTextColor={themeColors.placeholder}
            editable={!loading}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={loading}>
            <Ionicons name="send" size={24} color={themeColors.sendIcon} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const TypingIndicator = ({ typingDotColor }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createWaveAnimation = () => {
      // Wave animation that flows through all dots
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            // First wave - dot 1 leads
            Animated.sequence([
              Animated.timing(dot1, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(dot1, {
                toValue: 0,
                duration: 400,
                easing: Easing.in(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            
            // Second wave - dot 2 follows with slight delay
            Animated.sequence([
              Animated.delay(100),
              Animated.timing(dot2, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(dot2, {
                toValue: 0,
                duration: 400,
                easing: Easing.in(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            
            // Third wave - dot 3 follows last
            Animated.sequence([
              Animated.delay(200),
              Animated.timing(dot3, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(dot3, {
                toValue: 0,
                duration: 400,
                easing: Easing.in(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
          ]),
          
          // Small pause before next wave
          Animated.delay(200),
        ])
      ).start();

      // Background wave effect
      Animated.loop(
        Animated.timing(waveAnimation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        })
      ).start();
    };

    createWaveAnimation();
  }, []);

  return (
    <View style={styles.typingContainer}>
      {/* Background wave effect */}
      <Animated.View 
        style={[
          styles.waveBackground,
          {
            opacity: waveAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.3, 0.1],
            }),
            transform: [
              {
                scaleX: waveAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.2],
                }),
              },
            ],
          }
        ]}
      />
      
      {/* Animated dots with wave effect */}
      <Animated.Text 
        style={[
          styles.typingDot, 
          { 
            color: typingDotColor,
            opacity: dot1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
            transform: [
              {
                scale: dot1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1.4],
                }),
              },
              {
                translateY: dot1.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -8, 0],
                }),
              },
              {
                rotate: dot1.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '15deg'],
                }),
              },
            ],
          }
        ]}
      >
        •
      </Animated.Text>
      
      <Animated.Text 
        style={[
          styles.typingDot, 
          { 
            color: typingDotColor,
            opacity: dot2.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
            transform: [
              {
                scale: dot2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1.4],
                }),
              },
              {
                translateY: dot2.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -8, 0],
                }),
              },
              {
                rotate: dot2.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-15deg'],
                }),
              },
            ],
          }
        ]}
      >
        •
      </Animated.Text>
      
      <Animated.Text 
        style={[
          styles.typingDot, 
          { 
            color: typingDotColor,
            opacity: dot3.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
            transform: [
              {
                scale: dot3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1.4],
                }),
              },
              {
                translateY: dot3.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -8, 0],
                }),
              },
              {
                rotate: dot3.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '15deg'],
                }),
              },
            ],
          }
        ]}
      >
        •
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", marginLeft: 8 },
  chatArea: { padding: 12 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 4 },
  profilePic: { width: 36, height: 36, borderRadius: 18, marginHorizontal: 6 },
  message: { padding: 12, borderRadius: 20, maxWidth: "75%" },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 12,
    elevation: 2,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 6, paddingHorizontal: 10 },
  sendBtn: { padding: 8, borderRadius: 50, justifyContent: "center", alignItems: "center" },
  typingContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  typingDot: { 
    fontSize: 13, 
    marginHorizontal: 2,
    fontWeight: 'bold',
  },
  waveBackground: {
    position: 'absolute',
    width: 60,
    height: 10,
    backgroundColor: 'rgba(52, 122, 66, 0.1)',
    borderRadius: 10,
    top: '50%',
    left: '50%',
    marginLeft: -30,
    marginTop: -10,
  },
});
