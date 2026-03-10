"""
BudgetWise AI Engine
- Transaction categorization using NLTK keyword matching
- Expense forecasting using Prophet (with fallback to simple moving average)
- AI chat message processing
- Financial health score calculation
"""

import re
from datetime import datetime, timedelta

# ==================== TRANSACTION CATEGORIZATION (NLTK/Regex) ====================

CATEGORY_KEYWORDS = {
    1: ['food', 'restaurant', 'dinner', 'lunch', 'breakfast', 'pizza', 'burger',
        'coffee', 'tea', 'snack', 'grocery', 'swiggy', 'zomato', 'uber eats',
        'dominos', 'mcdonalds', 'kfc', 'dining', 'cafe', 'bakery', 'milk', 'bread'],
    2: ['uber', 'ola', 'taxi', 'cab', 'petrol', 'diesel', 'fuel', 'bus', 'train',
        'metro', 'flight', 'parking', 'toll', 'transport', 'car', 'bike', 'auto'],
    3: ['amazon', 'flipkart', 'myntra', 'shopping', 'clothes', 'shoes', 'electronics',
        'phone', 'laptop', 'gadget', 'watch', 'bag', 'dress', 'shirt', 'jeans'],
    4: ['electricity', 'water', 'gas', 'internet', 'wifi', 'broadband', 'mobile',
        'recharge', 'bill', 'utility', 'phone bill', 'dth', 'subscription'],
    5: ['movie', 'netflix', 'spotify', 'hotstar', 'prime', 'gaming', 'concert',
        'theatre', 'entertainment', 'party', 'club', 'outing', 'fun'],
    6: ['doctor', 'hospital', 'medicine', 'pharmacy', 'health', 'gym', 'fitness',
        'medical', 'clinic', 'dental', 'eye', 'therapy', 'insurance'],
    7: ['course', 'book', 'tuition', 'school', 'college', 'university', 'exam',
        'education', 'training', 'udemy', 'coursera', 'class', 'tutorial'],
    8: ['rent', 'emi', 'mortgage', 'house', 'apartment', 'flat', 'maintenance',
        'repair', 'furniture', 'home', 'plumber', 'electrician', 'paint'],
    9: ['savings', 'investment', 'mutual fund', 'fd', 'deposit', 'stock',
        'share', 'sip', 'ppf', 'nps', 'gold', 'crypto', 'bitcoin'],
}


def categorize_transaction(description):
    """Categorize a transaction using keyword matching (NLTK-style NLP)."""
    if not description:
        return 10  # Others

    desc_lower = description.lower().strip()

    for category_id, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if re.search(r'\b' + re.escape(keyword) + r'\b', desc_lower):
                return category_id

    return 10  # Default to 'Others'


# ==================== EXPENSE FORECASTING ====================

def forecast_expenses(user_id, months_ahead=3):
    """
    Forecast future expenses using Prophet if available,
    falls back to simple moving average.
    """
    from models import db, Transaction
    from sqlalchemy import func, extract

    # Get monthly expense totals for past 12 months
    now = datetime.utcnow()
    monthly_data = []

    for i in range(11, -1, -1):
        d = now - timedelta(days=i * 30)
        m, y = d.month, d.year
        total = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date) == m,
            extract('year', Transaction.date) == y
        ).scalar() or 0
        monthly_data.append({
            'ds': datetime(y, m, 1),
            'y': float(total),
            'month': m,
            'year': y
        })

    # Try Prophet forecasting
    try:
        import pandas as pd
        from prophet import Prophet

        df = pd.DataFrame([{'ds': d['ds'], 'y': d['y']} for d in monthly_data])

        if df['y'].sum() > 0:
            model = Prophet(yearly_seasonality=True, daily_seasonality=False, weekly_seasonality=False)
            model.fit(df)
            future = model.make_future_dataframe(periods=months_ahead, freq='MS')
            prediction = model.predict(future)

            forecasted = []
            for _, row in prediction.tail(months_ahead).iterrows():
                forecasted.append({
                    'month': row['ds'].month,
                    'year': row['ds'].year,
                    'predicted': round(max(row['yhat'], 0), 2),
                    'lower': round(max(row['yhat_lower'], 0), 2),
                    'upper': round(max(row['yhat_upper'], 0), 2)
                })

            return {
                'method': 'prophet',
                'historical': [{'month': d['month'], 'year': d['year'], 'total': d['y']} for d in monthly_data],
                'forecast': forecasted,
                'confidence': 'high'
            }
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback: Simple moving average
    values = [d['y'] for d in monthly_data if d['y'] > 0]
    avg = sum(values[-3:]) / max(len(values[-3:]), 1) if values else 0

    forecasted = []
    for i in range(1, months_ahead + 1):
        future_date = now + timedelta(days=i * 30)
        forecasted.append({
            'month': future_date.month,
            'year': future_date.year,
            'predicted': round(avg, 2),
            'lower': round(avg * 0.85, 2),
            'upper': round(avg * 1.15, 2)
        })

    return {
        'method': 'moving_average',
        'historical': [{'month': d['month'], 'year': d['year'], 'total': d['y']} for d in monthly_data],
        'forecast': forecasted,
        'confidence': 'medium'
    }


# ==================== AI CHAT PROCESSOR (OpenAI + Smart Fallback) ====================

def _rule_based_chat(message, user_id):
    """Rule-based fallback chat engine with full financial context."""
    from models import db, Transaction, FinancialGoal, Budget, Category
    from sqlalchemy import func, extract

    msg = message.lower().strip()
    now = datetime.utcnow()

    # --- Spending query ---
    if any(w in msg for w in ['spend', 'spent', 'expense', 'how much']):
        total = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date) == now.month,
            extract('year', Transaction.date) == now.year
        ).scalar() or 0

        categories = db.session.query(
            Category.name, Category.icon, func.sum(Transaction.amount).label('total')
        ).join(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date) == now.month,
            extract('year', Transaction.date) == now.year
        ).group_by(Category.id).order_by(func.sum(Transaction.amount).desc()).all()

        if total == 0:
            return "You haven't recorded any expenses this month yet. Start adding transactions to see your spending analysis!"

        breakdown = "\n".join([f"{c.icon} {c.name}: ₹{c.total:,.0f}" for c in categories[:5]])
        top = categories[0].name if categories else "N/A"
        return f"You spent ₹{total:,.0f} this month. {top} is your top category.\n\n{breakdown}"

    # --- Affordability check ---
    if any(w in msg for w in ['afford', 'can i buy', 'can i purchase', 'purchase']):
        amount_match = re.search(r'₹?\s?([\d,]+)', msg)
        if amount_match:
            amount = float(amount_match.group(1).replace(',', ''))
            total_expense = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == 'expense',
                extract('month', Transaction.date) == now.month
            ).scalar() or 0
            total_income = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == 'income',
                extract('month', Transaction.date) == now.month
            ).scalar() or 0
            income_base = max(total_income, 50000)
            remaining = income_base - total_expense
            if amount <= remaining:
                return f"✅ Yes, you can afford this! You have ₹{remaining:,.0f} remaining this month. After this purchase, you'll have ₹{remaining - amount:,.0f} left."
            else:
                over = amount - remaining
                return f"⚠️ This purchase of ₹{amount:,.0f} will exceed your remaining budget by ₹{over:,.0f}.\n\n💡 Suggestion: Try reducing spending in another category or wait until next month."

    # --- Savings / Goals query ---
    if any(w in msg for w in ['saving', 'goal', 'target']):
        goals = FinancialGoal.query.filter_by(user_id=user_id).all()
        if not goals:
            return "You haven't set any financial goals yet. Create your first savings goal to start tracking progress!"
        lines = [f"{g.icon} {g.name}: ₹{g.current_amount:,.0f} / ₹{g.target_amount:,.0f} ({g.to_dict()['progress']}%)" for g in goals]
        return "Your savings goals:\n\n" + "\n".join(lines)

    # --- Budget query ---
    if any(w in msg for w in ['budget', 'limit']):
        budgets = Budget.query.filter_by(user_id=user_id, month=now.month, year=now.year).all()
        if not budgets:
            return "You haven't set any budgets for this month. Set category budgets to track your spending limits!"
        lines = [f"• {b.category.name}: ₹{b.amount:,.0f}" for b in budgets if b.category]
        return f"Your budgets for {now.strftime('%B %Y')}:\n\n" + "\n".join(lines)

    # --- Health score ---
    if any(w in msg for w in ['health', 'score', 'financial health']):
        score = calculate_health_score(user_id)
        return (f"Your Financial Health Score: {score['score']}/100 ({score['status']})\n\n"
                f"• Spending Ratio: {score['details']['spending_ratio']}%\n"
                f"• Savings Rate: {score['details']['savings_rate']}%\n"
                f"• Budget Adherence: {score['details']['budget_adherence']}%\n\n"
                f"💡 {score['tip']}")

    # --- Greeting ---
    if any(w in msg for w in ['hello', 'hi', 'hey', 'help']):
        return ("Hi! I'm your BudgetWise AI assistant. I can help you with:\n\n"
                "💰 \"How much did I spend this month?\"\n"
                "🛍️ \"Can I afford a ₹20,000 phone?\"\n"
                "🎯 \"Show my savings goals\"\n"
                "📊 \"What's my budget status?\"\n"
                "❤️ \"Show my financial health score\"\n\n"
                "Just ask me anything about your finances!")

    # --- Default ---
    return ("I'm your AI financial assistant! I can help you with:\n\n"
            "💰 Spending analysis & expense breakdown\n"
            "🛍️ Affordability checks for purchases\n"
            "🎯 Savings goal progress tracking\n"
            "📊 Budget status & limits\n"
            "❤️ Financial health score\n\n"
            "Just ask me anything about your finances!")


def process_chat_message(message, user_id):
    """Process a chat message using Groq AI (finance-only) with smart fallback."""
    from models import db, Transaction, FinancialGoal, Budget, Category
    from sqlalchemy import func, extract
    from config import Config

    now = datetime.utcnow()

    try:
        from groq import Groq

        client = Groq(api_key=Config.GROQ_API_KEY)

        # --- Gather user's financial context ---
        total_expense = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date) == now.month,
            extract('year', Transaction.date) == now.year
        ).scalar() or 0

        total_income = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == 'income',
            extract('month', Transaction.date) == now.month,
            extract('year', Transaction.date) == now.year
        ).scalar() or 0

        categories = db.session.query(
            Category.name, func.sum(Transaction.amount).label('total')
        ).join(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date) == now.month,
            extract('year', Transaction.date) == now.year
        ).group_by(Category.id).order_by(func.sum(Transaction.amount).desc()).all()

        goals = FinancialGoal.query.filter_by(user_id=user_id).all()
        budgets = Budget.query.filter_by(user_id=user_id, month=now.month, year=now.year).all()
        health = calculate_health_score(user_id)

        # --- Build financial context ---
        context = f"""
        User's Real-Time Financial Data ({now.strftime('%B %Y')}):
        - Monthly Income: ₹{total_income:,.2f}
        - Monthly Expenses: ₹{total_expense:,.2f}
        - Remaining Balance: ₹{total_income - total_expense:,.2f}
        - Financial Health Score: {health['score']}/100 ({health['status']})
        - Top Spending Categories: {', '.join([f"{c.name} (₹{c.total:,.0f})" for c in categories[:5]]) or 'No expenses yet'}
        - Savings Goals: {', '.join([f"{g.name}: ₹{g.current_amount:,.0f}/₹{g.target_amount:,.0f} ({g.to_dict()['progress']}%)" for g in goals]) or 'No goals set'}
        - Monthly Budgets: {', '.join([f"{b.category.name if b.category else 'Misc'}: ₹{b.amount:,.0f}" for b in budgets]) or 'No budgets set'}
        - Health Tip: {health['tip']}
        """

        # --- Finance-only system prompt with guardrails ---
        system_prompt = f"""You are BudgetWise AI — a premium, intelligent financial assistant embedded in the BudgetWise expense tracking app.

STRICT RULES (YOU MUST FOLLOW THESE):
1. You ONLY answer questions related to personal finance, budgeting, expenses, savings, investments, and money management.
2. If the user asks about ANYTHING unrelated to finance (e.g., coding, weather, jokes, politics, recipes, general knowledge), you MUST politely decline by saying:
   "I'm your BudgetWise financial assistant, and I'm best at helping with money matters! 💰 Try asking me about your spending, budgets, savings goals, or financial health."
3. NEVER generate code, write stories, answer trivia, or discuss non-financial topics.
4. Always use the user's real financial data provided below to give personalized answers.
5. Format currency as ₹ (INR).
6. Be concise, professional, and encouraging.
7. Use emojis sparingly for a premium feel.

{context}"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            temperature=0.7,
            max_tokens=500
        )
        return response.choices[0].message.content

    except Exception as e:
        print(f"[BudgetWise AI] Groq unavailable ({e}) — using smart fallback engine.")
        return _rule_based_chat(message, user_id)



# ==================== FINANCIAL HEALTH SCORE ====================

def calculate_health_score(user_id):
    """Calculate a comprehensive financial health score (0-100)."""
    from models import db, Transaction, Budget, User, FinancialGoal
    from sqlalchemy import func, extract

    now = datetime.utcnow()
    recent_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.transaction_type == 'income',
        extract('month', Transaction.date) == now.month,
        extract('year', Transaction.date) == now.year
    ).scalar() or 0
    income = max(recent_income, 50000)

    # Total expenses this month
    total_expense = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.transaction_type == 'expense',
        extract('month', Transaction.date) == now.month,
        extract('year', Transaction.date) == now.year
    ).scalar() or 0

    # 1. Spending ratio (lower is better) — 30 points
    # Ideal is < 50%
    spending_ratio = (total_expense / income * 100) if income > 0 else 100
    if spending_ratio <= 50:
        spending_score = 30
    elif spending_ratio >= 100:
        spending_score = 0
    else:
        spending_score = 30 * (1 - (spending_ratio - 50) / 50)

    # 2. Savings rate — 30 points
    # Ideal is > 20%
    savings_amount = income - total_expense
    savings_rate = (savings_amount / income * 100) if income > 0 else 0
    if savings_rate >= 20:
        savings_score = 30
    elif savings_rate <= 0:
        savings_score = 0
    else:
        savings_score = 30 * (savings_rate / 20)

    # 3. Budget adherence — 25 points
    budgets = Budget.query.filter_by(user_id=user_id, month=now.month, year=now.year).all()
    if budgets:
        score_per_budget = 25 / len(budgets)
        budget_score = 0
        within_count = 0
        for b in budgets:
            spent = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.category_id == b.category_id,
                Transaction.transaction_type == 'expense',
                extract('month', Transaction.date) == now.month,
                extract('year', Transaction.date) == now.year
            ).scalar() or 0
            if spent <= b.amount:
                budget_score += score_per_budget
                within_count += 1
            else:
                # Penalty for overspending but proportional
                penalty = min(score_per_budget, (spent - b.amount) / b.amount * score_per_budget)
                budget_score += max(0, score_per_budget - penalty)
        adherence = (within_count / len(budgets)) * 100
    else:
        adherence = 0
        budget_score = 15  # Default "neutral" points for not having budgets

    # 4. Goal progress — 15 points
    goals = FinancialGoal.query.filter_by(user_id=user_id).all()
    if goals:
        total_p = sum(min(100, g.to_dict()['progress']) for g in goals)
        avg_progress = total_p / len(goals)
        goal_score = (avg_progress / 100) * 15
    else:
        avg_progress = 0
        goal_score = 10  # Default "on track" points if no goals

    total_score = round(spending_score + savings_score + budget_score + goal_score)
    total_score = max(0, min(100, total_score))

    # Detailed status and tips
    if total_score >= 85:
        status, tip = 'Excellent', 'You are a financial master! Your spending and savings are perfectly balanced.'
    elif total_score >= 70:
        status, tip = 'Good', 'You are doing well. Try setting more ambitious savings goals to reach them faster.'
    elif total_score >= 50:
        status, tip = 'Fair', 'Your finances are stable, but try reducing non-essential spending to boost your savings.'
    elif total_score >= 30:
        status, tip = 'Low', 'Your spending is high relative to your income. Review your budgets to find savings.'
    else:
        status, tip = 'Critical', 'Emergency: Your expenses exceed your income. Immediate budget cuts are recommended.'

    return {
        'score': total_score,
        'status': status,
        'tip': tip,
        'details': {
            'spending_ratio': round(spending_ratio, 1),
            'savings_rate': round(savings_rate, 1),
            'budget_adherence': round(adherence, 1),
            'risk_level': 'Low' if total_score >= 70 else 'Medium' if total_score >= 40 else 'High'
        }
    }
