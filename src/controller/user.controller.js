import { asyncHandler } from "../utils/asyncHandler.js";
// import {ApiError} from './utils/apiError.js'
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
// import { ApiResponse } from "./utils/apiResponse.js";
import jwt from 'jsonwebtoken'
import mongoose from "mongoose"; 

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

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        // console.log(accessToken,refreshToken)
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const loginUser = asyncHandler( async (req,res) => {
    // user data from frontend
    // check username or email
    // find user
    // password check
    // access or refresh token
    // send coockies
    console.log(req.body)
    const {email, username, password} = req.body
    
    if(!username && !email){
        throw new ApiError(400,"username or password email")
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })
    console.log(user)
    if(!user){
        throw new ApiError(404,"User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    console.log(isPasswordValid)
    if(!isPasswordValid){
        throw new ApiError(401,"invalid user credencial")
    }

    const { refreshToken, accessToken } =  await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,{
                user:loggedInUser,accessToken,refreshToken
            },
            "user login succesfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,{
            $unset:{
                refreshToken:1
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logout"))
})

const refreshAccessToken = asyncHandler(async(req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"refresh token is expired")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newRefreshToken},
                "access token refresh"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword,newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(isPasswordCorrect){
        throw new ApiError(400,"Invalid old Password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"password cahnged successfully"))
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(200,req.user,"Current user fetched successfully")
})

const updateAccountDetail = asyncHandler(async(req,res) => {
    const {fullName, email} = req.body
    if(!fullName || !email){
        throw new ApiError(400,"All feild required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname:fullName,
                email:email
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account detail update successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {
   const avatarLocalPath =  req.file?.path

   if(!avatarLocalPath) {
    throw new ApiError(400,"avatar file is missing")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   if(!avatar.url) {
    throw new ApiError(400,"Error while uploading on avatar")
   }

   const user = await User.findByIdAndUpdate(
    req.user._id,
    {
        $set:{
            avatar:avatar.url
        }
    },
    {new:true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200),user,"avatar updated successfully")
})

const updateUserCoverImage = asyncHandler(async(req,res) => {
   const coverImageLocalPath =  req.file?.path

   if(!coverImageLocalPath) {
    throw new ApiError(400,"coverImage file is missing")
   }

   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   if(!coverImage.url) {
    throw new ApiError(400,"Error while uploading on avatar")
   }

   const user = await User.findByIdAndUpdate(
    req.user._id,
    {
        $set:{
            coverImage:coverImage.url
        }
    },
    {new:true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200),user,"coverImage updated successfully")
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params

    if((!username?.trim())){
        throw new ApiError(400,"User is missing")
    }
    console.log(username)
    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        { 
            $addFields:{
            subscribersCount:{
                $size:"$subscribers"
            },
            
            channelsSubscribedToCount:{
                $size:"$subscribedTo"
            },
            isSubscribed:{
                $cond:{
                    if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                    then:true,
                    else:false
                }
            }
        }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel does not exists")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,channel[0],"User channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            },
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    console.log(res)
    return res
    .status(200)
    .json(new ApiResponse(200,user[0].watchHistory),"watch History fetched suceessfully")
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetail,
    updateUserAvatar,
    getUserChannelProfile,
    updateUserCoverImage,
    getWatchHistory
}