import { db } from "@/api/config/firebase.config";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft, Bookmark, Heart, MessageCircle, MoreVertical, Share2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  Share,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

// ✅ Gluestack UI
import SearchBar from "@/components/inputs/searchbar/SearchBar";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Reply } from "lucide-react-native";


// ⏱️ Helper: format timestamp into relative time
const timeAgo = (date, now) => {
  if (!date) return "..."
  const seconds = Math.floor((now - date) / 1000)

  // ✅ Show "Just now" for anything less than 60s
  if (seconds < 60) return "Just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

const ForumDetails = () => {
  // Add reply to a comment
  const addReply = async (parentId, replyToId = null) => {
    if (!replyText[parentId]?.trim()) return;
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.exists() ? userDoc.data() : {}
    const authorName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user?.displayName || "Unknown"
    // Only allow replies to comments, not to replies
    const collectionRef = collection(db, "forums", id, "comments", parentId, "replies");
    await addDoc(collectionRef, {
      content: replyText[parentId],
      authorName,
      authorPhoto: user?.photoURL,
      authorId: user?.uid,
      likesCount: 0,
      timestamp: serverTimestamp(),
    });
    // Check if parent comment exists before updating
    const commentRef = doc(db, "forums", id, "comments", parentId);
    const commentSnap = await getDoc(commentRef);
    if (commentSnap.exists()) {
      await updateDoc(commentRef, { repliesCount: increment(1) });
    }
    setReplyText((prev) => ({ ...prev, [parentId]: "" }));
    setReplyVisible((prev) => ({ ...prev, [parentId]: false }));
  };

  const { id } = useLocalSearchParams()
  const { user } = useAuth()
  const router = useRouter()

  const [forum, setForum] = useState(null)
  const [allComments, setAllComments] = useState([])
  const [commentMap, setCommentMap] = useState({})
  const [authors, setAuthors] = useState({})
  const [newComment, setNewComment] = useState("")
  const [replyText, setReplyText] = useState({})
  const [replyVisible, setReplyVisible] = useState({})
  const [editingComment, setEditingComment] = useState(null)
  const [editingReply, setEditingReply] = useState(null)
  const [editText, setEditText] = useState("")
  const [editReplyText, setEditReplyText] = useState({})
  const [menuVisible, setMenuVisible] = useState(null)
  const [replyMenuVisible, setReplyMenuVisible] = useState({})
  const [userLikes, setUserLikes] = useState({})
  const [commentLikes, setCommentLikes] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const [now, setNow] = useState(new Date())
  const [bookmarked, setBookmarked] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [likingItems, setLikingItems] = useState(new Set())

// Comment filter state
const [commentFilter, setCommentFilter] = useState("Newest") // "Newest" | "Oldest"
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    const bookmarkRef = doc(db, "users", user.uid, "bookmarks", id)
    const unsub = onSnapshot(bookmarkRef, snap => {
      setBookmarked(snap.exists())
    })
    return () => unsub()
  }, [id, user])

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleBookmark = async () => {
    if (!user) return Alert.alert("You need to be logged in to bookmark this forum")

    const bookmarkRef = doc(db, "users", user.uid, "bookmarks", id)
    try {
      const docSnap = await getDoc(bookmarkRef)
      if (docSnap.exists()) {
        await deleteDoc(bookmarkRef)
        setBookmarked(false)
      } else {
        await setDoc(bookmarkRef, {
          forumId: id,
          title: forum.title,
          timestamp: serverTimestamp()
        })
        setBookmarked(true)
      }
    } catch (err) {
      console.error("Error updating bookmark:", err)
      Alert.alert("Error", "Could not update bookmark. Please try again.")
    }
  }

  const shareForum = async () => {
    try {
      // We'll include a dynamic post link (forum id). You asked for dynamic links earlier.
      const forumLink = `https://yourapp.example.com/forum/${id}` // replace domain with your live domain or dynamic link
      await Share.share({
        message: `Check out this discussion: ${forum.title}\n\n${forum.content}\n\n${forumLink}`,
        title: forum.title,
      })
    } catch (error) {
      console.error("Error sharing forum:", error)
      Alert.alert("Error", "Could not share forum. Please try again.")
    }
  }

  const [fontsLoaded] = useFonts({
      Pacifico: require("../../../assets/fonts/Pacifico-Regular.ttf"),
      SpaceMono: require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      Roboto: require("../../../assets/fonts/Roboto-Bold.ttf"),
      Poppins: require("../../../assets/fonts/Poppins-Bold.ttf"),
      DM: require("../../../assets/fonts/DMSans-Regular.ttf"),
      DMBold: require("../../../assets/fonts/DMSans-Bold.ttf"),
    });
  
    if (!fontsLoaded) return null;

  // --- Local Storage Helpers ---
  const loadLikesFromStorage = async () => {
    try {
      const forumLikes = await AsyncStorage.getItem("forumLikes")
      const commentLikesStorage = await AsyncStorage.getItem("commentLikes")
      if (forumLikes) setUserLikes(JSON.parse(forumLikes))
      if (commentLikesStorage) setCommentLikes(JSON.parse(commentLikesStorage))
    } catch (err) {
      console.error("Error loading likes from storage", err)
    }
  }

  const saveLikesToStorage = async (key, data) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(data)) }
    catch (err) { console.error("Error saving likes to storage", err) }
  }

  useEffect(() => { loadLikesFromStorage() }, [])

  // --- Load forum ---
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "forums", id), async (docSnap) => {
      if (docSnap.exists()) {
        const forumData = { id: docSnap.id, ...docSnap.data() }
        if (forumData.authorId) {
          const userDoc = await getDoc(doc(db, "users", forumData.authorId))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            forumData.authorName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "Unknown User"
            // include author photo and admin flag when available
            forumData.authorPhoto = userData.photoURL || userData.photo || userData.avatar || forumData.authorPhoto || null
            forumData.authorIsAdmin = !!(userData.isAdmin || userData.role === "admin" || userData.role === "Admin")
          }
        }
        setForum(forumData)
      }
    })
    return () => unsub()
  }, [id])

  // --- Load top-level comments ---
  useEffect(() => {
    const q = query(collection(db, "forums", id, "comments"), orderBy("timestamp", "asc"))
    const unsub = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map((d) => {
        const data = d.data() || {}
        return {
          ...data,
          id: d.id,
          parentId: null,
          // normalize field: prefer content, fall back to text
          content: data.content ?? data.text ?? "",
        }
      })
      setAllComments(comments)
    })
    return () => unsub()
  }, [id])

  // --- Load nested replies dynamically ---
  useEffect(() => {
    const map = {}
    const unsubscribers = []

    const attachRepliesListener = (parentId) => {
      const q = query(collection(db, "forums", id, "comments", parentId, "replies"), orderBy("timestamp", "asc"))
      const unsub = onSnapshot(q, (snapshot) => {
        const replies = snapshot.docs.map((d) => {
          const data = d.data() || {}
          return {
            ...data,
            id: d.id,
            parentId,
            content: data.content ?? data.text ?? "",
          }
        })
        map[parentId] = replies
        setCommentMap({ ...map })

        replies.forEach((r) => {
          if (!map[r.id]) attachRepliesListener(r.id)
        })
      })
      unsubscribers.push(unsub)
    }

    allComments.forEach((c) => attachRepliesListener(c.id))
    return () => unsubscribers.forEach((u) => u())
  }, [allComments, id])

  // --- Fetch author profiles for comments/replies (to detect admin and photo) ---
  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        const ids = new Set();
        allComments.forEach(c => { if (c.authorId) ids.add(c.authorId) })
        Object.values(commentMap).forEach(arr => arr.forEach(r => { if (r.authorId) ids.add(r.authorId) }))

        const idsToFetch = Array.from(ids).filter(id => id && !authors[id])
        if (idsToFetch.length === 0) return

        const fetched = {}
        await Promise.all(idsToFetch.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid))
            if (snap.exists()) {
              const d = snap.data()
              fetched[uid] = {
                firstName: d.firstName || d.first_name || null,
                lastName: d.lastName || d.last_name || null,
                displayName: d.displayName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || null,
                photo: d.photoURL || d.photo || d.avatar || null,
                isAdmin: !!(d.isAdmin || d.role === 'admin' || d.role === 'Admin')
              }
            }
          } catch (e) {
            console.error('Error fetching author profile', uid, e)
          }
        }))

        if (Object.keys(fetched).length) setAuthors(prev => ({ ...prev, ...fetched }))
      } catch (e) {
        console.error('Error in fetchAuthors', e)
      }
    }

    fetchAuthors()
  }, [allComments, commentMap])

  // --- Likes Tracking ---
  useEffect(() => {
    if (!user) return
    const forumLikeRef = doc(db, "forums", id, "likes", user.uid)
    const unsub = onSnapshot(forumLikeRef, snap => {
      setUserLikes(prev => { const updated = { ...prev, [id]: snap.exists() }; saveLikesToStorage("forumLikes", updated); return updated })
    })
    return () => unsub()
  }, [id, user])

  useEffect(() => {
    if (!user) return
    const unsubs = []

    // Function to get all items (comments and replies)
    const getAllItems = () => {
      const items = [...allComments]
      Object.values(commentMap).forEach(replies => {
        items.push(...replies)
      })
      return items
    }

    const allItems = getAllItems()
    allItems.forEach((item) => {
      let path = ["comments", item.id]
      if (item.parentId) path = ["comments", item.parentId, "replies", item.id]
      const likeRef = doc(db, "forums", id, ...path, "likes", user.uid)
      const unsub = onSnapshot(likeRef, snap => {
        setCommentLikes(prev => { const updated = { ...prev, [item.id]: snap.exists() }; saveLikesToStorage("commentLikes", updated); return updated })
      })
      unsubs.push(unsub)
    })
    return () => unsubs.forEach(u => u())
  }, [allComments, commentMap, id, user])

  // --- Add comment ---
  const addComment = async () => {
    if (!newComment.trim()) return
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.exists() ? userDoc.data() : {}
    const authorName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user?.displayName || "Unknown"
    await addDoc(collection(db, "forums", id, "comments"), {
      content: newComment,
      authorName,
      authorPhoto: user?.photoURL,
      authorId: user?.uid,
      likesCount: 0,
      timestamp: serverTimestamp(),
    })
    await updateDoc(doc(db, "forums", id), { commentsCount: increment(1) })
    setNewComment("")
  }

  // --- Toggle forum like ---
  const toggleForumLike = async () => {
    if (!user) return
    const forumRef = doc(db, "forums", id)
    const likeRef = doc(db, "forums", id, "likes", user.uid)
    const likeDoc = await getDoc(likeRef)
    if (likeDoc.exists()) {
      await deleteDoc(likeRef)
      await updateDoc(forumRef, { likesCount: increment(-1) })
    } else {
      await setDoc(likeRef, { userId: user.uid })
      await updateDoc(forumRef, { likesCount: increment(1) })
    }
  }

  // --- Toggle comment/reply like (optimistic update) ---
  const toggleCommentLike = async (item) => {
    if (!user || likingItems.has(item.id)) return

    const itemId = item.id
    const currentlyLiked = commentLikes[itemId] || false

    // Add to liking set
    setLikingItems(prev => new Set(prev).add(itemId))

    // --- Optimistic UI update ---
    setCommentLikes(prev => {
      const updated = { ...prev, [itemId]: !currentlyLiked }
      saveLikesToStorage("commentLikes", updated)
      return updated
    })

    let path = ["comments", itemId]
    if (item.parentId) path = ["comments", item.parentId, "replies", itemId]

    const itemRef = doc(db, "forums", id, ...path)
    const likeRef = doc(db, "forums", id, ...path, "likes", user.uid)

    try {
      const likeDoc = await getDoc(likeRef)
      if (likeDoc.exists()) {
        await deleteDoc(likeRef)
        await updateDoc(itemRef, { likesCount: increment(-1) })
      } else {
        await setDoc(likeRef, { userId: user.uid })
        await updateDoc(itemRef, { likesCount: increment(1) })
      }
    } catch (err) {
      console.error("Error updating like:", err)
      // Revert UI if there is an error
      setCommentLikes(prev => ({ ...prev, [itemId]: currentlyLiked }))
    } finally {
      // Remove from liking set
      setLikingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  // --- Add nested reply ---
  const addNestedReply = async (parentId) => {
    if (!replyText[parentId]?.trim()) return
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.exists() ? userDoc.data() : {}
    const authorName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user?.displayName || "Unknown"
    await addDoc(collection(db, "forums", id, "comments", parentId, "replies"), {
      content: replyText[parentId],
      authorName,
      authorPhoto: user?.photoURL,
      authorId: user?.uid,
      likesCount: 0,
      timestamp: serverTimestamp(),
    })
    setReplyText(prev => ({ ...prev, [parentId]: "" }))
    setReplyVisible(prev => ({ ...prev, [parentId]: false }))
  }

  // --- Delete comment/reply ---
  const deleteItem = async (item) => {
    const path = item.parentId ? ["comments", item.parentId, "replies", item.id] : ["comments", item.id]
    await deleteDoc(doc(db, "forums", id, ...path))
  }

  // --- Save edited comment/reply ---
  const saveEditItem = async (item) => {
    const path = item.parentId ? ["comments", item.parentId, "replies", item.id] : ["comments", item.id]
    const newContent = item.parentId ? editReplyText[item.id] : editText
    if (!newContent?.trim()) return
    await updateDoc(doc(db, "forums", id, ...path), { content: newContent })
    if (item.parentId) setEditingReply(null)
    else setEditingComment(null)
  }

  // --- Recursive render function ---
  const renderCommentThread = (item, level = 0, parentAuthor = null) => {
    const children = commentMap[item.id] || []
    const isOwner = item.authorId === user?.uid
    const isEditing = item.parentId ? editingReply?.[item.id] : editingComment === item.id
    const displayLevel = Math.min(level, 1); // Cap visual level at 1

    return (
      <View key={item.id} style={{ flexDirection: "row", marginBottom: 8 }}>
        {/* Connector line */}
        <View style={{ width: 1 * displayLevel, alignItems: "center" }}>
          {displayLevel > 0 && <View style={{ width: 1, backgroundColor: "#ccc", flex: 1 }} />}
        </View>

        {/* Comment / Reply Card */}
        <Card className="p-3 mb-3 bg-white rounded-xl flex-1">
          {/* Header: Avatar, Name, Timestamp */}
              <Box className="flex-row justify-between items-start mb-1">
            <Box className="flex-row items-center">
              <Image
                source={{ uri: item.authorPhoto || authors[item.authorId]?.photo || "https://www.shutterstock.com/image-vector/blank-avatar-photo-place-holder-600nw-1095249842.jpg" }}
                style={{ width: 30, height: 30, borderRadius: 15, marginRight: 6 }}
              />
              <Text bold>{item.authorName}</Text>
              {/* show Admin pill for comments/replies authored by admin */}
              { (authors[item.authorId]?.isAdmin || item.isAdmin) && (
                <View style={{ marginLeft: 8, backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: '#166534', fontSize: 11, fontFamily: 'DMSans-Regular' }}>Admin</Text>
                </View>
              )}
              <Text className="mx-2 text-gray-400">•</Text>
              <Text className="text-gray-400 text-xs font-[DM]">
                {item.timestamp?.toDate ? timeAgo(item.timestamp.toDate(), now) : "..."}
              </Text>
            </Box>

            {/* Menu for Owner */}
            {isOwner && (
              <TouchableOpacity
                onPress={() =>
                  setMenuVisible(prev => ({ ...(prev || {}), [item.id]: !prev?.[item.id] }))
                }
              >
                <MoreVertical size={18} color="#555" />
              </TouchableOpacity>
            )}
          </Box>

          {/* Dropdown menu */}
          {menuVisible?.[item.id] && (
            <Box className="absolute top-8 right-3 bg-white shadow-md rounded-md z-10 font-[DM]">
              <TouchableOpacity
                className="px-4 py-2 font-[DM]"
                onPress={() => {
                  if (item.parentId) setEditingReply(prev => ({ ...prev, [item.id]: true }))
                  else setEditingComment(item.id)
                  setMenuVisible(prev => ({ ...(prev || {}), [item.id]: false }))
                }}
              >
                <Text>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-4 py-2 font-[DM]"
                onPress={() => deleteItem(item)}
              >
                <Text>Delete</Text>
              </TouchableOpacity>
            </Box>
          )}

          {/* Replying to */}
          {parentAuthor && (
            <Box className="flex-row items-center mb-1">
              <Reply size={14} color="#555" />
              <Text className="ml-1 text-sm text-gray-600 font-[DM]">
                Replying to @{parentAuthor}
              </Text>
            </Box>
          )}

          {/* Content */}
          {isEditing ? (
            <TextInput
              value={item.parentId ? editReplyText[item.id] : editText}
              onChangeText={text =>
                item.parentId
                  ? setEditReplyText(prev => ({ ...prev, [item.id]: text }))
                  : setEditText(text)
              }
              className="border border-gray-300 rounded-md p-2 mb-2"
            />
          ) : (
            <Text className="mb-2 font-[DM] text-black">{item.content}</Text>
          )}

          {/* Edit / Save buttons */}
          {isEditing && (
            <Box className="flex-row space-x-2 mb-2">
              <Button
                className="bg-green-600 px-3"
                onPress={() => saveEditItem(item)}
              >
                <Text className="text-white">Save</Text>
              </Button>
              <Button
                className="bg-gray-300 px-3"
                onPress={() => {
                  if (item.parentId)
                    setEditingReply(prev => ({ ...prev, [item.id]: false }))
                  else setEditingComment(null)
                }}
              >
                <Text>Cancel</Text>
              </Button>
            </Box>
          )}

          {/* Actions: Like / Reply */}
          <Box className="flex-row items-center mt-1">
            <TouchableOpacity
              onPress={() => toggleCommentLike(item)}
              disabled={likingItems.has(item.id)}
              className="flex-row items-center mr-4"
            >
              <Heart
                size={14}
                color={commentLikes[item.id] ? "red" : "black"}
                fill={commentLikes[item.id] ? "red" : "transparent"}
              />
              <Text className="ml-1 text-sm">{item.likesCount || 0} Likes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                setReplyVisible(prev => ({ ...(prev || {}), [item.id]: !prev?.[item.id] }))
              }
              className="flex-row items-center"
            >
              <Reply size={14} color="#555" />
              <Text className="ml-1 text-sm text-gray-600">
                {replyVisible[item.id] ? "Cancel" : "Reply"}
              </Text>
            </TouchableOpacity>
          </Box>

          {/* Reply input */}
          {replyVisible[item.id] && (
            <Box className="mb-2 mt-2">
              <TextInput
                placeholder="Write a reply..."
                value={replyText[item.id] || ""}
                onChangeText={text =>
                  setReplyText(prev => ({ ...prev, [item.id]: text }))
                }
                className="border border-gray-300 rounded-md p-2 mb-2"
                returnKeyType="send"
                blurOnSubmit={true}
                multiline
                textAlignVertical="top"
                onSubmitEditing={() => {
                  // If item is a nested reply (has parentId) we add a nested reply under this item
                  // otherwise, add a reply to the top-level comment
                  if (item?.parentId) {
                    addNestedReply(item.id)
                  } else {
                    addReply(item.id)
                  }
                }}
              />
              
            </Box>
          )}

          {/* Recursive children */}
          {children.map(child =>
            renderCommentThread(child, level + 1, item.authorName)
          )}
        </Card>
      </View>
    )
  }

  if (!forum) return null

  // build filtered list once, then sort according to selected filter
const baseFilteredComments = allComments.filter(c =>
  (c.content && c.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
  (c.authorName && c.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
)

const tsToMillis = (t) => (t && t.toDate ? t.toDate().getTime() : 0)

let filteredComments = [...baseFilteredComments]
if (commentFilter === "Newest") {
  filteredComments.sort((a, b) => tsToMillis(b.timestamp) - tsToMillis(a.timestamp))
} else if (commentFilter === "Oldest") {
  filteredComments.sort((a, b) => tsToMillis(a.timestamp) - tsToMillis(b.timestamp))
}

  const forumMatchesSearch =
    forum.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    forum.content?.toLowerCase().includes(searchQuery.toLowerCase())


   // ========== MOBILE (Expo Go) ==========
  return (
    <SafeAreaView className="flex-1 bg-[#D9E9DD] p-3">
      <ScrollView className="h-full">
       {/* HEADER */}
             <Box className="flex-row items-center justify-between mt-2 mb-6">
               <Box className="flex-row items-center">
                 <Image
                   source={require("@/assets/images/ariba-logo.png")} // <-- place your Ariba logo asset here
                   style={{ width: 60, height: 60, marginRight: 3 }}
                   resizeMode="contain"
                 />
                 <Text className="text-green-700 text-3xl font-[Pacifico]">
                   Ariba
                 </Text>
               </Box>
               <Box className="w-[140px] mt-5">
               <SearchBar
                 value={searchQuery}
                 onChangeText={(text) => setSearchQuery(text)}
                 placeholder="Search"
                 className="w-[140px]"
               />
               </Box>
             </Box>

        <Box className="bg-white rounded-xl p-6 shadow-sm flex-1">
          {forumMatchesSearch ? (
            <>
              <TouchableOpacity onPress={() => router.back()} className="mb-4">
                <ArrowLeft size={24} color="black" />
              </TouchableOpacity>

              <Text size="5xl" className="text-black mb-4 font-[Poppins]">FORUMS</Text>

              {/* ✅ Title row with Bookmark + Share */}
              <Box className="flex-row items-center justify-between mb-4">
                <Text className="text-2xl font-[DMBold] text-black flex-1 mr-2">
                  {forum.title || "Untitled Discussion"}
                </Text>

                <Box className="flex-row items-center space-x-3">
                  <TouchableOpacity onPress={toggleBookmark}>
                    <Bookmark
                      size={20}
                      color={bookmarked ? "#22c55e" : "black"}
                      fill={bookmarked ? "#22c55e" : "transparent"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={shareForum}>
                    <Share2 size={20} color="black" />
                  </TouchableOpacity>
                </Box>
              </Box>

              <Box className="flex-row items-start mb-2 text-black">
                <Image
                  source={{ uri: forum.authorPhoto || "https://www.shutterstock.com/image-vector/blank-avatar-photo-place-holder-600nw-1095249842.jpg" }}
                  style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
                />

                <View style={{ flex: 1 }}>
                  <Text className="text-lg font-[DMBold] text-black">{forum.authorName}</Text>

                  {/* If admin: show Admin pill with timestamp to the right. If not admin: show timestamp left-aligned below the name. */}
                  { (forum.isAdmin || forum.authorIsAdmin) ? (
                    <View className="flex-row items-center">
                      <View style={{ backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: '#166534', fontSize: 12, fontFamily: 'DMSans-Regular' }}>Admin</Text>
                      </View>
                      <Text className="ml-3 text-gray-500 text-xs font-[DM]">
                        {forum.timestamp?.toDate ? timeAgo(forum.timestamp.toDate(), now) : "..."}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ marginTop: 1 }}>
                      <Text className="text-gray-500 text-xs font-[DM]">{forum.timestamp?.toDate ? timeAgo(forum.timestamp.toDate(), now) : "..."}</Text>
                    </View>
                  )}
                </View>
              </Box>

              <Text className="text-base text-black font-[DM] mb-5">{forum.content}</Text>

              <Box className="flex-row items-center justify-between border-b border-gray-300 pb-3 mb-5">
                <TouchableOpacity onPress={() => {}} className="flex-row items-center">
                  <Heart size={20} color={userLikes[id] ? "red" : "black"} fill={userLikes[id] ? "red" : "transparent"} />
                  <Text className="ml-2 font-[DM] text-black">{forum.likesCount || 0} Likes</Text>
                </TouchableOpacity>
                <Box className="flex-row items-center">
                  <MessageCircle size={20} />
                  <Text className="ml-2 font-[DM] text-black">{forum.commentsCount || 0} Comments</Text>
                </Box>
              </Box>

              <Text size="2xl" className="mb-2 text-black font-[DMBold]">Comments</Text>
              <TextInput
                placeholder="Write your insights about the discussion..."
                value={newComment}
                onChangeText={setNewComment}
                className="bg-gray-100 border border-gray-300 text-slate-700 rounded-md p-2 mb-2"
                style={{ height: 80 }}
                multiline
                textAlignVertical="top"
                returnKeyType="send"
                blurOnSubmit={true}
                onSubmitEditing={() => addComment()}
              />

              {/* ✅ Removed Submit button completely */}

              {filteredComments.map(c => renderCommentThread(c))}
            </>
          ) : <Text className="text-center text-gray-500 py-10 font-[DM]">No results found for "{searchQuery}"</Text>}
        </Box>
      </ScrollView>
      {copied && (
        <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ backgroundColor: "black", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
            <Text style={{ color: "white" }}>✅ Copied to clipboard</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

export default ForumDetails