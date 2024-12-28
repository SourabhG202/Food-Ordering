const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const ejs = require("ejs");
const fileUpload = require("express-fileupload");
const { v4: uuidv4 } = require("uuid");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const path = require("path");

// Initialize Express App
const app = express();

// Set View Engine and Middleware
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());

// Database Connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Sourabh@2002",
  database: "foodorderingwesitedb", // Replace with your actual database name
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);
});

/*****************************  User-End Portal ***************************/

// Routes for User Sign-up, Sign-in, Home Page, Cart, Checkout, Order Confirmation, My Orders, and Settings
app.get("/", renderIndexPage);
app.get("/signup", renderSignUpPage);
app.post("/signup", signUpUser);
app.get("/signin", renderSignInPage);
app.post("/signin", signInUser);
app.get("/homepage", renderHomePage);
app.get("/cart", renderCart);
app.post("/cart", updateCart);
app.post("/checkout", checkout);
app.get("/confirmation", renderConfirmationPage);
app.get("/myorders", renderMyOrdersPage);
app.get("/settings", renderSettingsPage);
app.post("/address", updateAddress);
app.post("/contact", updateContact);
app.post("/password", updatePassword);

/***************************************** Admin End Portal ********************************************/
// Routes for Admin Sign-in, Admin Homepage, Adding Food, Viewing and Dispatching Orders, Changing Price, and Logout
app.get("/admin_signin", renderAdminSignInPage);
app.post("/admin_signin", adminSignIn);
app.get("/adminHomepage", renderAdminHomepage);
app.get("/admin_addFood", renderAddFoodPage);
app.post("/admin_addFood", addFood);
app.get("/admin_view_dispatch_orders", renderViewDispatchOrdersPage);
app.post("/admin_view_dispatch_orders", dispatchOrders);
app.get("/admin_change_price", renderChangePricePage);
app.post("/admin_change_price", changePrice);
app.get("/logout", logout);

/***************************** Route Handlers ***************************/

// Index Page
function renderIndexPage(req, res) {
  res.render("index");
}

// User Sign-up
function renderSignUpPage(req, res) {
  res.render("signup");
}

async function signUpUser(req, res) {
  const { name, address, email, mobile, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    connection.query(
      "INSERT INTO users (user_name, user_address, user_email, user_password, user_mobileno) VALUES (?, ?, ?, ?, ?)",
      [name, address, email, hashedPassword, mobile],
      function (error) {
        if (error) {
          console.error('Error inserting user:', error);
          res.status(500).send('Server error');
        } else {
          res.redirect("/signin");
        }
      }
    );
  } catch (err) {
    console.error('Error hashing password:', err);
    res.status(500).send('Server error');
  }
}

// User Sign-in
function renderSignInPage(req, res) {
  res.render("signin");
}

async function signInUser(req, res) {
  const { email, password } = req.body;
  connection.query(
    "SELECT user_id, user_name, user_password FROM users WHERE user_email = ?",
    [email],
    async function (error, results) {
      if (error || !results.length) {
        res.render("signin");
      } else {
        const isMatch = await bcrypt.compare(password, results[0].user_password);
        if (isMatch) {
          const { user_id, user_name } = results[0];
          res.cookie("cookuid", user_id);
          res.cookie("cookuname", user_name);
          res.redirect("/homepage");
        } else {
          res.render("signin");
        }
      }
    }
  );
}

// Render Home Page
function renderHomePage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        connection.query("SELECT * FROM menu", function (error, menuItems) {
          if (!error) {
            res.render("homepage", {
              username: userName,
              userid: userId,
              items: menuItems,
            });
          } else {
            console.error('Error fetching menu items:', error);
            res.status(500).send('Server error');
          }
        });
      } else {
        res.render("signin");
      }
    }
  );
}

// Render Cart Page
function renderCart(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("cart", {
          username: userName,
          userid: userId,
          items: citemdetails,
          item_count: item_in_cart,
        });
      } else {
        res.render("signin");
      }
    }
  );
}

// Update Cart
function updateCart(req, res) {
  const cartItems = req.body.cart;
  const uniqueItems = [...new Set(cartItems)];

  // Function to fetch details of items in the cart
  getItemDetails(uniqueItems);

  // Update cart logic if necessary
}

// Function to fetch details of items in the cart
let citemdetails = [];
let item_in_cart = 0; // Initialize the variable to store the count of items

function getItemDetails(citems) {
  citemdetails = [];
  citems.forEach((item) => {
    connection.query(
      "SELECT * FROM menu WHERE item_id = ?",
      [item],
      function (error, results_item) {
        if (!error && results_item.length) {
          citemdetails.push(results_item[0]);
        }
      }
    );
  });
  item_in_cart = citems.length;
}

// Checkout
function checkout(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        const { itemid, quantity, subprice } = req.body;
        const currDate = new Date();

        if (Array.isArray(itemid) && Array.isArray(quantity) && Array.isArray(subprice)) {
          itemid.forEach((item, index) => {
            if (quantity[index] != 0) {
              connection.query(
                "INSERT INTO orders (order_id, user_id, item_id, quantity, price, datetime) VALUES (?, ?, ?, ?, ?, ?)",
                [
                  uuidv4(),
                  userId,
                  item,
                  quantity[index],
                  subprice[index] * quantity[index],
                  currDate,
                ],
                function (error) {
                  if (error) {
                    console.error('Error inserting order:', error);
                    res.sendStatus(500);
                  }
                }
              );
            }
          });
        } else {
          if (quantity != 0) {
            connection.query(
              "INSERT INTO orders (order_id, user_id, item_id, quantity, price, datetime) VALUES (?, ?, ?, ?, ?, ?)",
              [
                uuidv4(),
                userId,
                itemid,
                quantity,
                subprice * quantity,
                currDate,
              ],
              function (error) {
                if (error) {
                  console.error('Error inserting order:', error);
                  res.sendStatus(500);
                }
              }
            );
          }
        }

        citemdetails = [];
        getItemDetails([]);
        res.render("confirmation", { username: userName, userid: userId });
      } else {
        res.render("signin");
      }
    }
  );
}

// Render Confirmation Page
function renderConfirmationPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("confirmation", { username: userName, userid: userId });
      } else {
        res.render("signin");
      }
    }
  );
}

// Render My Orders Page
function renderMyOrdersPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        connection.query(
          "SELECT * FROM orders WHERE user_id = ?",
          [userId],
          function (error, orders) {
            if (!error) {
              res.render("myorders", { username: userName, userid: userId, orders: orders });
            } else {
              console.error('Error fetching orders:', error);
              res.status(500).send('Server error');
            }
          }
        );
      } else {
        res.render("signin");
      }
    }
  );
}

// Render Settings Page
function renderSettingsPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("settings", { username: userName, userid: userId });
      } else {
        res.render("signin");
      }
    }
  );
}

// Update Address
function updateAddress(req, res) {
  const { address } = req.body;
  const userId = req.cookies.cookuid;
  connection.query(
    "UPDATE users SET user_address = ? WHERE user_id = ?",
    [address, userId],
    function (error) {
      if (error) {
        console.error('Error updating address:', error);
        res.status(500).send('Server error');
      } else {
        res.redirect("/settings");
      }
    }
  );
}

// Update Contact
function updateContact(req, res) {
  const { contact } = req.body;
  const userId = req.cookies.cookuid;
  connection.query(
    "UPDATE users SET user_mobileno = ? WHERE user_id = ?",
    [contact, userId],
    function (error) {
      if (error) {
        console.error('Error updating contact:', error);
        res.status(500).send('Server error');
      } else {
        res.redirect("/settings");
      }
    }
  );
}

// Update Password
async function updatePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  const userId = req.cookies.cookuid;
  connection.query(
    "SELECT user_password FROM users WHERE user_id = ?",
    [userId],
    async function (error, results) {
      if (error || !results.length) {
        res.status(500).send('Server error');
      } else {
        const isMatch = await bcrypt.compare(oldPassword, results[0].user_password);
        if (isMatch) {
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          connection.query(
            "UPDATE users SET user_password = ? WHERE user_id = ?",
            [hashedPassword, userId],
            function (error) {
              if (error) {
                console.error('Error updating password:', error);
                res.status(500).send('Server error');
              } else {
                res.redirect("/settings");
              }
            }
          );
        } else {
          res.render("settings", { message: "Old password is incorrect" });
        }
      }
    }
  );
}

/***************************************** Admin End Portal ********************************************/

// Admin Sign-in
function renderAdminSignInPage(req, res) {
  res.render("admin_signin");
}

async function adminSignIn(req, res) {
  const { email, password } = req.body;
  connection.query(
    "SELECT admin_id, admin_password FROM admin WHERE admin_email = ?",
    [email],
    async function (error, results) {
      if (error || !results.length) {
        res.render("admin_signin");
      } else {
        const isMatch = await bcrypt.compare(password, results[0].admin_password);
        if (isMatch) {
          res.redirect("/adminHomepage");
        } else {
          res.render("admin_signin");
        }
      }
    }
  );
}

// Admin Homepage
function renderAdminHomepage(req, res) {
  res.render("admin_homepage");
}

// Admin Add Food
function renderAddFoodPage(req, res) {
  res.render("admin_addFood");
}

function addFood(req, res) {
  const { foodName, foodPrice } = req.body;
  connection.query(
    "INSERT INTO menu (item_name, item_price) VALUES (?, ?)",
    [foodName, foodPrice],
    function (error) {
      if (error) {
        console.error('Error adding food:', error);
        res.status(500).send('Server error');
      } else {
        res.redirect("/adminHomepage");
      }
    }
  );
}

// Admin View and Dispatch Orders
function renderViewDispatchOrdersPage(req, res) {
  connection.query("SELECT * FROM orders WHERE status = 'pending'", function (error, results) {
    if (!error) {
      res.render("admin_view_dispatch_orders", { orders: results });
    } else {
      console.error('Error fetching orders:', error);
      res.status(500).send('Server error');
    }
  });
}

function dispatchOrders(req, res) {
  const { orderId } = req.body;
  connection.query(
    "UPDATE orders SET status = 'dispatched' WHERE order_id = ?",
    [orderId],
    function (error) {
      if (error) {
        console.error('Error dispatching order:', error);
        res.status(500).send('Server error');
      } else {
        res.redirect("/admin_view_dispatch_orders");
      }
    }
  );
}

// Admin Change Price
function renderChangePricePage(req, res) {
  res.render("admin_change_price");
}

function changePrice(req, res) {
  const { itemId, newPrice } = req.body;
  connection.query(
    "UPDATE menu SET item_price = ? WHERE item_id = ?",
    [newPrice, itemId],
    function (error) {
      if (error) {
        console.error('Error changing price:', error);
        res.status(500).send('Server error');
      } else {
        res.redirect("/adminHomepage");
      }
    }
  );
}

// Logout
function logout(req, res) {
  res.clearCookie("cookuid");
  res.clearCookie("cookuname");
  res.redirect("/");
}

module.exports = app;
