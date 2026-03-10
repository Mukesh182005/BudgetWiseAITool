from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    """User account model matching PDF schema (page 8)."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(150), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=True)
    profile_photo = db.Column(db.String(255), default='default_profile.png')
    currency = db.Column(db.String(10), default='INR')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    transactions = db.relationship('Transaction', backref='user', lazy=True, cascade='all, delete-orphan')
    budgets = db.relationship('Budget', backref='user', lazy=True, cascade='all, delete-orphan')
    goals = db.relationship('FinancialGoal', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'phone_number': self.phone_number,
            'city': self.city,
            'country': self.country,
            'profile_photo': self.profile_photo,
            'currency': self.currency,
            'created_at': self.created_at.isoformat()
        }


class Category(db.Model):
    """Expense category model."""
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    icon = db.Column(db.String(10), default='📦')
    color = db.Column(db.String(20), default='#667eea')
    is_default = db.Column(db.Boolean, default=True)

    transactions = db.relationship('Transaction', backref='category', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'icon': self.icon,
            'color': self.color
        }


class Transaction(db.Model):
    """Transaction/expense model matching PDF schema."""
    __tablename__ = 'transactions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    transaction_type = db.Column(db.String(20), default='expense')  # expense or income
    date = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'amount': self.amount,
            'description': self.description,
            'transaction_type': self.transaction_type,
            'category': self.category.to_dict() if self.category else None,
            'date': self.date.isoformat(),
            'created_at': self.created_at.isoformat()
        }


class Budget(db.Model):
    """Monthly budget model."""
    __tablename__ = 'budgets'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    category = db.relationship('Category', backref='budgets')

    def to_dict(self):
        return {
            'id': self.id,
            'amount': self.amount,
            'month': self.month,
            'year': self.year,
            'category': self.category.to_dict() if self.category else None
        }


class FinancialGoal(db.Model):
    """Financial goal/savings target model matching PDF schema."""
    __tablename__ = 'financial_goals'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, default=0.0)
    deadline = db.Column(db.DateTime, nullable=True)
    icon = db.Column(db.String(10), default='🎯')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        progress = (self.current_amount / self.target_amount * 100) if self.target_amount > 0 else 0
        return {
            'id': self.id,
            'name': self.name,
            'target_amount': self.target_amount,
            'current_amount': self.current_amount,
            'progress': round(progress, 1),
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'icon': self.icon
        }
