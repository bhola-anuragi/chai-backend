import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from '../utils/apiError.js'
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req,res) => {
    // get user deatails from frontend
    // vallidation - not empty
    // check if user already exist: username,email
    // check for image, check for avatar
    // upload them to cloudnary, avatar
    // create usaer object - create user in db
    // remove password and refresh token feilds from response
    // check for user creation
    // return res


    const {fullname,password, email, username} = req.body

    // console.log('username:',username);

    if(
        [fullname,password,username,email].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400,"all fields are reqiured")
    }
    
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser){
        throw new ApiError(409,"user with email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    // console.log(avatarLocalPath)
    if (!avatarLocalPath) {
        throw new ApiError(400,"avatar file is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // console.log(avatar)
    if(!avatar) {
        throw new ApiError(400,"avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username
    })
    // console.log(user)
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser) {
        throw new ApiError(500,"something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser,"User regidtered succressfully")
    )
})

export {registerUser}