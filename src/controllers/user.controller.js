import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiErrors.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'

const registerUser = asyncHandler( async (req, res) => {

    // get user details
    const {fullName, email, username, password} = req.body;

    // validate user details - not empty etc
    if(
        [fullName, email, username, password].some((fields) => 
        fields?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // check if user already exist
    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })

    if(existedUser) {
        throw new ApiError(409, "User with email or username already exist")
    }

    // handling images
    const avatarLocalPath = req.files?.avatar[0].path;
    const coverImageLocalPath = req.files?.coverImage[0].path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }

    // upload them to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url,
        email,
        password,
        username: username.toLowerCase()
    })

    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
    "-password -refreshToken")    // optional- extra db calls but future proof
    
    // check for user creation - optional
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user ");
    }


    return res.status(200).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )


}) 

export {registerUser}