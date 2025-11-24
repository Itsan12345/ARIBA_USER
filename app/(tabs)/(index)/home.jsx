import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

// UI Components
import SearchBar from "@/components/inputs/searchbar/SearchBar";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

// Firebase
import { db } from "@/api/config/firebase.config";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// Context
import { useAuth } from "@/context/AuthContext";

// Icons
import { Heart, MessageCircle, MoreVertical, Plus } from "lucide-react-native";

const ForumsScreen = () => {
  const { user, userDoc } = useAuth();
  const router = useRouter();

  // States
  const [modalVisible, setModalVisible] = useState(false);
  const [discussions, setDiscussions] = useState([]);
  const [newDiscussion, setNewDiscussion] = useState({ title: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("newest");
  const [sortOrder, setSortOrder] = useState("desc");
  const [userLikes, setUserLikes] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDiscussions, setFilteredDiscussions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [likingPosts, setLikingPosts] = useState(new Set());
  const [likeAnimations, setLikeAnimations] = useState({});
  const [commentAnimations, setCommentAnimations] = useState({});
  const [menuOpenId, setMenuOpenId] = useState(null);
  // Cache for author profiles (firstName, lastName, photo, isAdmin, etc.)
  const [authors, setAuthors] = useState({});
  const [expandedPosts, setExpandedPosts] = useState(new Set());
  const skipNavigation = useRef(false);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Load cached likes
  useEffect(() => {
    const loadCachedLikes = async () => {
      try {
        const cached = await AsyncStorage.getItem(`userLikes_${user?.uid}`);
        if (cached) setUserLikes(JSON.parse(cached));
      } catch (e) {
        console.error("Error loading cached likes:", e);
      }
    };
    if (user) loadCachedLikes();
  }, [user]);

  // Initialize animation values for new discussions
  useEffect(() => {
    const newLikeAnimations = {};
    const newCommentAnimations = {};
    discussions.forEach(discussion => {
      if (!likeAnimations[discussion.id]) {
        newLikeAnimations[discussion.id] = new Animated.Value(1);
      }
      if (!commentAnimations[discussion.id]) {
        newCommentAnimations[discussion.id] = new Animated.Value(1);
      }
    });
    if (Object.keys(newLikeAnimations).length > 0) {
      setLikeAnimations(prev => ({ ...prev, ...newLikeAnimations }));
    }
    if (Object.keys(newCommentAnimations).length > 0) {
      setCommentAnimations(prev => ({ ...prev, ...newCommentAnimations }));
    }
  }, [discussions]);

  // Fetch missing author profiles for discussions (from `users` collection)
  useEffect(() => {
    const fetchMissingAuthors = async () => {
      try {
        const idsToFetch = Array.from(
          new Set(
            discussions
              .map((d) => d.authorId)
              .filter((id) => id && !authors[id])
          )
        );

        if (idsToFetch.length === 0) return;

        const fetched = {};
        await Promise.all(
          idsToFetch.map(async (id) => {
            try {
              const userDocRef = doc(db, "users", id);
              const snap = await getDoc(userDocRef);
              if (snap.exists()) {
                const data = snap.data();
                fetched[id] = {
                  firstName: data.firstName || data.first_name || null,
                  lastName: data.lastName || data.last_name || null,
                  photo: data.photoURL || data.photo || data.avatar || null,
                  isAdmin: !!(data.isAdmin || data.role === "admin" || data.role === "Admin"),
                  displayName: data.displayName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || null,
                };
              }
            } catch (e) {
              // ignore individual fetch errors
              console.error("Error fetching author:", id, e);
            }
          })
        );

        if (Object.keys(fetched).length > 0) {
          setAuthors((prev) => ({ ...prev, ...fetched }));
        }
      } catch (e) {
        console.error("Error fetching authors:", e);
      }
    };

    fetchMissingAuthors();
    // only re-run when discussions change; authors is intentionally omitted to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussions]);

  const saveLikesToCache = async (likes) => {
    try {
      await AsyncStorage.setItem(`userLikes_${user?.uid}`, JSON.stringify(likes));
    } catch (e) {
      console.error("Error saving likes:", e);
    }
  };

  // Realtime discussions
  useEffect(() => {
    const q = collection(db, "forums");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setDiscussions(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Listen for user likes
  useEffect(() => {
    if (!user) return;
    const likesRef = collection(db, "userLikes", user.uid, "forums");
    const unsubscribe = onSnapshot(likesRef, (snapshot) => {
      const likedPosts = {};
      snapshot.forEach((docSnap) => {
        likedPosts[docSnap.id] = true;
      });
      setUserLikes(likedPosts);
      saveLikesToCache(likedPosts);
    });
    return () => unsubscribe();
  }, [user]);

  // Compute filtered + sorted discussions
  useEffect(() => {
    const computeFiltered = () => {
      let list = Array.isArray(discussions) ? [...discussions] : [];
      const q = (searchQuery || "").trim().toLowerCase();

      if (q.length > 0) {
        list = list.filter((item) => {
          const title = (item.title || "").toString().toLowerCase();
          const content = (item.content || "").toString().toLowerCase();
          return title.includes(q) || content.includes(q);
        });
      }

      if (filter === "newest") {
        list.sort((a, b) => {
          const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
          const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
          return tb - ta;
        });
      } else if (filter === "ongoing") {
        list.sort((a, b) => (b.commentsCount || 0) - (a.commentsCount || 0));
      }

      if (sortOrder === "asc") list.reverse();
      return list;
    };

    setFilteredDiscussions(computeFiltered());
  }, [discussions, searchQuery, filter, sortOrder]);

  // Save discussion
  const saveDiscussion = async () => {
    if (!newDiscussion.title?.trim() || !newDiscussion.description?.trim() || isSaving) return;

    setIsSaving(true);

    try {
      if (editingId) {
        await updateDoc(doc(db, "forums", editingId), {
          title: newDiscussion.title,
          content: newDiscussion.description,
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "forums"), {
          title: newDiscussion.title,
          content: newDiscussion.description,
          likesCount: 0,
          commentsCount: 0,
          // Use Firestore-stored first/last name when available, fall back to displayName or Anonymous
          authorName: (userDoc?.firstName || userDoc?.lastName) ? `${userDoc?.firstName || ''} ${userDoc?.lastName || ''}`.trim() : (user?.displayName || 'Anonymous'),
          authorPhoto: user?.photoURL || "https://i.pravatar.cc/100",
          authorId: user?.uid,
          timestamp: serverTimestamp(),
        });
      }

      setNewDiscussion({ title: "", description: "" });
      setModalVisible(false);
    } catch (error) {
      console.error("Error saving discussion:", error);
      // Optionally, show an error message to the user
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDiscussion = async (forumId) => {
    await deleteDoc(doc(db, "forums", forumId));
  };

  const formatTimeAgo = (date, now = new Date()) => {
    if (!date) return "...";
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 5) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const toggleLike = async (forum) => {
    if (!user) return;
    
    // Prevent spam clicking - check if this post is already being processed
    if (likingPosts.has(forum.id)) return;
    
    // Trigger animation
    const animationValue = likeAnimations[forum.id];
    if (animationValue) {
      Animated.sequence([
        Animated.timing(animationValue, {
          toValue: 1.2,
          duration: 100,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(animationValue, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.elastic(1)),
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    // Add this post to the processing set
    setLikingPosts(prev => new Set([...prev, forum.id]));
    
    try {
      const forumRef = doc(db, "forums", forum.id);
      const likeRef = doc(db, "forums", forum.id, "likes", user.uid);
      const userLikeRef = doc(db, "userLikes", user.uid, "forums", forum.id);

      const likeDoc = await getDoc(likeRef);
      const updatedLikes = { ...userLikes };

      if (likeDoc.exists()) {
        await deleteDoc(likeRef);
        await deleteDoc(userLikeRef);
        await updateDoc(forumRef, { likesCount: increment(-1) });
        delete updatedLikes[forum.id];
      } else {
        await setDoc(likeRef, { userId: user.uid });
        await setDoc(userLikeRef, { forumId: forum.id });
        await updateDoc(forumRef, { likesCount: increment(1) });
        updatedLikes[forum.id] = true;
      }

      setUserLikes(updatedLikes);
      saveLikesToCache(updatedLikes);
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      // Remove this post from the processing set
      setLikingPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(forum.id);
        return newSet;
      });
    }
  };

  const animateComment = (forumId) => {
    const animationValue = commentAnimations[forumId];
    if (animationValue) {
      Animated.sequence([
        Animated.timing(animationValue, {
          toValue: 1.2,
          duration: 100,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(animationValue, {
          toValue: 1,
          duration: 100,
          easing: Easing.out(Easing.elastic(1)),
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const [fontsLoaded] = useFonts({
    Pacifico: require("../../../assets/fonts/Pacifico-Regular.ttf"),
    SpaceMono: require("../../../assets/fonts/SpaceMono-Regular.ttf"),
    Roboto: require("../../../assets/fonts/Roboto-Bold.ttf"),
    Poppins: require("../../../assets/fonts/Poppins-Bold.ttf"),
    DM: require("../../../assets/fonts/DMSans-Regular.ttf"),
    DMBold: require("../../../assets/fonts/DMSans-Bold.ttf"),
  });

  if (!fontsLoaded) return null;

  // ===== MOBILE VERSION ONLY =====
  return (
    <SafeAreaView className="flex-1 bg-[#D9E9DD] px-3">
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <Box className="flex-row items-center justify-between mt-2 ">
        <Box className="flex-row items-center">
          <Image
            source={require("@/assets/images/ariba-logo.png")}
            style={{ width: 80, height: 80, marginRight: 2, marginBottom: 12 }}
            resizeMode="contain"
          />
          
        </Box>
        <Box className="w-[140px] h-11 mt-6">
          <SearchBar
            value={searchQuery}
            onChangeText={(text) => setSearchQuery(text)}
            placeholder="Search"
            className="w-[140px]"
          />
        </Box>
      </Box>

      {/* FORUMS HEADER */}
      <Box className="bg-white rounded-2xl p-4 shadow-sm">
        <Box className="flex-row items-center justify-between mb-4">
          <Box>
            <Text size="4xl" className="text-black font-[Poppins] mb-1">
              FORUMS
            </Text>
            <Text className="text-black font-[DM]">{discussions.length} Discussions</Text>
          </Box>

          {/* Controls */}
          <Box className="flex-row items-center">
            <TouchableOpacity
              onPress={() => {
                setModalVisible(true);
                setEditingId(null);
                setNewDiscussion({ title: "", description: "" });
              }}
              className="bg-green-600 w-9 h-9 items-center justify-center rounded-md mr-1 mt-11"
            >
              <Plus size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter("newest")}
              className={`px-2 py-1 border border-green-600 rounded-l-md mt-11 font-[DM] ${
                filter === "newest" ? "bg-green-600" : "bg-white"
              }`}
            >
              <Text className={filter === "newest" ? "text-white" : "text-black font-[DM]"}>Newest</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter("ongoing")}
              className={`px-2 py-1 border border-green-600 rounded-r-md mt-11 font-[DM] ${
                filter === "ongoing" ? "bg-green-600" : "bg-white"
              }`}
            >
              <Text className={filter === "ongoing" ? "text-white" : "text-black font-[DM]"}>Ongoing</Text>
            </TouchableOpacity>
          </Box>
        </Box>

        {/* DISCUSSION LIST */}
        <FlatList
          data={filteredDiscussions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const liked = userLikes[item.id] || false;
            const isOwner = item.authorId === user?.uid;
            const likeAnimationValue = likeAnimations[item.id] || new Animated.Value(1);
            const commentAnimationValue = commentAnimations[item.id] || new Animated.Value(1);
            const author = (item.authorId && authors[item.authorId]) ? authors[item.authorId] : {};
            const authorPhoto = item.authorPhoto || author.photo || "https://i.pravatar.cc/100";
            const displayName = (author.firstName || author.lastName)
              ? `${author.firstName || ""} ${author.lastName || ""}`.trim()
              : (item.authorName || author.displayName || "Anonymous");
            const isAdminPoster = !!(item.isAdmin || author.isAdmin);
            return (
              <Card className="p-4 pr-6 mb-4 rounded-xl border border-green-600 bg-white" style={{ position: 'relative' }}>
                {/* Kebab menu - only visible to owner */}
                {isOwner && (
                  <View style={{ position: "absolute", top: 8, right: 8, zIndex: 20 }}>
                    <TouchableOpacity
                      onPress={() => setMenuOpenId(prev => (prev === item.id ? null : item.id))}
                      style={{
                        width: 16,
                        height: 26,
                        borderRadius: 18,
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
                      activeOpacity={0.8}
                    >
                      <MoreVertical size={20} color="#111827" />
                    </TouchableOpacity>

                    {menuOpenId === item.id && (
                      <View style={{ width: 70, position: 'absolute', top: 30, right: 0, backgroundColor: "white", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, shadowColor: "#000", shadowOpacity: 0.13, shadowRadius: 6, elevation: 6, zIndex: 999 }}>
                        <TouchableOpacity
                          onPress={() => {
                            // Edit: populate modal and open in edit mode
                            setNewDiscussion({ title: item.title || "", description: item.content || "" });
                            setEditingId(item.id);
                            setModalVisible(true);
                            setMenuOpenId(null);
                          }}
                          style={{ paddingVertical: 6 }}
                        >
                          <Text className="text-black font-[DM]">Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            // Delete with confirmation
                            Alert.alert(
                              "Delete discussion",
                              "Are you sure you want to delete this discussion? This action cannot be undone.",
                              [
                                { text: "Cancel", style: "cancel" },
                                { text: "Delete", style: "destructive", onPress: async () => { await deleteDiscussion(item.id); setMenuOpenId(null); } }
                              ]
                            );
                          }}
                          style={{ paddingVertical: 6 }}
                        >
                          <Text className="text-red-600 font-[DM]">Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                <TouchableOpacity activeOpacity={0.95} onPress={() => {
                  if (skipNavigation.current) {
                    // clear the flag and don't navigate (See more was tapped)
                    skipNavigation.current = false;
                    return;
                  }
                  router.push(`/(tabs)/(index)/${item.id}`);
                }}>
                  {/* Header: Avatar + Name */}
                  <View className="flex-row items-start mb-2">
                    <Image
                      source={{ uri: authorPhoto }}
                      style={{ width: 40, height: 40, borderRadius: 24, marginRight: 12 }}
                    />

                    <View style={{ flex: 1 }}>
                      <Text className="text-base text-black font-[DMBold]">{displayName}</Text>

                      <View className="flex-row items-center mt-1">
                        {isAdminPoster && (
                          <View className="bg-green-100 rounded-md px-2 py-0.5 mr-2">
                            <Text className="text-green-800 text-sm font-[DM]">Admin</Text>
                          </View>
                        )}
                        <Text className="text-xs text-gray-500 font-[DM]">{item.timestamp?.toDate ? formatTimeAgo(item.timestamp.toDate(), currentTime) : "..."}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Title (prominent, full width, left-aligned) */}
                  <View>
                    <Text className="text-2xl text-black font-[Poppins] mb-2">{item.title}</Text>

                    {/* Content preview: truncate with 'See more' if long (left-aligned) */}
                    {(() => {
                      const content = item.content || "";
                      const isExpanded = expandedPosts.has(item.id);
                      const shouldTruncate = content.length > 220;

                      if (isExpanded) {
                        return (
                          <Text className="text-black mb-3 font-[DM]">{content}</Text>
                        );
                      }

                      if (shouldTruncate) {
                        const preview = content.slice(0, 220).trim();
                        return (
                          <Text className="text-black mb-3 font-[DM]">
                            {preview}
                            <Text>... </Text>
                            <Text
                              className="text-green-600"
                              onPress={() => {
                                // mark to skip parent navigation and expand inline
                                skipNavigation.current = true;
                                setExpandedPosts(prev => new Set(prev).add(item.id));
                              }}
                            >
                              See more
                            </Text>
                          </Text>
                        );
                      }

                      return <Text className="text-black mb-3 font-[DM]">{content}</Text>;
                    })()}
                  </View>
                </TouchableOpacity>

                {/* Likes + Comments */}
                <Box className="flex-row items-center">
                  <TouchableOpacity 
                    onPress={() => toggleLike(item)} 
                    className="flex-row items-center mr-6"
                  >
                    <Animated.View style={{ transform: [{ scale: likeAnimationValue }] }}>
                      <Heart size={18} color={liked ? "red" : "black"} fill={liked ? "red" : "transparent"} />
                    </Animated.View>
                    <Text className="ml-1 text-gray-700">{item.likesCount || 0} Likes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => {
                      animateComment(item.id);
                      router.push(`/(tabs)/(index)/${item.id}`);
                    }} 
                    className="flex-row items-center"
                  >
                    <Animated.View style={{ transform: [{ scale: commentAnimationValue }] }}>
                      <MessageCircle size={18} />
                    </Animated.View>
                    <Text className="ml-1 text-gray-700">{item.commentsCount || 0} Comments</Text>
                  </TouchableOpacity>
                </Box>
              </Card>
            );
          }}
          contentContainerStyle={{ paddingBottom: 160 }}
        />

        {/* ADD DISCUSSION MODAL */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View className="flex-1 bg-black/40 justify-center items-center px-4">
            <View className="bg-white w-full rounded-2xl shadow-lg p-6">
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setEditingId(null);
                  setNewDiscussion({ title: "", description: "" });
                }}
              >
                <Text className="text-xs font-[Poppins] text-black mb-2">BACK</Text>
              </TouchableOpacity>

              <Text className="text-xl text-black font-[Poppins] text-center mb-2">START A DISCUSSION</Text>
              <View className="border-t border-gray-300 mb-4" />

              <Text className="font-[DMBold] text-black mb-2">Discussion Title</Text>
              <TextInput
                placeholder="Write your report title here."
                value={newDiscussion.title}
                onChangeText={(text) => setNewDiscussion((prev) => ({ ...prev, title: text }))}
                className="bg-gray-200 rounded-md px-4 py-3 mb-4 text-gray-800"
              />

              <Text className="font-[DMBold] text-black mb-2">Report Description</Text>
              <TextInput
                placeholder="Write your report description here."
                value={newDiscussion.description}
                onChangeText={(text) => setNewDiscussion((prev) => ({ ...prev, description: text }))}
                className="bg-gray-200 rounded-md px-4 py-3 text-gray-800 mb-6 h-32"
                multiline
                textAlignVertical="top"
              />

              <View className="flex-row justify-between mt-2">
                <TouchableOpacity
                  className="flex-1 bg-green-600 py-3 rounded-md mr-2 items-center"
                  onPress={saveDiscussion}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-[DMBold]">Confirm</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-red-600 py-3 rounded-md ml-2 items-center"
                  onPress={() => {
                    if (isSaving) return;
                    setModalVisible(false);
                    setEditingId(null);
                    setNewDiscussion({ title: "", description: "" });
                  }}
                  disabled={isSaving}
                >
                  <Text className="text-white font-[DMBold]">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Box>
    </SafeAreaView>
  );
};

export default ForumsScreen;
