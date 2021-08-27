var db = require('../config/connection')
var collection = require('../config/collection')
const bcrypt = require('bcrypt')
var objectId = require('mongodb').ObjectID
const { response, checkout } = require('../app')
const { ORDER_COLLECTION } = require('../config/collection')

const Razorpay = require('razorpay')
const { resolve } = require('path')
const moment = require('moment')
var instance = new Razorpay({
    key_id: 'rzp_test_XyxrCNSUqYCkHE',
    key_secret: 'HbS57r59yrx2Yh45EPbN1afg',
});

module.exports = {
    doSignup: (userData, referalcode) => {
        let userReferalCode = userData.referal;
        return new Promise(async (resolve, reject) => {
            if (userReferalCode) {
                db.get().collection(collection.USER_COLLECTION).updateOne({ referalcode: userReferalCode },
                    {
                        $inc: {
                            credits: 1
                        }
                    })
            }
            let Coupon = await db.get().collection(collection.COUPON_COLLECTION).findOne({ status: true })
            let emailExist = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: userData.Email })
            if (!emailExist) {
                userData.Password = await bcrypt.hash(userData.Password, 10)
                db.get().collection(collection.USER_COLLECTION).insertOne(
                    {
                        Name: userData.Name,
                        Username: userData.Username,
                        Email: userData.Email,
                        Mobile: userData.Mobile,
                        Password: userData.Password,
                        status: false,
                        referalcode: referalcode,
                        coupon: Coupon
                    }
                ).then((data) => {
                    resolve(data.ops[0])
                })
            } else {
                reject()
            }
        })
    },


    changePassword: (currentPass, Password, userId) => {
        return new Promise(async (resolve, reject) => {
            let response = {}
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: objectId(userId) })
            bcrypt.compare(currentPass, user.Password).then(async (status) => {
                if (status) {
                    response.user = user
                    response.status = true
                    if (response.status) {
                        password = await bcrypt.hash(Password, 10)
                        db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId(userId) },
                            {
                                $set: {
                                    Password: password
                                }
                            })
                    }
                    resolve(response)
                } else {
                    resolve({ status: false })
                }
            })
        })
    },


    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let loginStatus = false
            let response = {}
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: userData.Email })
            if (user) {
                if (user.status) {
                    response.Blockuser = 'Your account is blocked'
                }
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        response.user = user
                        response.status = true
                        resolve(response)
                    } else {
                        resolve({ status: false })
                    }
                })
            } else {
                resolve({ status: false })
            }
        })
    },
    getUserDetails: (userId) => {
        return new Promise(async (resolve, reject) => {
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: objectId(userId), status: true })
            resolve(user)
        })
    },
    addToCart: (proId, userId) => {
        let proObj = {
            item: objectId(proId),
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            if (userCart) {
                let proExist = userCart.products.findIndex(product => product.item == proId)
                if (proExist != -1) {
                    db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ user: objectId(userId), 'products.item': objectId(proId) },
                            {
                                $inc: { 'products.$.quantity': 1 }
                            }
                        ).then(() => {
                            resolve()
                        })
                } else {
                    db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ user: objectId(userId) },
                            {
                                $push: { products: proObj }
                            }
                        ).then(() => {
                            resolve()
                        })
                }
            } else {
                let cartObj = {
                    user: objectId(userId),
                    products: [proObj]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve()
                })
            }
        })
    },
    getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: objectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTOION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] },
                        subtotal: { $multiply: [{ $arrayElemAt: ['$product.Price', 0] }, '$quantity'] }

                    }
                }
            ]).toArray()
            resolve(cartItems)
        })
    },
    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },
    changeProductQuanity: (details) => {
        details.count = parseInt(details.count)
        details.quantity = parseInt(details.quantity)

        return new Promise((resolve, reject) => {
            if (details.count === -1 && details.quantity === 1) {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: objectId(details.cart) },
                        {
                            $pull: { products: { item: objectId(details.product) } }
                        }
                    ).then((response) => {
                        resolve({ removeProduct: true })
                    })
            } else {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: objectId(details.cart), 'products.item': objectId(details.product) },
                        {
                            $inc: { 'products.$.quantity': details.count }
                        }
                    ).then((response) => {
                        resolve({ status: true })
                    })
            }
        })
    },
    viewCategory: (categoryId) => {
        return new Promise(async (resolve, reject) => {
            let catName = await db.get().collection(collection.CATEGORY_COLLECTION).findOne({ _id: objectId(categoryId) })
            let product = await db.get().collection(collection.PRODUCT_COLLECTOION).find({ Category: catName.Category }).toArray()
            resolve(product)
        })
    },
    getTotalAmount: (userId, cartId, proId) => {
        return new Promise(async (resolve, reject) => {
            let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: objectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTOION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $multiply: ['$quantity', '$product.Price'] } }
                    }
                }
            ]).toArray()
            if (total[0] == null) {
                return new Promise((resolve, reject) => {
                    db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ _id: objectId(cartId) },
                            {
                                $pull: { products: { item: objectId(proId) } }
                            }
                        ).then((response) => {
                            resolve({ removeProduct: true })
                        })
                })
            } else {
                resolve(total[0].total)
            }
        })
    },
    removeProCart: (details) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.CART_COLLECTION)
                .updateOne({ _id: objectId(details.cart) },
                    {
                        $pull: { products: { item: objectId(details.product) } }
                    }
                ).then((response) => {
                    resolve({ removeProduct: true })
                })

        })
    },
    getSubTotal: (userId, proId, cartId) => {
        return new Promise(async (resolve, reject) => {
            let subtotal = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: objectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTOION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $match: { item: objectId(proId) }
                },
                {
                    $project: {
                        _id: null,
                        subtotal: { $multiply: [{ $arrayElemAt: ['$product.Price', 0] }, '$quantity'] }
                    }
                }
            ]).toArray()
            if (subtotal[0] == null) {
                return new Promise((resolve, reject) => {
                    db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ _id: objectId(cartId) },
                            {
                                $pull: { products: { item: objectId(proId) } }
                            }
                        ).then((response) => {
                            resolve({ removeProduct: true })
                        })
                })
            } else {
                resolve(subtotal[0].subtotal)
            }
        })
    },
    addAddress: (address) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ADDRESS_COLLECTION).insertOne(address).then((data) => {
                resolve(data.ops[0]._id)
            })
        })
    },
    getAddress: (address) => {
        return new Promise((resolve, reject) => {
            let addres = db.get().collection(collection.ADDRESS_COLLECTION).find({ UserId: address }).toArray()
            resolve(addres)
        })
    },
    placeOrder: (order, products, total) => {
        return new Promise((resolve, reject) => {
            let status = order.Payment === 'COD' ? 'placed' : 'pending'
            let orderObj = {
                deliveryDetails: {
                    Name: order.Name,
                    Phone: order.Phone,
                    Email: order.Email,
                    Country: order.Country,
                    State: order.State,
                    Pincode: order.Pincode
                },
                userId: objectId(order.UserId),
                paymentMethod: order.Payment,
                products: products,
                totalAmount: total,
                status: status,
                date: moment(new Date).format('L')
            }

            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                db.get().collection(collection.CART_COLLECTION).removeOne({ user: objectId(order.UserId) }).then(() => {
                    resolve(response.ops[0]._id);
                })
            })
        })
    },
    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            resolve(cart.products)
        })
    },
    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION)
                .find({ userId: objectId(userId) }).toArray()
            resolve(orders)
        })
    },
    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: objectId(orderId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTOION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }
            ]).toArray()
            resolve(orderItems)
        })
    },
    userProfile: (userId) => {
        return new Promise(async (resolve, reject) => {
            let profile = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: objectId(userId) })
            resolve(profile)
        })
    },
    genarateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total * 100,  // amount in the smallest currency unit
                currency: "INR",
                receipt: "" + orderId
            };
            instance.orders.create(options, function (err, order) {
                if (err) {
                    console.log(err)
                } else {
                    resolve(order)
                }
            });
        })
    },
    verifyPayment: (details) => {
        return new Promise((resolve, reject) => {
            const crypto = require('crypto');
            let hmac = crypto.createHmac('sha256', 'HbS57r59yrx2Yh45EPbN1afg');
            hmac.update(details['payment[razorpay_order_id]'] + '|' + details['payment[razorpay_payment_id]'])
            hmac = hmac.digest('hex')
            if (hmac === details['payment[razorpay_signature]']) {
                resolve()
            } else {
                reject()
            }
        })
    },
    changePaymentStatus: (orderId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION)
                .updateOne({ _id: objectId(orderId) },
                    {
                        $set: {
                            status: 'placed'
                        }
                    }).then(() => {
                        resolve()
                    })
        })
    },
    checkPhone: (Mobile) => {
        return new Promise(async (resolve, reject) => {
            let mobile = await db.get().collection(collection.USER_COLLECTION).findOne({ Mobile: Mobile })
            resolve(mobile)
        })
    },
    OtpLog: (Mobile) => {
        return new Promise(async (resolve, reject) => {
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Mobile: Mobile })
            if (user) {
                user.status = true
                resolve(user)
            }
            else {
                resolve({ status: false })
            }
        })
    },
    editAddress: (AddressId) => {
        return new Promise((resolve, reject) => {
            let address = db.get().collection(collection.ADDRESS_COLLECTION).findOne({ _id: objectId(AddressId) })
            resolve(address)
        })
    },
    updateAddress: (Id, Address) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ADDRESS_COLLECTION)
                .updateOne({ _id: objectId(Id) },
                    {
                        $set: {
                            Name: Address.Name,
                            Phone: Address.Phone,
                            Email: Address.Email,
                            Country: Address.Country,
                            State: Address.State,
                            Pincode: Address.Pincode
                        }
                    }).then((response) => {
                        resolve()
                    })
        })
    },
    updateUser: (Id, userData) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.USER_COLLECTION)
                .updateOne({ _id: objectId(Id) },
                    {
                        $set: {
                            Name: userData.Name,
                            Username: userData.Username,
                            Email: userData.Email,
                            Mobile: userData.Mobile
                        }
                    }).then((response) => {
                        resolve()
                    })
        })
    },
    getCoupons: (user) => {
        return new Promise(async (resolve, reject) => {
            let res = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: objectId(user) })
            resolve(res)
        })
    },
    verifyCoupon: (coupon, user) => {
        return new Promise(async (resolve, reject) => {
            let response = {}
            let couponfound = await db.get().collection(collection.COUPON_COLLECTION).findOne({ Coupon: coupon })
            if (couponfound) {
                if (couponfound.status) {
                    response.status = 0
                    db.get().collection(collection.COUPON_COLLECTION).updateOne({ Coupon: coupon }, {
                        $set: {

                            status: false
                        }
                    })
                    db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId(user) }, {
                        $unset: {
                            Coupon: 1
                        }
                    })
                    response.offer = parseInt(couponfound.Offer)
                    resolve(response)
                }
                else {
                    response.status = 2
                    resolve(response)
                }
            }
            else {
                response.status = 1
                resolve(response)
            }
        })
    },
    countcredits: (user) => {
        return new Promise(async (resolve, reject) => {
            let counter = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: objectId(user) }, { credits: 1 })
            if (counter) {
                resolve(counter)
            }
        })
    },
    removeCredits: (user) => {
        return new Promise(async (resolve, reject) => {
            let remove = db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId(user) }, {
                $set: {
                    credits: 0
                }
            })
        })
    },
}

