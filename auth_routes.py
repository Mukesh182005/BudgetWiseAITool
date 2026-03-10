from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, set_access_cookies, unset_jwt_cookies
from models import db, User

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('register.html')

    # Handle JSON API or form submission
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip()

    # Validation
    if not username or not email or not password:
        error = 'Username, email, and password are required.'
        if request.is_json:
            return jsonify({'error': error}), 400
        flash(error, 'error')
        return redirect(url_for('auth.register'))

    if User.query.filter_by(email=email).first():
        error = 'Email already registered.'
        if request.is_json:
            return jsonify({'error': error}), 409
        flash(error, 'error')
        return redirect(url_for('auth.register'))

    if User.query.filter_by(username=username).first():
        error = 'Username already taken.'
        if request.is_json:
            return jsonify({'error': error}), 409
        flash(error, 'error')
        return redirect(url_for('auth.register'))

    # Create user
    user = User(
        username=username,
        email=email,
        password_hash=bcrypt.generate_password_hash(password).decode('utf-8'),
        full_name=full_name
    )
    db.session.add(user)
    db.session.commit()

    # Create default categories for the user
    _seed_default_categories()

    if request.is_json:
        token = create_access_token(identity=str(user.id))
        return jsonify({'message': 'Registration successful', 'token': token, 'user': user.to_dict()}), 201

    login_user(user)
    token = create_access_token(identity=str(user.id))
    resp = redirect(url_for('dashboard'))
    set_access_cookies(resp, token)
    return resp


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    email = data.get('email', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        error = 'Invalid email or password.'
        if request.is_json:
            return jsonify({'error': error}), 401
        flash(error, 'error')
        return redirect(url_for('auth.login'))

    if request.is_json:
        token = create_access_token(identity=str(user.id))
        return jsonify({'token': token, 'user': user.to_dict()}), 200

    login_user(user)
    token = create_access_token(identity=str(user.id))
    resp = redirect(url_for('dashboard'))
    set_access_cookies(resp, token)
    return resp


@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    resp = redirect(url_for('home'))
    unset_jwt_cookies(resp)
    return resp


@auth_bp.route('/profile', methods=['GET', 'PUT'])
@login_required
def profile():
    if request.method == 'GET':
        return jsonify(current_user.to_dict())

    data = request.get_json()
    if data.get('full_name'):
        current_user.full_name = data['full_name']
    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': current_user.to_dict()})


def _seed_default_categories():
    """Seed default expense categories if they don't exist."""
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
