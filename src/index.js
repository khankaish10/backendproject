import dotenv from 'dotenv'
import connectDb from './db/index.js'

dotenv.config({path: './env'})

connectDb()
.then(() => {
    app.listen(proces.env.PORT || 8000, () =>  
        console.log(`server is running at ${process.env.PORT}`)
    )
})
.catch(err => {
    console.log("Mongo db connection failed !!", err)
})
