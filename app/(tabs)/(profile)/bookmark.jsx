import { db } from "@/api/config/firebase.config";
import SearchBar from "@/components/inputs/searchbar/SearchBar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
} from "firebase/firestore";
import {
  Bookmark as BookmarkIcon,
  ChevronLeft,
  Heart,
  MessageCircle,
  SlidersHorizontal,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const Bookmark = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);
  const [userLikes, setUserLikes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const bookmarksRef = collection(db, "users", user.uid, "bookmarks");
    const unsub = onSnapshot(bookmarksRef, async (snapshot) => {
      const items = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const forumRef = doc(db, "forums", data.forumId);
          const forumDoc = await getDoc(forumRef);
          if (forumDoc.exists()) {
            const forumData = forumDoc.data();

            const likesQuery = query(
              collection(db, "forums", forumDoc.id, "likes")
            );
            const likesSnap = await getDocs(likesQuery);

            const commentsQuery = query(
              collection(db, "forums", forumDoc.id, "comments")
            );
            const commentsSnap = await getDocs(commentsQuery);

            // Check if user liked this post
            const userLikeRef = doc(
              db,
              "forums",
              forumDoc.id,
              "likes",
              user.uid
            );
            const userLikeSnap = await getDoc(userLikeRef);
            if (userLikeSnap.exists()) {
              setUserLikes((prev) => ({ ...prev, [forumDoc.id]: true }));
            }

            return {
              id: forumDoc.id,
              ...forumData,
              likesCount: likesSnap.size,
              commentsCount: commentsSnap.size,
            };
          }
          return null;
        })
      );
      const validItems = items.filter(Boolean);
      setBookmarks(validItems);
      setFilteredBookmarks(validItems);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const filtered = bookmarks.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.content &&
          item.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredBookmarks(filtered);
  }, [searchQuery, bookmarks]);

  const formatTimeAgo = (date) => {
    if (!date) return "";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F0FDF4]">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-5 pb-3 mt-6">
        <Image
          source={require("@/assets/images/ariba-logo.png")}
          style={{ width: 50, height: 50 }}
          resizeMode="contain"
        />
        <View className="w-40">
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
          />
        </View>
      </View>

      {/* White container for title and list */}
      <View className="bg-white rounded-t-3xl shadow-lg mt-4 flex-1 mx-3">
        {/* Title Header */}
        <View className="p-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center p-2 -ml-2"
          >
            <ChevronLeft size={20} color="black" />
            <Text className="text-xs font-bold">BACK</Text>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-3xl font-bold">BOOKMARK</Text>
            <TouchableOpacity className="border border-gray-300 rounded-lg p-2">
              <SlidersHorizontal size={24} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            renderItem={({ item }) => {
              const liked = userLikes[item.id] || false;
              return (
                <Card className="p-4 mb-4 rounded-xl border border-gray-300 bg-white shadow-md">
                  <TouchableOpacity
                    onPress={() => router.push(`/(tabs)/(index)/${item.id}`)}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-3">
                        <View className="flex-row items-center mb-2">
                          <Text
                            className="text-lg font-bold flex-1"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.title}
                          </Text>
                          <Text className="mx-2 text-gray-400">•</Text>
                          <Text className="text-xs text-gray-500 shrink-0">
                            {formatTimeAgo(item.timestamp?.toDate())}
                          </Text>
                        </View>
                        <Text className="text-gray-700 mb-1" numberOfLines={3}>
                          {item.content}
                        </Text>
                      </View>
                      <BookmarkIcon size={24} color="#4CAF50" fill="#4CAF50" />
                    </View>
                  </TouchableOpacity>

                  <View className="flex-row items-center mt-3">
                    <View className="flex-row items-center mr-6">
                      <Heart
                        size={18}
                        color={liked ? "red" : "black"}
                        fill={liked ? "red" : "transparent"}
                      />
                      <Text className="ml-1 text-gray-700">
                        {item.likesCount || 0} Likes
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <MessageCircle size={18} color="black" />
                      <Text className="ml-1 text-gray-700">
                        {item.commentsCount || 0} Comments
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            }}
            ListEmptyComponent={() => (
              <View className="flex-1 justify-center items-center mt-20 px-6">
                <Image
                  source={require('@/assets/images/bookmarks-bg.png')}
                  style={{ width: 260, height: 260, resizeMode: 'contain' }}
                />

                <Text className="text-gray-400 -mt-8 text-sm">sure is empty here...</Text>

                <Text className="text-center mt-6 text-base text-black px-3">
                  Visit <Text className="font-bold">Forums</Text> and <Text className="font-bold">BookMark</Text> discussion that interest you
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default Bookmark;
