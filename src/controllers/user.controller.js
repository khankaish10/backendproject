import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiErrors.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return {
            accessToken, 
            refreshToken
        }


    } catch (error) {
        throw new ApiError(500, "something went wrong while generating token", error)
    }
}

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
    // const coverImageLocalPath = req.files?.coverImage[0].path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0 ) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

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
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
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

const loginUser = asyncHandler(async (req, res) => {

    //get user details
    const {username, email, password} = req.body;

    // validate- user details
    if((username === '' || email === '')) {
        throw new ApiError(400, "username or email is required")
    }

    // check user existence
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user) {
        throw new ApiError(500, "User not found");
    }

    // password check - bcrypt.compare
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid) {
        throw new ApiError(400, "Incorrect credentials");
    }

    // generate token - access/refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user?._id);
    
    // sanitizing response data
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    //cookies options
    const options = {
        httpOnly: true,
        secure: true,
    }

    // return response
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, "User loggedIn Successfully")
    )

}) 

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new : true
        }
    )

    //cookies options
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200,{}, "User loggedOut")
    )

})

const refreshAccessToken = asyncHandler (async (req, res) => {
    const incomingToken = req.cookie.refreshToken || req.body.refreshToken;
    if(!incomingToken) {
        throw new ApiError(401, "Unauthorize request")
    }

    const decodedToken = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET);
    if(!decodedToken) {
        throw new ApiError(400, "Invalid Token")
    }

    const user = await User.findById(decodedToken?._id);
    if(incomingToken !== user._refreshToken) {
        throw new ApiError(401, "Refreshed token is expired")
    }

    //cookies options
    const options = {
        httpOnly: true,
        secure: true,
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);
    
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,{accessToken, refreshToken}, "new Token created")
    )

})

export {
    registerUser, 
    loginUser,
    logoutUser,
    refreshAccessToken
}