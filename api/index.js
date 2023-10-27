const express = require("express");
const app = express();
const cors = require("cors");
const { default: mongoose } = require("mongoose");
const User = require("./models/User.js");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');


const Place = require("./models/Place.js");
const Booking = require("./models/Booking.js");
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "fasefraw4r5r3wq45wdfgw34twdfg";
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);
//x2yNMwxMlZzYtynr
console.log(process.env.MONGO_URL);

app.get("/api/test", (req, res) => {
  res.json("Test Ok");
});

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}



async function uploadToS3(path, originalFilename, mimetype) {
  return new Promise(async (resolve, reject) => {
    const client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
    const parts = originalFilename.split('.');
    const ext = parts[parts.length - 1];
    const newFileName = Date.now() + '.' + ext;
    console.log({path,parts,ext,newFileName});
    const data = await client.send(new PutObjectCommand({
      Bucket: 'vaibhav-booking-app',
      Body: fs.readFileSync(path),
      ACL: 'public-read',
      Key: newFileName,
      ContentType: mimetype,
    }));
    resolve(`https://vaibhav-booking-app.s3.amazonaws.com/${newFileName}`);
  });
}


app.post("/api/register", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { name, email, password } = req.body;

  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post("/api/login", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        {
          email: userDoc.email,
          id: userDoc._id,
        },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;
          res
            .cookie("token", token, {
              sameSite: "none",
              secure: true,
            })
            .json(userDoc);
        }
      );
    } else {
      res.status(422).json("pass not ok");
    }
  } else {
    res.json("not found");
  }
});

app.get("/api/profile", (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post("/api/logout", (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  res.cookie("token", "").json(true);
});

console.log({ __dirname });
// app.post("/upload-by-link", async (req, res) => {
//   mongoose.connect(process.env.MONGO_URL);
//   const { link } = req.body;
//   const newName = "photo" + Date.now() + ".jpg";
//   const destination = path.join(__dirname, "uploads", newName);
//   //console.log(destination);
//   await imageDownloader.image({
//     url: link,
//     dest: __dirname + "\\uploads" + "\\" + newName,
//   });
//   res.json(newName);
// });


app.post("/api/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  const destination = path.join(__dirname, "uploads", newName);
  //console.log(destination);
  await imageDownloader.image({
    url: link,
    dest: '\\tmp\\' + newName,
  });
 const url = await uploadToS3('\\tmp\\' + newName, newName, mime.lookup('\\temp\\' + newName));

  res.json(url);
});

// const photoMiddleware = multer({ dest: "uploads/" });
//  app.post("/upload", photoMiddleware.array("photos", 100), (req, res) => {
//   const uploadedFiles = [];
//   for (let i = 0; i < req.files.length; i++) {
//     const { path, originalname } = req.files[i];
//     const parts = originalname.split(".");
//     const ext = parts[parts.length - 1];
//     const newPath = path + "." + ext;
//     fs.renameSync(path, newPath);
//     uploadedFiles.push(newPath.replace("uploads\\", ""));
//   }

//   res.json(uploadedFiles);
// });


const photosMiddleware = multer({dest:'/tmp'});
app.post("/api/upload", photosMiddleware.array('photos', 100), async (req,res) => {
  const uploadedFiles = [];

  for (let i = 0; i < req.files.length; i++) {
    const {path,originalname,mimetype} = req.files[i];
    console.log(req.files[i]);
    const location = await uploadToS3(path, originalname, mimetype);
    uploadedFiles.push(location);
  }
  res.json(uploadedFiles);
});

app.post("/api/places", (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const {
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      photos: addedPhotos,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    });
    res.json(placeDoc);
  });
});

app.get("/api/user-places", (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get("/api/places/:id", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put("/api/places", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json("ok");
    }
  });
});

app.get("/api/places", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  res.json(await Place.find());
});

app.post("/bookings", async(req, res) => {
  mongoose.connect(process.env.MONGO_URL);
 
  const userData = await getUserDataFromReq(req);
  const { place, checkIn, checkOut, numberOfGuests, 
    name, phone, price } = req.body;

  Booking.create({
    place,
    checkIn,
    checkOut,
    numberOfGuests,
    name,
    phone,
    price,
    user: userData.id,
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      throw err;
    });
});

//bookings should be visible to respective looged in user only, thus userData.id
app.get("/api/bookings", async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate('place'));  //this place is declared as ref in booking,js model it creates object in it
});

app.listen(4000);
