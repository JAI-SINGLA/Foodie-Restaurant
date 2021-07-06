const express= require("express");
const async=require("async");
const path= require("path");
const cookieParser= require("cookie-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const PaytmChecksum = require('./paytm/checksum.js');
const https=require("https");
const passport= require("passport"),LocalStrategy = require('passport-local').Strategy;
const port=3000;

const app= express();
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"/views"));
app.use(express.static("assests"));
app.use(express.urlencoded({extended:false}));
app.use(express.json({ extended: false }));
app.use(cookieParser());


app.use(session({
	name:"tomato",
	secret:"allo",
	saveUninitailized:false,
	resave:false,
	cookie:{
		maxAge:(1000*60*100)
	}
}));

mongoose.connect('mongodb://localhost/myDB', {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Sucessfully Connected to database");
});
const restuarantSchema= new mongoose.Schema({
	name:String,
	password:{
		type:String,
		required:true
	},
	email:{
		type:String,
		required:true,
		unique:true
	},
	image:String,
	orders:[
	{orderId: String}
	],
	items:[
	{
		itemName:String,
		itemPrice:Number,
		itemImage:String
	}],
	delivery:[{
		pincode:Number,
		area:String,
		time:String,
		price:Number
	}]
},{
	timestamps:true
});
const userSchema= new mongoose.Schema({
	email:{
		type:String,
		unique:true,
		required:true
	},
	password:{
		type:String,
		required:true
	},
	name:{
		type:String
	},
	address:[{
		name:String,
		pincode:Number,
		area:String,
		city:String,
		state:String,
		details:String,
		phone:{
			type:String,
		}
	}],
	cart:[{
		restaurantId:String,
		itemId:String,
		quantity:Number,

	}],
	orders:[{orderId:String}]

},{timestamps:true});

const orderSchema = new mongoose.Schema({
	_id:String,
	txnId:String,
	txnDate:String,
	orderAmount:Number,
	paymentStatus:String,
	paymentMethod:String,
	order:[{
		quantity:Number,
		restaurantId:String,
		restaurantName:String,
		itemId:String,
		itemName:String,
		itemImage:String,
		status:String,
		amount:Number,
		delivery:String,
		deliveryTime:String
	}],
	customerId:String
},{_id:false,
timestamps:true});
const Restaurant= mongoose.model("Restaurant",restuarantSchema);
const User=mongoose.model("User",userSchema);
const Order=mongoose.model("Order",orderSchema);

passport.use(new LocalStrategy({
	usernameField:'email'
},
  function(email, password, done) {
    Restaurant.findOne({ email: email }, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      if (user.password!=password) { return done(null, false); }
      return done(null, user);
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});



passport.deserializeUser(function(id, done) {
  Restaurant.findById(id, function(err, user) {
  	if(err){
  		return done(err);
  	}
    return done(null, user);
  });
});


passport.checkAuthentication=function(req,res,next){
	if(req.isAuthenticated()){
		return next();
	}
	return res.redirect("/login");
}

passport.setAuthenticatedUser =function(req,res,next){
	if(req.isAuthenticated()){
		res.locals.user=req.user;
		//console.log(req.user);
	}
	next();
}
app.use(passport.initialize());
app.use(passport.session());
app.use(passport.setAuthenticatedUser);


app.get("/",async function(req,res){
	var allOrders=[];
	if(req.isAuthenticated()){
		try{
		  for(let i of req.user.orders){
		  	var doc;

			await Order.findById(i.orderId,function (err, docs) {
				//console.log("Id",i.orderId);
    if (err){
        console.log(err);
    }
    else{
    	// console.log("IN Else");
    	doc={
    		paymentStatus:docs.paymentStatus,
    		customerId:docs.customerId,
    		order:docs.order,
    		txnId:docs.txnId,
    		txnDate:docs.txnDate
    	}
    	console.log(doc);
    }});

    	if(doc.paymentStatus!="TXN_SUCCESS"){
    	}
    	else{
    	await User.findById(doc.customerId,function(err,customer){
    	// console.log(docs);
    	if(err){
    		console.log("Error");
    	}
        for(let j of doc.order){
        	// console.log(j)
        	if(j.restaurantId==req.user.id){        
        	let specificOrder={
        		specificOrderId:j.id,
        		orderId:i.orderId,
        		itemName:j.itemName,
        		itemId:j.itemId,
        		itemImage:j.itemImage,
        		quantity:j.quantity,
        		restaurantName:j.restaurantName,
        		amount:j.amount,
        		delivery:j.delivery,
        		deliveryTime:j.deliveryTime,
        		txnId:doc.txnId,
        		txnDate:doc.txnDate,
        		address:customer.address,
        	}
        	if(j.status){
        		console.log("in if");
        		specificOrder.status=j.status;
        	}
        	else{
        		specificOrder.status=doc.paymentStatus;
        	}
        	allOrders.push(specificOrder);
        	console.log("Checking all orders");
        	console.log(allOrders);}
        }
        console.log("j wala loop")
    });


    }
    }
		}catch(err){console.log("Error")}
		console.log("final");
		res.render("home",{
			allOrders:allOrders
		});
	}
	else{
		res.redirect("/login");
	}
});

app.get("/login",function(req,res){
	if(req.isAuthenticated()){
		res.redirect("/");
	}
	else{
		res.render("login");
	}
});
app.get("/signup",function(req,res){
	if(req.isAuthenticated()){
		res.redirect("/");
	}
	else{
		res.render("signup");
	}
});

app.get("/deleteItem/:id",function(req,res){
	console.log(req.params.id);
	if(req.isAuthenticated()){
		req.user.items.pull(req.params.id);
		req.user.save(function(err){
			if(!err){
				res.redirect("/");
			}
		});
   }
   else{
	res.redirect("/");
	}
});
app.get("/deleteDelivery/:id",function(req,res){
	console.log(req.params.id);
	if(req.isAuthenticated()){
		req.user.delivery.pull(req.params.id);
		req.user.save(function(err){
			if(!err){
				res.redirect("/");
			}
		});
   }
   else{
	res.redirect("/");
	}
});

app.get("/signout",function(req,res){
	res.locals.loggedIn=false;
	req.logout();
	return res.redirect("/");
});


app.post("/change",async function(req,res){
	if(req.body.status=="Delivered"){
		res.redirect("/");
	}
	console.log("making changr request");
	try{
	var newStatus;
	if(req.body.status=="TXN_SUCCESS"){
		newStatus="Packed";
	}
	else if(req.body.status=="Packed"){
		newStatus="Shipped";
	}
	else if(req.body.status=="Shipped"){
		newStatus="Delivered";
	}
	console.log("newStatus",newStatus);
	console.log(req.body.orderId);
	console.log(req.body.itemId);

		await Order.updateOne({_id:req.body.orderId,"order.itemId":req.body.itemId},{'$set': {
    						'order.$.status':newStatus
    						}});
	}catch(err){
		console.log("Error");
	}
	res.redirect("/");
});

app.post("/cancel",async function(req,res){
	try{
	await Order.updateOne({_id:req.body.orderId,"order.itemId":req.body.itemId},{'$set': {
    						'order.$.status':"Cancelled-Refunded"
    						}});
	}catch(err){
		console.log("Error");
	}
	res.redirect("/");
})
app.post("/addItem",function(req,res){
	if(req.isAuthenticated()){
		//console.log(req);
		var newItem={
		itemName:req.body.itemName,
		itemPrice:req.body.itemPrice,
		itemImage:req.body.itemImage
		}
		req.user.items.push(newItem);
		req.user.save(function(err){
			if(!err){
				res.redirect("/");
			}
		});
	}
	else{
		res.redirect("/login");
	}
});
app.post("/addDelivery",function(req,res){
	if(req.isAuthenticated()){
		//console.log(req);
		var newItem={
		pincode:req.body.pincode,
		area:req.body.area,
		time:req.body.time,
		price:req.body.price
		}
		req.user.delivery.push(newItem);
		req.user.save(function(err){
			if(!err){
				res.redirect("/");
			}
		});
	}
	else{
		res.redirect("/login");
	}
});

app.post("/signup",function(req,res){

	if(req.body.password!=req.body.confirmPassword){
		return res.redirect("/signup");
	}
	Restaurant.findOne({email:req.body.email},function(err,user){
		if(err){
			console.log("Error");
			return;
		}
		if(!user){
			Restaurant.create({
				email:req.body.email,
				password:req.body.password,
				name:req.body.name,
				image:req.body.image
			},function(err){
				if(!err){
					return res.redirect("/login");
				}
			});
		}
		else{
			return res.redirect('back');
		}
	});


})

app.post('/login',
  passport.authenticate('local', { successRedirect: '/',
                                   failureRedirect: '/login',
                                   failureFlash: true })
);


app.listen(port,function(err){
	if(err){
		console.log(err);
	}
	else{
		console.log("Server running on port:",port);
	}
})