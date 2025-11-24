import { changePassword as changePasswordService, createUser, newUserDoc, signInUser, signOutUser, userForgotPassword } from "../services/firebase/auth.sevices";
// import { HttpStatus }  from "../../enums/status";
import { HttpStatus } from "@/enums/status";
import { userDocRef } from "../services/firebase/users.services";

export const signIn = async ( req ) => {
    const { email, password } = req;
    try{
        const userData = await signInUser(email, password);
        
        return { 
            status: HttpStatus.OK, 
            message: "User signed in successfully",
            data: userData  
        };
    }catch(error){
        console.error(`Sign In Error: ${error.message}`);
        return { 
            status: HttpStatus.BAD_REQUEST, 
            message: error.message 
        };
    };
};

export const checkUserIfExist = ( uid ) => {
    const userCollection = userDocRef("users", uid);
    if(userCollection) return true;
    return false;   
}

export const signUp = async ( req ) => {
    const { email, password, role } = req;
    try{
        const userCredentials = await createUser(email, password);
        await newUserDoc(userCredentials, role, req);
        // const {uid} = userCredentials.user;
        // setRole(uid)
        // console.log(userDoc)

        return { 
            status: HttpStatus.OK, 
            message: "User created successfully" ,
            data: userCredentials
        }
    }catch(error){
        console.error(`Creating User Error: ${error.message}`);
        return { 
            status: HttpStatus.BAD_REQUEST, 
            message: error.message 
        };
    };
};

export const signOut = async ( req ) => {
    try{
        const {uid} = req;
        if(!uid) throw new Error("User id not found")

        await signOutUser();
        return { 
            status: HttpStatus.OK, 
            message: "User signed out successfully" 
        };
    }catch(error){
        console.error(`Sign out Error: ${error.message}`);
        return { 
            status: HttpStatus.BAD_REQUEST, 
            message: error.message 
        };
    };
};

export const forgotPassword = async ( email ) => {
    try{
        // const { email } = req;

        if(!email) throw new Error("Email not specified")

        await userForgotPassword(email);
        return { 
            status: HttpStatus.OK, 
            message: "Password reset email sent successfully" 
        };
    }catch(error){
        console.error(`Forgot password Error: ${error.message}`);
        return { 
            status: HttpStatus.BAD_REQUEST, 
            message: error.message 
        };
    }
};

export const changePassword = async ( newPassword ) => {
    try {
        await changePasswordService(newPassword);
        return {
            status: HttpStatus.OK,
            message: "Password updated successfully",
        };
    } catch (error) {
        console.error(`Change password Error: ${error.message}`);
        return {
            status: HttpStatus.BAD_REQUEST,
            message: error.message,
        };
    }
};

