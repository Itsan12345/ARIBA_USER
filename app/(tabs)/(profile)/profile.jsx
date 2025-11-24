import { db } from "@/api/config/firebase.config";
import { changePassword } from "@/api/controller/auth.controller";
import { uploadImagesToFirebase } from "@/api/services/firebase/storage.services";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useFonts } from "expo-font";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { deleteUser, EmailAuthProvider, getAuth, reauthenticateWithCredential, updateProfile } from "firebase/auth";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Check, Eye, EyeOff, LogOut, Pencil, Upload, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Profile() {
  const router = useRouter();
  const { user, userDoc, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCoverPhotoSuccessModal, setShowCoverPhotoSuccessModal] = useState(false);
  const [showProfilePhotoSuccessModal, setShowProfilePhotoSuccessModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Add new states
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);

// Reauth state for sensitive operations (delete account)
const [showReauthModal, setShowReauthModal] = useState(false);
const [reauthPassword, setReauthPassword] = useState("");
const [isReauthenticating, setIsReauthenticating] = useState(false);
const [reauthError, setReauthError] = useState("");

// Parse suspended-until from userDoc (human-readable string stored in Firestore)
const suspendedUntilMs = userDoc?.sosSuspendedUntil ? Date.parse(userDoc.sosSuspendedUntil) : null;



  const [fontsLoaded] = useFonts({
    Pacifico: require("../../../assets/fonts/Pacifico-Regular.ttf"),
    SpaceMono: require("../../../assets/fonts/SpaceMono-Regular.ttf"),
    Roboto: require("../../../assets/fonts/Roboto-Bold.ttf"),
    Poppins: require("../../../assets/fonts/Poppins-Bold.ttf"),
  });

  if (!fontsLoaded) return null;

  useEffect(() => {
    if (userDoc) {
      setFirstName(userDoc.firstName || "");
      setLastName(userDoc.lastName || "");
      // userDoc may store phone under `phone` or `phoneNumber` depending on signup flow
      setPhoneNumber(userDoc.phone || userDoc.phoneNumber || "");
    }
  }, [userDoc]);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, oldPassword);

    try {
      await reauthenticateWithCredential(user, credential);
      const res = await changePassword(newPassword);
      if (res.status === 200) {
        setModalVisible(false);
        setShowSuccessModal(true);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert(`Error: ${res.message}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };


const handleDeleteAccount = async () => {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // If the user's SOS is currently suspended, do not attempt deletion directly.
  // Instead prompt the user to re-authenticate first in a friendly modal so we
  // avoid triggering `auth/requires-recent-login`.
  if (suspendedUntilMs && Date.now() < suspendedUntilMs) {
    const providerIsPassword = currentUser?.providerData?.some(p => p.providerId === 'password');
    if (providerIsPassword) {
      // Show reauth modal and a helpful message
      setReauthError('Your SOS access is suspended. Please re-enter your password to confirm account deletion.');
      setShowReauthModal(true);
    } else {
      Alert.alert(
        'Recent login required',
        'Your SOS access is suspended. To delete your account please sign in again using your original provider and try deleting your account.'
      );
    }
    return;
  }

  try {
    setIsDeleting(true);

    // Delete user Firestore document
    const userRef = doc(db, "users", currentUser.uid);
    await deleteDoc(userRef);

    // Delete from Firebase Authentication
    await deleteUser(currentUser);

    // Show success modal
    setShowDeleteModal(false);
    setShowDeleteSuccessModal(true);

    // Wait briefly before logout & redirect
    setTimeout(() => {
      logout();
      router.replace("/");
    }, 2500);
  } catch (error) {
    // Log as a warning so dev overlay is less intrusive; handle requires-recent-login
    console.warn("Error deleting account:", error);
    if (error?.code === 'auth/requires-recent-login' || (error?.message || '').includes('requires-recent-login')) {
      const providerIsPassword = currentUser?.providerData?.some(p => p.providerId === 'password');
      if (providerIsPassword) {
        setReauthError('Please re-enter your password to confirm account deletion.');
        setShowReauthModal(true);
      } else {
        Alert.alert(
          'Recent login required',
          'To delete your account you must re-authenticate. Please sign in again using your original provider (e.g. Google) and try deleting your account.'
        );
      }
    } else {
      Alert.alert("Error", "Failed to delete account. Try again later.");
    }
  } finally {
    setIsDeleting(false);
  }
};

// Reauthenticate with email/password and attempt deletion again
const performReauthAndDelete = async () => {
  setReauthError('');
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    setReauthError('No authenticated user found.');
    return;
  }

  try {
    setIsReauthenticating(true);
    const credential = EmailAuthProvider.credential(currentUser.email, reauthPassword);
    await reauthenticateWithCredential(currentUser, credential);

    // After successful reauth, delete the Firestore doc and auth user
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(userRef);
    } catch (e) {
      console.warn('Failed to delete Firestore user doc during reauth-delete:', e);
      // continue to attempt auth deletion regardless
    }

    try {
      await deleteUser(currentUser);
    } catch (e) {
      console.error('Failed to delete auth user after reauth:', e);
      setReauthError('Failed to delete account after re-authentication. Please try again later.');
      return;
    }

    // Success
    setShowReauthModal(false);
    setShowDeleteModal(false);
    setShowDeleteSuccessModal(true);
    setTimeout(() => {
      logout();
      router.replace('/');
    }, 2000);
  } catch (err) {
    console.error('Re-authentication failed:', err);
    setReauthError(err?.message || 'Re-authentication failed.');
  } finally {
    setIsReauthenticating(false);
  }
};




  const handleSaveInformation = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Error", "First name and last name cannot be empty.");
      return;
    }
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        firstName: firstName,
        lastName: lastName,
        phone: phoneNumber,
      });
      
    } catch (error) {
      console.error("Error updating user information: ", error);
      Alert.alert("Error", "Failed to update information. Please try again.");
    } finally {
      setIsEditing(false);
    }
  };

  const handleCoverPhotoChange = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "You need to allow access to your photos to change the cover photo."
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });

    if (pickerResult.canceled) {
      return;
    }

    setIsUploadingCover(true);
    try {
      const { uri } = pickerResult.assets[0];
      const newImageUrls = await uploadImagesToFirebase(
        [{ uri }],
        `cover_photos/${user.uid}`
      );

      if (newImageUrls && newImageUrls.length > 0) {
        const coverPhotoURL = newImageUrls[0];
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { coverPhotoURL });
        setShowCoverPhotoSuccessModal(true);
      } else {
        throw new Error("Image upload returned no URL.");
      }
    } catch (error) {
      console.error("Error updating cover photo: ", error);
      Alert.alert("Error", "Failed to update cover photo. Please try again.");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleProfilePhotoChange = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "You need to allow access to your photos to change your profile picture."
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (pickerResult.canceled) {
      return;
    }

    setIsUploadingProfilePic(true);
    try {
      const { uri } = pickerResult.assets[0];
      const newImageUrls = await uploadImagesToFirebase(
        [{ uri }],
        `profile_pictures/${user.uid}`
      );

      if (newImageUrls && newImageUrls.length > 0) {
        const photoURL = newImageUrls[0];
        const auth = getAuth();
        await updateProfile(auth.currentUser, { photoURL });

        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { photoURL });

        setShowProfilePhotoSuccessModal(true);
      } else {
        throw new Error("Image upload returned no URL.");
      }
    } catch (error) {
      console.error("Error updating profile picture: ", error);
      Alert.alert(
        "Error",
        "Failed to update profile picture. Please try again."
      );
    } finally {
      setIsUploadingProfilePic(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F0FDF4]">
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View className="bg-[#F0FDF4] px-4 pt-3 pb-3">
          <View className="flex-row items-center">
            <Image
              source={require("@/assets/images/ariba-logo.png")}
              style={{ width: 80, height: 80, marginRight: 2 }}
              resizeMode="contain"
            />
            <View>
              <Text className="text-3xl font-[Poppins] text-black mt-5">
                PROFILE
              </Text>
              <Text className="text-xs text-gray-500">
                Manage Settings for your Profile
              </Text>
            </View>
          </View>
        </View>

        <View className="px-4">
          {/* Profile Card */}
          <View className="bg-white rounded-2xl shadow-md p-4">
            <ImageBackground
              source={{ uri: userDoc?.coverPhotoURL }}
              className="h-32 bg-gray-300 rounded-t-xl -mt-4 -mx-4 overflow-hidden"
              resizeMode="cover"
            >
              <View className="flex-1 justify-center items-center">
                {isUploadingCover && (
                  <ActivityIndicator size="large" color="#fff" />
                )}
              </View>
              <TouchableOpacity
                onPress={handleCoverPhotoChange}
                className="absolute top-2 right-2 bg-white/70 p-1.5 rounded-full"
                disabled={isUploadingCover}
              >
                <Pencil size={18} color="#16A34A" />
              </TouchableOpacity>
            </ImageBackground>
            <View className="flex-row items-center -mt-16 px-4">
              <Image
                source={{ uri: user?.photoURL || "https://www.shutterstock.com/image-vector/blank-avatar-photo-place-holder-600nw-1095249842.jpg" }}
                className="-ml-2 w-28 h-28 rounded-full border-4 border-white bg-gray-200"
              />
              <View className="ml-2">
                <Text className="text-2xl font-bold mt-20">
                  {userDoc?.firstName} {userDoc?.lastName}
                </Text>
                <TouchableOpacity
                  onPress={handleProfilePhotoChange}
                  disabled={isUploadingProfilePic}
                  className="flex-row items-center justify-center mt-2 bg-green-500 px-4 py-2 w-40 h-10 rounded-lg"
                >
                  {isUploadingProfilePic ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Upload size={14} color="white" className="mr-2" />
                      <Text className="text-white ml-2">Upload Image</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text className="text-xs text-gray-400 mt-1">
                  Supports PNGs, JPEG under 5mb
                </Text>
              </View>
            </View>

            {/* Account Information */}
            <View className="border-t border-gray-200 mt-6 pt-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-bold">Account Information</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (isEditing) {
                      handleSaveInformation();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="bg-green-500 px-3 py-0.5 h-9 rounded-lg flex-row items-center"
                >
                  <Pencil size={12} color="white" className="mr-1" />
                  <Text className="text-white ml-1 text-xs">
                    {isEditing ? "Save" : "Edit Information"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mt-4">
                <Text className="text-sm text-gray-500">First Name</Text>
                <TextInput
                  value={firstName}
                  editable={isEditing}
                  onChangeText={setFirstName}
                  className={`border rounded-lg p-2 mt-1 ${
                    isEditing ? "border-gray-300" : "border-transparent bg-gray-100"
                  }`}
                />
              </View>
              <View className="mt-4">
                <Text className="text-sm text-gray-500">Last Name</Text>
                <TextInput
                  value={lastName}
                  editable={isEditing}
                  onChangeText={setLastName}
                  className={`border rounded-lg p-2 mt-1 ${
                    isEditing ? "border-gray-300" : "border-transparent bg-gray-100"
                  }`}
                />
              </View>
              <View className="mt-4">
                <Text className="text-sm text-gray-500">E-mail Address</Text>
                <TextInput
                  value={user?.email}
                  editable={false}
                  className="border border-gray-300 rounded-lg p-2 mt-1 bg-gray-100"
                />
              </View>
              <View className="mt-4">
                <Text className="text-sm text-gray-500">Mobile Number</Text>
                  <TextInput
                    value={phoneNumber || "+09000000000"}
                    editable={isEditing}
                    onChangeText={setPhoneNumber}
                    className={`border rounded-lg p-2 mt-1 ${
                      isEditing ? "border-gray-300" : "border-transparent bg-gray-100"
                    }`}
                  />
              </View>
              <Text className="text-xs text-gray-400 mt-2">
                You may need to log out and log back in to see changes.
              </Text>
            </View>

            <View className="border-t border-gray-200 mt-6 pt-4">
              <Text className="text-lg font-bold">Change Password</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                className="bg-green-500 mt-2 px-4 py-3 rounded-lg items-center"
              >
                <Text className="text-white font-bold">Edit Password</Text>
              </TouchableOpacity>
            </View>

            <View className="border-t border-gray-200 mt-6 pt-4">
              <Text className="text-lg font-bold">Bookmarks</Text>
              <TouchableOpacity
                onPress={() => router.push("(tabs)/(profile)/bookmark")}
                className="bg-green-500 mt-2 px-4 py-3 rounded-lg items-center"
              >
                <Text className="text-white font-bold">View all Bookmarks</Text>
              </TouchableOpacity>
            </View>

            <View className="border-t border-gray-200 mt-6 pt-4">
              <Text className="text-lg font-bold">Account Deletion</Text>
              <Text className="text-sm text-gray-600 mt-1">
                If you want to permanently delete this account and all of its
                data, you can do so below by clicking the "Delete Button".
              </Text>
              <TouchableOpacity
  onPress={() => setShowDeleteModal(true)}
  className="bg-red-500 mt-4 px-4 py-3 rounded-lg items-center"
>
  <Text className="text-white font-bold">Delete Account</Text>
</TouchableOpacity>

            </View>

            <View className="border-t border-gray-200 mt-6 pt-4">
              <TouchableOpacity
                onPress={logout}
                className="bg-gray-200 mt-2 px-4 py-3 rounded-lg items-center flex-row justify-center"
              >
                <LogOut size={18} color="black" className="mr-2" />
                <Text className="text-black font-bold">Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white w-11/12 rounded-2xl p-6 shadow-lg">
            <TouchableOpacity
              className="absolute top-4 right-4"
              onPress={() => setModalVisible(false)}
            >
              <X size={24} color="black" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-center mb-4">
              CHANGE PASSWORD
            </Text>
            <View className="border-b-2 border-gray-200 mb-6" />

            <Text className="text-sm font-semibold mb-1">
              Confirm old Password
            </Text>
            <View className="flex-row items-center bg-gray-100 border border-gray-300 rounded-lg mb-4">
              <TextInput
                placeholder="Enter old password here"
                secureTextEntry={!showOldPassword}
                value={oldPassword}
                onChangeText={setOldPassword}
                className="flex-1 p-3"
              />
              <TouchableOpacity
                onPress={() => setShowOldPassword(!showOldPassword)}
                className="p-3"
              >
                <Icon as={showOldPassword ? Eye : EyeOff} size="md" color="gray" />
              </TouchableOpacity>
            </View>

            <Text className="text-sm font-semibold mb-1">
              Create new password
            </Text>
            <View className="flex-row items-center bg-gray-100 border border-gray-300 rounded-lg">
              <TextInput
                placeholder="Enter new password here"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                className="flex-1 p-3"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                className="p-3"
              >
                <Icon as={showNewPassword ? Eye : EyeOff} size="md" color="gray" />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-gray-500 mt-1 mb-4">
              Password must be in Alphanumeric 12 min character 1 Special
            </Text>

            <Text className="text-sm font-semibold mb-1">
              Confirm new password
            </Text>
            <View className="flex-row items-center bg-gray-100 border border-gray-300 rounded-lg mb-6">
              <TextInput
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                className="flex-1 p-3"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="p-3"
              >
                <Icon as={showConfirmPassword ? Eye : EyeOff} size="md" color="gray" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handlePasswordChange}
              className="bg-green-500 py-3 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-lg">
                Change Password
              </Text>
            </TouchableOpacity>
            <Text className="text-xs text-gray-500 text-center mt-2">
              By clicking the change password we'll send email for confimation
            </Text>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white w-11/12 max-w-sm rounded-2xl p-6 items-center shadow-lg">
            <TouchableOpacity
              className="absolute top-4 right-4"
              onPress={() => setShowSuccessModal(false)}
            >
              <X size={24} color="black" />
            </TouchableOpacity>
            
            <Text className="text-4xl font-[Poppins] text-center my-6">
              PASSWORD CHANGE
            </Text>
      
            <View className="h-24 w-24 bg-green-500 items-center justify-center rounded-xl mb-6">
              <Check size={80} color="white" strokeWidth={3} />
            </View>
      
            <Text className="text-lg mb-6 text-center">
              Password Change <Text className="font-bold text-green-600">Successful!</Text>
            </Text>
      
            <TouchableOpacity
              onPress={() => setShowSuccessModal(false)}
              className="bg-green-500 w-full py-3 rounded-lg items-center"
              style={{
                shadowColor: "#16A34A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <Text className="text-white font-bold text-lg">
                Okay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCoverPhotoSuccessModal}
        onRequestClose={() => setShowCoverPhotoSuccessModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white w-11/12 max-w-sm rounded-2xl p-6 items-center shadow-lg">
            <TouchableOpacity
              className="absolute top-4 right-4"
              onPress={() => setShowCoverPhotoSuccessModal(false)}
            >
              <X size={24} color="black" />
            </TouchableOpacity>
            
            <Text className="text-3xl font-[Poppins] text-center my-4">
              COVER PHOTO UPDATED
            </Text>
      
            <Image
              source={require("@/assets/images/imagecheck.png")}
              style={{ width: 90, height: 90, marginBottom: 16 }}
              resizeMode="contain"
            />
      
            <Text className="text-lg mb-6 text-center">
              Cover Photo Updated <Text className="font-bold text-green-600">Successfully!</Text>
            </Text>
      
            <TouchableOpacity
              onPress={() => setShowCoverPhotoSuccessModal(false)}
              className="bg-green-500 py-3 rounded-lg items-center w-full"
            >
              <Text className="text-white font-bold text-lg">
                Okay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showProfilePhotoSuccessModal}
        onRequestClose={() => setShowProfilePhotoSuccessModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white w-11/12 max-w-sm rounded-2xl p-6 items-center shadow-lg">
            <TouchableOpacity
              className="absolute top-4 right-4"
              onPress={() => setShowProfilePhotoSuccessModal(false)}
            >
              <X size={24} color="black" />
            </TouchableOpacity>
            
            <Text className="text-3xl font-[Poppins] text-center my-4">
              PROFILE PICTURE UPDATED
            </Text>
      
            <Image
              source={require("@/assets/images/profile-icon.png")}
              style={{ width: 120, height: 120, marginBottom: 10 }}
              resizeMode="contain"
            />
      
            <Text className="text-lg mb-6 text-center">
              Profile Photo Updated <Text className="font-bold text-green-600">Successfully!</Text>
            </Text>
      
            <TouchableOpacity
              onPress={() => setShowProfilePhotoSuccessModal(false)}
              className="bg-green-500 py-3 rounded-lg items-center w-full"
            >
              <Text className="text-white font-bold text-lg">
                Okay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Account Deletion Modal */}
{/* DELETE ACCOUNT CONFIRMATION MODAL */}
<Modal
  animationType="fade"
  transparent={true}
  visible={showDeleteModal}
  onRequestClose={() => setShowDeleteModal(false)}
>
  <View className="flex-1 justify-center items-center bg-black/50">
    <View
      className="bg-white w-11/12 max-w-sm rounded-2xl p-6 items-center shadow-lg"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 8,
      }}
    >
      {/* Close Button (top-right X) */}
      <TouchableOpacity
        className="absolute top-4 right-4"
        onPress={() => setShowDeleteModal(false)}
      >
        <X size={24} color="black" />
      </TouchableOpacity>

      {/* Title */}
      <Text
        className="text-3xl font-extrabold text-center mb-4"
        style={{ fontFamily: "Poppins-Bold" }}
      >
        ACCOUNT DELETION
      </Text>

      {/* Delete Icon */}
      <Image
        source={require("../../../assets/images/delete-icon.png")} // 👈 make sure the image path matches your project
        style={{
          width: 80,
          height: 80,
          resizeMode: "contain",
          marginVertical: 10,
        }}
      />

      {/* Confirmation Text */}
      <Text
        className="text-center text-base mt-2 mb-6 text-gray-700"
        style={{ fontFamily: "Poppins-Regular" }}
      >
        Are you sure you want to{" "}
        <Text className="font-bold">Delete</Text> your account?
      </Text>

      {/* Buttons */}
      <View className="flex-row w-full justify-between">
        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={isDeleting}
          className="flex-1 py-3 rounded-xl mr-2 items-center"
          style={{
            backgroundColor: "#ef4444", // red
            shadowColor: "#ef4444",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Text
            className="text-white font-bold text-lg"
            style={{ fontFamily: "Poppins-SemiBold" }}
          >
            {isDeleting ? "Deleting..." : "Delete Account"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowDeleteModal(false)}
          className="flex-1 py-3 rounded-xl ml-2 items-center"
          style={{
            backgroundColor: "#22c55e", // green
            shadowColor: "#22c55e",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Text
            className="text-white font-bold text-lg"
            style={{ fontFamily: "Poppins-SemiBold" }}
          >
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* Re-authentication modal shown when recent login is required for deletion */}
<Modal
  animationType="fade"
  transparent={true}
  visible={showReauthModal}
  onRequestClose={() => setShowReauthModal(false)}
>
  <View className="flex-1 justify-center items-center bg-black/50">
    <View className="bg-white w-11/12 max-w-sm rounded-2xl p-6 items-center shadow-lg">
      <TouchableOpacity
        className="absolute top-4 right-4"
        onPress={() => setShowReauthModal(false)}
      >
        <X size={24} color="black" />
      </TouchableOpacity>

      <Text className="text-2xl font-extrabold text-center mb-3">Re-authenticate</Text>
      <Text className="text-center text-sm text-gray-600 mb-4">For security, please enter your password to confirm account deletion.</Text>

      <TextInput
        value={reauthPassword}
        onChangeText={setReauthPassword}
        placeholder="Password"
        secureTextEntry
        className="w-full border border-gray-200 py-2.5 px-3 rounded-lg bg-white text-slate-900 mb-2"
      />
      {reauthError ? <Text className="text-red-600 mb-2">{reauthError}</Text> : null}

      <View className="flex-row w-full justify-between mt-3">
        <TouchableOpacity
          onPress={() => setShowReauthModal(false)}
          className="flex-1 py-3 rounded-xl mr-2 items-center bg-gray-200"
        >
          <Text className="text-gray-900 font-bold">Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={performReauthAndDelete}
          disabled={isReauthenticating}
          className="flex-1 py-3 rounded-xl ml-2 items-center"
          style={{ backgroundColor: '#ef4444' }}
        >
          <Text className="text-white font-bold">{isReauthenticating ? 'Processing...' : 'Confirm Delete'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* DELETE SUCCESS MODAL */}
<Modal
  animationType="fade"
  transparent={true}
  visible={showDeleteSuccessModal}
  onRequestClose={() => setShowDeleteSuccessModal(false)}
>
  <View className="flex-1 justify-center items-center bg-black/50">
    <View className="bg-white w-11/12 max-w-sm rounded-2xl p-6 items-center shadow-lg">
      <Text className="text-3xl font-[Poppins] text-center my-4">
        ACCOUNT DELETED
      </Text>

      <View className="h-24 w-24 bg-green-500 items-center justify-center rounded-xl mb-6">
        <Check size={80} color="white" strokeWidth={3} />
      </View>

      <Text className="text-lg mb-6 text-center">
        Account Deleted <Text className="font-bold text-green-600">Successfully!</Text>
      </Text>
    </View>
  </View>
</Modal>
    </SafeAreaView>
  );
}
