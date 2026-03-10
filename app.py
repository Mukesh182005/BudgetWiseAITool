"""
BudgetWise — AI-Based Expense Forecasting Tool
Main Flask Application
"""

from flask import Flask, render_template, redirect, url_for
from flask_login import LoginManager, login_required, current_user
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import Config
from models import db, User

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
db.init_app(app)
CORS(app)
jwt = JWTManager(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# Register blueprints
from auth_routes import auth_bp, bcrypt
from api_routes import api_bp

bcrypt.init_app(app)
app.register_blueprint(auth_bp)
app.register_blueprint(api_bp)


# ==================== PAGE ROUTES ====================

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', user=current_user)


@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/gdpr')
def gdpr():
    return render_template('gdpr.html')

@app.route('/cookies')
def cookies():
    return render_template('cookies.html')


# ==================== DATABASE INITIALIZATION ====================


def init_db():
    """Create all database tables and seed default data."""
    with app.app_context():
        db.create_all()

        # Seed default categories
        from models import Category
        if Category.query.count() == 0:
            defaults = [
                ('Food & Dining', '🍕', '#667eea'),
                ('Transport', '🚗', '#764ba2'),
                ('Shopping', '🛍️', '#f093fb'),
                ('Bills & Utilities', '📱', '#4facfe'),
                ('Entertainment', '🎬', '#43e97b'),
                ('Health', '💊', '#fa709a'),
                ('Education', '📚', '#fee140'),
                ('Rent & Housing', '🏠', '#a18cd1'),
                ('Savings', '💰', '#00c9ff'),
                ('Others', '📦', '#9ca3af'),
            ]
            for name, icon, color in defaults:
                db.session.add(Category(name=name, icon=icon, color=color))
            db.session.commit()
            print('✅ Default categories seeded.')

        print('✅ Database initialized.')


if __name__ == '__main__':
    init_db()
    print('\n🚀 BudgetWise is running at http://127.0.0.1:5000\n')
    app.run(debug=True, port=5000)
