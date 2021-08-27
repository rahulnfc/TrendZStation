var express = require('express');
const { response } = require('../app');
const adminHelpers = require('../helpers/admin-helpers');
const { ReplSet } = require('mongodb');
const session = require('express-session');
var router = express.Router();
var base64ToImage = require('base64-to-image');
const voucher_codes = require('voucher-code-generator');
const verifyLogin = (req, res, next) => {
  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  let admin = req.session.adminloggedIn
  if (admin) {
    next()
  } else {
    res.redirect('/admin-login')
  }
}

/* GET users listing. */
router.get('/admin', verifyLogin, async (req, res) => {
  req.session.admin = true
  let Revenue = await adminHelpers.totalRevenue()
  let monthsales = await adminHelpers.ordersGraph()
  let completed_orders = await adminHelpers.completed_orders()
  let canceled_orders = await adminHelpers.canceled_orders()
  let totalProducts = await adminHelpers.totalProducts()
  let ordercount = await adminHelpers.ordercount()
  let usercount = await adminHelpers.usercount()
  res.render('admin/index', { admin: true, Revenue, monthsales, completed_orders, canceled_orders, ordercount, totalProducts, usercount })
});

router.get('/admin-login', (req, res) => {
  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  let Admin = req.session.admin
  if (Admin) {
    res.redirect('/admin')
  } else {
    res.render('admin/login', { admin: true, rahul: true, "adminloginErr": req.session.adminloginErr, "adminemailErr": req.session.adminemailErr, "adminpassErr": req.session.adminpassErr })
    req.session.adminemailErr = false
    req.session.adminpassErr = false
  }
})

router.post('/admin-login', (req, res) => {
  admin = {
    name: 'Admin',
    email: 'admin@gmail.com',
    password: 1234
  }
  if (admin.email != req.body.Email) {
    req.session.adminemailErr = true
    res.redirect('/admin-login');
    req.session.adminemailErr = false
  }
  else if (admin.password != req.body.Password) {
    req.session.adminpassErr = true
    res.redirect('/admin-login');
    req.session.adminpassErr = false
  }
  else if (admin.email == req.body.Email && admin.password == req.body.Password) {
    req.session.adminloggedIn = true
    res.redirect('/admin');
    // req.session.adminloggedIn = false
  } else {
    req.session.adminloginErr = true
    res.redirect('/admin');
    req.session.adminloginErr = false
  }
});

router.get('/admin-logout', (req, res) => {
  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  req.session.admin = false
  req.session.adminloggedIn = false
  req.session.adminpassErr = false
  req.session.adminemailErr = false
  res.redirect('/admin');
});

router.get('/viewUsers', verifyLogin, (req, res) => {
  req.session.admin = true
  adminHelpers.getAllUsers().then((users) => {
    res.render('admin/view-users', { admin: true, users })
  })
});

router.get('/viewProduct', verifyLogin, (req, res) => {
  req.session.admin = true
  adminHelpers.getAllProducts().then(async (products) => {
    let product = await adminHelpers.getProductDetails(req.params.id)
    res.render('admin/view-products', { admin: true, products, product })
  })
});

router.get('/addProduct', verifyLogin, (req, res) => {
  req.session.admin = true
  adminHelpers.getAllCategory().then((category) => {
    res.render('admin/add-product', { admin: true, category })
  })
});

router.post('/addProduct', (req, res) => {
  adminHelpers.addProduct(req.body, (id) => {

    var base64Str1 = req.body.imageBase64Data1
    var path = "./public/product-images/";
    var optionalObj = { fileName: id + '1', type: "jpg" };
    base64ToImage(base64Str1, path, optionalObj);

    var base64Str2 = req.body.imageBase64Data2
    var path = "./public/product-images/";
    var optionalObj = { fileName: id + '2', type: "jpg" };
    base64ToImage(base64Str2, path, optionalObj);

    var base64Str3 = req.body.imageBase64Data3
    var path = "./public/product-images/";
    var optionalObj = { fileName: id + '3', type: "jpg" };
    base64ToImage(base64Str3, path, optionalObj);

    res.redirect('/viewProduct');
  })
});

router.get('/deleteProduct/:id', (req, res) => {
  let proId = req.params.id
  adminHelpers.deleteProduct(proId).then((response) => {
    res.redirect('/viewProduct');
  })
});

router.get('/editProduct/:id', verifyLogin, async (req, res) => {
  req.session.admin = true
  let product = await adminHelpers.getProductDetails(req.params.id)
  let category = await adminHelpers.getAllCategory(req.params.id)
  res.render('admin/edit-product', { admin: true, product, category })
});

router.post('/editProduct/:id', (req, res) => {
  let id = req.params.id
  adminHelpers.updateProduct(req.params.id, req.body).then(() => {

    var base64Str1 = req.body.imageBase64Data1
    var path = "./public/product-images/";
    var optionalObj = { fileName: id + '1', type: "jpg" };
    base64ToImage(base64Str1, path, optionalObj);

    var base64Str2 = req.body.imageBase64Data2
    var path = "./public/product-images/";
    var optionalObj = { fileName: id + '2', type: "jpg" };
    base64ToImage(base64Str2, path, optionalObj);

    var base64Str3 = req.body.imageBase64Data3
    var path = "./public/product-images/";
    var optionalObj = { fileName: id + '3', type: "jpg" };
    base64ToImage(base64Str3, path, optionalObj);

    res.redirect('/viewProduct')
  })
});

router.get('/blockUser/:id', (req, res) => {
  let userId = req.params.id
  adminHelpers.blockUser(userId).then((response) => {
    res.redirect('/viewUsers')
  })
});

router.get('/unblockUser/:id', (req, res) => {
  let userId = req.params.id
  adminHelpers.unblockUser(userId).then((response) => {
    res.redirect('/viewUsers')
  })
});

router.get('/addCategory', verifyLogin, (req, res) => {
  req.session.admin = true
  res.render('admin/add-category', { admin: true })
});

router.post('/addCategory', (req, res) => {
  adminHelpers.addCategory(req.body).then((response) => {
    res.redirect('/viewCategory')
  })
});

router.get('/viewCategory', verifyLogin, (req, res) => {
  req.session.admin = true
  adminHelpers.getAllCategory(req.body).then((category) => {
    res.render('admin/view-category', { admin: true, category })
  })
});

router.get('/deleteCategory/:id', (req, res) => {
  let categoryId = req.params.id
  adminHelpers.deleteCategory(categoryId).then((response) => {
    res.redirect('/viewCategory')
  })
});

router.get('/editCategory/:id', verifyLogin, async (req, res) => {
  req.session.admin = true
  let category = await adminHelpers.getCategoryDetails(req.params.id)
  res.render('admin/edit-category', { admin: true, category })});

router.post('/editCategory/:id', (req, res) => {
  let categoryId = req.params.id
  adminHelpers.updateCategory(categoryId, req.body).then(() => {
    res.redirect('/viewCategory')
  })
});

router.get('/view-orders', verifyLogin, async (req, res) => {
  req.session.admin = true
  let orders = await adminHelpers.getAllOrders()
  res.render('admin/view-orders', { admin: true, orders })
});

router.post("/changeStatus", (req, res) => {
  adminHelpers.changeStatus(req.body).then((response) => {
    adminHelpers.getOrderId(req.body.id).then((order) => {
      res.json({ order });
    })
      .catch(() => {
        console.log("err");
      });
  });
});

router.get('/viewReport', verifyLogin, async (req, res) => {
  admin = req.session.admin
  let monthsales = await adminHelpers.ordersGraph()
  res.render('admin/viewReport', { admin: true, monthsales })
});

router.post('/findReportbyDate', verifyLogin, (req, res) => {
  adminHelpers.getOrderByDate(req.body).then((response) => {
    res.render('admin/viewSalesByDate', { admin: true, response })
  })

});

router.post('/createDiscount', (req, res) => {
  let id = req.body.proId
  let price = parseInt(req.body.proPrice)
  let discount = parseInt(req.body.proDiscount)
  let from = req.body.ValidFrom
  let to = req.body.ValidTo
  adminHelpers.createOffer(id, price, discount, from, to).then((response) => {
    res.redirect('/viewProduct')
  })
})

router.post('/catDiscount', (req, res) => {
  let catName = req.body.catName
  let catDiscount = parseInt(req.body.catDiscount)
  let from = req.body.ValidFrom
  let to = req.body.ValidTo
  adminHelpers.catOffer(catName, catDiscount, from, to).then((response) => {
    res.redirect('/viewCategory')
  })
})

router.get('/viewOffer', verifyLogin, async (req, res) => {
  adminHelpers.viewOffers().then((data) => {
    res.render('admin/view-offer', { admin: true, data })
  })
})

router.get('/deleteOffer/:id', verifyLogin, (req, res) => {
  let proId = req.params.id
  adminHelpers.deleteOffer(proId).then((data) => {
    res.redirect('/ViewOffer')
  })
})

router.get('/viewCoupon', verifyLogin, (req, res) => {
  adminHelpers.getcoupon().then((coupons) => {
    res.render('admin/view-coupon', { admin: true, coupons })
  })
})

router.get('/createCoupon', verifyLogin, (req, res) => {
  res.render('admin/create-coupon', { admin: true })
})

router.get('/generate-couponCode', verifyLogin, (req, res) => {
  let voucher = voucher_codes.generate({
    length: 8,
    count: 1
  })
  let voucherCode = voucher[0]
  res.send(voucherCode)
})

router.post('/createCoupon', async (req, res) => {
  let coupon = req.body.coupon
  let offer = req.body.offer
  await adminHelpers.createCoupons(offer, coupon).then(() => {
    res.redirect('/viewCoupon')
  })
})

router.get('/delete-coupon/:id', async (req, res) => {
  await adminHelpers.deactivateCoupon(req.params.id).then(() => {
    res.redirect('/viewCoupon')
  })
})

module.exports = router;