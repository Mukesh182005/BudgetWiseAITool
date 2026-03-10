from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Transaction, Category, Budget, FinancialGoal, User
from datetime import datetime, timedelta
from sqlalchemy import func, extract
import json

api_bp = Blueprint('api', __name__, url_prefix='/api')


# ==================== TRANSACTIONS ====================

@api_bp.route('/transactions', methods=['GET'])
@login_required
def get_transactions():
    """Get all transactions for the current user with optional filters."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    category_id = request.args.get('category_id', type=int)
    tx_type = request.args.get('type')  # expense or income
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)

    query = Transaction.query.filter_by(user_id=current_user.id)

    if category_id:
        query = query.filter_by(category_id=category_id)
    if tx_type:
        query = query.filter_by(transaction_type=tx_type)
    if month:
        query = query.filter(extract('month', Transaction.date) == month)
    if year:
        query = query.filter(extract('year', Transaction.date) == year)

    query = query.order_by(Transaction.date.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'transactions': [t.to_dict() for t in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page
    })


@api_bp.route('/transactions', methods=['POST'])
@login_required
def add_transaction():
    """Add a new transaction. AI auto-categorizes if no category provided."""
    data = request.get_json()
    amount = data.get('amount')
    description = data.get('description', '')
    tx_type = data.get('transaction_type', 'expense')
    category_id = data.get('category_id')
    date_str = data.get('date')

    if not amount:
        return jsonify({'error': 'Amount is required'}), 400

    # AI auto-categorization if no category provided
    if not category_id and description:
        from ai_engine import categorize_transaction
        category_id = categorize_transaction(description)

    tx_date = datetime.fromisoformat(date_str) if date_str else datetime.utcnow()

    transaction = Transaction(
        user_id=current_user.id,
        category_id=category_id,
        amount=float(amount),
        description=description,
        transaction_type=tx_type,
        date=tx_date
    )
    db.session.add(transaction)
    db.session.commit()

    return jsonify({'message': 'Transaction added', 'transaction': transaction.to_dict()}), 201


@api_bp.route('/transactions/<int:tx_id>', methods=['PUT'])
@login_required
def update_transaction(tx_id):
    tx = Transaction.query.filter_by(id=tx_id, user_id=current_user.id).first_or_404()
    data = request.get_json()

    if 'amount' in data:
        tx.amount = float(data['amount'])
    if 'description' in data:
        tx.description = data['description']
    if 'category_id' in data:
        tx.category_id = data['category_id']
    if 'transaction_type' in data:
        tx.transaction_type = data['transaction_type']
    if 'date' in data:
        tx.date = datetime.fromisoformat(data['date'])

    db.session.commit()
    return jsonify({'message': 'Transaction updated', 'transaction': tx.to_dict()})


@api_bp.route('/transactions/<int:tx_id>', methods=['DELETE'])
@login_required
def delete_transaction(tx_id):
    tx = Transaction.query.filter_by(id=tx_id, user_id=current_user.id).first_or_404()
    db.session.delete(tx)
    db.session.commit()
    return jsonify({'message': 'Transaction deleted'})


# ==================== CATEGORIES ====================

@api_bp.route('/categories', methods=['GET'])
@login_required
def get_categories():
    categories = Category.query.all()
    return jsonify([c.to_dict() for c in categories])


# ==================== BUDGETS ====================

@api_bp.route('/budgets', methods=['GET'])
@login_required
def get_budgets():
    month = request.args.get('month', datetime.utcnow().month, type=int)
    year = request.args.get('year', datetime.utcnow().year, type=int)

    budgets = Budget.query.filter_by(user_id=current_user.id, month=month, year=year).all()
    result = []
    for b in budgets:
        spent = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == current_user.id,
            Transaction.category_id == b.category_id,
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date) == month,
            extract('year', Transaction.date) == year
        ).scalar() or 0

        result.append({
            **b.to_dict(),
            'spent': round(spent, 2),
            'remaining': round(b.amount - spent, 2),
            'percentage': round((spent / b.amount * 100), 1) if b.amount > 0 else 0
        })

    return jsonify(result)


@api_bp.route('/budgets', methods=['POST'])
@login_required
def set_budget():
    data = request.get_json()
    budget = Budget(
        user_id=current_user.id,
        category_id=data.get('category_id'),
        amount=float(data['amount']),
        month=data.get('month', datetime.utcnow().month),
        year=data.get('year', datetime.utcnow().year)
    )
    db.session.add(budget)
    db.session.commit()
    return jsonify({'message': 'Budget set', 'budget': budget.to_dict()}), 201


# ==================== FINANCIAL GOALS ====================

@api_bp.route('/goals', methods=['GET'])
@login_required
def get_goals():
    goals = FinancialGoal.query.filter_by(user_id=current_user.id).all()
    return jsonify([g.to_dict() for g in goals])


@api_bp.route('/goals', methods=['POST'])
@login_required
def add_goal():
    data = request.get_json()
    goal = FinancialGoal(
        user_id=current_user.id,
        name=data['name'],
        target_amount=float(data['target_amount']),
        current_amount=float(data.get('current_amount', 0)),
        deadline=datetime.fromisoformat(data['deadline']) if data.get('deadline') else None,
        icon=data.get('icon', '🎯')
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify({'message': 'Goal created', 'goal': goal.to_dict()}), 201


@api_bp.route('/goals/<int:goal_id>', methods=['PUT'])
@login_required
def update_goal(goal_id):
    goal = FinancialGoal.query.filter_by(id=goal_id, user_id=current_user.id).first_or_404()
    data = request.get_json()

    if 'current_amount' in data:
        goal.current_amount = float(data['current_amount'])
    if 'target_amount' in data:
        goal.target_amount = float(data['target_amount'])
    if 'name' in data:
        goal.name = data['name']
    if 'icon' in data:
        goal.icon = data['icon']
    if 'deadline' in data:
        goal.deadline = datetime.fromisoformat(data['deadline']) if data['deadline'] else None

    db.session.commit()
    return jsonify({'message': 'Goal updated', 'goal': goal.to_dict()})


@api_bp.route('/goals/<int:goal_id>', methods=['DELETE'])
@login_required
def delete_goal(goal_id):
    goal = FinancialGoal.query.filter_by(id=goal_id, user_id=current_user.id).first_or_404()
    db.session.delete(goal)
    db.session.commit()
    return jsonify({'message': 'Goal deleted'})


# ==================== PROFILE ====================

@api_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile details."""
    data = request.get_json()
    if 'full_name' in data:
        current_user.full_name = data['full_name']
    if 'phone_number' in data:
        current_user.phone_number = data['phone_number']
    if 'city' in data:
        current_user.city = data['city']
    if 'country' in data:
        current_user.country = data['country']
    if 'currency' in data:
        current_user.currency = data['currency']
    
    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': current_user.to_dict()})


@api_bp.route('/profile/upload-photo', methods=['POST'])
@login_required
def upload_profile_photo():
    """Handle profile photo upload."""
    if 'photo' not in request.files:
        return jsonify({'error': 'No photo part'}), 400
    
    file = request.files['photo']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        import os
        from uuid import uuid4
        from werkzeug.utils import secure_filename
        
        # Ensure uploads folder exists
        upload_folder = os.path.join('static', 'uploads', 'profiles')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        filename = secure_filename(f"{current_user.id}_{uuid4().hex[:8]}_{file.filename}")
        file.save(os.path.join(upload_folder, filename))
        
        current_user.profile_photo = filename
        db.session.commit()
        
        return jsonify({'message': 'Photo uploaded successfully', 'photo_url': filename})
    
    return jsonify({'error': 'Upload failed'}), 500


# ==================== ANALYTICS ====================

@api_bp.route('/analytics/summary', methods=['GET'])
@login_required
def get_summary():
    """Get monthly financial summary for dashboard."""
    now = datetime.utcnow()
    month = request.args.get('month', now.month, type=int)
    year = request.args.get('year', now.year, type=int)

    total_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == 'income',
        extract('month', Transaction.date) == month,
        extract('year', Transaction.date) == year
    ).scalar() or 0

    total_expense = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == 'expense',
        extract('month', Transaction.date) == month,
        extract('year', Transaction.date) == year
    ).scalar() or 0

    # All categories with either transactions or budgets
    # 1. Categories with expense transactions
    cat_tx = db.session.query(
        Category.id, Category.name, Category.icon, Category.color,
        func.sum(Transaction.amount).label('total')
    ).join(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == 'expense',
        extract('month', Transaction.date) == month,
        extract('year', Transaction.date) == year
    ).group_by(Category.id).all()

    # 1b. Categories with income transactions
    cat_income_tx = db.session.query(
        Category.id, Category.name, Category.icon, Category.color,
        func.sum(Transaction.amount).label('total')
    ).join(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == 'income',
        extract('month', Transaction.date) == month,
        extract('year', Transaction.date) == year
    ).group_by(Category.id).all()

    # 2. Categories with budgets
    cat_budget = db.session.query(
        Category.id, Category.name, Category.icon, Category.color,
        Budget.amount
    ).join(Budget, Category.id == Budget.category_id).filter(
        Budget.user_id == current_user.id,
        Budget.month == month,
        Budget.year == year
    ).all()

    # Merge results for expenses
    category_map = {}
    
    # Add from tx
    for c in cat_tx:
        category_map[c.id] = {
            'name': c.name,
            'icon': c.icon,
            'color': c.color,
            'total': round(c.total, 2),
            'budget': 0
        }
    
    # Add/Update from budget
    for c in cat_budget:
        if c.id in category_map:
            category_map[c.id]['budget'] = round(c.amount, 2)
        else:
            category_map[c.id] = {
                'name': c.name,
                'icon': c.icon,
                'color': c.color,
                'total': 0,
                'budget': round(c.amount, 2)
            }
    
    category_summary = sorted(category_map.values(), key=lambda x: x['total'], reverse=True)

    # Build income breakdown
    income_colors = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#34d399', '#10b981', '#059669']
    income_breakdown = []
    for i, c in enumerate(cat_income_tx):
        income_breakdown.append({
            'name': c.name,
            'icon': c.icon,
            'color': income_colors[i % len(income_colors)],
            'total': round(c.total, 2)
        })
    income_breakdown.sort(key=lambda x: x['total'], reverse=True)

    # If no categorized income, show total as "General Income"
    if not income_breakdown and total_income > 0:
        income_breakdown = [{'name': 'General Income', 'icon': '💰', 'color': '#16a34a', 'total': round(total_income, 2)}]

    return jsonify({
        'total_income': round(total_income, 2),
        'total_expense': round(total_expense, 2),
        'savings': round(total_income - total_expense, 2),
        'currency': current_user.currency or 'INR',
        'category_breakdown': category_summary,
        'income_breakdown': income_breakdown,
        'month': month,
        'year': year
    })


@api_bp.route('/analytics/trends', methods=['GET'])
@login_required
def get_trends():
    """Get monthly spending trends for the past 12 months."""
    now = datetime.utcnow()
    trends = []

    for i in range(11, -1, -1):
        d = now - timedelta(days=i * 30)
        m, y = d.month, d.year
        total = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date) == m,
            extract('year', Transaction.date) == y
        ).scalar() or 0
        trends.append({'month': m, 'year': y, 'total': round(total, 2)})

    return jsonify(trends)


@api_bp.route('/analytics/forecast', methods=['GET'])
@login_required
def get_analytics_forecast():
    """Get AI expense forecast for the next 3 months."""
    from ai_engine import forecast_expenses
    data = forecast_expenses(current_user.id)
    return jsonify(data)


@api_bp.route('/analytics/heatmap', methods=['GET'])
@login_required
def get_heatmap():
    """Get spending intensity by day of week and hour (or just day)."""
    # Simply day of week for now
    data = db.session.query(
        extract('dow', Transaction.date).label('dow'),
        func.sum(Transaction.amount).label('total')
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == 'expense'
    ).group_by('dow').all()

    #dow: 0=Sunday, 6=Saturday
    heatmap = {int(d.dow): round(d.total, 2) for d in data}
    return jsonify(heatmap)


# ==================== AI CHAT ENDPOINT ====================

@api_bp.route('/chat', methods=['POST'])
@login_required
def ai_chat():
    """Handle AI chatbot messages."""
    data = request.get_json()
    message = data.get('message', '')

    from ai_engine import process_chat_message
    response = process_chat_message(message, current_user.id)

    return jsonify({'reply': response})


# ==================== FORECASTING ENDPOINT ====================

@api_bp.route('/forecast', methods=['GET'])
@login_required
def get_ai_forecast():
    """Get AI-powered expense forecast."""
    months_ahead = request.args.get('months', 3, type=int)

    from ai_engine import forecast_expenses
    forecast = forecast_expenses(current_user.id, months_ahead)

    return jsonify(forecast)


# ==================== FINANCIAL HEALTH ====================

@api_bp.route('/health-score', methods=['GET'])
@login_required
def get_health_score():
    """Calculate AI-based financial health score."""
    from ai_engine import calculate_health_score
    score = calculate_health_score(current_user.id)
    return jsonify(score)
