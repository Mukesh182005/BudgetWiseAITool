# 🚀 BudgetWise AI

BudgetWise AI is a smart, modern, and interactive personal finance management dashboard. Powered by AI, it not only tracks your income and expenses but also provides intelligent categorization, future expense forecasting, and a comprehensive financial health score, all wrapped in a sleek, stunning user interface.

## ✨ Key Features

- **🤖 AI-Powered Categorization:** Automatically categorizes your transactions using NLP keyword matching.
- **📈 Advanced Expense Forecasting:** Predicts your spending for the next 3-6 months using Prophet AI (with a smart fallback to moving averages). Includes trend analysis, volatility checks, and actionable insights.
- **❤️ Financial Health Score:** Calculates a dynamic 0-100 score based on your spending ratio, savings rate, budget adherence, and goal progress. Provides real-time actionable recommendations.
- **📊 Interactive & Dynamic Charts:** 
  - **Spending Trends:** Fluid, animated spline charts showing income vs. expenses with an AI forecast overlay. Switch dynamically between different views.
  - **Weekly Intensity Heatmap:** A beautiful, GitHub-style interactive contribution grid showing your daily spending intensity over the last 12 weeks.
  - **Expense Distribution:** Interactive pie charts displaying category breakdown.
- **💬 Smart Financial Assistant:** Built-in AI chat assistant (powered by Groq / Llama 3) that understands your real-time financial context to answer questions about affordability, budgets, and spending habits safely and securely.
- **🎯 Savings Goals & Budgets:** Track progress towards your financial goals with beautiful circular progress indicators and set category-specific monthly budgets.

## 🛠️ Tech Stack

- **Backend:** Python, Flask, SQLAlchemy, SQLite
- **Frontend:** HTML5, CSS3 (Vanilla, custom UI/UX), JavaScript (ES6+), Plotly.js
- **AI / Data Science:** Prophet (Time Series Forecasting), Groq API (Llama 3 for Chat Assistant), Regular Expressions (Categorization)

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Mukesh182005/BudgetWiseAITool.git
   cd BudgetWiseAITool
   ```

2. **Set up a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(Note: For advanced forecasting, ensure `prophet` and `pandas` are installed. The app works gracefully without them using moving averages.)*

4. **Environment Variables:**
   Create a `.env` file in the root directory and add your Groq API key (optional, for the AI Chat feature):
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```
   *(Note: The app has a smart local fallback engine if no key is provided.)*

5. **Initialize the Database & Run the Application:**
   ```bash
   python app.py
   ```
   *(The app will automatically create the required SQLite database in `instance/budgetwise.db` on first run.)*

   The server will start on `http://127.0.0.1:5000/`.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
