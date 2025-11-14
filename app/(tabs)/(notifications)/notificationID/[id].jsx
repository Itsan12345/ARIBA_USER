import { db } from "@/api/config/firebase.config";
import { Box } from "@/components/ui/box";
import {
  Popover,
  PopoverArrow,
  PopoverBackdrop,
  PopoverBody,
  PopoverContent,
} from "@/components/ui/popover";
import { useFonts } from "expo-font";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Text as RNText,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";

export default function NotificationReportDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [showTierInfo, setShowTierInfo] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const carouselRef = useRef(null);
  const screenWidth = Dimensions.get('window').width;
  // Calculate how many images are visible at once
  const imagesPerPage = 2;
  const itemWidth = (screenWidth - 80) / imagesPerPage;

  const openImageModal = (uri) => {
    setSelectedImage(uri);
    setModalVisible(true);
  };

  const closeImageModal = () => {
    setModalVisible(false);
    setSelectedImage(null);
  };


  // Snap to pairs of images
  const navigateCarousel = (direction) => {
    if (!report?.images || report.images.length === 0) return;
    let maxIndex = Math.max(0, report.images.length - imagesPerPage);
    let newIndex = currentImageIndex;
    if (direction === 'next') {
      newIndex = Math.min(currentImageIndex + 1, maxIndex);
    } else {
      newIndex = Math.max(currentImageIndex - 1, 0);
    }
    setCurrentImageIndex(newIndex);
    carouselRef.current?.scrollToOffset({ offset: newIndex * itemWidth, animated: true });
  };

  const handleScroll = (event) => {
    if (!report || !report.images || report.images.length === 0) return;
    const contentOffset = event.nativeEvent.contentOffset;
    const index = Math.round(contentOffset.x / itemWidth);
    setCurrentImageIndex(Math.max(0, Math.min(index, report.images.length - imagesPerPage)));
  };

  const [fontsLoaded] = useFonts({
        Pacifico: require("../../../../assets/fonts/Pacifico-Regular.ttf"),
        SpaceMono: require("../../../../assets/fonts/SpaceMono-Regular.ttf"),
        Roboto: require("../../../../assets/fonts/Roboto-Bold.ttf"),
        Poppins: require("../../../../assets/fonts/Poppins-Bold.ttf"),
        DM: require("../../../../assets/fonts/DMSans-Regular.ttf"),
        DMBold: require("../../../../assets/fonts/DMSans-Bold.ttf"),
      });
    
      if (!fontsLoaded) return null;

  useEffect(() => {
    if (id) {
      const fetchReport = async () => {
        setLoading(true);
        const docRef = doc(db, "allReports", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setReport({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.log("No such document!");
        }
        setLoading(false);
      };

      fetchReport();
    }
  }, [id]);

  if (loading) {
    return (
      <Box className="flex-1 justify-center items-center bg-[#D9E9DD]">
        <ActivityIndicator size="large" />
        <RNText>Loading report...</RNText>
      </Box>
    );
  }

  if (!report) {
    return (
      <Box className="flex-1 justify-center items-center bg-[#D9E9DD]">
        <RNText>Report not found.</RNText>
      </Box>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#D9E9DD]">
      {/* Header */}
      <View className="bg-[#D9E9DD] px-4 pt-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Image
              source={require("@/assets/images/ariba-logo.png")}
              style={{ width: 80, height: 80, marginRight: 2 }}
              resizeMode="contain"
            />
            <RNText className="text-3xl font-[Poppins] text-black">
              NOTIFICATION
            </RNText>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-xl p-4 shadow-md">
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center mb-4"
          >
            <ChevronLeft size={24} color="black" />
            <RNText className="text-sm font-bold ml-1">BACK</RNText>
          </TouchableOpacity>

          {/* Report Title */}
          <RNText className="text-3xl font-[DMBold] mb-2">{report?.title || 'Loading...'}</RNText>

          {/* Report Description */}
          <View className="bg-gray-100 p-3 rounded-lg mb-6">
            <RNText className="text-base text-gray-700 font-[DM]">
              {report?.description || 'Loading description...'}
            </RNText>
          </View>

          {/* Status */}
          <View className="items-center mb-6">
            <RNText className="text-lg font-[Roboto]">
              THIS REPORT HAS BEEN MARKED AS:
            </RNText>
            <RNText
              className="text-2xl font-[Roboto]"
              style={{
                color:
                  report?.status?.toLowerCase() === "pending"
                    ? "#EAB308" // Yellow for Pending
                    : report?.status?.toLowerCase() === "responded"
                    ? "#16A34A" // Green for Responded
                    : "#DC2626", // Red for Ignored
              }}
            >
              {report?.status?.toUpperCase() || 'LOADING'}
            </RNText>
          </View>

          {/* Tier List */}
          <View className="mb-6">
            <RNText className="text-xl font-[DMBold]">
              Report's Tier list
            </RNText>
            <RNText className="text-xs text-gray-500 mb-2 font-[DM]">
              How urgent is the report?
            </RNText>
            <View className="flex-row items-center">
              <View className="flex-1 border border-gray-300 rounded-md p-3 bg-gray-50 mr-3">
                <RNText className="text-base">{report?.tier || 'Loading...'}</RNText>
              </View>
              <Popover
                isOpen={showTierInfo}
                onClose={() => setShowTierInfo(false)}
                onOpen={() => setShowTierInfo(true)}
                placement="top"
                trigger={(triggerProps) => {
                  return (
                    <TouchableOpacity {...triggerProps}>
                      <Info size={24} color="gray" className="ml-2" />
                    </TouchableOpacity>
                  );
                }}
              >
                <PopoverBackdrop />
                <PopoverContent className="mx-5 w-92 rounded-lg">
                  <PopoverArrow />
                  <PopoverBody>
                    <RNText className="font-bold text-lg mb-2">Legend:</RNText>
                    <View className="mb-1">
                      <RNText>
                        <RNText className="font-bold text-green-600">
                          Low
                        </RNText>
                        - use this to identify that the report is in low
                        priority/not so important, can wait longer or just for
                        awareness, no action needed.
                      </RNText>
                    </View>
                    <View className="mb-1">
                      <RNText>
                        <RNText className="font-bold text-yellow-500">
                          Medium
                        </RNText>
                        - use this to identify that the report is of medium
                        priority, needs attention but not immediate action.
                      </RNText>
                    </View>
                    <View className="mb-1">
                      <RNText>
                        <RNText className="font-bold text-orange-500">
                          High
                        </RNText>
                        - use this to identify that the report is of high
                        priority, needs attention and action soon.
                      </RNText>
                    </View>
                    <View>
                      <RNText>
                        <RNText className="font-bold text-red-600">
                          Emergency
                        </RNText>
                        - use this to identify that the report is urgent and
                        needs immediate attention action.
                      </RNText>
                    </View>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </View>
          </View>

          {/* Attached Files */}
          <View>
            <RNText className="text-xl mb-3 font-[DMBold]">Files Attached:</RNText>
            {report?.images && report.images.length > 0 ? (
              <View style={styles.carouselContainer}>
                <FlatList
                  ref={carouselRef}
                  data={report.images}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  keyExtractor={(item, index) => index.toString()}
                  contentContainerStyle={styles.carouselContent}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[styles.imageItem, index === report.images.length - 1 ? { marginRight: 0 } : {}]}
                      onPress={() => openImageModal(item)}
                    >
                      <View style={styles.imageWrapper}>
                        <Image
                          source={{ uri: item }}
                          style={styles.carouselImage}
                          resizeMode="cover"
                        />
                        <View style={styles.imageOverlay}>
                          <View style={styles.imageIcon}>
                            <View style={styles.mountainIcon}>
                              <View style={styles.mountain1} />
                              <View style={styles.mountain2} />
                              <View style={styles.sun} />
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
                  initialScrollIndex={0}
                  extraData={currentImageIndex}
                />
                {/* Left Arrow */}
                {currentImageIndex > 0 && (
                  <TouchableOpacity
                    style={{ ...styles.nextButton, left: -8, right: undefined, transform: [{ rotate: '180deg' }], zIndex: 2 }}
                    onPress={() => navigateCarousel('prev')}
                  >
                    <ChevronRight size={20} color="#666" />
                  </TouchableOpacity>
                )}
                {/* Right Arrow */}
                {currentImageIndex < report.images.length - imagesPerPage && (
                  <TouchableOpacity
                    style={styles.nextButton}
                    onPress={() => navigateCarousel('next')}
                  >
                    <ChevronRight size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.noFilesContainer}>
                <RNText className="text-gray-500">
                  {report ? 'No files attached.' : 'Loading files...'}
                </RNText>
              </View>
            )}
          </View>

          {/* Location Map / Fallback */}
          <View className="mt-6">
            <RNText className="text-xl mb-3 font-[DMBold]">Location:</RNText>
            {report?.location && report.location.length === 2 ? (
              <View style={mapStyles.cardContainer}>
                {/* If you want an interactive native map, install `react-native-maps` and re-enable MapView here. */}
                {/* Static map image (Google Static Maps) if API key provided, otherwise show an 'Open in Maps' button */}
                {global.GOOGLE_MAPS_API_KEY ? (
                  <Image
                    source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?center=${report.location[1]},${report.location[0]}&zoom=15&size=600x300&markers=color:red%7C${report.location[1]},${report.location[0]}&key=${global.GOOGLE_MAPS_API_KEY}` }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
                    <RNText className="text-gray-600 text-sm mb-3">Click the button below to see your location.</RNText>
                    <TouchableOpacity
                      onPress={() => {
                        const lat = report.location[1];
                        const lng = report.location[0];
                        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                        Linking.openURL(url);
                      }}
                      className="bg-green-500 px-4 py-2 rounded-md"
                    >
                      <RNText className="text-white font-bold">Open in Maps</RNText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noFilesContainer}>
                <RNText className="text-gray-500">Location not available.</RNText>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeImageModal}
      >
        <View
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
        >
          <TouchableOpacity
            className="absolute top-10 right-5 z-10"
            onPress={closeImageModal}
          >
            <X size={32} color="white" />
          </TouchableOpacity>

          <Image
            source={{ uri: selectedImage }}
            style={{
              width: windowWidth * 0.9,
              height: windowHeight * 0.8,
            }}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = {
  carouselContainer: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  carouselContent: {
    paddingHorizontal: 0,
  },
  imageItem: {
    width: (Dimensions.get('window').width - 100) / 2, // Show 2 images side by side
    marginRight: 12,
  },
  imageWrapper: {
    position: 'relative',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    overflow: 'hidden',
    aspectRatio: 1, // Square aspect ratio
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  nextButton: {
    position: 'absolute',
    right: -8,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  noFilesContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
};

const mapStyles = {
  cardContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#6b7280',
    backgroundColor: '#fff',
    width: '100%',
    height: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
};
