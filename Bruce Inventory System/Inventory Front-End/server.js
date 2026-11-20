// load the things we need
var express = require('express');
var app = express();
const crypto = require('crypto');
const config = require('./config');

// required module to make calls to a REST API
const axios = require('axios');

app.use(express.urlencoded({ extended: false }));

// Products with fewer than this many on hand count as "low stock" (Home and Reports)
const LOW_STOCK_THRESHOLD = 10;

// ---- Login session: a signed cookie, so pages can't be opened without logging in ----
// The secret changes every time the server starts, which also logs everyone out on restart.
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'bruce_session';

function sign(value) {
    return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function getCookie(req, name) {
    const header = req.headers.cookie || '';
    for (const part of header.split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === name) return decodeURIComponent(v.join('='));
    }
    return null;
}

function isLoggedIn(req) {
    const token = getCookie(req, SESSION_COOKIE);
    if (!token) return false;
    const [user, sig] = token.split('.');
    if (!user || !sig) return false;
    const expected = sign(user);
    return sig.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function requireLogin(req, res, next) {
    if (isLoggedIn(req)) return next();
    res.redirect('/');
}

// set the view engine to ejs
app.set('view engine', 'ejs');

// use res.render to load up an ejs view file

app.get('/', function(req, res) {
    res.render('pages/index.ejs', {login:"false"});
});

//main function page
app.get('/main', requireLogin, (req, res) => {
    // Fetch all products from the API
    axios.get(`http://127.0.0.1:5000/api/stock`)
    .then((response) => {
        const products = response.data;
        const tagline = "Low Stock Products";

        // Filter products where on-hand count is less than 10
        const filteredProducts = products.filter(product => product.instock < LOW_STOCK_THRESHOLD);

        // Render the page with filtered products for the chart
        res.render('pages/main', { 
            product: filteredProducts,
            tagline: tagline,
            auth: true // Pass authentication status
        });
    })
    .catch((error) => {
        console.error("Error fetching products:", error);
        res.status(500).send("Error fetching products");
    });
});

//logout 
app.get('/logout', function(req, res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.render('pages/index.ejs', {login:"logout"});
});

//login
app.post('/process_login', function(req, res){
    var user = req.body.username;
    var password = req.body.password;

    if (user === config.adminUser && password === config.adminPassword) {
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${user}.${sign(user)}; HttpOnly; SameSite=Lax; Path=/`);
        res.redirect('/main');
    } else {
        res.render('pages/index.ejs', {login:"true"});
    }
});

app.get('/reports', requireLogin, (req, res) => {
    // Fetch all products from the API
    axios.get(`http://127.0.0.1:5000/api/stock`)
    .then((response) => {
        const products = response.data;
        const tagline = "Low Stock Products";
        const tagline2 = "Out of Stock Products";

        // Filter products where on-hand count is less than 10, more than 0
        const lowProducts = products.filter(product => product.instock > 0 && product.instock < LOW_STOCK_THRESHOLD);
        const outProducts = products.filter(product => product.instock == 0);

        // Retrieve filters from query parameters
        const nameFilter = req.query.nfilter || ''; // Name filter
        const categoryFilter = req.query.filter || ''; // Category filter

        // Filter products based on the filters
        const lowfilteredProducts = lowProducts.filter(lowproduct => {
            const nameMatches = !nameFilter || lowproduct.s_name.toLowerCase().includes(nameFilter.toLowerCase());
            const categoryMatches = !categoryFilter || (lowproduct.s_category && lowproduct.s_category.toLowerCase() === categoryFilter.toLowerCase());
            return nameMatches && categoryMatches;
        });

        // Filter products based on the filters
        const outfilteredProducts = outProducts.filter(outproduct => {
            const nameMatches = !nameFilter || outproduct.s_name.toLowerCase().includes(nameFilter.toLowerCase());
            const categoryMatches = !categoryFilter || (outproduct.s_category && outproduct.s_category.toLowerCase() === categoryFilter.toLowerCase());
            return nameMatches && categoryMatches;
        });

        // Render the page with filtered products for the reports
        res.render('pages/report', { 
            lowproduct: lowfilteredProducts,
            outproduct: outfilteredProducts,
            tagline: tagline,
            tagline2: tagline2,
            nfilter: nameFilter,
            filter: categoryFilter
        });
    })
    .catch((error) => {
        console.error("Error fetching products:", error);
        res.status(500).send("Error fetching products");
    });
});

app.get('/filter_products', requireLogin, (req, res) => {
    axios.get(`http://127.0.0.1:5000/api/stock`)
    .then((response) => {
        const products = response.data;
        const tagline = "Inventory";

        // Retrieve filters from query parameters
        const nameFilter = req.query.nfilter || ''; // Name filter
        const categoryFilter = req.query.filter || ''; // Category filter

        // Filter products based on the filters
        const filteredProducts = products.filter(product => {
            const nameMatches = !nameFilter || product.s_name.toLowerCase().includes(nameFilter.toLowerCase());
            const categoryMatches = !categoryFilter || (product.s_category && product.s_category.toLowerCase() === categoryFilter.toLowerCase());
            return nameMatches && categoryMatches;
        });

        // Render the page with products and filter values
        res.render('pages/dashboard', { 
            product: filteredProducts,
            nfilter: nameFilter,         // Pass name filter value
            filter: categoryFilter,     // Pass category filter value
            tagline: tagline       
        });
    })
    .catch((error) => {
        console.error("Error fetching products:", error);
        res.status(500).send("Error fetching products");
    });
});


app.get('/filter_stockchange', requireLogin, (req, res) => {
    axios.get(`http://127.0.0.1:5000/api/stock_change`)
    .then((response) => {
        const stockchanges = response.data;
        const tagline = "Stock Change History";

        // Retrieve filters from query parameters
        const nameFilter = req.query.nfilter || ''; // Name filter (s_id)
        const startDate = req.query.startDate || ''; // Start date filter
        const endDate = req.query.endDate || ''; // End date filter

        // Filter stock changes based on the filters.
        // Dates are compared as YYYY-MM-DD strings so timezones can't shift a day,
        // and each date is optional on its own.
        const toYMD = (d) => new Date(d).toISOString().split('T')[0];
        const filteredschange = stockchanges.filter(stockchange => {
            const nameMatches = !nameFilter || stockchange.s_id.toString() === nameFilter;
            const day = toYMD(stockchange.up_date);
            const dateMatches = (!startDate || day >= startDate) && (!endDate || day <= endDate);
            return nameMatches && dateMatches;
        });

        // Prepare unique product IDs and corresponding names for the dropdown
        const uniqueProducts = Array.from(new Set(stockchanges.map(item => item.s_id)))
            .map(id => ({
                id,
                name: stockchanges.find(item => item.s_id === id).s_name // Get corresponding product name
            }));

        // Render the page with products and filter values
        res.render('pages/history', { 
            stockchange: filteredschange,
            nfilter: nameFilter,         // Pass name filter value
            startDate: startDate,           // Pass start date for the input
            endDate: endDate,               // Pass end date for the input
            tagline: tagline,               // Pass tagline
            uniqueProducts                 // Pass unique products for the dropdown
        });
    })
    .catch((error) => {
        console.error("Error fetching products:", error);
        res.status(500).send("Error fetching products");
    });
});

app.post('/add_product', requireLogin, function(req, res) {
    // Extract product details from the request body
    const proname = req.body.proname;
    const proprice = parseFloat(req.body.proprice); // Ensure the price is a number
    const prooh = parseInt(req.body.prooh, 10); // Ensure the on-hand count is an integer
    const procat = req.body.cats;
 
 
    // Capture filter values from the request body
    const currentNameFilter = req.body.nfilter || '';
    const currentCategoryFilter = req.body.filter || '';
 
 
    // Validate input data to prevent issues
    if (!proname || isNaN(proprice) || isNaN(prooh) || !procat) {
        console.error("Invalid input data for adding product.");
        return res.status(400).send("Invalid input data for adding product.");
    }
 
 
    // Make the API call to add the product with a timeout configuration
    axios.post('http://127.0.0.1:5000/api/stock', {
        s_name: proname,
        s_price: proprice,
        instock: prooh,
        s_category: procat
    }, { timeout: 5000 }) // Added timeout configuration
    .then((response) => {
        console.log("Product added successfully:", {
            name: proname,
            price: proprice,
            onhand: prooh,
            category: procat
        });
 
 
        // Redirect to the filtered product list
        res.redirect(`/filter_products?nfilter=${encodeURIComponent(currentNameFilter)}&filter=${encodeURIComponent(currentCategoryFilter)}`);
    })
    .catch((error) => {
        if (error.response) {
            // The request was made, but the server responded with a status code not in the 2xx range
            console.error("Error adding product - Server response:", error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error("Error adding product - No response received:", error.request);
        } else {
            // Something else happened during the request setup
            console.error("Error adding product:", error.message);
        }
        res.status(500).send("Error adding product");
    });
 });
 

app.post('/update_product/:s_id', requireLogin, function(req, res) {
    const sid = req.params.s_id;
    const sname = req.body.proname;
    const newPrice = parseFloat(req.body.proprice); // New price
    const newOnHand = parseInt(req.body.prooh, 10); // New on-hand quantity
    const newCategory = req.body.cats; // New category

    // Capture the filter values
    const currentNameFilter = req.body.nfilter || '';
    const currentCategoryFilter = req.body.filter || '';

    // Validate input data to prevent issues
    if (!sname || isNaN(newPrice) || isNaN(newOnHand) || !newCategory) {
        console.error("Invalid input data for updating product.");
        return res.status(400).send("Invalid input data for updating product.");
    }

    // Update the products in the database
    axios.put('http://127.0.0.1:5000/api/stock', {
        s_id: sid,
        s_name: sname,
        s_price: newPrice,
        instock: newOnHand,
        s_category: newCategory
    })
    .then(() => {
        console.log("Product updated:", {
            sid: sid, 
            name: sname, 
            price: newPrice, 
            onhand: newOnHand, 
            category: newCategory 
        });
        // Redirect with current filter values
        res.redirect(`/filter_products?nfilter=${encodeURIComponent(currentNameFilter)}&filter=${encodeURIComponent(currentCategoryFilter)}`);
    })
    .catch((error) => {
        console.error("Error updating product:", error);
        res.status(500).send("Error updating product");
    });
});



app.post('/delete_product/:s_id', requireLogin, function(req, res) {
    const sid = req.params.s_id;

    // Capture filter values from the request body or query parameters
    const nameFilter = req.body.nfilter || ''; // Name filter
    const categoryFilter = req.body.filter || ''; // Category filter

    axios.delete('http://127.0.0.1:5000/api/stock', { data: { s_id: sid } })
        .then(() => {
            console.log("Product ID Deleted: " + sid);

            // Redirect back to the filter route with the current filter values
            res.redirect(`/filter_products?nfilter=${encodeURIComponent(nameFilter)}&filter=${encodeURIComponent(categoryFilter)}`);
        })
        .catch((error) => {
            console.error("Error deleting product:", error);
            res.status(500).send("Error deleting product");
        });
});



app.listen(9000);
console.log('9000 is the magic port');
