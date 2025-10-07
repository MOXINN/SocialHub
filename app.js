const express = require('express');
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require("crypto");
const path = require("path");
const upload = require("./config/multerconfig");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname,"public")));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.render("index");
});

app.get('/login', (req, res) => {
  res.render("login");
})

app.post('/register', async (req, res) => {
   let { email, password, username, name, age} = req.body;

    let user =  await userModel.findOne({ email: email });
    if(user) return res.status(409).send("User already register");
     
    const saltrounds = 10;
   bcrypt.hash(password, saltrounds, async (err, hash) => {
    if(err) {
        console.error('Hashing error', err);
        return res.status(500).send("Something went wrong. Please try again later.")
    };
  let user =  await userModel.create({
        name: name,
        username: username,
        email: email,
        age: age,
        password: hash
    });

    let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
    res.cookie("token", token);
    res.render('login');
  })
});

app.post('/login', async (req, res) => {
    let {identifier, password} = req.body;

    let user =  await userModel.findOne({ $or:[{ email: identifier },{username: identifier}]});
    if(!user) return res.status(409).send("Sorry, your password was incorrect.");
    
    bcrypt.compare(password, user.password, (err, result) => {
      if(result){
        let token = jwt.sign({ email: user.email, userid: user._id }, "shhhh");
       res.cookie("token", token);
       res.status(200).redirect("/profile");
      }
      else res.redirect("/login");
    })
});

//Protected route security matters in this route only logged in user veiws this route
app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate("posts");
  
  if (!user.profileImage) {
    user.profileImage = "default.png";
  }

  res.render("profile", { user });
});


//editprofile
app.get('/editprofile', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({email: req.user.email});
  res.render("editprofile", {user});
});

//Route of method post for upload and update image by multer
app.post('/upload/:id', isLoggedIn, upload.single("profileImage"), async (req,res) => {
 try{
  if(!req.file) return res.status(400).send("No file uploaded");

    //build updated object without using object spread
    const updateData = Object.assign({},req.body,{
      profileImage: req.file.filename
    });
  
  //Update user with uploaded file path
  const user = await userModel.findByIdAndUpdate(req.params.id,
    updateData, {new:true});
    
  res.redirect("/profile"); //after success redirect to profile page
 }catch (err) {
  console.error(err);
  res.status(500).send("Error uploading image")
 }
});

app.get('/edit/:id', isLoggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  const user = req.user;
  if (!post) return res.status(404).send('Post not found');
  res.render('edit', { post, user });
});


//edit post route render
app.post('/edit/:id', isLoggedIn, async (req, res) => {
  const action = req.body.action;
  const postId = req.params.id;

  if (action === 'update') {
    await postModel.findByIdAndUpdate(postId, { content: req.body.content });
    return res.redirect('/profile');
  } else if (action === 'delete') {
    await postModel.findByIdAndDelete(postId);
    return res.redirect('/profile');
  } else {
    // Handle unexpected action
    return res.status(400).send('Invalid action');
  }
});
//Delete route
// app.post("/delete/:id", isLoggedIn, async (req, res) =>{
//   let post = await postModel.findOneAndDelete({_id:req.params.id});
//   res.redirect("/profile");
// })



// like route
app.get("/like/:id", isLoggedIn, async (req, res) => {
 let post =  await postModel.findOne({_id : req.params.id}).populate("user");

 if(post.likes.indexOf(req.user.userid) === -1){
  post.likes.push(req.user.userid);
 }else{
  post.likes.splice(post.likes.indexOf(req.user.userid), 1);
 }
 
 await post.save();
  res.redirect("/profile");
})


app.post("/post", isLoggedIn, async (req, res) => {
 let user =  await userModel.findOne({email: req.user.email});
 let {content} = req.body;

  let post = await postModel.create({
    user: user._id,
    content
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile")
}); 


// checking cookies
app.get('/read', (req, res) => {
  res.send(req.cookies);
})


app.get('/logout', (req, res) => {
  res.cookie("token", "");
  res.redirect("/login");
});

//middleware
function isLoggedIn(req, res, next){
if(!req.cookies.token || req.cookies.token === ""){
  return res.redirect("/login");
} 
try{
 let data =  jwt.verify(req.cookies.token, "shhhh");
 req.user = data;
next();
}catch (err){
  return res.redirect("/login");
}
}


app.listen(3000);