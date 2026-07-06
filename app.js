const express = require("express");

const app = express();

app.use(express.static("public"));

app.set("view engine", "ejs");

app.listen(3000);

app.get("/", (req,res)=>{

    res.render("home");

});

app.get("/product",(req,res)=>{

    res.render("product");

});

app.get("/cart",(req,res)=>{

    res.render("cart");

});

app.use(express.static("public"));