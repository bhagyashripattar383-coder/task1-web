import os
import random
import string
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, ".env"))

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///" + os.path.join(basedir, "shop.db")
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-key")
app.config["JSON_SORT_KEYS"] = False

CORS(app, resources={r"/api/*": {"origins": "*"}})
db = SQLAlchemy(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="customer")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    cart_items = db.relationship("CartItem", backref="user", cascade="all, delete-orphan")
    wishlist_items = db.relationship("WishlistItem", backref="user", cascade="all, delete-orphan")
    orders = db.relationship("Order", backref="user", cascade="all, delete-orphan")

    def serialize(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Float, nullable=False)
    original_price = db.Column(db.Float, default=0)
    rating = db.Column(db.Float, default=4.5)
    stock = db.Column(db.Integer, default=10)
    image_url = db.Column(db.String(500), nullable=False)
    featured = db.Column(db.Boolean, default=False)
    bestseller = db.Column(db.Boolean, default=False)
    new_arrival = db.Column(db.Boolean, default=False)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def serialize(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "price": float(self.price),
            "original_price": float(self.original_price or self.price),
            "rating": float(self.rating),
            "stock": int(self.stock),
            "image_url": self.image_url,
            "featured": self.featured,
            "bestseller": self.bestseller,
            "new_arrival": self.new_arrival,
            "active": self.active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CartItem(db.Model):
    __tablename__ = "cart_items"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    product = db.relationship("Product")

    __table_args__ = (db.UniqueConstraint("user_id", "product_id", name="unique_user_product_cart"),)


class WishlistItem(db.Model):
    __tablename__ = "wishlist_items"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)

    product = db.relationship("Product")

    __table_args__ = (db.UniqueConstraint("user_id", "product_id", name="unique_user_product_wishlist"),)


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    order_number = db.Column(db.String(30), unique=True, nullable=False)
    customer_name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    shipping_address = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(50), nullable=False)
    state = db.Column(db.String(50), nullable=False)
    postal_code = db.Column(db.String(15), nullable=False)
    payment_method = db.Column(db.String(20), nullable=False)
    payment_status = db.Column(db.String(50), nullable=False, default="pending")
    status = db.Column(db.String(30), nullable=False, default="pending")
    subtotal = db.Column(db.Float, nullable=False, default=0)
    shipping_fee = db.Column(db.Float, nullable=False, default=0)
    discount_amount = db.Column(db.Float, nullable=False, default=0)
    total = db.Column(db.Float, nullable=False, default=0)
    coupon_code = db.Column(db.String(30), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship("OrderItem", backref="order", cascade="all, delete-orphan")

    def serialize(self):
        return {
            "id": self.id,
            "order_number": self.order_number,
            "customer_name": self.customer_name,
            "phone": self.phone,
            "shipping_address": self.shipping_address,
            "city": self.city,
            "state": self.state,
            "postal_code": self.postal_code,
            "payment_method": self.payment_method,
            "payment_status": self.payment_status,
            "status": self.status,
            "subtotal": float(self.subtotal),
            "shipping_fee": float(self.shipping_fee),
            "discount_amount": float(self.discount_amount),
            "total": float(self.total),
            "coupon_code": self.coupon_code,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "items": [item.serialize() for item in self.items],
        }


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    product_name = db.Column(db.String(150), nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)

    def serialize(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "image_url": self.image_url,
            "quantity": self.quantity,
            "price": float(self.price),
        }


@app.before_request
def ensure_database():
    db.create_all()


def ensure_admin_user():
    admin = User.query.filter_by(email="admin@shopease.com").first()
    if admin is None:
        db.session.add(
            User(
                full_name="ShopEase Admin",
                email="admin@shopease.com",
                password_hash=generate_password_hash("admin123"),
                role="admin",
            )
        )
        db.session.commit()


def seed_products():
    if Product.query.count() > 0:
        return

    products = [
        {
            "name": "Aero Wireless Headphones",
            "category": "Electronics",
            "description": "Premium wireless Bluetooth headphones with deep bass and all-day comfort.",
            "price": 2999,
            "original_price": 3999,
            "rating": 4.8,
            "stock": 25,
            "image_url": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1000&q=80",
            "featured": True,
            "bestseller": True,
            "new_arrival": False,
        },
        {
            "name": "Urban Smartwatch Pro",
            "category": "Electronics",
            "description": "A feature-rich smartwatch with fitness tracking, notifications, and heart monitoring.",
            "price": 4599,
            "original_price": 5900,
            "rating": 4.7,
            "stock": 18,
            "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
            "featured": True,
            "bestseller": False,
            "new_arrival": True,
        },
        {
            "name": "Luna Comfort Chair",
            "category": "Home",
            "description": "Contemporary lounge chair designed for comfort, style, and relaxation.",
            "price": 6999,
            "original_price": 8999,
            "rating": 4.6,
            "stock": 12,
            "image_url": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80",
            "featured": False,
            "bestseller": True,
            "new_arrival": False,
        },
        {
            "name": "Nova Running Shoes",
            "category": "Sports",
            "description": "Lightweight performance shoes built for everyday comfort and active movement.",
            "price": 2299,
            "original_price": 3299,
            "rating": 4.5,
            "stock": 30,
            "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80",
            "featured": True,
            "bestseller": False,
            "new_arrival": True,
        },
        {
            "name": "Monarch Leather Backpack",
            "category": "Fashion",
            "description": "Durable premium backpack with smart compartments for work, travel, and daily use.",
            "price": 2599,
            "original_price": 3499,
            "rating": 4.7,
            "stock": 22,
            "image_url": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80",
            "featured": False,
            "bestseller": True,
            "new_arrival": False,
        },
        {
            "name": "Glow Face Serum",
            "category": "Beauty",
            "description": "Vitamin-rich brightening serum to hydrate skin and improve luminosity.",
            "price": 1499,
            "original_price": 1999,
            "rating": 4.6,
            "stock": 40,
            "image_url": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80",
            "featured": True,
            "bestseller": False,
            "new_arrival": True,
        },
        {
            "name": "Summit Travel Mug",
            "category": "Home",
            "description": "Thermal insulated mug that keeps drinks warm for long hours during commuting.",
            "price": 899,
            "original_price": 1299,
            "rating": 4.4,
            "stock": 50,
            "image_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80",
            "featured": False,
            "bestseller": True,
            "new_arrival": True,
        },
        {
            "name": "Pixel Pro Camera",
            "category": "Electronics",
            "description": "Compact mirrorless camera for creators, travel photographers, and everyday shooting.",
            "price": 58999,
            "original_price": 67999,
            "rating": 4.9,
            "stock": 8,
            "image_url": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80",
            "featured": True,
            "bestseller": False,
            "new_arrival": True,
        },
        {
            "name": "Verve Desk Lamp",
            "category": "Home",
            "description": "Minimal desk lamp with adjustable brightness and warm ambient lighting.",
            "price": 1699,
            "original_price": 2299,
            "rating": 4.5,
            "stock": 28,
            "image_url": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80",
            "featured": False,
            "bestseller": False,
            "new_arrival": True,
        },
        {
            "name": "Aster Smart Speaker",
            "category": "Electronics",
            "description": "Voice-enabled smart speaker with immersive sound and full-room audio quality.",
            "price": 3999,
            "original_price": 4999,
            "rating": 4.6,
            "stock": 17,
            "image_url": "https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=1000&q=80",
            "featured": True,
            "bestseller": True,
            "new_arrival": False,
        },
    ]

    for item in products:
        db.session.add(Product(**item))
    db.session.commit()


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "ShopEase API is running"})


@app.route("/api/auth/register", methods=["POST"])
def register_user():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not full_name or not email or not password:
        return jsonify({"message": "Full name, email and password are required"}), 400
    if password != confirm_password:
        return jsonify({"message": "Passwords do not match"}), 400
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters long"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "An account already exists with this email"}), 409

    user = User(
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
        role="customer",
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=user.id)
    return jsonify({"token": token, "user": user.serialize()}), 201


@app.route("/api/auth/login", methods=["POST"])
def login_user():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Invalid email or password"}), 401

    token = create_access_token(identity=user.id)
    return jsonify({"token": token, "user": user.serialize()})


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return jsonify({"user": user.serialize()})


@app.route("/api/auth/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

    if not check_password_hash(user.password_hash, current_password):
        return jsonify({"message": "Current password is incorrect"}), 400
    if len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters long"}), 400

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully"})


@app.route("/api/auth/logout", methods=["POST"])
@jwt_required()
def logout_user():
    return jsonify({"message": "Logged out successfully"})


@app.route("/api/categories", methods=["GET"])
def get_categories():
    categories = [row[0] for row in db.session.query(Product.category).distinct().order_by(Product.category)]
    return jsonify({"categories": categories})


@app.route("/api/products", methods=["GET"])
def get_products():
    search = (request.args.get("search") or "").strip()
    category = (request.args.get("category") or "").strip()
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)
    sort = request.args.get("sort", "newest")
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(24, max(1, request.args.get("per_page", 12, type=int)))

    query = Product.query.filter(Product.active.is_(True))

    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if category and category != "All":
        query = query.filter(Product.category == category)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    if sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "popularity":
        query = query.order_by(Product.rating.desc(), Product.stock.desc())
    elif sort == "newest":
        query = query.order_by(Product.created_at.desc())
    else:
        query = query.order_by(Product.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "products": [product.serialize() for product in pagination.items],
        "page": page,
        "pages": pagination.pages,
        "total": pagination.total,
    })


@app.route("/api/products/featured", methods=["GET"])
def get_featured_products():
    products = Product.query.filter(Product.featured.is_(True), Product.active.is_(True)).limit(6).all()
    return jsonify({"products": [product.serialize() for product in products]})


@app.route("/api/products/trending", methods=["GET"])
def get_trending_products():
    products = Product.query.filter(Product.bestseller.is_(True), Product.active.is_(True)).limit(6).all()
    return jsonify({"products": [product.serialize() for product in products]})


@app.route("/api/products/new-arrivals", methods=["GET"])
def get_new_arrivals():
    products = Product.query.filter(Product.new_arrival.is_(True), Product.active.is_(True)).limit(6).all()
    return jsonify({"products": [product.serialize() for product in products]})


@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    related = Product.query.filter(
        Product.category == product.category,
        Product.id != product.id,
        Product.active.is_(True),
    ).limit(4).all()
    return jsonify({"product": product.serialize(), "related": [item.serialize() for item in related]})


@app.route("/api/wishlist", methods=["GET"])
@jwt_required()
def get_wishlist():
    user_id = get_jwt_identity()
    items = WishlistItem.query.filter_by(user_id=user_id).all()
    return jsonify({"items": [item.product.serialize() for item in items]})


@app.route("/api/wishlist/<int:product_id>", methods=["POST"])
@jwt_required()
def add_wishlist(product_id):
    user_id = get_jwt_identity()
    product = Product.query.get_or_404(product_id)
    if WishlistItem.query.filter_by(user_id=user_id, product_id=product_id).first():
        return jsonify({"message": "Product already in wishlist"}), 409
    db.session.add(WishlistItem(user_id=user_id, product_id=product_id))
    db.session.commit()
    return jsonify({"message": "Added to wishlist", "product": product.serialize()})


@app.route("/api/wishlist/<int:product_id>", methods=["DELETE"])
@jwt_required()
def remove_wishlist(product_id):
    user_id = get_jwt_identity()
    item = WishlistItem.query.filter_by(user_id=user_id, product_id=product_id).first()
    if item is None:
        return jsonify({"message": "Wishlist item not found"}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Removed from wishlist"})


@app.route("/api/cart", methods=["GET"])
@jwt_required()
def get_cart():
    user_id = get_jwt_identity()
    items = CartItem.query.filter_by(user_id=user_id).all()
    items_payload = []
    subtotal = 0
    for item in items:
        product = item.product
        if product is None:
            continue
        line_total = float(product.price) * item.quantity
        subtotal += line_total
        items_payload.append({
            "id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "name": product.name,
            "image_url": product.image_url,
            "price": float(product.price),
            "stock": product.stock,
            "subtotal": float(line_total),
        })
    return jsonify({"items": items_payload, "subtotal": float(subtotal), "count": sum(item["quantity"] for item in items_payload)})


@app.route("/api/cart/items", methods=["POST"])
@jwt_required()
def add_cart_item():
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    quantity = int(data.get("quantity", 1) or 1)
    if not product_id:
        return jsonify({"message": "Product not found"}), 400
    product = Product.query.get_or_404(product_id)
    if quantity <= 0:
        return jsonify({"message": "Quantity must be greater than zero"}), 400
    if product.stock < quantity:
        return jsonify({"message": "Not enough stock available"}), 400

    item = CartItem.query.filter_by(user_id=get_jwt_identity(), product_id=product_id).first()
    if item:
        new_quantity = item.quantity + quantity
        if new_quantity > product.stock:
            return jsonify({"message": "The requested quantity exceeds available stock"}), 400
        item.quantity = new_quantity
    else:
        db.session.add(CartItem(user_id=get_jwt_identity(), product_id=product_id, quantity=quantity))
    db.session.commit()
    return jsonify({"message": "Product added to cart"})


@app.route("/api/cart/items/<int:product_id>", methods=["PUT"])
@jwt_required()
def update_cart_item(product_id):
    data = request.get_json(silent=True) or {}
    quantity = int(data.get("quantity", 1) or 1)
    user_id = get_jwt_identity()
    item = CartItem.query.filter_by(user_id=user_id, product_id=product_id).first()
    if item is None:
        return jsonify({"message": "Cart item not found"}), 404

    product = Product.query.get(product_id)
    if quantity <= 0:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Item removed from cart"})
    if product is None or quantity > product.stock:
        return jsonify({"message": "Requested quantity exceeds available stock"}), 400
    item.quantity = quantity
    db.session.commit()
    return jsonify({"message": "Cart updated"})


@app.route("/api/cart/items/<int:product_id>", methods=["DELETE"])
@jwt_required()
def delete_cart_item(product_id):
    user_id = get_jwt_identity()
    item = CartItem.query.filter_by(user_id=user_id, product_id=product_id).first()
    if item is None:
        return jsonify({"message": "Cart item not found"}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Item removed from cart"})


@app.route("/api/checkout", methods=["POST"])
@jwt_required()
def create_checkout():
    data = request.get_json(silent=True) or {}
    cart_items = CartItem.query.filter_by(user_id=get_jwt_identity()).all()
    if not cart_items:
        return jsonify({"message": "Your cart is empty"}), 400

    customer_name = (data.get("customer_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    shipping_address = (data.get("shipping_address") or "").strip()
    city = (data.get("city") or "").strip()
    state = (data.get("state") or "").strip()
    postal_code = (data.get("postal_code") or "").strip()
    payment_method = (data.get("payment_method") or "cod").strip().lower()
    coupon_code = (data.get("coupon_code") or "").strip().upper()

    if not all([customer_name, phone, shipping_address, city, state, postal_code]):
        return jsonify({"message": "Please complete all shipping details"}), 400

    subtotal = 0
    order_items = []
    for cart_item in cart_items:
        product = Product.query.get(cart_item.product_id)
        if product is None:
            return jsonify({"message": f"Product {cart_item.product_id} is no longer available"}), 400
        if cart_item.quantity > product.stock:
            return jsonify({"message": f"Not enough stock left for {product.name}"}), 400
        subtotal += product.price * cart_item.quantity
        order_items.append({
            "product_id": product.id,
            "product_name": product.name,
            "image_url": product.image_url,
            "quantity": cart_item.quantity,
            "price": product.price,
        })

    shipping_fee = 0 if subtotal >= 2500 else 150
    discount_amount = 0
    if coupon_code == "SAVE10":
        discount_amount = round(subtotal * 0.10, 2)

    total = round(subtotal + shipping_fee - discount_amount, 2)

    online_configured = bool(os.getenv("RAZORPAY_KEY_ID")) and bool(os.getenv("RAZORPAY_KEY_SECRET"))
    if payment_method == "online":
        payment_status = "paid" if online_configured else "requires_setup"
    else:
        payment_status = "pending"

    order_number = "SE-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    order = Order(
        user_id=get_jwt_identity(),
        order_number=order_number,
        customer_name=customer_name,
        phone=phone,
        shipping_address=shipping_address,
        city=city,
        state=state,
        postal_code=postal_code,
        payment_method=payment_method,
        payment_status=payment_status,
        status="pending",
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        discount_amount=discount_amount,
        total=total,
        coupon_code=coupon_code,
    )
    db.session.add(order)
    db.session.commit()

    for item in order_items:
        db.session.add(
            OrderItem(
                order_id=order.id,
                product_id=item["product_id"],
                product_name=item["product_name"],
                image_url=item["image_url"],
                quantity=item["quantity"],
                price=item["price"],
            )
        )

    for cart_item in cart_items:
        product = Product.query.get(cart_item.product_id)
        if product:
            product.stock -= cart_item.quantity

    CartItem.query.filter_by(user_id=get_jwt_identity()).delete()
    db.session.commit()

    return jsonify({
        "message": "Order placed successfully",
        "order": order.serialize(),
        "payment_setup_required": payment_method == "online" and not online_configured,
    })


@app.route("/api/orders", methods=["GET"])
@jwt_required()
def list_orders():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    if user.role == "admin":
        orders = Order.query.order_by(Order.created_at.desc()).all()
    else:
        orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return jsonify({"orders": [order.serialize() for order in orders]})


@app.route("/api/orders/<int:order_id>", methods=["GET"])
@jwt_required()
def get_order(order_id):
    user_id = get_jwt_identity()
    order = Order.query.get_or_404(order_id)
    if order.user_id != user_id and User.query.get(user_id).role != "admin":
        return jsonify({"message": "You do not have access to this order"}), 403
    return jsonify({"order": order.serialize()})


@app.route("/api/orders/<int:order_id>/cancel", methods=["PUT"])
@jwt_required()
def cancel_order(order_id):
    user_id = get_jwt_identity()
    order = Order.query.get_or_404(order_id)
    if order.user_id != user_id and User.query.get(user_id).role != "admin":
        return jsonify({"message": "You do not have permission to cancel this order"}), 403
    if order.status in ["shipped", "delivered", "cancelled"]:
        return jsonify({"message": "This order cannot be cancelled"}), 400
    order.status = "cancelled"
    order.payment_status = "cancelled"
    db.session.commit()
    return jsonify({"message": "Order cancelled successfully", "order": order.serialize()})


@app.route("/api/admin/summary", methods=["GET"])
@jwt_required()
def admin_summary():
    user = User.query.get_or_404(get_jwt_identity())
    if user.role != "admin":
        return jsonify({"message": "Admin access required"}), 403

    total_orders = Order.query.count()
    total_revenue = sum(order.total for order in Order.query.all())
    customers = User.query.filter_by(role="customer").count()
    pending_orders = Order.query.filter_by(status="pending").count()

    return jsonify({
        "stats": {
            "total_orders": total_orders,
            "total_revenue": float(total_revenue),
            "customers": customers,
            "pending_orders": pending_orders,
        },
        "orders": [order.serialize() for order in Order.query.order_by(Order.created_at.desc()).limit(8).all()],
    })


@app.route("/api/admin/orders/<int:order_id>/status", methods=["PUT"])
@jwt_required()
def update_order_status(order_id):
    user = User.query.get_or_404(get_jwt_identity())
    if user.role != "admin":
        return jsonify({"message": "Admin access required"}), 403

    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip().lower()
    valid_statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        return jsonify({"message": "Invalid order status"}), 400

    order = Order.query.get_or_404(order_id)
    order.status = new_status
    if new_status == "delivered":
        order.payment_status = "paid"
    db.session.commit()
    return jsonify({"message": "Order status updated", "order": order.serialize()})


with app.app_context():
    db.create_all()
    ensure_admin_user()
    seed_products()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
