import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'budgetwise-secret-key-change-in-production')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///budgetwise.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour
    JWT_TOKEN_LOCATION = ['cookies', 'headers']
    JWT_COOKIE_SECURE = False  # Set True in production
    JWT_COOKIE_CSRF_PROTECT = False  # Set True in production
    GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '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')
