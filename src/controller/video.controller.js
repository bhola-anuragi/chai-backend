import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import {Video} from '../models/video.model.js'
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    if(!title){
        throw new ApiError(400,"Title is required")
    }
    if(!description){
        throw new ApiError(400,"Description is required")
    }
    // get a video
    // check a video
    //  get a thumbnail title and description
    // check info
    // upload video
    // TODO: get video, upload to cloudinary, create video
    const thumbnailLocalPath = req.files?.thumbnail[0].path
    const videoLocalPath = req.files?.videoFile[0].path
    console.log(videoLocalPath)
    if(!thumbnailLocalPath){
        throw new ApiError(400,"thumbnail is required")
    }
    if(!videoLocalPath){
        throw new ApiError(400,"video is required")
    }

    const video = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    console.log(video.duration)
    if(!video){
        throw new ApiError(400,"video is not uploaded")
    }
    if(!thumbnail){
        throw new ApiError(400,"thumbnail is not uploded")
    }
    const owner = req.user._id
    console.log(owner)
    const userVideo = await Video.create({
        title:title,
        description:description,
        videoFile:video.url,
        duration:video.duration,
        thumbnail:thumbnail.url,
        owner:owner

    })
    console.log(userVideo)

    // const uploadedVideo = await User.findById(_id)
    
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if(videoId){
        throw new ApiError(400,"videoId is required")
    }

    
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}