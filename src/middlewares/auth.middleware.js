import  jwt  from "jsonwebtoken";
import { ApiError } from "../utils/ApiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";



export const verifyJWT = asyncHandler( async (req, _, next) => {

    // getting token from 
    //        1. cookies injected as accessToken and refreshToken
    //        2. header("Authorization") --- during mobile apps because app doesnot have cookies
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")

    if(!token) {
        throw new ApiError(400, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
     
    const user = await User.findById(decodedToken._id).select("-password -refreshToken");
    if(!user) {
        throw new ApiError(400, "Invalid Access Token")
    }

    req.user = user;

    next();

})