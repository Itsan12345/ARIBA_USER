// working on this
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase.config";

export async function signInUser(email, password){
   return await signInWithEmailAndPassword(auth, email, password);
}

export async function createUser(email, password){
   return await createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutUser(){
   return await signOut(auth)
} 

export async function userForgotPassword(email) {
   return await sendPasswordResetEmail(auth, email)
}

export const signInWithToken = async (credential) => {
    return await signInWithCredential(auth, credential)     
}

export async function newUserDoc(userCredentials, role, extra) {
  try {
    const {
      uid,
      displayName,
      email,
      phoneNumber,
      metadata,
      providerData,
      firstName,
      lastName
    } = userCredentials.user;

    if (!role) throw new Error("Role not specified");

    const providerId = providerData?.[0]?.providerId || null;
    const photoUrl = providerData?.[0]?.photoURL || null;

    const userDocPayload = {
      name: displayName,
      email,
      // prefer explicit phone provided in the signup payload (extra.phone)
      phone: (extra && extra.phone) ? extra.phone : phoneNumber || null,
      photoUrl,
      providerId,
      createdAt: metadata?.creationTime || null,
      lastSignedIn: metadata?.lastSignInTime || null,
      role,
      firstName: extra.firstName,
      lastName: extra.lastName
    };

    // If location array was provided in the extra payload, attach it to the user doc
    if (extra && Array.isArray(extra.location) && extra.location.length >= 2) {
      userDocPayload.location = extra.location;
    }

    await setDoc(doc(db, "users", uid), userDocPayload);
  } catch (error) {
    console.error(`Firestore Error: ${error.message}`);
    throw error;
  }
}

export async function changePassword(newPassword) {
  const user = auth.currentUser;
  if (user) {
    return await updatePassword(user, newPassword);
  }
  throw new Error("No user is signed in.");
}



