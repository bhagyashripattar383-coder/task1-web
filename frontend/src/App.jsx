import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  ArrowRight,
  BadgePercent,
  Heart,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const api = axios.create({ baseURL: API_BASE })

const AuthContext = createContext(null)
const CartContext = createContext(null)

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('shopease_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('shopease_token')
    if (savedToken) {
      api.defaults.headers.common.Authorization = `Bearer ${savedToken}`
      api
        .get('/auth/me')
        .then((result) => setUser(result.data.user))
        .catch(() => {
          localStorage.removeItem('shopease_token')
          delete api.defaults.headers.common.Authorization
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    const authToken = response.data.token
    localStorage.setItem('shopease_token', authToken)
    api.defaults.headers.common.Authorization = `Bearer ${authToken}`
    setToken(authToken)
    setUser(response.data.user)
    return response.data
  }

  const register = async (payload) => {
    const response = await api.post('/auth/register', payload)
    const authToken = response.data.token
    localStorage.setItem('shopease_token', authToken)
    api.defaults.headers.common.Authorization = `Bearer ${authToken}`
    setToken(authToken)
    setUser(response.data.user)
    return response.data
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error(error)
    }
    setUser(null)
    setToken(null)
    localStorage.removeItem('shopease_token')
    delete api.defaults.headers.common.Authorization
  }

  const changePassword = async (currentPassword, newPassword) => {
    const response = await api.put('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return response.data
  }

  const refreshUser = async () => {
    if (!localStorage.getItem('shopease_token')) {
      setUser(null)
      return
    }
    const response = await api.get('/auth/me')
    setUser(response.data.user)
    return response.data.user
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, changePassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

function CartProvider({ children }) {
  const { token, user } = useAuth()
  const [cartCount, setCartCount] = useState(0)

  const refreshCartCount = async () => {
    if (!token) {
      const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]')
      const count = guestCart.reduce((total, item) => total + Number(item.quantity || 1), 0)
      setCartCount(count)
      return count
    }
    try {
      const response = await api.get('/cart')
      setCartCount(response.data.count || 0)
      return response.data.count || 0
    } catch (error) {
      setCartCount(0)
      return 0
    }
  }

  useEffect(() => {
    refreshCartCount()
  }, [token, user])

  const addToCart = async (productId, quantity = 1) => {
    if (!token) {
      const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]')
      const existingItem = guestCart.find((item) => item.product_id === productId)
      if (existingItem) {
        existingItem.quantity += quantity
      } else {
        guestCart.push({ product_id: productId, quantity })
      }
      localStorage.setItem('guest_cart', JSON.stringify(guestCart))
      refreshCartCount()
      toast.success('Added to cart')
      return { message: 'Added to cart' }
    }
    const response = await api.post('/cart/items', { product_id: productId, quantity })
    await refreshCartCount()
    toast.success('Added to cart')
    return response.data
  }

  const updateCartItem = async (productId, quantity) => {
    if (!token) {
      const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]')
      const updated = guestCart.filter((item) => item.product_id !== productId)
      if (quantity > 0) {
        updated.push({ product_id: productId, quantity })
      }
      localStorage.setItem('guest_cart', JSON.stringify(updated))
      refreshCartCount()
      return
    }
    await api.put(`/cart/items/${productId}`, { quantity })
    await refreshCartCount()
  }

  const removeCartItem = async (productId) => {
    if (!token) {
      const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]')
      const updated = guestCart.filter((item) => item.product_id !== productId)
      localStorage.setItem('guest_cart', JSON.stringify(updated))
      refreshCartCount()
      return
    }
    await api.delete(`/cart/items/${productId}`)
    await refreshCartCount()
  }

  return (
    <CartContext.Provider value={{ cartCount, setCartCount, refreshCartCount, addToCart, updateCartItem, removeCartItem }}>
      {children}
    </CartContext.Provider>
  )
}

function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="page-loader">Loading account...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="page-loader">Checking access...</div>
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return children
}

function ProductCard({ product, onAddToCart, onAddToWishlist }) {
  const discounted = Number(product.original_price) > Number(product.price)
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img src={product.image_url} alt={product.name} />
        {discounted && <span className="badge">{Math.round(((product.original_price - product.price) / product.original_price) * 100)}% OFF</span>}
      </div>
      <div className="product-card-body">
        <div className="product-meta-row">
          <span className="category-pill">{product.category}</span>
          <button type="button" className="icon-btn ghost" onClick={onAddToWishlist} aria-label="Add to wishlist">
            <Heart size={16} />
          </button>
        </div>
        <Link to={`/product/${product.id}`} className="product-name">{product.name}</Link>
        <div className="rating-row">
          <Star size={14} fill="#fbbf24" color="#fbbf24" />
          <span>{product.rating}</span>
        </div>
        <div className="price-row">
          <span className="current-price">{formatPrice(product.price)}</span>
          {discounted && <span className="original-price">{formatPrice(product.original_price)}</span>}
        </div>
        <div className="stock-row">
          <span className={product.stock > 0 ? 'in-stock' : 'out-stock'}>{product.stock > 0 ? `In stock (${product.stock})` : 'Out of stock'}</span>
        </div>
        <div className="card-actions">
          <button type="button" className="primary-btn" onClick={onAddToCart} disabled={product.stock <= 0}>
            Add to Cart
          </button>
          <Link to={`/product/${product.id}`} className="secondary-btn">
            View Details
          </Link>
        </div>
      </div>
    </article>
  )
}

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { cartCount } = useCart()
  const [searchText, setSearchText] = useState('')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setWishlistCount(0)
      return
    }
    api
      .get('/wishlist')
      .then((res) => setWishlistCount(res.data.items?.length || 0))
      .catch(() => setWishlistCount(0))
  }, [user, location.pathname])

  const handleSearch = (event) => {
    event.preventDefault()
    const value = searchText.trim()
    navigate(value ? `/shop?search=${encodeURIComponent(value)}` : '/shop')
    setShowMobileMenu(false)
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand-wrap">
          <div className="brand-badge">S</div>
          <div>
            <span className="brand-name">ShopEase</span>
          </div>
        </Link>

        <nav className={`main-nav ${showMobileMenu ? 'open' : ''}`}>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/shop?category=Electronics">Categories</NavLink>
          <NavLink to="/orders">My Orders</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <form className="header-search" onSubmit={handleSearch}>
          <Search size={16} />
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
          />
        </form>

        <div className="header-actions">
          <Link to="/wishlist" className="icon-link" aria-label="Wishlist">
            <Heart size={18} />
            {wishlistCount > 0 && <span className="count-badge">{wishlistCount}</span>}
          </Link>
          <Link to="/cart" className="icon-link" aria-label="Cart">
            <ShoppingCart size={18} />
            {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
          </Link>
          {user ? (
            <div className="user-menu">
              <Link to="/profile" className="profile-pill"><User size={16} /> {user.full_name}</Link>
              <button type="button" className="text-btn" onClick={logout}>Logout</button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="secondary-btn small">Login</Link>
              <Link to="/register" className="primary-btn small">Register</Link>
            </div>
          )}
          <button type="button" className="menu-btn" onClick={() => setShowMobileMenu(!showMobileMenu)}>
            {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h3>About ShopEase</h3>
          <p>ShopEase brings premium finds, fresh essentials, and everyday convenience together in one delightful shopping platform.</p>
        </div>
        <div>
          <h3>Customer support</h3>
          <ul>
            <li>hello@shopease.in</li>
            <li>+91 98765 43210</li>
            <li>Mon - Sat, 9 AM to 8 PM</li>
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul>
            <li>Privacy policy</li>
            <li>Terms & conditions</li>
            <li>Shipping & returns</li>
          </ul>
        </div>
        <div>
          <h3>Follow us</h3>
          <div className="social-row">
            <span>Instagram</span>
            <span>Facebook</span>
            <span>Twitter</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function HomePage() {
  const [featured, setFeatured] = useState([])
  const [trending, setTrending] = useState([])
  const [newArrivals, setNewArrivals] = useState([])
  const [categories, setCategories] = useState([])
  const { addToCart } = useCart()
  const { user } = useAuth()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuredRes, trendingRes, arrivalsRes, categoriesRes] = await Promise.all([
          api.get('/products/featured'),
          api.get('/products/trending'),
          api.get('/products/new-arrivals'),
          api.get('/categories'),
        ])
        setFeatured(featuredRes.data.products || [])
        setTrending(trendingRes.data.products || [])
        setNewArrivals(arrivalsRes.data.products || [])
        setCategories(categoriesRes.data.categories || [])
      } catch (error) {
        console.error(error)
      }
    }
    fetchData()
  }, [])

  const handleWishlist = async (productId) => {
    if (!user) {
      toast.info('Please log in to save products to your wishlist')
      return
    }
    try {
      await api.post(`/wishlist/${productId}`)
      toast.success('Added to wishlist')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to add to wishlist')
    }
  }

  return (
    <div className="page-shell">
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Everything you love</span>
            <h1>Shop smarter with ShopEase</h1>
            <p>Discover premium styles, lifestyle essentials, gadgets, and home picks curated for your everyday life.</p>
            <div className="hero-actions">
              <Link to="/shop" className="primary-btn">Shop Now</Link>
              <Link to="/shop" className="secondary-btn">Explore Deals</Link>
            </div>
            <div className="hero-stats">
              <div><strong>25K+</strong><span>Happy shoppers</span></div>
              <div><strong>4.9/5</strong><span>Average rating</span></div>
              <div><strong>2-day</strong><span>Fast delivery</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-card large">
              <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80" alt="Fashion gadget" />
            </div>
            <div className="visual-card small top">
              <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80" alt="Sneakers" />
            </div>
            <div className="visual-card small bottom">
              <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=700&q=80" alt="Chair" />
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Explore categories</span>
              <h2>Trending categories</h2>
            </div>
          </div>
          <div className="category-grid">
            {categories.slice(0, 6).map((category) => (
              <Link to={`/shop?category=${encodeURIComponent(category)}`} key={category} className="category-card">
                <div className="category-icon"><ShoppingBag size={24} /></div>
                <h3>{category}</h3>
                <span>Fresh picks</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block alt">
        <div className="container">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Featured products</span>
              <h2>Hot deals this week</h2>
            </div>
            <Link to="/shop" className="text-link">View all <ArrowRight size={16} /></Link>
          </div>
          <div className="product-grid">
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={() => addToCart(product.id, 1)}
                onAddToWishlist={() => handleWishlist(product.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Best sellers</span>
              <h2>Most loved by customers</h2>
            </div>
          </div>
          <div className="product-grid compact">
            {trending.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={() => addToCart(product.id, 1)}
                onAddToWishlist={() => handleWishlist(product.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section-block offer-banner">
        <div className="container offer-inner">
          <div>
            <span className="eyebrow">Special offer</span>
            <h2>Enjoy up to 50% off on curated essentials</h2>
          </div>
          <Link to="/shop" className="primary-btn">Claim Offer</Link>
        </div>
      </section>

      <section className="section-block alt">
        <div className="container">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">New arrivals</span>
              <h2>Freshly launched picks</h2>
            </div>
          </div>
          <div className="product-grid compact">
            {newArrivals.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={() => addToCart(product.id, 1)}
                onAddToWishlist={() => handleWishlist(product.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section-block testimonials">
        <div className="container">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Customer reviews</span>
              <h2>What shoppers are saying</h2>
            </div>
          </div>
          <div className="review-grid">
            {[
              { name: 'Riya', text: 'The shopping experience was effortless and the product quality was exactly as described.' },
              { name: 'Arjun', text: 'Fast delivery, beautiful offers, and easy checkout. ShopEase is my go-to store now.' },
              { name: 'Meera', text: 'Loved the clean UI and the seamless cart and wishlist flow. Super smooth experience.' },
            ].map((review, index) => (
              <div key={index} className="review-card">
                <div className="stars">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star key={starIndex} size={14} fill="#fbbf24" color="#fbbf24" />
                  ))}
                </div>
                <p>“{review.text}”</p>
                <strong>{review.name}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block newsletter-section">
        <div className="container newsletter-box">
          <div>
            <span className="eyebrow">Stay in the loop</span>
            <h2>Subscribe for deals and updates</h2>
          </div>
          <form className="newsletter-form">
            <input type="email" placeholder="Enter your email" />
            <button type="button" className="primary-btn">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  )
}

function ShopPage() {
  const queryParams = new URLSearchParams(window.location.search)
  const initialSearch = queryParams.get('search') || ''
  const initialCategory = queryParams.get('category') || 'All'
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState(['All'])
  const [category, setCategory] = useState(initialCategory)
  const [searchValue, setSearchValue] = useState(initialSearch)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { addToCart } = useCart()

  useEffect(() => {
    let ignore = false
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories')
        if (!ignore) {
          setCategories(['All', ...(response.data.categories || [])])
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchCategories()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const response = await api.get('/products', {
          params: {
            search: searchValue,
            category: category === 'All' ? '' : category,
            min_price: minPrice || undefined,
            max_price: maxPrice || undefined,
            sort,
            page,
            per_page: 12,
          },
        })
        setProducts(response.data.products || [])
        setTotalPages(response.data.pages || 1)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [searchValue, category, minPrice, maxPrice, sort, page])

  const handleWishlist = async (productId) => {
    if (!user) {
      toast.info('Please log in to save products to your wishlist')
      return
    }
    try {
      await api.post(`/wishlist/${productId}`)
      toast.success('Added to wishlist')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to add to wishlist')
    }
  }

  const applyFilters = (event) => {
    event.preventDefault()
    setPage(1)
  }

  return (
    <div className="page-shell">
      <div className="container shop-layout">
        <aside className="filter-panel">
          <h3>Filters</h3>
          <form onSubmit={applyFilters} className="filter-form">
            <div className="field-group">
              <label>Category</label>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Search</label>
              <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search product" />
            </div>
            <div className="price-grid">
              <div className="field-group">
                <label>Min</label>
                <input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value) || 0)} />
              </div>
              <div className="field-group">
                <label>Max</label>
                <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
            </div>
            <div className="field-group">
              <label>Sort by</label>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="popularity">Popularity</option>
              </select>
            </div>
          </form>
        </aside>

        <main className="content-panel">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Products</span>
              <h2>Shop all essentials</h2>
            </div>
            <span className="result-count">{products.length} items</span>
          </div>

          {loading ? (
            <div className="page-loader">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <ShoppingBag size={42} />
              <h3>No products found</h3>
              <p>Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <>
              <div className="product-grid shop-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={() => addToCart(product.id, 1)}
                    onAddToWishlist={() => handleWishlist(product.id)}
                  />
                ))}
              </div>
              <div className="pagination">
                <button type="button" className="secondary-btn small" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                <span>Page {page} of {totalPages}</span>
                <button type="button" className="secondary-btn small" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const { addToCart } = useCart()
  const { user } = useAuth()

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      try {
        const response = await api.get(`/products/${id}`)
        setProduct(response.data.product)
        setRelated(response.data.related || [])
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  const handleWishlist = async (productId = id) => {
    if (!user) {
      toast.info('Please log in to save this product')
      return
    }
    try {
      await api.post(`/wishlist/${productId}`)
      toast.success('Added to wishlist')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to add to wishlist')
    }
  }

  if (loading) return <div className="page-loader">Loading product details...</div>
  if (!product) return <div className="empty-state">Product not found</div>

  const maxQuantity = Math.min(product.stock, 10)

  return (
    <div className="page-shell">
      <div className="container detail-layout">
        <div className="detail-image-wrap">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail-content">
          <span className="eyebrow">{product.category}</span>
          <h1>{product.name}</h1>
          <div className="rating-row big-gap">
            <Star size={16} fill="#fbbf24" color="#fbbf24" />
            <span>{product.rating}</span>
          </div>
          <div className="price-row">
            <span className="current-price large-price">{formatPrice(product.price)}</span>
            <span className="original-price">{formatPrice(product.original_price)}</span>
          </div>
          <p className="description-copy">{product.description}</p>
          <div className="stock-row detail-stock">
            <span className={product.stock > 0 ? 'in-stock' : 'out-stock'}>{product.stock > 0 ? `In stock (${product.stock} available)` : 'Out of stock'}</span>
          </div>

          <div className="quantity-row">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={16} /></button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}><Plus size={16} /></button>
          </div>

          <div className="card-actions detail-actions">
            <button type="button" className="primary-btn" onClick={() => addToCart(product.id, quantity)} disabled={product.stock <= 0}>Add to Cart</button>
            <button type="button" className="secondary-btn" onClick={handleWishlist}>Add to Wishlist</button>
          </div>

          <div className="feature-list">
            <div><Truck size={16} /> Free shipping on orders above ₹2,500</div>
            <div><ShieldCheck size={16} /> Secure payments and easy returns</div>
            <div><BadgePercent size={16} /> Exclusive member discounts</div>
          </div>
        </div>
      </div>

      <div className="container related-section">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Related products</span>
            <h2>Complete your look</h2>
          </div>
        </div>
        <div className="product-grid compact">
          {related.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              onAddToCart={() => addToCart(item.id, 1)}
              onAddToWishlist={() => handleWishlist(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CartPage() {
  const [items, setItems] = useState([])
  const [subtotal, setSubtotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { token } = useAuth()
  const { refreshCartCount, updateCartItem, removeCartItem } = useCart()

  const fetchCart = async () => {
    if (!token) {
      const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]')
      if (!guestCart.length) {
        setItems([])
        setSubtotal(0)
        setLoading(false)
        return
      }
      try {
        const response = await api.get('/products')
        const productMap = Object.fromEntries((response.data.products || []).map((item) => [item.id, item]))
        const hydratedItems = guestCart.map((entry) => {
          const product = productMap[entry.product_id]
          return product ? { ...entry, name: product.name, image_url: product.image_url, price: product.price, stock: product.stock, subtotal: product.price * entry.quantity } : null
        }).filter(Boolean)
        setItems(hydratedItems)
        setSubtotal(hydratedItems.reduce((total, item) => total + item.subtotal, 0))
        setLoading(false)
      } catch (error) {
        setItems([])
        setSubtotal(0)
        setLoading(false)
      }
      return
    }

    try {
      const response = await api.get('/cart')
      setItems(response.data.items || [])
      setSubtotal(response.data.subtotal || 0)
    } catch (error) {
      setItems([])
      setSubtotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCart()
  }, [token])

  const totalItems = items.reduce((total, item) => total + item.quantity, 0)

  const handleUpdate = async (productId, quantity) => {
    await updateCartItem(productId, quantity)
    await fetchCart()
    await refreshCartCount()
  }

  if (loading) return <div className="page-loader">Loading cart...</div>
  if (!items.length) {
    return (
      <div className="page-shell">
        <div className="container empty-state large-empty">
          <ShoppingCart size={44} />
          <h3>Your cart is empty</h3>
          <p>Browse products and add a few items to get started.</p>
          <Link to="/shop" className="primary-btn">Continue shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="container cart-layout">
        <div className="cart-list">
          {items.map((item) => (
            <div className="cart-item" key={item.product_id || item.id}>
              <img src={item.image_url} alt={item.name} />
              <div className="cart-item-info">
                <h3>{item.name}</h3>
                <p>{formatPrice(item.price)}</p>
                <div className="quantity-row compact-row">
                  <button type="button" onClick={() => handleUpdate(item.product_id, Math.max(1, item.quantity - 1))}><Minus size={14} /></button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => handleUpdate(item.product_id, Math.min(item.stock || item.quantity + 1, item.quantity + 1))}><Plus size={14} /></button>
                </div>
              </div>
              <div className="cart-item-meta">
                <strong>{formatPrice(item.subtotal || item.price * item.quantity)}</strong>
                <button type="button" className="icon-btn danger" onClick={async () => { await removeCartItem(item.product_id); await fetchCart(); await refreshCartCount(); }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        <aside className="summary-box">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Items</span><strong>{totalItems}</strong></div>
          <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
          <div className="summary-row"><span>Shipping</span><strong>{subtotal >= 2500 ? 'Free' : formatPrice(150)}</strong></div>
          <div className="summary-row total-row"><span>Total</span><strong>{formatPrice(subtotal + (subtotal >= 2500 ? 0 : 150))}</strong></div>
          <Link to="/checkout" className="primary-btn wide">Proceed to Checkout</Link>
        </aside>
      </div>
    </div>
  )
}

function WishlistPage() {
  const [items, setItems] = useState([])
  const { addToCart, refreshCartCount } = useCart()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    api
      .get('/wishlist')
      .then((response) => setItems(response.data.items || []))
      .catch(() => setItems([]))
  }, [user])

  const moveToCart = async (product) => {
    await addToCart(product.id, 1)
    await api.delete(`/wishlist/${product.id}`)
    setItems((current) => current.filter((item) => item.id !== product.id))
    await refreshCartCount()
  }

  const removeItem = async (productId) => {
    await api.delete(`/wishlist/${productId}`)
    setItems((current) => current.filter((item) => item.id !== productId))
  }

  if (!user) {
    return <div className="empty-state">Please log in to access your wishlist.</div>
  }

  return (
    <div className="page-shell">
      <div className="container">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Saved items</span>
            <h2>Your wishlist</h2>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty-state"><Heart size={42} /><h3>Your wishlist is empty</h3></div>
        ) : (
          <div className="wishlist-grid">
            {items.map((product) => (
              <div key={product.id} className="wishlist-item">
                <img src={product.image_url} alt={product.name} />
                <div>
                  <h3>{product.name}</h3>
                  <p>{formatPrice(product.price)}</p>
                </div>
                <div className="wishlist-actions">
                  <button type="button" className="primary-btn small" onClick={() => moveToCart(product)}>Move to cart</button>
                  <button type="button" className="secondary-btn small" onClick={() => removeItem(product.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })

  const onSubmit = async (event) => {
    event.preventDefault()
    try {
      await login(form.email, form.password)
      navigate(location.state?.from || '/shop')
      toast.success('Login successful')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed')
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="auth-card">
        <h2>Welcome back</h2>
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="field-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button type="submit" className="primary-btn wide">Login</button>
        </form>
        <p className="auth-switch">Need an account? <Link to="/register">Register here</Link></p>
      </div>
    </div>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm_password: '' })

  const onSubmit = async (event) => {
    event.preventDefault()
    try {
      await register(form)
      navigate('/shop')
      toast.success('Registration successful')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create account')
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="auth-card">
        <h2>Create your account</h2>
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="field-group">
            <label>Full name</label>
            <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="field-group">
            <label>Email address</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="field-group">
            <label>Confirm password</label>
            <input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required />
          </div>
          <button type="submit" className="primary-btn wide">Register</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Login here</Link></p>
      </div>
    </div>
  )
}

function ProfilePage() {
  const { user, changePassword, logout } = useAuth()
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' })

  const handlePasswordUpdate = async (event) => {
    event.preventDefault()
    try {
      await changePassword(passwordForm.current_password, passwordForm.new_password)
      toast.success('Password updated successfully')
      setPasswordForm({ current_password: '', new_password: '' })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password')
    }
  }

  return (
    <div className="page-shell">
      <div className="container profile-layout">
        <aside className="profile-card">
          <h3>Profile</h3>
          <p><strong>Name:</strong> {user?.full_name}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Role:</strong> {user?.role}</p>
          <div className="profile-actions">
            <Link to="/orders" className="secondary-btn wide">My orders</Link>
            <button type="button" className="text-btn danger-text" onClick={logout}>Logout</button>
          </div>
        </aside>

        <div className="profile-card">
          <h3>Change password</h3>
          <form className="form-grid" onSubmit={handlePasswordUpdate}>
            <div className="field-group">
              <label>Current password</label>
              <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>New password</label>
              <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required />
            </div>
            <button type="submit" className="primary-btn wide">Update password</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function CheckoutPage() {
  const navigate = useNavigate()
  const [cart, setCart] = useState({ items: [], subtotal: 0 })
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const [form, setForm] = useState({
    customer_name: user?.full_name || '',
    phone: '',
    shipping_address: '',
    city: '',
    state: '',
    postal_code: '',
    payment_method: 'cod',
    coupon_code: '',
  })

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await api.get('/cart')
        setCart(response.data)
      } catch (error) {
        setCart({ items: [], subtotal: 0 })
      } finally {
        setLoading(false)
      }
    }
    fetchCart()
  }, [user])

  const shippingFee = cart.subtotal >= 2500 ? 0 : 150
  const couponDiscount = form.coupon_code.trim().toUpperCase() === 'SAVE10' ? cart.subtotal * 0.1 : 0
  const finalTotal = Math.max(cart.subtotal + shippingFee - couponDiscount, 0)

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      const response = await api.post('/checkout', { ...form, customer_name: form.customer_name || user?.full_name })
      toast.success('Order placed successfully')
      const paymentRequired = response.data.payment_setup_required
      if (paymentRequired) {
        toast.warning('Online payment is not configured in the backend environment. COD remains available.')
      }
      navigate(`/orders/${response.data.order.id}`)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to place order')
    }
  }

  if (loading) return <div className="page-loader">Loading checkout...</div>
  if (!cart.items.length) {
    return (
      <div className="page-shell">
        <div className="container empty-state">
          <ShoppingBag size={42} />
          <h3>Your cart is empty</h3>
          <Link to="/shop" className="primary-btn">Continue shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="container checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <h2>Checkout</h2>
          <div className="field-group">
            <label>Customer name</label>
            <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
          </div>
          <div className="field-group">
            <label>Phone number</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div className="field-group">
            <label>Shipping address</label>
            <textarea value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} required />
          </div>
          <div className="price-grid">
            <div className="field-group">
              <label>City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>State</label>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
            </div>
          </div>
          <div className="field-group">
            <label>PIN code</label>
            <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} required />
          </div>
          <div className="field-group">
            <label>Coupon code</label>
            <input value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value })} placeholder="SAVE10" />
          </div>
          <div className="field-group">
            <label>Payment method</label>
            <div className="payment-options">
              <label><input type="radio" name="payment" checked={form.payment_method === 'cod'} onChange={() => setForm({ ...form, payment_method: 'cod' })} /> Cash on Delivery</label>
              <label><input type="radio" name="payment" checked={form.payment_method === 'online'} onChange={() => setForm({ ...form, payment_method: 'online' })} /> Online payment</label>
            </div>
            {form.payment_method === 'online' && (
              <p className="info-note">If Razorpay credentials are not added to the backend .env file, the app will keep the payment flow ready and continue with COD-safe setup messaging.</p>
            )}
          </div>
          <button type="submit" className="primary-btn wide">Place order</button>
        </form>

        <aside className="summary-box">
          <h3>Order Summary</h3>
          {cart.items.map((item) => (
            <div key={item.product_id} className="summary-product">
              <span>{item.name} × {item.quantity}</span>
              <strong>{formatPrice(item.subtotal || item.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(cart.subtotal)}</strong></div>
          <div className="summary-row"><span>Shipping</span><strong>{shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}</strong></div>
          <div className="summary-row"><span>Discount</span><strong>{formatPrice(couponDiscount)}</strong></div>
          <div className="summary-row total-row"><span>Total</span><strong>{formatPrice(finalTotal)}</strong></div>
        </aside>
      </div>
    </div>
  )
}

function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const loadOrders = async () => {
    try {
      const response = await api.get('/orders')
      setOrders(response.data.orders || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const cancelOrder = async (orderId) => {
    try {
      await api.put(`/orders/${orderId}/cancel`)
      toast.success('Order cancelled')
      loadOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel order')
    }
  }

  if (loading) return <div className="page-loader">Loading your orders...</div>

  return (
    <div className="page-shell">
      <div className="container">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Orders</span>
            <h2>My purchases</h2>
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="empty-state"><PackageCheck size={42} /><h3>No orders yet</h3><Link to="/shop" className="primary-btn">Start shopping</Link></div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-head">
                  <div>
                    <span className="eyebrow">{order.order_number}</span>
                    <h3>{new Date(order.created_at).toLocaleDateString()}</h3>
                  </div>
                  <span className={`status-badge ${order.status}`}>{order.status}</span>
                </div>
                <div className="order-details-row">
                  <span>{order.items.length} items</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
                <div className="order-actions">
                  <Link to={`/orders/${order.id}`} className="secondary-btn small">View details</Link>
                  {['pending', 'confirmed'].includes(order.status) && (
                    <button type="button" className="text-btn danger-text" onClick={() => cancelOrder(order.id)}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then((response) => setOrder(response.data.order))
      .catch((error) => console.error(error))
  }, [id])

  if (!order) return <div className="page-loader">Loading order details...</div>

  return (
    <div className="page-shell">
      <div className="container order-detail-box">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Order</span>
            <h2>{order.order_number}</h2>
          </div>
          <span className={`status-badge ${order.status}`}>{order.status}</span>
        </div>

        <div className="detail-grid">
          <div className="profile-card">
            <h3>Shipping</h3>
            <p>{order.customer_name}</p>
            <p>{order.shipping_address}</p>
            <p>{order.city}, {order.state} - {order.postal_code}</p>
            <p>{order.phone}</p>
          </div>
          <div className="profile-card">
            <h3>Payment</h3>
            <p>Method: {order.payment_method}</p>
            <p>Status: {order.payment_status}</p>
            <p>Coupon: {order.coupon_code || 'None'}</p>
          </div>
        </div>

        <div className="order-items-list">
          {order.items.map((item) => (
            <div key={item.id} className="order-item-row">
              <div>
                <h4>{item.product_name}</h4>
                <p>Qty: {item.quantity}</p>
              </div>
              <strong>{formatPrice(item.price * item.quantity)}</strong>
            </div>
          ))}
        </div>

        <div className="summary-box padded-summary">
          <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></div>
          <div className="summary-row"><span>Shipping</span><strong>{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee)}</strong></div>
          <div className="summary-row"><span>Discount</span><strong>{formatPrice(order.discount_amount)}</strong></div>
          <div className="summary-row total-row"><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
        </div>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const [summary, setSummary] = useState({ stats: {}, orders: [] })

  const loadSummary = async () => {
    const response = await api.get('/admin/summary')
    setSummary(response.data)
  }

  useEffect(() => {
    loadSummary()
  }, [])

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status })
      toast.success('Order status updated')
      loadSummary()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update order status')
    }
  }

  return (
    <div className="page-shell">
      <div className="container admin-shell">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Admin panel</span>
            <h2>Dashboard overview</h2>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-box"><strong>{summary.stats.total_orders || 0}</strong><span>Total orders</span></div>
          <div className="stat-box"><strong>{formatPrice(summary.stats.total_revenue || 0)}</strong><span>Revenue</span></div>
          <div className="stat-box"><strong>{summary.stats.customers || 0}</strong><span>Customers</span></div>
          <div className="stat-box"><strong>{summary.stats.pending_orders || 0}</strong><span>Pending</span></div>
        </div>

        <div className="orders-list admin-table">
          {summary.orders.map((order) => (
            <div key={order.id} className="order-card admin-order">
              <div className="order-head">
                <div>
                  <span className="eyebrow">{order.order_number}</span>
                  <h3>{order.customer_name}</h3>
                </div>
                <span className={`status-badge ${order.status}`}>{order.status}</span>
              </div>
              <div className="order-details-row">
                <span>{order.payment_method}</span>
                <span>{formatPrice(order.total)}</span>
              </div>
              <div className="order-actions admin-actions">
                <select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminOnlyRoute><AdminDashboard /></AdminOnlyRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
          <ToastContainer position="top-right" autoClose={2800} hideProgressBar={false} newestOnTop />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
